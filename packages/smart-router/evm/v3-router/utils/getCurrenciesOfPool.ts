import { Pool } from '../types'
import { isInfinityBinPool, isInfinityClPool, isInfinityStablePool, isStablePool, isV2Pool, isV3Pool } from './pool'

export function getCurrenciesOfPool(pool: Pool) {
  if (isV2Pool(pool)) {
    const { reserve0, reserve1 } = pool
    return [reserve0.currency, reserve1.currency]
  }
  if (isV3Pool(pool)) {
    const { token0, token1 } = pool
    return [token0, token1]
  }
  if (isStablePool(pool)) {
    const { balances } = pool
    return balances.map((b) => b.currency)
  }
  if (isInfinityClPool(pool) || isInfinityBinPool(pool) || isInfinityStablePool(pool)) {
    const { currency0, currency1 } = pool
    return [currency0, currency1]
  }
  throw new Error('Cannot get tokens by invalid pool')
}
