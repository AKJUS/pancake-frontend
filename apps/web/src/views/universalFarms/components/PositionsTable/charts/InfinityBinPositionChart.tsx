import { Skeleton } from '@pancakeswap/uikit'
import { useMemo } from 'react'
import { useBinDensityChartData } from 'views/AddLiquidityInfinity/hooks/useDensityChartData'
import useIsTickAtLimit from 'hooks/infinity/useIsTickAtLimit'
import { useTranslation } from '@pancakeswap/localization'
import type { InfinityBinPositionChartProps } from './types'
import { ChartContainer } from './ChartContainer.styles'
import { CHART_HEIGHT } from './types'
import { PositionChartV2, ChartEntry } from './PositionChartV2'
import { ErrorText } from '../../shared/styled'

/**
 * Infinity Bin liquidity distribution chart for the expanded position row.
 * Uses the same data source as the Add Liquidity Infinity Bin page (useBinDensityChartData).
 */
export function InfinityBinPositionChart({
  poolId,
  chainId,
  baseCurrency,
  quoteCurrency,
  tickLower,
  tickUpper,
  tickCurrent: propTickCurrent,
  tickSpacing,
  inverted = false,
  priceLower: propPriceLower,
  priceUpper: propPriceUpper,
}: InfinityBinPositionChartProps) {
  const { t } = useTranslation()

  // For Bin pools, activeId is the current bin ID from useBinDensityChartData (activeBinId)
  // DON'T use pool.activeId directly - it can be stale or wrong (PAN-10696)
  const tickCurrent = propTickCurrent

  // BIN pools: tickLower/tickUpper are bin IDs, not ticks. Don't clamp them with tick limits!
  // Use them directly, or fallback to 0 if undefined
  const safeTickLower = tickLower ?? 0
  const safeTickUpper = tickUpper ?? 0
  const safeTickCurrent = tickCurrent ?? 0

  const { isLoading, formattedData, activeBinId } = useBinDensityChartData({
    poolId,
    chainId,
    baseCurrency,
    quoteCurrency,
  })

  const tickAtLimit = useIsTickAtLimit(safeTickLower, safeTickUpper, tickSpacing)
  const isFullRange = tickAtLimit?.LOWER && tickAtLimit?.UPPER

  // For BIN pools: get current price from the active bin data, NOT from usePositionPrices
  // (usePositionPrices expects tick values, not bin IDs - PAN-10696)
  const { priceLowerNum, priceUpperNum, priceCurrentNum } = useMemo(() => {
    // Find the active bin in the data
    const activeBin = formattedData?.find((d) => d.binId === activeBinId)
    // ALWAYS use price0 - PositionChartV2 will handle inversion based on baseIn prop
    const currentPriceFromData = activeBin?.price0

    return {
      priceLowerNum: propPriceLower ?? 0,
      priceUpperNum: propPriceUpper ?? 0,
      priceCurrentNum: currentPriceFromData ?? 0,
    }
  }, [formattedData, activeBinId, propPriceLower, propPriceUpper])

  const chartData = useMemo((): ChartEntry[] | undefined => {
    if (!formattedData?.length) return undefined
    // BIN chart data already has correct prices from useBinDensityChartData
    return formattedData.map((d) => ({
      liquidity: d.activeLiquidity,
      price0: d.price0,
      price1: d.price1,
      tick: d.binId, // Use actual binId
    }))
  }, [formattedData])

  // Show chart immediately if we have data
  if (chartData && chartData.length > 0) {
    return (
      <ChartContainer>
        <PositionChartV2
          chartData={chartData}
          tickLower={safeTickLower}
          tickUpper={safeTickUpper}
          tickCurrent={activeBinId ?? safeTickCurrent}
          priceLower={priceLowerNum}
          priceUpper={priceUpperNum}
          priceCurrent={priceCurrentNum}
          baseIn={!inverted}
          token0Symbol={baseCurrency?.symbol}
          token1Symbol={quoteCurrency?.symbol}
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
