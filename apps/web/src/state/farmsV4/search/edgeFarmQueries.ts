import { ChainId, chainNamesInKebabCase } from '@pancakeswap/chains'
import {
  FarmV4SupportedChainId,
  fetchAllUniversalFarms,
  Protocol,
  supportedChainIdV4,
  UniversalFarmConfig,
} from '@pancakeswap/farms'
import { getCurrencyAddress, Pair } from '@pancakeswap/sdk'
import { InfinityRouter } from '@pancakeswap/smart-router'

import { SORT_ORDER } from '@pancakeswap/uikit'
import uniqBy from '@pancakeswap/utils/uniqBy'
import { computePoolAddress, DEPLOYER_ADDRESSES } from '@pancakeswap/v3-sdk'
import { edgeQueries } from 'quoter/utils/edgePoolQueries'
import { getEdgeChainName } from 'quoter/utils/edgeQueries.util'
import { explorerApiClient } from 'state/info/api/client'
import { Address } from 'viem/accounts'
import { erc20Abi } from 'viem'
import chunk from '@pancakeswap/utils/chunk'
import { publicClient } from 'utils/viem'
import { FarmInfo, normalizeAddress, safeGetAddress } from './farm.util'

const DEFAULT_PROTOCOLS: Protocol[] = Object.values(Protocol)
export interface FarmQuery {
  keywords?: string
  chains: FarmV4SupportedChainId[]
  protocols: Protocol[]
  sortBy: string
  sortOrder?: SORT_ORDER
  activeChainId?: ChainId
  symbols?: string[]
  tokens?: string[]
  page?: number
  abort?: boolean
}

function getPoolId(farm: UniversalFarmConfig) {
  if (farm.protocol === 'v3') {
    const deployerAddress = DEPLOYER_ADDRESSES[farm.chainId]
    const id = computePoolAddress({
      deployerAddress: deployerAddress as Address,
      tokenA: farm.token0.wrapped,
      tokenB: farm.token1.wrapped,
      fee: farm.feeAmount,
    })
    return id
  }
  if (farm.protocol === 'v2') {
    const id = Pair.getAddress(farm.token0.wrapped, farm.token1.wrapped)
    return id
  }
  if (farm.protocol === 'stable') {
    return farm.stableSwapAddress
  }
  if (farm.protocol === 'infinityCl' || farm.protocol === 'infinityBin' || farm.protocol === 'infinityStable') {
    return farm.poolId
  }
  throw new Error(`Unsupported protocol: ${farm.protocol}`)
}

export type ChainNameKebab = (typeof chainNamesInKebabCase)[keyof typeof chainNamesInKebabCase]

async function fetchExplorerFarmPools(query: FarmQuery, signal?: AbortSignal) {
  const { protocols, chains } = query
  const chainIds = chains.length > 0 ? chains : supportedChainIdV4
  const chainNames = chainIds.map((chainId) => getEdgeChainName(chainId))

  // NOTE: Infinity Stable is not supported in the farming API yet
  const farmSupportedProtocols = (protocols.length > 0 ? protocols : DEFAULT_PROTOCOLS).filter(
    (p) => p !== Protocol.InfinitySTABLE,
  )

  const resp = await explorerApiClient.GET('/cached/pools/farming', {
    params: {
      query: {
        protocols: farmSupportedProtocols,
        chains: chainNames,
      },
    },
    headers: {
      EXPLORER_API_KEY: process.env.EXPLORER_API_KEY,
    },
    signal,
  })

  return (resp.data || []) as InfinityRouter.RemotePoolBase[]
}

function toRemotePool(farm: UniversalFarmConfig) {
  const { token0, token1 } = farm
  const poolBase: InfinityRouter.RemotePoolBase = {
    id: getPoolId(farm),
    chainId: farm.chainId,
    tvlUSD: '0',
    apr24h: '0',
    volumeUSD24h: '0',
    protocol: farm.protocol,
    token0: {
      id: getCurrencyAddress(token0),
      decimals: farm.token0.decimals,
      symbol: farm.token0.symbol,
    },
    token1: {
      id: getCurrencyAddress(token1),
      decimals: farm.token1.decimals,
      symbol: farm.token1.symbol,
    },
    // @ts-ignore
    feeTier: farm.feeAmount,
  }
  if (farm.protocol === 'v2') {
    return poolBase as InfinityRouter.RemotePoolV2
  }
  if (farm.protocol === 'v3') {
    return {
      ...poolBase,
      feeTier: farm.feeAmount,
    } as InfinityRouter.RemotePoolV3
  }

  return poolBase
}

async function mergePromiseList<T>(promises: Promise<T[]>[]): Promise<T[]> {
  const results = await Promise.allSettled(promises)
  return results.flatMap((r) => {
    if (r.status === 'fulfilled') return r.value
    return []
  })
}

async function fetchFarms(query: FarmQuery, extend: boolean, signal?: AbortSignal) {
  const { protocols: _protocols, tokens, symbols, chains, sortBy } = query
  const protocols = _protocols.length > 0 ? _protocols : DEFAULT_PROTOCOLS
  const chainIds = chains.length > 0 ? chains : supportedChainIdV4

  if (!extend) {
    return mergePromiseList([fetchExplorerFarmPools(query, signal), fetchAllExplorerPools(query, signal)])
  }

  if (tokens && tokens.length > 0) {
    const byTokenAddress = fetchAllExplorerPoolsByAddress(query, true, signal)
    const byPoolAddress = fetchAllExplorerPoolsByAddress(query, false, signal)
    return mergePromiseList([byTokenAddress, byPoolAddress])
  }

  if (symbols && symbols.length > 0) {
    return fetchAllExplorerPoolsBySymbols(Array.from(chainIds), symbols, protocols, sortBy, signal)
  }
  return fetchAllExplorerPools(query, signal)
}

async function queryFarms(query: FarmQuery, extend: boolean, signal?: AbortSignal) {
  try {
    const [pools, universalFarms] = await Promise.all([fetchFarms(query, extend, signal), fetchAllUniversalFarms()])

    const farmMaps = universalFarms.reduce((acc, farm) => {
      const id = getPoolId(farm)
      return {
        ...acc,
        [`${farm.chainId}:${id}`]: {
          pid: farm.pid,
          lpAddress: safeGetAddress(farm.lpAddress),
        },
      }
    }, {} as Record<Address, number | undefined>)
    const universalFarmPools = universalFarms.map((x) => toRemotePool(x))

    const all = (extend ? [...pools] : [...pools, ...universalFarmPools])
      .map(normalizeAddress)
      .filter((x) => x) as InfinityRouter.RemotePoolBase[]

    const allPools = uniqBy(all, (p) => `${p.chainId}:${p.id}`)
      .map((pool) => {
        const parsedPool = InfinityRouter.parseRemotePool(pool as InfinityRouter.RemotePool)
        if (!parsedPool) {
          return null
        }

        const farmInfo = farmMaps[`${pool.chainId}:${pool.id}`]
        const pid = farmInfo ? farmInfo.pid : undefined
        const lpAddress = farmInfo ? farmInfo.lpAddress : undefined
        return {
          pool: parsedPool,
          id: pool.id,
          chainId: pool.chainId,
          protocol: pool.protocol,
          tvlUSD: pool.tvlUSD || '0',
          vol24hUsd: pool.volumeUSD24h || '0',
          pid,
          apr24h: Number(pool.apr24h || 0),
          isDynamicFee: pool.isDynamicFee,
          feeTier: pool.feeTier,
          lpAddress: lpAddress || pool.id,
        } as FarmInfo
      })
      .filter((x) => x) as FarmInfo[]
    return allPools
  } catch (ex) {
    console.warn('Error fetching farms:', ex)
    return []
  }
}

function getOrder(sortBy?: FarmQuery['sortBy']): 'tvlUSD' | 'volumeUSD24h' {
  if (sortBy === 'tvlUsd') {
    return 'tvlUSD'
  }
  if (sortBy === 'vol24hUsd') {
    return 'volumeUSD24h'
  }
  return 'volumeUSD24h'
}

async function fetchAllExplorerPools(query: FarmQuery, signal?: AbortSignal) {
  const { protocols, chains, sortBy } = query
  const chainIds = chains.length > 0 ? chains : supportedChainIdV4
  const filteredProtocols = (protocols.length > 0 ? protocols : DEFAULT_PROTOCOLS).filter(
    (p) => p !== Protocol.InfinitySTABLE,
  )
  const poolQuery = {
    baseUrl: `${process.env.NEXT_PUBLIC_EXPLORE_API_ENDPOINT}/cached/pools/list`,
    protocols: filteredProtocols,
    chains: chainIds.map((chain) => getEdgeChainName(chain as ChainId)),
    maxPages: 3,
    orderBy: getOrder(sortBy),
    signal,
  }
  const pools = await edgeQueries.fetchAllPools(poolQuery)
  return pools.map(normalizeAddress).filter((x) => x) as InfinityRouter.RemotePoolBase[]
}

async function fetchAllExplorerPoolsByAddress(query: FarmQuery, isPool: boolean = false, signal?: AbortSignal) {
  const { protocols, chains, tokens, sortBy } = query
  const chainIds = chains.length > 0 ? chains : supportedChainIdV4
  const protocolList = (protocols.length > 0 ? protocols : DEFAULT_PROTOCOLS).filter(
    (p) => p !== Protocol.InfinitySTABLE,
  )

  if (!protocolList.length) return []
  const baseUrl = `${process.env.NEXT_PUBLIC_EXPLORE_API_ENDPOINT}/cached/pools/list`
  const chainNames = chainIds.map((chain) => getEdgeChainName(chain as ChainId))

  if (!tokens || !tokens.length) return []

  const chunks = chunk(tokens, 20)
  const allPools = await mergePromiseList(
    chunks.map((addrChunk) => {
      return edgeQueries.fetchAllPools({
        baseUrl,
        protocols: protocolList as Array<'v2' | 'v3' | 'stable' | 'infinityBin' | 'infinityCl' | 'infinityStable'>,
        chains: chainNames,
        pools: isPool ? addrChunk : undefined,
        tokens: !isPool ? addrChunk : undefined,
        maxPages: 1,
        orderBy: getOrder(sortBy),
        signal,
      })
    }),
  )
  return allPools
    .flat()
    .map(normalizeAddress)
    .filter((x) => x) as InfinityRouter.RemotePoolBase[]
}

async function fetchAllExplorerPoolsBySymbols(
  chains: FarmV4SupportedChainId[],
  symbols: string[],
  protocols: Protocol[],
  sortBy?: FarmQuery['sortBy'],
  signal?: AbortSignal,
) {
  const filteredProtocols = protocols.filter((p) => p !== Protocol.InfinitySTABLE)
  if (!filteredProtocols.length) return []
  if (!symbols.length) return []

  const baseUrl = `${process.env.NEXT_PUBLIC_EXPLORE_API_ENDPOINT}/cached/pools/list`
  const chainNames = chains.map((chain) => getEdgeChainName(chain as ChainId))

  const chunks = chunk(symbols, 20)
  const allPools = await mergePromiseList(
    chunks.map((symbolChunk) => {
      return edgeQueries.fetchAllPools({
        baseUrl,
        protocols: filteredProtocols,
        chains: chainNames,
        symbols: symbolChunk,
        maxPages: 3,
        orderBy: getOrder(sortBy),
        signal,
      })
    }),
  )

  return allPools
    .flat()
    .map(normalizeAddress)
    .filter((x) => x) as InfinityRouter.RemotePoolBase[]
}

export default {
  queryFarms,
}
