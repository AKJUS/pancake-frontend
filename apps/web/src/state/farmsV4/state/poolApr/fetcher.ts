import { Protocol, supportedChainIdV4, merklSupportedChainId } from '@pancakeswap/farms'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { masterChefV3ABI, pancakeV3PoolABI } from '@pancakeswap/v3-sdk'
import { create, windowedFiniteBatchScheduler } from '@yornaath/batshit'
import BigNumber from 'bignumber.js'
import { SECONDS_PER_YEAR } from 'config'
import { v2BCakeWrapperABI } from 'config/abi/v2BCakeWrapper'
import { InfinityProtocol, NonInfinityProtocol } from 'config/constants/protocols'
import dayjs from 'dayjs'
import groupBy from 'lodash/groupBy'
import set from 'lodash/set'
import { chainIdToExplorerInfoChainName, explorerApiClient } from 'state/info/api/client'
import { safeGetAddress } from 'utils/safeGetAddress'
import { usdPriceBatcher } from 'utils/batcher'
import { getMasterChefV3Contract } from 'utils/contractHelpers'
import { isInfinityProtocol } from 'utils/protocols'
import { publicClient } from 'utils/wagmi'
import { erc20Abi } from 'viem'

import { ChainId, isEvm } from '@pancakeswap/chains'
import { INCENTRA_API, IncentraCampaign } from 'hooks/useIncentra'
import { ChainIdAddressKey, InfinityPoolInfo, PoolInfo, StablePoolInfo, V2PoolInfo, V3PoolInfo } from '../type'
import { AprValue, CakeApr, IncentraApr, MerklApr } from './atom'

export const getCakeApr = (pool: PoolInfo, cakePrice: BigNumber): Promise<CakeApr> => {
  switch (pool.protocol) {
    case 'v3':
      return v3PoolCakeAprBatcher.fetch({ pool, cakePrice })
    case 'v2':
    case 'stable':
      return v2PoolCakeAprBatcher.fetch({ pool, cakePrice })
    default:
      return Promise.resolve({
        [`${pool.chainId}:${pool.lpAddress}`]: {
          value: '0' as const,
        },
      })
  }
}

// @todo @ChefJerry should directly fetch from poolInfo api, BE need update
export const getLpApr = async (
  pool: {
    protocol: Protocol
    chainId: ChainId
    lpAddress?: `0x${string}`
    poolId?: `0x${string}`
  },
  apr24h: boolean = false,
  signal?: AbortSignal,
): Promise<number> => {
  const { protocol } = pool
  const chainName = chainIdToExplorerInfoChainName[pool.chainId]

  const resp = await explorerApiClient.GET(
    isInfinityProtocol(protocol)
      ? `/cached/pools/apr/${protocol as InfinityProtocol}/{chainName}/{id}`
      : `/cached/pools/apr/${protocol as NonInfinityProtocol}/{chainName}/{address}`,
    {
      signal,
      params: {
        path: {
          address: pool.lpAddress,
          chainName,
          id: (pool as InfinityPoolInfo).poolId,
        },
      },
    },
  )
  if (!resp.data) {
    return 0
  }

  if (apr24h) {
    return 'apr24h' in resp.data && resp.data.apr24h ? parseFloat(resp.data.apr24h) : 0
  }
  return resp.data.apr7d ? parseFloat(resp.data.apr7d) : 0
}

const masterChefV3CacheMap = new Map<
  number,
  {
    totalAllocPoint: bigint
    latestPeriodCakePerSecond: bigint
  }
>()

const calcV3PoolApr = ({
  pool,
  cakePrice,
  totalAllocPoint,
  latestPeriodCakePerSecond,
  poolInfo,
  liquidity,
}: {
  pool: V3PoolInfo
  cakePrice: BigNumber
  totalAllocPoint: bigint
  latestPeriodCakePerSecond: bigint
  poolInfo: readonly [bigint, `0x${string}`, `0x${string}`, `0x${string}`, number, bigint, bigint]
  liquidity: bigint
}) => {
  const cakePerYear = new BigNumber(SECONDS_PER_YEAR)
    .times(latestPeriodCakePerSecond.toString())
    .dividedBy(1e18)
    .dividedBy(1e12)
  const cakePerYearUsd = cakePrice.times(cakePerYear.toString())
  const [allocPoint, , , , , totalLiquidity, totalBoostLiquidity] = poolInfo
  const poolWeight = new BigNumber(allocPoint.toString()).dividedBy(totalAllocPoint.toString())
  const liquidityBooster =
    Number(totalLiquidity) === 0
      ? BIG_ZERO
      : new BigNumber(totalBoostLiquidity.toString()).dividedBy(totalLiquidity.toString())
  // @fixme @ChefJerry use batched https://farms-api.pancakeswap.com/v3/{chainId}/liquidity/{lp}
  // to calculate active pool TVL
  const poolTvlUsd = new BigNumber(pool.tvlUsd ?? 0)

  const baseApr =
    liquidityBooster.isZero() || poolTvlUsd.isZero()
      ? BIG_ZERO
      : cakePerYearUsd.times(poolWeight).dividedBy(liquidityBooster.times(poolTvlUsd ?? 1))

  return {
    value: liquidity > 0n ? (baseApr.toString() as `${number}`) : '0',
    cakePerYear,
    poolWeight,
  }
}

export const getMerklApr = async (result: any, chainId: number) => {
  try {
    const opportunities = result?.filter((opportunity) => opportunity?.chainId === chainId)
    if (!opportunities || opportunities?.length === 0) return {}
    return opportunities.reduce((acc: MerklApr, opportunity) => {
      const poolId = safeGetAddress(opportunity.identifier)
      if (poolId) {
        const key: ChainIdAddressKey = `${chainId}:${poolId}`

        // eslint-disable-next-line no-param-reassign
        acc[key] = `${(opportunity.apr ?? 0) / 100}`
      }
      return acc
    }, {})
  } catch (error) {
    console.error('Failed to process merkl apr', error)
    return {}
  }
}

export const getAllNetworkMerklApr = async (signal?: AbortSignal) => {
  const chainIds = supportedChainIdV4.filter((chainId) => merklSupportedChainId.includes(chainId))
  const resp = await fetch(
    `https://api.merkl.xyz/v4/opportunities/?chainId=${chainIds.join(
      ',',
    )}&test=false&mainProtocolId=pancake-swap&action=POOL,HOLD&status=LIVE&items=100`,
    { signal },
  )
  if (resp.ok) {
    const result = await resp.json()
    const pancakeResult = result?.filter(
      (opportunity) =>
        opportunity?.tokens?.[0]?.symbol?.toLowerCase().startsWith('cake-lp') ||
        opportunity?.protocol?.id?.toLowerCase().startsWith('pancake-swap') ||
        opportunity?.protocol?.id?.toLowerCase().startsWith('pancakeswap'),
    )
    const aprs = await Promise.all(chainIds.map((chainId) => getMerklApr(pancakeResult, chainId)))
    return aprs.reduce((acc, apr) => Object.assign(acc, apr), {})
  }
  throw resp
}

export const getAllNetworkIncentraApr = async (signal?: AbortSignal) => {
  const resp = await fetch(`${INCENTRA_API}/liquidityCampaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      campaign_type: [3, 4],
      status: [4], // ACTIVE
    }),
    signal,
  })

  if (!resp.ok) throw resp

  const json = (await resp.json()) as { err: string | null; campaigns: IncentraCampaign[] }
  if (json.err) throw new Error(`Incentra API error: ${json.err}`)

  const evmChains = supportedChainIdV4.filter((chainId) => isEvm(chainId)) as ChainId[]
  const filteredCampaigns = json.campaigns.filter((c) => evmChains.includes(Number(c.chainId) as ChainId))

  const aprs = filteredCampaigns.reduce((acc, campaign) => {
    const poolId = safeGetAddress(campaign.pools.poolId)
    if (poolId) {
      const key: ChainIdAddressKey = `${Number(campaign.chainId)}:${poolId}`
      // eslint-disable-next-line no-param-reassign
      acc[key] = `${campaign.rewardInfo.apr}`
    }
    return acc
  }, {} as IncentraApr)

  return aprs
}

const getV3PoolsCakeAprByChainId = async (pools: V3PoolInfo[], chainId: number, cakePrice: BigNumber) => {
  const masterChefV3 = getMasterChefV3Contract(undefined, chainId)
  const client = publicClient({ chainId })

  if (!masterChefV3 || !client) return {}

  const validPools = pools.filter((pool) => {
    return pool.pid && pool.chainId === chainId && pool.pid > 0
  })

  if (!validPools?.length) return {}

  const [totalAllocPoint, latestPeriodCakePerSecond] = await Promise.all([
    masterChefV3CacheMap.get(chainId)?.totalAllocPoint ?? masterChefV3.read.totalAllocPoint(),
    masterChefV3CacheMap.get(chainId)?.latestPeriodCakePerSecond ?? masterChefV3.read.latestPeriodCakePerSecond(),
  ])

  masterChefV3CacheMap.set(chainId, {
    ...(masterChefV3CacheMap.get(chainId) ?? {}),
    totalAllocPoint,
    latestPeriodCakePerSecond,
  })

  const poolInfoCalls = validPools.map(
    (pool) =>
      ({
        address: masterChefV3.address,
        functionName: 'poolInfo',
        abi: masterChefV3ABI,
        args: [BigInt(pool.pid!)],
      } as const),
  )

  const liquidityCalls = validPools.map((pool) => {
    return {
      address: pool.lpAddress,
      functionName: 'liquidity',
      abi: pancakeV3PoolABI,
    } as const
  })

  const [poolInfos, liquidities] = await Promise.all([
    client.multicall({
      contracts: poolInfoCalls,
      allowFailure: false,
    }),
    client.multicall({
      contracts: liquidityCalls,
      allowFailure: false,
    }),
  ])

  return validPools.reduce((acc, pool, index) => {
    const poolInfo = poolInfos[index]
    if (!poolInfo) return acc
    const key = `${chainId}:${safeGetAddress(pool.lpAddress)}`
    const liquidity = liquidities[index]
    set(
      acc,
      key,
      calcV3PoolApr({
        pool,
        cakePrice,
        totalAllocPoint,
        latestPeriodCakePerSecond,
        poolInfo,
        liquidity,
      }),
    )
    return acc
  }, {} as CakeApr)
}

const getV3PoolsCakeApr = async (queries: { pool: V3PoolInfo; cakePrice: BigNumber }[]): Promise<CakeApr> => {
  const pools = queries.map((query) => query.pool)
  const cakePrice = queries[0]?.cakePrice
  const poolsByChainId = groupBy(pools, 'chainId')
  const aprs = await Promise.all(
    Object.keys(poolsByChainId).map((chainId) =>
      getV3PoolsCakeAprByChainId(poolsByChainId[chainId], Number(chainId), cakePrice),
    ),
  )
  return aprs.reduce((acc, apr) => Object.assign(acc, apr), {})
}

const v3PoolCakeAprBatcher = create<CakeApr, { pool: V3PoolInfo; cakePrice: BigNumber }, CakeApr>({
  fetcher: getV3PoolsCakeApr,
  resolver: (items, query) => {
    const { pool } = query
    const key = `${pool.chainId}:${pool.lpAddress}`
    return { [key]: items[key] }
  },
  scheduler: windowedFiniteBatchScheduler({
    windowMs: 60,
    maxBatchSize: 100,
  }),
})

const calcV2PoolApr = ({
  pool,
  cakePrice,
  cakePerSecond,
  totalBoostShare,
  totalSupply,
  token0PriceUsd,
  token1PriceUsd,
  token0Reserve,
  token1Reserve,
}: {
  pool: V2PoolInfo | StablePoolInfo
  cakePrice: BigNumber
  cakePerSecond: bigint
  totalBoostShare: bigint
  totalSupply: bigint
  token0PriceUsd: number
  token1PriceUsd: number
  token0Reserve: bigint
  token1Reserve: bigint
}) => {
  if (cakePerSecond === 0n) {
    return {
      value: '0',
      cakePerYear: new BigNumber(0),
    }
  }
  const cakePerYear = new BigNumber(SECONDS_PER_YEAR).times(cakePerSecond.toString()).dividedBy(1e18)
  const cakeOneYearUsd = cakePrice.times(cakePerYear.toString())
  const poolTvlUsd = new BigNumber(
    new BigNumber(token0Reserve.toString()).times(token0PriceUsd).div(10 ** pool.token0.decimals),
  ).plus(new BigNumber(token1Reserve.toString()).times(token1PriceUsd).div(10 ** pool.token1.decimals))

  const usdPerShare = poolTvlUsd.div(totalSupply.toString() ?? 1)

  const farmingTVLUsd = usdPerShare.times(totalBoostShare.toString() ?? 0)

  const baseApr = cakeOneYearUsd.dividedBy((farmingTVLUsd ?? 1).toString())

  return {
    value: baseApr.toString() as `${number}`,
    cakePerYear,
    userTvlUsd: farmingTVLUsd,
    totalSupply,
  }
}

const getV2PoolsCakeAprByChainId = async (
  pools: Array<V2PoolInfo | StablePoolInfo>,
  chainId: number,
  cakePrice: BigNumber,
) => {
  const client = publicClient({ chainId })
  const validPools = pools.filter((p) => p.chainId === chainId && p.bCakeWrapperAddress)

  if (!validPools?.length) return {}

  const rewardPerSecondCalls = validPools.map((pool) => {
    return {
      address: pool.bCakeWrapperAddress!,
      functionName: 'rewardPerSecond',
      abi: v2BCakeWrapperABI,
    } as const
  })

  const totalSupplyCalls = validPools.map((pool) => {
    return {
      address: pool.lpAddress!,
      functionName: 'totalSupply',
      abi: erc20Abi,
    } as const
  })

  const reserve0Calls = validPools.map((pool) => {
    return {
      address: pool.token0.wrapped.address,
      functionName: 'balanceOf',
      abi: erc20Abi,
      args: [pool.stableSwapAddress ?? pool.lpAddress],
    } as const
  })
  const reserve1Calls = validPools.map((pool) => {
    return {
      address: pool.token1.wrapped.address,
      functionName: 'balanceOf',
      abi: erc20Abi,
      args: [pool.stableSwapAddress ?? pool.lpAddress],
    } as const
  })

  const totalBoostedShareCalls = validPools.map((pool) => {
    return {
      address: pool.bCakeWrapperAddress!,
      functionName: 'totalBoostedShare',
      abi: v2BCakeWrapperABI,
    } as const
  })

  const endTimestampCalls = validPools.map((pool) => {
    return {
      address: pool.bCakeWrapperAddress!,
      functionName: 'endTimestamp',
      abi: v2BCakeWrapperABI,
    } as const
  })

  const priceCalls = validPools.map(async (pool) => {
    return Promise.all([usdPriceBatcher.fetch(pool.token0), usdPriceBatcher.fetch(pool.token1)])
  })

  const [rewardPerSecondResults, totalBoostedShareResults, totalSupplies, reserve0s, reserve1s, endTimestamps, prices] =
    await Promise.all([
      client.multicall({
        contracts: rewardPerSecondCalls,
        allowFailure: false,
      }),
      client.multicall({
        contracts: totalBoostedShareCalls,
        allowFailure: false,
      }),
      client.multicall({
        contracts: totalSupplyCalls,
        allowFailure: false,
      }),
      client.multicall({
        contracts: reserve0Calls,
        allowFailure: false,
      }),
      client.multicall({
        contracts: reserve1Calls,
        allowFailure: false,
      }),
      client.multicall({
        contracts: endTimestampCalls,
        allowFailure: false,
      }),
      Promise.all(priceCalls),
    ])

  return validPools.reduce((acc, pool, index) => {
    const rewardPerSecond = rewardPerSecondResults[index]
    const totalBoostShare = totalBoostedShareResults[index]
    const endTimestamp = endTimestamps[index]
    const expired = endTimestamp && Number(endTimestamp) < dayjs().unix()
    const [token0PriceUsd, token1PriceUsd] = prices[index]
    const token0Reserve = reserve0s[index]
    const token1Reserve = reserve1s[index]
    if (!rewardPerSecond || expired) return acc
    const key = `${chainId}:${safeGetAddress(pool.lpAddress)}`
    set(
      acc,
      key,
      calcV2PoolApr({
        pool: pool as V2PoolInfo | StablePoolInfo,
        cakePrice,
        cakePerSecond: rewardPerSecond,
        totalBoostShare,
        totalSupply: totalSupplies[index],
        token0PriceUsd,
        token1PriceUsd,
        token0Reserve,
        token1Reserve,
      }),
    )
    return acc
  }, {} as CakeApr)
}
const getV2PoolsCakeApr = async (
  queries: { pool: V2PoolInfo | StablePoolInfo; cakePrice: BigNumber }[],
): Promise<CakeApr> => {
  const pools = queries.map((query) => query.pool)
  const cakePrice = queries[0]?.cakePrice
  const poolsByChainId = groupBy(pools, 'chainId')
  const aprs = await Promise.all(
    Object.keys(poolsByChainId).map((chainId) =>
      getV2PoolsCakeAprByChainId(poolsByChainId[chainId], Number(chainId), cakePrice),
    ),
  )
  return aprs.reduce((acc, apr) => Object.assign(acc, apr), {})
}
const v2PoolCakeAprBatcher = create<CakeApr, { pool: V2PoolInfo | StablePoolInfo; cakePrice: BigNumber }, CakeApr>({
  fetcher: getV2PoolsCakeApr,
  resolver: (items, query) => {
    const { pool } = query
    const key = `${pool.chainId}:${pool.lpAddress}`
    return { [key]: items[key] }
  },
  scheduler: windowedFiniteBatchScheduler({
    windowMs: 60,
    maxBatchSize: 100,
  }),
})
