import { Currency, getCurrencyAddress, getMatchedCurrency } from '@pancakeswap/swap-sdk-core'
import { Address } from 'viem'

import { BaseRoute, Pool } from '../types'
import {
  getOutputCurrency,
  isInfinityBinPool,
  isInfinityClPool,
  isInfinityStablePool,
  isStablePool,
  isV2Pool,
  isV3Pool,
} from './pool'

function getPoolCurrencies(pool: Pool) {
  if (isV2Pool(pool)) {
    return [pool.reserve0.currency, pool.reserve1.currency]
  }
  if (isV3Pool(pool)) {
    return [pool.token0, pool.token1]
  }
  if (isStablePool(pool)) {
    return pool.balances.map((b) => b.currency)
  }
  if (isInfinityClPool(pool) || isInfinityBinPool(pool) || isInfinityStablePool(pool)) {
    return [pool.currency0, pool.currency1]
  }
  throw new Error('Failed to get pool currencies. Unrecognized pool type')
}

/**
 * Converts a route to an array of path key
 * @param route the mixed path to convert to an encoded path
 * @returns the encoded path keys
 */
export function encodeInfinityMixedRouteCurrencyPath(route: BaseRoute): Address[] {
  const { pools } = route
  const currencyStart = route.path[0]
  const pathStart = getMatchedCurrency(currencyStart, getPoolCurrencies(pools[0]))
  if (!pathStart) {
    throw new Error('Failed to encode path keys. Invalid start currency.')
  }

  const { path } = pools.reduce(
    (
      // eslint-disable-next-line @typescript-eslint/no-shadow
      { baseCurrency, path }: { baseCurrency: Currency; path: Address[] },
      p: Pool,
    ): { baseCurrency: Currency; path: Address[] } => {
      const quoteCurrency = getOutputCurrency(p, baseCurrency)
      return {
        baseCurrency: quoteCurrency,
        path: [...path, getCurrencyAddress(quoteCurrency)],
      }
    },
    { baseCurrency: pathStart, path: [getCurrencyAddress(pathStart)] },
  )

  return path
}
