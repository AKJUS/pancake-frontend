import { ChainId, getChainName } from '@pancakeswap/chains'
import { findHookByAddress, type HookData, hooksList } from '@pancakeswap/infinity-sdk'
import {
  InfinityBinPool,
  InfinityClPool,
  InfinityPoolWithTvl,
  InfinityRouter,
  Pool,
  PoolType,
  SmartRouter,
  StablePoolWithTvl,
  V2PoolWithTvl,
  V3Pool,
  V3PoolWithTvl,
} from '@pancakeswap/smart-router'

import {
  RemotePoolBase,
  RemotePoolBIN,
  RemotePoolCL,
} from '@pancakeswap/smart-router/dist/evm/infinity-router/queries/remotePool.type'
import { createAsyncCallWithFallbacks } from '@pancakeswap/utils/withFallback'
import { viemServerClients } from 'utils/viem.server'
import { v3Clients } from 'utils/graphql'
import { mockCurrency } from 'utils/mockCurrency'
import { Address } from 'viem/accounts'
import { isInfinityStableSupported } from '@pancakeswap/infinity-stable-sdk'
import { APIChain, getProvider, Protocol } from './edgeQueries.util'

async function getHooksMap(type: 'light' | 'full', poolWithHooks: (RemotePoolCL | RemotePoolBIN)[], chainId: ChainId) {
  const hooks = await Promise.all(
    poolWithHooks.map(async (pool) => {
      const { hookAddress } = pool
      if (!hookAddress) {
        return { hook: null, hookAddress }
      }

      try {
        const hook = await findHookByAddress({
          poolId: pool.id,
          publicClient: viemServerClients[chainId],
          chainId: chainId as keyof typeof hooksList,
          poolType: pool.protocol === 'infinityBin' ? 'Bin' : 'CL',
          hookAddress: pool.hookAddress || undefined,
        })
        return { hook, hookAddress }
      } catch (ex) {
        const reason = ex instanceof Error ? ex.message : String(ex)
        console.error(`[Hook Fetch Error]`, reason)

        return {
          hook: null,
          hookAddress,
        }
      }
    }),
  )
  const hooksMap = hooks
    .filter((x) => x && x.hookAddress && x.hook)
    .reduce((acc, { hook, hookAddress }) => {
      if (hookAddress != null) {
        // eslint-disable-next-line no-param-reassign
        acc[hookAddress] = hook as HookData
      }
      return acc
    }, {} as Record<string, HookData>)
  return hooksMap
}

async function getInfinityPoolsFromApi(addressA: Address, addressB: Address, chainId: ChainId, type: 'full' | 'light') {
  const chain = getChainName(chainId)
  const url = `${process.env.NEXT_PUBLIC_EXPLORE_API_ENDPOINT}/cached/pools/candidates/infinity/${chain}/${addressA}/${addressB}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Error fetching infinity pools: ${url} ${response.statusText}`)
  }
  const data = (await response.json()) as (RemotePoolCL | RemotePoolBIN)[]

  const hooksMap = await getHooksMap(type, data, chainId)

  const localPools = data
    .map((pool) => InfinityRouter.toLocalInfinityPool(pool, chainId as keyof typeof hooksList, hooksMap))
    .filter((x) => x) as InfinityPoolWithTvl[]

  const [currencyA, currencyB] = await Promise.all([
    mockCurrency(addressA, chainId, getProvider()),
    mockCurrency(addressB, chainId, getProvider()),
  ])

  // Filter pools by TVL, and return Pools omitted tvlUSD field
  const filtered = SmartRouter.infinityPoolTvlSelector(currencyA, currencyB, localPools)
  return filtered
}

async function fillTicksAndBins(pools: (InfinityClPool | InfinityBinPool)[]) {
  const clPools = pools.filter((pool) => pool.type === PoolType.InfinityCL) as InfinityClPool[]
  const binPools = pools.filter((pool) => pool.type === PoolType.InfinityBIN) as InfinityBinPool[]

  const [poolWithTicks, poolWithBins] = await Promise.all([
    InfinityRouter.fillClPoolsWithTicks({
      pools: clPools,
      clientProvider: getProvider(),
    }),
    InfinityRouter.fillPoolsWithBins({
      pools: binPools,
      clientProvider: getProvider(),
    }),
  ])
  return [...poolWithTicks, ...poolWithBins]
}

const fetchInfinityPoolsLight = async (
  addressA: Address,
  addressB: Address,
  chainId: ChainId,
  type: 'full' | 'light',
) => {
  const call = createAsyncCallWithFallbacks(getInfinityPoolsFromApi, {
    fallbacks: [getInfinityPoolsOnChain],
    fallbackTimeout: 5_000,
  })
  return call(addressA, addressB, chainId, type)
}
const fetchInfinityPools = async (addressA: Address, addressB: Address, chainId: ChainId, type: 'full' | 'light') => {
  const pools = await fetchInfinityPoolsLight(addressA, addressB, chainId, type)

  return fillTicksAndBins(pools as (InfinityClPool | InfinityBinPool)[])
}

const getInfinityPoolsOnChain = async (addressA: Address, addressB: Address, chainId: ChainId) => {
  const [currencyA, currencyB] = await Promise.all([
    mockCurrency(addressA, chainId, getProvider()),
    mockCurrency(addressB, chainId, getProvider()),
  ])
  const chain = getChainName(chainId)
  const tvlMap = await poolTvlMap(['infinityBin', 'infinityCl'], chain as APIChain)
  const ref: InfinityRouter.InfinityPoolTvlReferenceMap = {}
  Object.entries(tvlMap).forEach(([id, tvlUSD]) => {
    ref[id] = {
      tvlUSD: BigInt(Math.floor(Number(tvlUSD))),
      tvlRef: id,
    }
  })

  const pools = await InfinityRouter.getInfinityCandidatePoolsLite({
    currencyA,
    currencyB,
    clientProvider: getProvider(),
    tvlRefMap: ref,
  })
  return pools
}

const fetchV2Pools = async (addressA: Address, addressB: Address, chainId: ChainId) => {
  const [currencyA, currencyB] = await Promise.all([
    mockCurrency(addressA, chainId, getProvider()),
    mockCurrency(addressB, chainId, getProvider()),
  ])

  const pools = await SmartRouter.getV2CandidatePools({
    currencyA,
    currencyB,
    onChainProvider: getProvider(),
    v3SubgraphProvider: ({ chainId }) => (chainId ? v3Clients[chainId] : undefined),
  })
  return pools
}

const fetchV3Pools = async (addressA: Address, addressB: Address, chainId: ChainId) => {
  const [currencyA, currencyB] = await Promise.all([
    mockCurrency(addressA, chainId, getProvider()),
    mockCurrency(addressB, chainId, getProvider()),
  ])

  const pools = await InfinityRouter.getV3CandidatePools({
    currencyA,
    currencyB,
    clientProvider: getProvider(),
  })

  return pools
}

const fetchV3PoolsWithoutTicks = async (addressA: Address, addressB: Address, chainId: ChainId) => {
  const [currencyA, currencyB] = await Promise.all([
    mockCurrency(addressA, chainId, getProvider()),
    mockCurrency(addressB, chainId, getProvider()),
  ])
  const client = getProvider()
  const blockNumber = await client({ chainId })?.getBlockNumber()

  const pools = await SmartRouter.getV3CandidatePools({
    currencyA,
    currencyB,
    subgraphProvider: ({ chainId }) => (chainId ? v3Clients[chainId] : undefined),
    onChainProvider: getProvider(),
    blockNumber,
  })

  return pools as V3Pool[]
}

const fetchSSPool = async (addressA: Address, addressB: Address, chainId: ChainId) => {
  const [currencyA, currencyB] = await Promise.all([
    mockCurrency(addressA, chainId, getProvider()),
    mockCurrency(addressB, chainId, getProvider()),
  ])
  const client = getProvider()
  const blockNumber = await client({ chainId })?.getBlockNumber()

  return SmartRouter.getStableCandidatePools({
    currencyA,
    currencyB,
    onChainProvider: getProvider(),
    blockNumber,
  })
}

const fetchInfinityStablePools = async (addressA: Address, addressB: Address, chainId: ChainId) => {
  if (!isInfinityStableSupported(chainId)) {
    console.warn('Infinity Stable not supported on chain', chainId)
    return []
  }

  try {
    const [currencyA, currencyB] = await Promise.all([
      mockCurrency(addressA, chainId, getProvider()),
      mockCurrency(addressB, chainId, getProvider()),
    ])

    const pools = await InfinityRouter.getInfinityStableCandidatePools({
      currencyA,
      currencyB,
      clientProvider: getProvider(),
    })

    return pools
  } catch (error) {
    // Return empty array on unsupported chains or missing client
    console.warn('Failed to fetch Infinity Stable pools:', error)
    return []
  }
}

const querySingleType = async (
  chainId: ChainId,
  protocol: Protocol,
  addressA: Address,
  addressB: Address,
  type: 'full' | 'light',
) => {
  switch (protocol) {
    case 'v2': {
      return fetchV2Pools(addressA, addressB, chainId)
    }
    case 'stable': {
      return fetchSSPool(addressA, addressB, chainId)
    }
    case 'v3': {
      return fetchV3Pools(addressA, addressB, chainId)
    }
    case 'infinityBin':
    case 'infinityCl': {
      return fetchInfinityPools(addressA, addressB, chainId, type)
    }
    case 'infinityStable': {
      return fetchInfinityStablePools(addressA, addressB, chainId)
    }
    default:
      throw new Error('invalid pool')
  }
}

const querySingleTypeLite = async (
  chainId: ChainId,
  protocol: Protocol,
  addressA: Address,
  addressB: Address,
  type: 'full' | 'light',
) => {
  switch (protocol) {
    case 'v2': {
      return fetchV2Pools(addressA, addressB, chainId)
    }
    case 'stable': {
      return fetchSSPool(addressA, addressB, chainId)
    }
    case 'v3': {
      return fetchV3PoolsWithoutTicks(addressA, addressB, chainId)
    }
    case 'infinityBin':
    case 'infinityCl': {
      return fetchInfinityPoolsLight(addressA, addressB, chainId, type)
    }
    case 'infinityStable': {
      return fetchInfinityStablePools(addressA, addressB, chainId)
    }
    default:
      throw new Error('invalid pool')
  }
}
const fetchAllCandidatePools = async (
  addressA: Address,
  addressB: Address,
  chainId: ChainId,
  protocols: Protocol[],
) => {
  const queries = await Promise.all(
    protocols
      .filter((x) => x !== 'infinityBin') // For infinity pools fetch together
      .map((protocol) => querySingleType(chainId, protocol as Protocol, addressA, addressB, 'full')),
  )
  const pools = queries.flat() as (InfinityPoolWithTvl | V2PoolWithTvl | V3PoolWithTvl | StablePoolWithTvl)[]
  return pools.map((pool) => {
    return SmartRouter.Transformer.serializePool(pool as Pool)
  })
}

const fetchAllCandidatePoolsLite = async (
  addressA: Address,
  addressB: Address,
  chainId: ChainId,
  protocols: Protocol[],
) => {
  const queries = await Promise.all(
    protocols
      .filter((x) => x !== 'infinityBin')
      .map((protocol) => querySingleTypeLite(chainId, protocol as Protocol, addressA, addressB, 'light')),
  )
  const pools = queries.flat() as (InfinityPoolWithTvl | V2PoolWithTvl | V3Pool | V3PoolWithTvl | StablePoolWithTvl)[]
  return pools.map((pool) => {
    return SmartRouter.Transformer.serializePool(pool as Pool)
  })
}

export const poolTvlMap = async (protocols: Protocol[], chain: APIChain) => {
  try {
    const remotePools = await fetchAllPools({
      baseUrl: `${process.env.NEXT_PUBLIC_EXPLORE_API_ENDPOINT}/cached/pools/tvl-refs`,
      protocols,
      chains: [chain],
      orderBy: 'tvlUSD',
      pageSize: 1000,
    })
    const tvlMap: Record<`0x${string}`, string> = {}
    for (const pool of remotePools) {
      const { tvlUSD } = pool
      const { id } = pool
      tvlMap[id] = tvlUSD
    }
    return tvlMap
  } catch (ex) {
    return {}
  }
}

type PaginatedResponse = {
  startCursor?: string
  endCursor?: string
  hasNextPage: boolean
  hasPrevPage: boolean
  rows: RemotePoolBase[]
}

type FetchAllPoolsParams = {
  baseUrl: string
  orderBy?: 'tvlUSD' | 'volumeUSD24h' | 'apr24h'
  protocols: Array<'v2' | 'v3' | 'infinityBin' | 'infinityCl' | 'stable' | 'infinityStable'>
  signal?: AbortSignal
  chains: Array<
    | 'bsc'
    | 'bsc-testnet'
    | 'ethereum'
    | 'base'
    | 'opbnb'
    | 'zksync'
    | 'polygon-zkevm'
    | 'linea'
    | 'arbitrum'
    | 'sol'
    | 'monad'
  >
  pools?: string[]
  tokens?: string[]
  symbols?: string[]
  pageSize?: number
  maxPages?: number // Optional safety limit for maximum pages to fetch
}

/**
 * Fetches all data from a paginated API endpoint
 * @param params Configuration parameters for the fetch operation
 * @returns Promise resolving to an array of all pools
 */
async function fetchAllPools({
  baseUrl,
  orderBy = 'tvlUSD',
  protocols,
  chains,
  pools = [],
  tokens = [],
  symbols = [],
  pageSize = 100,
  maxPages = Infinity,
  signal,
}: FetchAllPoolsParams): Promise<RemotePoolBase[]> {
  const allResults: RemotePoolBase[] = []
  let cursor: string | null = null
  let hasNextPage = true
  let pageCount = 0

  // Construct the base URL params
  const buildUrlParams = (after?: string) => {
    const params = new URLSearchParams()

    // Add required parameters
    params.append('orderBy', orderBy)

    // Add protocols
    protocols.forEach((protocol) => {
      params.append('protocols', protocol)
    })

    // Add chains if tokens are not specified
    chains.forEach((chain) => {
      params.append('chains', chain)
    })

    // Add pools if specified
    pools.forEach((pool) => {
      params.append('pools', pool)
    })

    // Add tokens if specified
    tokens.forEach((token) => {
      params.append('tokens', token)
    })

    symbols.forEach((symbol) => {
      params.append('tokenSymbols', symbol)
    })

    // Add pagination parameters
    if (after) {
      params.append('after', after)
    }

    // Add page size
    params.append('limit', pageSize.toString())

    return params.toString()
  }

  while (hasNextPage && pageCount < maxPages) {
    const url = `${baseUrl}?${buildUrlParams(cursor || undefined)}`

    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await fetch(url, {
        headers: {
          ...(typeof window === 'undefined' ? { 'x-api-key': process.env.EXPLORER_API_KEY || '' } : {}),
          'Content-Type': 'application/json',
        },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      // eslint-disable-next-line no-await-in-loop
      const data: PaginatedResponse = await response.json()

      // Add the current page of results
      allResults.push(...data.rows)

      // Update for next iteration
      const { hasNextPage: hasNext, endCursor } = data
      hasNextPage = hasNext
      cursor = endCursor || null
      pageCount++
    } catch (error) {
      console.error('Error fetching data:', error)
      // If it's a timeout error, return empty results instead of throwing
      if (error instanceof Error && error.name === 'TimeoutError') {
        console.warn('Request timed out, returning empty results')
        break
      }
      throw error
    }
  }

  if (pageCount >= maxPages && hasNextPage) {
    console.warn(`Reached maximum page limit of ${maxPages}. Some data may not have been fetched.`)
  }

  return allResults
}

export const edgeQueries = {
  fetchAllCandidatePools,
  fetchAllCandidatePoolsLite,
  fetchAllPools,
  fetchV2Pools,
  fetchV3Pools,
  fetchV3PoolsWithoutTicks,
  fetchSSPool,
  fetchInfinityStablePools,
  fetchInfinityPools,
  fetchInfinityPoolsLight,
  getInfinityPoolsOnChain,
  getInfinityPoolsFromApi,
  fillTicksAndBins,
  querySingleType,
  querySingleTypeLite,
  poolTvlMap,
}
