import { ChainId, UnifiedChainId } from '@pancakeswap/chains'

import { CHAIN_QUERY_NAME } from 'config/chains'

import { multiChainName, multiChainPaths } from './constant'
import { ApiPoolData, InfoDataSource, PoolDataForView } from './types'

// TODO: refactor
// Params should be defined in object for future extension
export function getTokenInfoPath(
  chainId: ChainId | undefined,
  address: string,
  dataSource: InfoDataSource = InfoDataSource.V3,
  stableSwapPath = '',
) {
  return `/info${dataSource === InfoDataSource.V3 ? '/v3' : ''}${
    multiChainPaths[chainId ?? '']
  }/tokens/${address}?chain=${CHAIN_QUERY_NAME[chainId ?? '']}${stableSwapPath.replace('?', '&')}`
}

export const get2DayChange = (valueNow: string, value24HoursAgo: string, value48HoursAgo: string): [number, number] => {
  // get volume info for both 24 hour periods
  const currentChange = parseFloat(valueNow) - parseFloat(value24HoursAgo)
  const previousChange = parseFloat(value24HoursAgo) - parseFloat(value48HoursAgo)
  const adjustedPercentChange = ((currentChange - previousChange) / previousChange) * 100
  if (Number.isNaN(adjustedPercentChange) || !Number.isFinite(adjustedPercentChange)) {
    return [currentChange, 0]
  }
  return [currentChange, adjustedPercentChange]
}

export function transformPoolData(item: ApiPoolData): PoolDataForView {
  return {
    feeTier: item.feeTier,
    address: item.id,
    volumeUSD: parseFloat(item.volumeUSD24h),
    volumeUSDWeek: parseFloat(item.volumeUSD7d),
    token0: { ...item.token0, address: item.token0.id, derivedETH: 0 },
    token1: { ...item.token1, address: item.token1.id, derivedETH: 0 },
    feeUSD: item.totalFeeUSD,
    liquidity: parseFloat(item.liquidity),
    sqrtPrice: parseFloat(item.sqrtPrice),
    tick: item.tick ?? 0,
    tvlUSD: parseFloat(item.tvlUSD),
    token0Price: parseFloat(item.token0Price),
    token1Price: parseFloat(item.token1Price),
    tvlToken0: parseFloat(item.tvlToken0),
    tvlToken1: parseFloat(item.tvlToken1),
    volumeUSDChange: 0,
    tvlUSDChange: 0,
  }
}

export function getMultiChainName(chainId?: UnifiedChainId) {
  return multiChainName[chainId || ChainId.BSC]
}
