import { Skeleton } from '@pancakeswap/uikit'
import { useMemo } from 'react'
import { MAX_TICK, MIN_TICK, TickUtils } from '@pancakeswap/solana-core-sdk'
import { calculateSolanaTickLimits, getTickAtLimitStatus } from 'views/PoolDetail/utils'
import { SolanaV3Pool } from 'state/pools/solana'
import { usePoolChartData } from 'views/PositionSolana/hooks/usePoolChartData'
import { useTranslation } from '@pancakeswap/localization'
import { ChartContainer } from './ChartContainer.styles'
import { CHART_HEIGHT } from './types'
import { PositionChartV2 } from './PositionChartV2'
import { clampTick } from '../../../utils'
import { ErrorText } from '../../shared/styled'

/** Props for Solana V3 liquidity distribution chart */
export type SolanaV3PositionChartProps = {
  currency0: any
  currency1: any
  feeAmount: any
  tickLower?: number
  tickUpper?: number
  poolInfo?: SolanaV3Pool
  /** When true, display prices as currency1 per currency0 instead of currency0 per currency1 */
  inverted?: boolean
}

/**
 * Helper to calculate tick price using Solana SDK - returns raw number
 * This matches the format returned by the chart data API
 */
function getTickPriceNumber(tick: number, poolInfo: SolanaV3Pool, baseIn: boolean): number {
  try {
    if (tick >= MAX_TICK) return Infinity
    if (tick <= MIN_TICK) return 0

    const tickPrice = TickUtils.getTickPrice({
      poolInfo,
      tick,
      baseIn,
    })
    return parseFloat(tickPrice.price.toFixed(18))
  } catch (error) {
    console.error('[SolanaV3PositionChart] Error calculating tick price:', error)
    // Fallback calculation
    const basePrice = 1.0001 ** tick
    return baseIn ? basePrice : 1 / basePrice
  }
}

/**
 * Solana V3 liquidity distribution chart for the expanded position row.
 * Uses the same data source as Solana position detail page (Solana API via usePoolChartData).
 */
export function SolanaV3PositionChart({
  currency0,
  currency1,
  feeAmount,
  tickLower,
  tickUpper,
  poolInfo,
  inverted = false,
}: SolanaV3PositionChartProps) {
  const { t } = useTranslation()
  const baseIn = !inverted

  // Get tickCurrent from poolInfo
  const tickCurrent = poolInfo?.tickCurrent ?? 0

  // Validate and clamp tick values to prevent TICK invariant errors
  const safeTickLower = useMemo(() => clampTick(tickLower), [tickLower])
  const safeTickUpper = useMemo(() => clampTick(tickUpper), [tickUpper])
  const safeTickCurrent = useMemo(() => clampTick(tickCurrent), [tickCurrent])

  // Fetch tick data from Solana API (same as SolanaV3Position page)
  const poolId = poolInfo?.id
  const { formattedData: chartData, isLoading, error } = usePoolChartData(poolId)

  // Check if full range using Solana tick limits
  // Also detect full range heuristically when poolInfo is loading
  const { tickAtLimit, isFullRange } = useMemo(() => {
    // Heuristic: if ticks are at or beyond MIN_TICK/MAX_TICK bounds, it's likely full range
    // Use Solana SDK constants (MIN_TICK = -443636, MAX_TICK = 443636)
    // Note: Actual usable ticks may be slightly different due to tick spacing rounding,
    // but if ticks are at/beyond these limits, they're definitely full range
    const heuristicFullRange =
      safeTickLower !== undefined &&
      safeTickUpper !== undefined &&
      safeTickLower <= MIN_TICK &&
      safeTickUpper >= MAX_TICK

    if (safeTickLower === undefined || safeTickUpper === undefined || !poolInfo?.config?.tickSpacing) {
      return {
        tickAtLimit: { LOWER: heuristicFullRange, UPPER: heuristicFullRange },
        isFullRange: heuristicFullRange,
      }
    }

    const tickLimits = calculateSolanaTickLimits(poolInfo.config.tickSpacing)
    const limitStatus = getTickAtLimitStatus(safeTickLower, safeTickUpper, tickLimits)

    return {
      tickAtLimit: limitStatus,
      isFullRange: limitStatus.LOWER && limitStatus.UPPER,
    }
  }, [safeTickLower, safeTickUpper, poolInfo?.config?.tickSpacing])

  // Calculate prices using the same method as the chart data API for consistency.
  // Always compute in baseIn=true (price0) format — PositionChartV2 handles inversion
  // internally when baseIn=false. Using baseIn here would cause double-inversion:
  // the Solana chart would pre-invert, then PositionChartV2 would invert again,
  // putting reference lines/domain back in the price0 range while the XAxis shows
  // price1 values. (PAN-10584)
  const { priceLower, priceUpper, priceCurrent } = useMemo(() => {
    if (!poolInfo || safeTickLower === undefined || safeTickUpper === undefined) {
      return { priceLower: 0, priceUpper: 0, priceCurrent: 0 }
    }

    const lower = getTickPriceNumber(safeTickLower, poolInfo, true)
    const upper = getTickPriceNumber(safeTickUpper, poolInfo, true)
    const current = getTickPriceNumber(safeTickCurrent ?? 0, poolInfo, true)

    return {
      priceLower: lower,
      priceUpper: upper,
      priceCurrent: current,
    }
  }, [poolInfo, safeTickLower, safeTickUpper, safeTickCurrent])

  if (error) {
    return (
      <ChartContainer>
        <ErrorText>{t('Chart display error')}</ErrorText>
      </ChartContainer>
    )
  }

  // Show chart if we have data and valid tick range
  if (chartData && chartData.length > 0 && safeTickLower !== undefined && safeTickUpper !== undefined) {
    return (
      <ChartContainer>
        <PositionChartV2
          chartData={chartData}
          tickLower={safeTickLower}
          tickUpper={safeTickUpper}
          tickCurrent={safeTickCurrent}
          priceLower={priceLower}
          priceUpper={priceUpper}
          priceCurrent={priceCurrent}
          baseIn={baseIn}
          token0Symbol={currency0?.symbol}
          token1Symbol={currency1?.symbol}
          compact
          height={CHART_HEIGHT}
          isFullRange={isFullRange}
        />
      </ChartContainer>
    )
  }

  return (
    <ChartContainer>
      {isLoading ? <Skeleton height={CHART_HEIGHT} /> : <ErrorText>{t('Chart display error')}</ErrorText>}
    </ChartContainer>
  )
}
