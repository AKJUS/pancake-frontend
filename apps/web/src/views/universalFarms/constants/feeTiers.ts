/**
 * Fee tier constants for different protocols
 * Re-exports from SDKs where available
 */
import { ONE_HUNDRED_PERCENT_FEE } from '@pancakeswap/infinity-sdk'
import { BIPS_BASE } from '@pancakeswap/smart-router/evm'

/** V3 and Infinity fee tier base (1,000,000) - from infinity-sdk */
export const V3_FEE_TIER_BASE = Number(ONE_HUNDRED_PERCENT_FEE)

/** V2 and StableSwap fee tier base (10,000) - from smart-router */
export const V2_FEE_TIER_BASE = Number(BIPS_BASE)

/** V2 fee tier value (25 = 0.25%) */
export const V2_FEE_TIER = 25

/** Solana fee tier base (1,000,000) - re-export from utils */
export { SOLANA_FEE_TIER_BASE } from 'utils/normalizeSolanaPoolInfo'
