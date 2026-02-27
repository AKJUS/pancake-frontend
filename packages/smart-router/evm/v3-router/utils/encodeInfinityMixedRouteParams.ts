import {
  DYNAMIC_FEE_FLAG,
  PoolKey,
  decodeHooksRegistration,
  encodePoolKey,
  isDynamicFeeHook,
} from '@pancakeswap/infinity-sdk'
import { getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import { Hex, encodeAbiParameters, parseAbiParameters } from 'viem'

import { BaseRoute } from '../types'
import { isInfinityBinPool, isInfinityClPool, isInfinityStablePool, isStablePool, isV2Pool, isV3Pool } from './pool'

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

export function encodeInfinityMixedRouteParams(route: BaseRoute): Hex[] {
  return route.pools.map((p) => {
    if (isV2Pool(p) || isStablePool(p)) {
      return '0x'
    }
    if (isV3Pool(p)) {
      return encodeAbiParameters(parseAbiParameters('uint24'), [p.fee])
    }
    if (isInfinityClPool(p) || isInfinityStablePool(p)) {
      const poolKey: PoolKey<'CL'> = {
        currency0: getCurrencyAddress(p.currency0),
        currency1: getCurrencyAddress(p.currency1),
        fee: isDynamicFeeHook(p.currency0.chainId, p.hooks) ? DYNAMIC_FEE_FLAG : p.fee,
        hooks: p.hooks,
        poolManager: p.poolManager,
        parameters: {
          tickSpacing: p.tickSpacing,
          hooksRegistration:
            p.hooksRegistrationBitmap !== undefined ? decodeHooksRegistration(p.hooksRegistrationBitmap) : undefined,
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
      const poolKey: PoolKey<'Bin'> = {
        currency0: getCurrencyAddress(p.currency0),
        currency1: getCurrencyAddress(p.currency1),
        fee: isDynamicFeeHook(p.currency0.chainId, p.hooks) ? DYNAMIC_FEE_FLAG : p.fee,
        hooks: p.hooks,
        poolManager: p.poolManager,
        parameters: {
          binStep: Number(p.binStep),
          hooksRegistration:
            p.hooksRegistrationBitmap !== undefined ? decodeHooksRegistration(p.hooksRegistrationBitmap) : undefined,
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
