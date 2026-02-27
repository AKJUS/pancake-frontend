import { Hex, bytesToHex } from 'viem'

import { BaseRoute, InfinityMixedQuoterActions } from '../types'
import { isInfinityBinPool, isInfinityClPool, isInfinityStablePool, isStablePool, isV2Pool, isV3Pool } from './pool'

export function encodeInfinityMixedRouteActions(route: BaseRoute): Hex {
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
        if (isInfinityClPool(p) || isInfinityStablePool(p)) {
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
