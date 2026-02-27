import { isInfinityBinPool, isInfinityCLPool, isInfinityStablePool } from '@pancakeswap/routing-sdk-addon-infinity'
import { isStablePool } from '@pancakeswap/routing-sdk-addon-stable-swap'
import { isV2Pool } from '@pancakeswap/routing-sdk-addon-v2'
import { isV3Pool } from '@pancakeswap/routing-sdk-addon-v3'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { SupportedPool } from '../types'

// FIXME: current version is not working with stable pools that have more than 2 tokens
export function getOutputCurrency(pool: SupportedPool, currencyIn: Currency): Currency {
  const tokenIn = currencyIn.wrapped
  if (isV2Pool(pool)) {
    const { reserve0, reserve1 } = pool.getPoolData()
    return reserve0.currency.equals(tokenIn) ? reserve1.currency : reserve0.currency
  }
  if (isV3Pool(pool)) {
    const { token0, token1 } = pool.getPoolData()
    return token0.equals(tokenIn) ? token1 : token0
  }
  if (isStablePool(pool)) {
    const { balances } = pool.getPoolData()
    return balances[0].currency.equals(tokenIn) ? balances[1].currency : balances[0].currency
  }
  if (isInfinityCLPool(pool) || isInfinityBinPool(pool) || isInfinityStablePool(pool)) {
    const { currency0, currency1 } = pool.getPoolData()
    return currency0.wrapped.equals(tokenIn) ? currency1 : currency0
  }
  throw new Error('Cannot get output currency by invalid pool')
}
