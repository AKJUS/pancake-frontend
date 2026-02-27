import { Protocol } from '@pancakeswap/farms'
import { LegacyRouter } from '@pancakeswap/smart-router/legacy-router'
import { NATIVE, WNATIVE, wSolToSol } from '@pancakeswap/sdk'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { getAddInfinityLiquidityURL } from 'config/constants/liquidity'
import type { InfinityPoolInfo, PoolInfo, UnifiedPoolInfo } from 'state/farmsV4/state/type'
import { multiChainPaths } from 'state/info/constant'
import { NonEVMChainId } from '@pancakeswap/chains'

import { addQueryToPath } from './addQueryToPath'
import { isAddressEqual } from './safeGetAddress'
import { currencyId } from './currencyId'

export function getPoolAddLiquidityLink(pool: PoolInfo): string {
  const { chainId, protocol, lpAddress, feeTier } = pool
  const { poolId } = pool as Partial<InfinityPoolInfo>

  if ([Protocol.InfinityBIN, Protocol.InfinityCLAMM].includes(protocol)) {
    const href = getAddInfinityLiquidityURL({ chainId, poolId: poolId || lpAddress })
    return addQueryToPath(href, { chain: CHAIN_QUERY_NAME[chainId], [PERSIST_CHAIN_KEY]: '1' })
  }

  const token0 = isAddressEqual(pool.token0?.wrapped?.address, WNATIVE[chainId]?.address)
    ? NATIVE[chainId]?.symbol
    : pool.token0
    ? currencyId(pool.token0)
    : undefined
  const token1 = isAddressEqual(pool.token1?.wrapped?.address, WNATIVE[chainId]?.address)
    ? NATIVE[chainId]?.symbol
    : pool.token1
    ? currencyId(pool.token1)
    : undefined

  const token0Address = token0 ? wSolToSol(token0) : undefined
  const token1Address = token1 ? wSolToSol(token1) : undefined
  const tokenPath = token0Address && token1Address ? `${token0Address}/${token1Address}` : ''

  if (protocol === Protocol.V2) {
    return addQueryToPath(`/v2/add/${tokenPath}`, { chain: CHAIN_QUERY_NAME[chainId], [PERSIST_CHAIN_KEY]: '1' })
  }
  if (protocol === Protocol.STABLE) {
    return addQueryToPath(`/stable/add/${tokenPath}`, { chain: CHAIN_QUERY_NAME[chainId], [PERSIST_CHAIN_KEY]: '1' })
  }

  if (protocol === Protocol.InfinitySTABLE) {
    return addQueryToPath(`/infinityStable/add/${lpAddress}`, {
      chain: CHAIN_QUERY_NAME[chainId],
      [PERSIST_CHAIN_KEY]: '1',
    })
  }

  return addQueryToPath(`/add/${tokenPath}/${feeTier}`, { chain: CHAIN_QUERY_NAME[chainId], [PERSIST_CHAIN_KEY]: '1' })
}

export async function getLinkForPool(pool: UnifiedPoolInfo, type: 'detail' | 'info'): Promise<string> {
  const { chainId, protocol, lpAddress, stableSwapAddress, poolId } = pool

  if (type === 'detail') {
    const linkPrefix = `/liquidity/pool${multiChainPaths[chainId] || '/bsc'}`
    if (protocol === Protocol.STABLE) {
      if (stableSwapAddress) {
        return `${linkPrefix}/${stableSwapAddress}`
      }
      const pairs = await LegacyRouter.getStableSwapPairs(chainId)
      const ssPair = pairs?.find((pair) => isAddressEqual(pair.lpAddress, lpAddress))
      if (ssPair) {
        return `${linkPrefix}/${ssPair.stableSwapAddress}`
      }
    }
    if (chainId === NonEVMChainId.SOLANA) {
      // Use poolId as fallback for Infinity pools where lpAddress might be undefined
      return `/liquidity/pool/solana/${lpAddress || poolId}`
    }
    return `${linkPrefix}/${lpAddress}`
  }

  // info page
  const toLink = (addr: string, p: string, q: string = '') => `/info/${p}${multiChainPaths[chainId]}/pairs/${addr}?${q}`
  if (protocol === Protocol.STABLE) {
    const pairs = await LegacyRouter.getStableSwapPairs(chainId)
    const ssPair = pairs?.find((pair) => isAddressEqual(pair.lpAddress, lpAddress))
    if (ssPair) {
      return toLink(ssPair.stableSwapAddress, '', 'type=stableSwap')
    }
  }
  return toLink(lpAddress!, protocol)
}

export const getPoolDetailPageLink = (pool: UnifiedPoolInfo) => getLinkForPool(pool, 'detail')
export const getPoolInfoPageLink = (pool: PoolInfo) => getLinkForPool(pool, 'info')
