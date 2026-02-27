import { infinityPoolTvlSelector } from '../../v3-router/providers'
import {
  InfinityBinPool,
  InfinityClPool,
  InfinityPoolWithTvl,
  InfinityStablePool,
  PoolType,
} from '../../v3-router/types'
import { GetInfinityCandidatePoolsParams } from '../types'
import { fillPoolsWithBins, getInfinityBinCandidatePoolsWithoutBins } from './getInfinityBinPools'
import { fillClPoolsWithTicks, getInfinityClCandidatePoolsWithoutTicks } from './getInfinityClPools'
import { getInfinityPoolTvl } from './getPoolTvl'

export const getInfinityCandidatePools = async (params: GetInfinityCandidatePoolsParams) => {
  const pools = await getInfinityCandidatePoolsLite(params)
  const clPools = pools.filter((pool) => pool.type === PoolType.InfinityCL) as InfinityClPool[]
  const binPools = pools.filter((pool) => pool.type === PoolType.InfinityBIN) as InfinityBinPool[]

  const [poolWithTicks, poolWithBins] = await Promise.all([
    fillClPoolsWithTicks({
      pools: clPools,
      clientProvider: params.clientProvider,
      gasLimit: params.gasLimit,
    }),
    fillPoolsWithBins({
      pools: binPools,
      clientProvider: params.clientProvider,
      gasLimit: params.gasLimit,
    }),
  ])
  return [...poolWithTicks, ...poolWithBins]
}

async function fetchPoolsOnChain(params: GetInfinityCandidatePoolsParams) {
  const [clPools, binPools] = await Promise.all([
    getInfinityClCandidatePoolsWithoutTicks(params),
    getInfinityBinCandidatePoolsWithoutBins(params),
  ])

  const pools = [...clPools, ...binPools]
  const poolsWithTvl: InfinityPoolWithTvl[] = pools.map((pool) => {
    return {
      ...pool,
      tvlUSD: params.tvlRefMap ? getInfinityPoolTvl(params.tvlRefMap, pool.id) : 0n,
    } as InfinityPoolWithTvl
  })
  return poolsWithTvl
}

export const getInfinityCandidatePoolsLite = async (
  params: GetInfinityCandidatePoolsParams,
): Promise<(InfinityClPool | InfinityBinPool)[]> => {
  const pools = await fetchPoolsOnChain(params)

  const filtered = infinityPoolTvlSelector(params.currencyA, params.currencyB, pools)

  return filtered as (InfinityClPool | InfinityBinPool)[]
}
