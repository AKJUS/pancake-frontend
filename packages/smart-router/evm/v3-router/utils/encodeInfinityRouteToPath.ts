import {
  DYNAMIC_FEE_FLAG,
  decodeHooksRegistration,
  encodePoolParameters,
  isDynamicFeeHook,
} from '@pancakeswap/infinity-sdk'
import { Currency, getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import { Address, zeroAddress } from 'viem'

import { BaseRoute, Pool } from '../types'
import { getOutputCurrency, isInfinityBinPool, isInfinityClPool, isInfinityStablePool } from './pool'

export type PathKey = {
  intermediateCurrency: Address
  fee: number
  hooks: Address
  poolManager: Address
  hookData: `0x${string}`
  parameters: `0x${string}`
}

/**
 * Converts a route to an array of path key
 * @param route the mixed path to convert to an encoded path
 * @returns the encoded path keys
 */
export function encodeInfinityRouteToPath(route: BaseRoute, exactOutput: boolean): PathKey[] {
  if (route.pools.some((p) => !isInfinityClPool(p) && !isInfinityBinPool(p) && !isInfinityStablePool(p))) {
    throw new Error('Failed to encode path keys. Invalid Infinity pool found in route.')
  }

  const currencyStart = exactOutput ? route.output : route.input
  const pools = exactOutput ? [...route.pools].reverse() : route.pools

  const { path } = pools.reduce(
    (
      // eslint-disable-next-line @typescript-eslint/no-shadow
      { baseCurrency, path }: { baseCurrency: Currency; path: PathKey[] },
      pool: Pool,
    ): { baseCurrency: Currency; path: PathKey[] } => {
      const isInfinityCl = isInfinityClPool(pool)
      const isInfinityBin = isInfinityBinPool(pool)
      const isInfinityStable = isInfinityStablePool(pool)
      if (!isInfinityCl && !isInfinityBin && !isInfinityStable) throw new Error(`Invalid Infinity pool ${pool}`)
      const quoteCurrency = getOutputCurrency(pool, baseCurrency)
      const hooksRegistration =
        pool.hooksRegistrationBitmap !== undefined ? decodeHooksRegistration(pool.hooksRegistrationBitmap) : undefined
      const parameters = encodePoolParameters(
        isInfinityCl || isInfinityStable
          ? {
              tickSpacing: pool.tickSpacing,
              hooksRegistration,
            }
          : {
              binStep: pool.binStep,
              hooksRegistration,
            },
      )
      return {
        baseCurrency: quoteCurrency,
        path: [
          ...path,
          {
            intermediateCurrency: getCurrencyAddress(quoteCurrency),
            fee: isDynamicFeeHook(pool.currency0.chainId, pool.hooks) ? DYNAMIC_FEE_FLAG : pool.fee,
            hooks: pool.hooks ?? zeroAddress,
            poolManager: pool.poolManager,
            hookData: '0x',
            parameters,
          },
        ],
      }
    },
    { baseCurrency: currencyStart, path: [] },
  )

  return exactOutput ? path.reverse() : path
}
