import { PoolType } from '@pancakeswap/smart-router'
import { QuoteQuery } from 'quoter/quoter.types'

export function getAllowedPoolTypes(options: QuoteQuery) {
  const { infinitySwap, infinityStableSwap, v2Swap, v3Swap, stableSwap } = options
  const types: PoolType[] = []
  if (infinitySwap) {
    types.push(PoolType.InfinityBIN)
    types.push(PoolType.InfinityCL)
  }
  if (infinityStableSwap) {
    types.push(PoolType.InfinityStable)
  }
  if (v2Swap) {
    types.push(PoolType.V2)
  }
  if (v3Swap) {
    types.push(PoolType.V3)
  }
  if (stableSwap) {
    types.push(PoolType.STABLE)
  }
  return types
}

export function getAllowedPoolTypesX(options: QuoteQuery) {
  const { v2Swap, v3Swap, stableSwap } = options
  const types: PoolType[] = []

  if (v2Swap) {
    types.push(PoolType.V2)
  }
  if (v3Swap) {
    types.push(PoolType.V3)
  }
  if (stableSwap) {
    types.push(PoolType.STABLE)
  }
  return types
}
