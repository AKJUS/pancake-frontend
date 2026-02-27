import { getMainnetChainNameInKebabCase } from '@pancakeswap/chains'
import {
  FarmV4SupportedChainId,
  Protocol,
  UniversalFarmConfigV4,
  fetchAllUniversalFarms,
  masterChefV3Addresses,
  supportedChainIdV4,
} from '@pancakeswap/farms'
import { smartChefABI } from '@pancakeswap/pools'
import { getStableSwapPools } from '@pancakeswap/stable-swap-sdk'
import { FeeAmount, masterChefV3ABI } from '@pancakeswap/v3-sdk'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { explorerApiClient } from 'state/info/api/client'
import { isAddressEqual } from 'utils'
import { isInfinityProtocol } from 'utils/protocols'
import { publicClient } from 'utils/viem'
import { type Address } from 'viem'

import uniqWith from '@pancakeswap/utils/uniqWith'
import { InfinityPoolInfo, PoolInfo } from '../type'
import { parseFarmPools } from '../utils'

dayjs.extend(utc)

export const DEFAULT_PROTOCOLS: Protocol[] = Object.values(Protocol)
export const DEFAULT_CHAINS: FarmV4SupportedChainId[] = Object.values(supportedChainIdV4)

export const fetchExplorerFarmPools = async (
  args: {
    protocols?: Protocol[]
    chainId?: FarmV4SupportedChainId | FarmV4SupportedChainId[]
  } = {
    protocols: DEFAULT_PROTOCOLS,
    chainId: DEFAULT_CHAINS,
  },
  signal?: AbortSignal,
): Promise<PoolInfo[]> => {
  let chains = Array.isArray(args?.chainId) ? args.chainId ?? [] : [args?.chainId]
  chains = chains.filter(Boolean)

  // NOTE: Infinity Stable is not supported in the farming API yet
  const farmSupportedProtocols = (args.protocols ?? DEFAULT_PROTOCOLS).filter((p) => p !== Protocol.InfinitySTABLE)

  try {
    const resp = await explorerApiClient.GET('/cached/pools/farming', {
      signal,
      params: {
        query: {
          protocols: farmSupportedProtocols,
          chains: chains.reduce((requestChainIds, currentChainId) => {
            const chainName = currentChainId ? getMainnetChainNameInKebabCase(currentChainId) : undefined
            if (chainName) {
              requestChainIds.push(chainName)
            }

            return requestChainIds
          }, [] as any[]),
        },
      },
    })

    if (!resp.data) {
      return []
    }

    return parseFarmPools(resp.data, { isFarming: true })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }
    console.log(`ERROR GET /cached/pools/farming:`, error)
    return []
  }

  // TODO: @chef-eric this tvl & vol data is not correct
  // const tvlAndVolume = await fetchTvlVolumeFromSubgraph(resp.data)

  // return parseFarmPools(
  //   resp.data.map((p) => {
  //     const infoFromSubgraph = tvlAndVolume[getPoolKey(p)]
  //     if (!infoFromSubgraph) return p
  //     return {
  //       ...p,
  //       tvlUSD: infoFromSubgraph.tvlUSD,
  //       volumeUSD24h: infoFromSubgraph.volumeUSD24h,
  //     }
  //   }),
  //   { isFarming: true },
  // )
}

export const fetchFarmPools = async (
  args: {
    protocols?: Protocol[]
    chainId?: FarmV4SupportedChainId | FarmV4SupportedChainId[]
  } = {
    protocols: DEFAULT_PROTOCOLS,
    chainId: DEFAULT_CHAINS,
  },
  signal?: AbortSignal,
) => {
  let remotePools: PoolInfo[] | undefined
  try {
    remotePools = await fetchExplorerFarmPools(args, signal)
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw error
      }
    }
    console.error('Failed to fetch remote pools', error)
  }

  const fetchFarmConfig = await fetchAllUniversalFarms()
  const localPools = uniqWith(
    fetchFarmConfig.filter((farm) => {
      return (
        args.protocols?.includes(farm.protocol) &&
        (Array.isArray(args.chainId) ? args.chainId.includes(farm.chainId) : farm.chainId === args.chainId)
      )
    }),
    (a, b) => a.chainId === b.chainId && a.lpAddress === b.lpAddress && a.protocol === b.protocol,
  )
  const remoteMissedPoolsIndex: number[] = []

  const finalPools = await Promise.all(
    localPools.map(async (farm, index) => {
      const pool = remotePools?.find((p) => {
        return (
          p.chainId === farm.chainId &&
          p.protocol === farm.protocol &&
          (isInfinityProtocol(p.protocol)
            ? (p as InfinityPoolInfo).poolId.toLowerCase() === (farm as UniversalFarmConfigV4).poolId.toLowerCase()
            : isAddressEqual(p.lpAddress, farm.lpAddress)) &&
          (p.protocol === Protocol.V3 ? p.pid === farm.pid : true)
        )
      })

      if (pool) {
        return {
          ...pool,
          pid: farm.pid,
          feeTierBase: 1_000_000,
          ...(farm.protocol === 'v2' || farm.protocol === 'stable'
            ? { bCakeWrapperAddress: farm.bCakeWrapperAddress }
            : {}),
        } satisfies PoolInfo
      }

      remoteMissedPoolsIndex.push(index)

      let stablePair
      if (farm.protocol === Protocol.STABLE) {
        const stablePools = await getStableSwapPools(farm.chainId)
        stablePair = stablePools.find((p) => isAddressEqual(p.lpAddress, farm.lpAddress))
      }

      let feeTier = 100
      if (farm.protocol === Protocol.V3) feeTier = Number(farm.feeAmount)
      if (farm.protocol === Protocol.V2) feeTier = FeeAmount.MEDIUM
      if (stablePair) feeTier = stablePair.stableTotalFee * 1_000_000

      return {
        ...farm,
        pid: farm.pid,
        tvlUsd: undefined,
        vol24hUsd: undefined,
        feeTier,
        feeTierBase: 1_000_000,
        isFarming: true,
      } satisfies PoolInfo
    }),
  )

  // fetch ss fee
  // await

  return finalPools
}

export const fetchV3PoolsStatusByChainId = async (chainId: number, pools: { pid?: number }[]) => {
  const masterChefAddress = masterChefV3Addresses[chainId]
  const client = publicClient({ chainId })
  const poolInfoCalls = pools.map(
    (pool) =>
      ({
        functionName: 'poolInfo',
        address: masterChefAddress,
        abi: masterChefV3ABI,
        args: [BigInt(pool.pid!)],
      } as const),
  )

  const resp = await client.multicall({
    contracts: poolInfoCalls,
    allowFailure: false,
  })
  return resp
}

export const fetchPoolsTimeFrame = async (bCakeAddresses: Address[], chainId: number) => {
  if (!bCakeAddresses.length) {
    return []
  }

  const client = publicClient({ chainId })
  const calls = bCakeAddresses.flatMap((address) => {
    return [
      {
        abi: smartChefABI,
        address,
        functionName: 'startTimestamp',
      },
      {
        abi: smartChefABI,
        address,
        functionName: 'endTimestamp',
      },
    ] as const
  })

  const resp = await client.multicall({
    contracts: calls,
    allowFailure: false,
  })

  const poolTimeFrame = resp.reduce<bigint[][]>((acc, item, index) => {
    const chunkIndex = Math.floor(index / 2)
    if (!acc[chunkIndex]) {
      // eslint-disable-next-line no-param-reassign
      acc[chunkIndex] = []
    }
    acc[chunkIndex].push(item)
    return acc
  }, [])

  return bCakeAddresses.map((_, index) => {
    const [startTimestamp, endTimestamp] = poolTimeFrame[index]
    return {
      startTimestamp: Number(startTimestamp),
      endTimestamp: Number(endTimestamp),
    }
  })
}
