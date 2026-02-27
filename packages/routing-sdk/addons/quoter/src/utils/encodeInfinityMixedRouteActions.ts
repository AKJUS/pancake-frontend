import { BaseRoute } from '@pancakeswap/routing-sdk'
import { isInfinityBinPool, isInfinityCLPool, isInfinityStablePool } from '@pancakeswap/routing-sdk-addon-infinity'
import { isStablePool } from '@pancakeswap/routing-sdk-addon-stable-swap'
import { isV2Pool } from '@pancakeswap/routing-sdk-addon-v2'
import { isV3Pool } from '@pancakeswap/routing-sdk-addon-v3'
import { Hex, bytesToHex } from 'viem'

import { InfinityMixedQuoterActions, SupportedPool } from '../types'

export function encodeInfinityMixedRouteActions(
  route: Omit<BaseRoute<SupportedPool>, 'percent' | 'inputAmount' | 'outputAmount' | 'gasUseEstimate'>,
): Hex {
  return bytesToHex(
    new Uint8Array(
      route.pools.map((p) => {
        if (isV2Pool(p)) {
          return InfinityMixedQuoterActions.V2_EXACT_INPUT_SINGLE
        }
        if (isV3Pool(p)) {
          return InfinityMixedQuoterActions.V3_EXACT_INPUT_SINGLE
        }
        if (isStablePool(p)) {
          return InfinityMixedQuoterActions.SS_2_EXACT_INPUT_SINGLE
        }
        if (isInfinityCLPool(p) || isInfinityStablePool(p)) {
          return InfinityMixedQuoterActions.INFI_CL_EXACT_INPUT_SINGLE
        }
        if (isInfinityBinPool(p)) {
          return InfinityMixedQuoterActions.INFI_BIN_EXACT_INPUT_SINGLE
        }
        throw new Error(`Unrecognized pool type ${p}`)
      }),
    ),
  )
}
