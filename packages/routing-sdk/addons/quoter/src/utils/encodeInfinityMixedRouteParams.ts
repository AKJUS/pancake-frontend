import {
  DYNAMIC_FEE_FLAG,
  PoolKey,
  decodeHooksRegistration,
  encodePoolKey,
  isDynamicFeeHook,
} from '@pancakeswap/infinity-sdk'
import { BaseRoute } from '@pancakeswap/routing-sdk'
import { isInfinityBinPool, isInfinityCLPool, isInfinityStablePool } from '@pancakeswap/routing-sdk-addon-infinity'
import { isStablePool } from '@pancakeswap/routing-sdk-addon-stable-swap'
import { isV2Pool } from '@pancakeswap/routing-sdk-addon-v2'
import { isV3Pool } from '@pancakeswap/routing-sdk-addon-v3'
import { getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import { Hex, encodeAbiParameters, parseAbiParameters } from 'viem'

import { SupportedPool } from '../types'

const infinityRouteParamsAbi = [
  {
    components: [
      {
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'hooks', type: 'address' },
          { name: 'poolManager', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'parameters', type: 'bytes32' },
        ],
        name: 'poolKey',
        type: 'tuple',
      },
      { name: 'hookData', type: 'bytes' },
    ],
    name: 'params',
    type: 'tuple',
  },
] as const

export function encodeInfinityMixedRouteParams(
  route: Omit<BaseRoute<SupportedPool>, 'percent' | 'inputAmount' | 'outputAmount' | 'gasUseEstimate'>,
): Hex[] {
  return route.pools.map((p) => {
    if (isV2Pool(p) || isStablePool(p)) {
      return '0x'
    }
    if (isV3Pool(p)) {
      return encodeAbiParameters(parseAbiParameters('uint24'), [p.getPoolData().fee])
    }
    if (isInfinityCLPool(p) || isInfinityStablePool(p)) {
      const pool = p.getPoolData()
      const poolKey: PoolKey<'CL'> = {
        currency0: getCurrencyAddress(pool.currency0),
        currency1: getCurrencyAddress(pool.currency1),
        fee: isDynamicFeeHook(pool.currency0.chainId, pool.hooks) ? DYNAMIC_FEE_FLAG : pool.fee,
        hooks: pool.hooks,
        poolManager: pool.poolManager,
        parameters: {
          tickSpacing: pool.tickSpacing,
          hooksRegistration:
            pool.hooksRegistrationBitmap !== undefined
              ? decodeHooksRegistration(pool.hooksRegistrationBitmap)
              : undefined,
        },
      }
      return encodeAbiParameters(infinityRouteParamsAbi, [
        {
          poolKey: encodePoolKey(poolKey),
          hookData: '0x',
        },
      ])
    }
    if (isInfinityBinPool(p)) {
      const pool = p.getPoolData()
      const poolKey: PoolKey<'Bin'> = {
        currency0: getCurrencyAddress(pool.currency0),
        currency1: getCurrencyAddress(pool.currency1),
        fee: isDynamicFeeHook(pool.currency0.chainId, pool.hooks) ? DYNAMIC_FEE_FLAG : pool.fee,
        hooks: pool.hooks,
        poolManager: pool.poolManager,
        parameters: {
          binStep: Number(pool.binStep),
          hooksRegistration:
            pool.hooksRegistrationBitmap !== undefined
              ? decodeHooksRegistration(pool.hooksRegistrationBitmap)
              : undefined,
        },
      }
      return encodeAbiParameters(infinityRouteParamsAbi, [
        {
          poolKey: encodePoolKey(poolKey),
          hookData: '0x',
        },
      ])
    }

    throw new Error(`Invalid pool type ${p}`)
  })
}
