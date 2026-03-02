import type { Protocol } from '@pancakeswap/farms'
import type { Currency } from '@pancakeswap/swap-sdk-core'
import type { FeeAmount } from '@pancakeswap/v3-sdk'
import type { Address } from 'viem'
import type { UnifiedPositionDetail, SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import type { SolanaV3Pool } from 'state/pools/solana'

export const CHART_HEIGHT = 200
export const CHART_WIDTH = '100%'

/** Props passed to the protocol-agnostic chart router */
export type PositionChartByProtocolProps = {
  protocol: Protocol
  position: UnifiedPositionDetail
  currency0?: Currency
  currency1?: Currency
  chainId: number
  poolId?: Address | string // Address for EVM chains, string for Solana
  /** When true, display prices as currency1 per currency0 instead of currency0 per currency1 */
  inverted?: boolean
  /** Fallback priceLower when tick is unavailable (PAN-10696) */
  priceLower?: number
  /** Fallback priceUpper when tick is unavailable (PAN-10696) */
  priceUpper?: number
}

/** Props for V3 liquidity distribution chart. Same inputs as Add Liquidity V3 density chart. */
export type V3PositionChartProps = {
  currency0: Currency | undefined
  currency1: Currency | undefined
  feeAmount: FeeAmount | undefined
  tickLower?: number
  tickUpper?: number
  tickCurrent?: number
  /** When true, display prices as currency1 per currency0 instead of currency0 per currency1 */
  inverted?: boolean
}

/** Props for Solana V3 liquidity distribution chart. */
export type SolanaV3PositionChartProps = {
  currency0: Currency | undefined
  currency1: Currency | undefined
  feeAmount: FeeAmount | undefined
  tickLower?: number
  tickUpper?: number
  poolInfo?: SolanaV3Pool
  /** When true, display prices as currency1 per currency0 instead of currency0 per currency1 */
  inverted?: boolean
}

/** Props for Infinity CL liquidity distribution chart. Same inputs as Add Liquidity Infinity CL. */
export type InfinityCLPositionChartProps = {
  poolId: Address | undefined
  chainId: number | undefined
  baseCurrency: Currency | undefined
  quoteCurrency: Currency | undefined
  tickLower?: number
  tickUpper?: number
  tickCurrent?: number
  tickSpacing?: number
  /** When true, display prices as quoteCurrency per baseCurrency instead of baseCurrency per quoteCurrency */
  inverted?: boolean
  /** Fallback priceLower when tick is unavailable (PAN-10696) */
  priceLower?: number
  /** Fallback priceUpper when tick is unavailable (PAN-10696) */
  priceUpper?: number
}

/** Props for Infinity Bin liquidity distribution chart. Same inputs as Add Liquidity Infinity Bin. */
export type InfinityBinPositionChartProps = {
  poolId: Address | undefined
  chainId: number | undefined
  baseCurrency: Currency | undefined
  quoteCurrency: Currency | undefined
  tickLower?: number
  tickUpper?: number
  tickCurrent?: number
  tickSpacing?: number
  /** When true, display prices as quoteCurrency per baseCurrency instead of baseCurrency per quoteCurrency */
  inverted?: boolean
  /** Fallback priceLower when tick is unavailable (PAN-10696) */
  priceLower?: number
  /** Fallback priceUpper when tick is unavailable (PAN-10696) */
  priceUpper?: number
}
