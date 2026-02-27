import {
  DYNAMIC_FEE_FLAG,
  decodeHooksRegistration,
  encodePoolParameters,
  isDynamicFeeHook,
} from '@pancakeswap/infinity-sdk'
import { BaseRoute } from '@pancakeswap/routing-sdk'
import { isInfinityBinPool, isInfinityCLPool, isInfinityStablePool } from '@pancakeswap/routing-sdk-addon-infinity'
import { Currency, getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import { Address, zeroAddress } from 'viem'

import { InfinitySupportedPool } from '../types'
import { getOutputCurrency } from './getOutputCurrency'

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
export function encodeInfinityRouteToPath<P extends InfinitySupportedPool = InfinitySupportedPool>(
  route: Omit<BaseRoute<P>, 'percent' | 'inputAmount' | 'outputAmount' | 'gasUseEstimate'>,
  exactOutput: boolean,
): PathKey[] {
  if (route.pools.some((p) => !isInfinityCLPool(p) && !isInfinityBinPool(p) && !isInfinityStablePool(p))) {
    throw new Error('Failed to encode path keys. Invalid infinity pool found in route.')
  }

  const currencyStart = exactOutput ? route.path[route.path.length - 1] : route.path[0]
  const pools = exactOutput ? [...route.pools].reverse() : route.pools

  const { path } = pools.reduce(
    (
      // eslint-disable-next-line @typescript-eslint/no-shadow
      { baseCurrency, path }: { baseCurrency: Currency; path: PathKey[] },
      p: P,
    ): { baseCurrency: Currency; path: PathKey[] } => {
      const isInfinityCl = isInfinityCLPool(p)
      const isInfinityBin = isInfinityBinPool(p)
      const isInfinityStable = isInfinityStablePool(p)
      if (!isInfinityCl && !isInfinityBin && !isInfinityStable) throw new Error(`Invalid Infinity pool ${p}`)
      const quoteCurrency = getOutputCurrency(p, baseCurrency)
      const pool = p.getPoolData()
      const hooksRegistration =
        pool.hooksRegistrationBitmap !== undefined ? decodeHooksRegistration(pool.hooksRegistrationBitmap) : undefined
      const parameters = encodePoolParameters(
        isInfinityCl || isInfinityStable
          ? {
              tickSpacing: p.getPoolData().tickSpacing,
              hooksRegistration,
            }
          : {
              binStep: p.getPoolData().binStep,
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
