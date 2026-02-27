import type { Pool } from '@pancakeswap/routing-sdk'

import { INFI_BIN_POOL_TYPE, INFI_STABLE_POOL_TYPE } from '../constants'
import { InfinityBinPool, InfinityStablePool } from '../types'

export function isInfinityBinPool(p: Pool): p is InfinityBinPool {
  return p.type === INFI_BIN_POOL_TYPE
}

export function isInfinityStablePool(p: Pool): p is InfinityStablePool {
  return p.type === INFI_STABLE_POOL_TYPE
}
