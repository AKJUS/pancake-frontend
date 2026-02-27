import type { Pool } from '@pancakeswap/routing-sdk'
import { isInfinityBinPool, isInfinityCLPool, isInfinityStablePool } from '@pancakeswap/routing-sdk-addon-infinity'

import { SupportedPool, V3SupportedPool } from '../types'

type Route<P extends Pool = Pool> = {
  pools: P[]
}

export function isMixedRoute(r: Route<Pool>): r is Route<V3SupportedPool> {
  const { pools } = r
  const hasInfinityPool = pools.some((p) => isInfinityCLPool(p) || isInfinityStablePool(p))
  if (hasInfinityPool) {
    return false
  }

  let lastType
  for (const p of pools) {
    if (lastType === undefined) {
      lastType = p.type
      continue
    }
    if (lastType !== p.type) {
      return true
    }
  }
  return false
}

export function isInfinityMixedRoute(r: Route<Pool>): r is Route<SupportedPool> {
  const { pools } = r

  const hasInfinityPool = pools.some((p) => isInfinityCLPool(p) || isInfinityBinPool(p) || isInfinityStablePool(p))
  if (!hasInfinityPool) {
    return false
  }

  let lastType
  for (const p of pools) {
    if (lastType === undefined) {
      lastType = p.type
      continue
    }
    if (lastType !== p.type) {
      return true
    }
  }
  return false
}
