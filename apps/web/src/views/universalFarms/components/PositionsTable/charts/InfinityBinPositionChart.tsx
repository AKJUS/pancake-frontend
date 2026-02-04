import { Skeleton, Text } from '@pancakeswap/uikit'
import { useMemo, useState, useEffect } from 'react'
import { useBinDensityChartData } from 'views/AddLiquidityInfinity/hooks/useDensityChartData'
import { usePositionPrices } from 'state/farmsV4/state/accountPositions/hooks/usePositionPrices'
import useIsTickAtLimit from 'hooks/infinity/useIsTickAtLimit'
import { usePoolById } from 'hooks/infinity/usePool'
import styled from 'styled-components'
import { useTranslation } from '@pancakeswap/localization'
import type { InfinityBinPositionChartProps } from './types'
import { ChartContainer } from './ChartContainer.styles'
import { CHART_HEIGHT } from './types'
import { PositionChartV2, ChartEntry } from './PositionChartV2'
import { clampTick } from '../../../utils'
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
}: InfinityBinPositionChartProps) {
  const { t } = useTranslation()

  // Get pool to fetch activeId (which acts as tickCurrent for Bin pools)
  const [, pool] = usePoolById<'Bin'>(poolId, chainId)

  // For Bin pools, activeId is the current bin ID (similar to tickCurrent)
  // Use activeId from pool if available, otherwise fall back to prop
  const tickCurrent = useMemo(() => {
    if (pool?.activeId !== undefined) {
      return pool.activeId
    }
    return propTickCurrent
  }, [pool?.activeId, propTickCurrent])

  // Validate and clamp tick values to prevent TICK invariant errors
  const safeTickLower = useMemo(() => clampTick(tickLower), [tickLower])
  const safeTickUpper = useMemo(() => clampTick(tickUpper), [tickUpper])
  const safeTickCurrent = useMemo(() => clampTick(tickCurrent), [tickCurrent])

  const { isLoading, formattedData, activeBinId } = useBinDensityChartData({
    poolId,
    chainId,
    baseCurrency,
    quoteCurrency,
  })

  const tickAtLimit = useIsTickAtLimit(safeTickLower, safeTickUpper, tickSpacing)
  const isFullRange = tickAtLimit?.LOWER && tickAtLimit?.UPPER

  const { priceLower, priceUpper, priceCurrent } = usePositionPrices({
    currencyA: baseCurrency,
    currencyB: quoteCurrency,
    tickLower: safeTickLower,
    tickUpper: safeTickUpper,
    tickCurrent: safeTickCurrent,
  })

  const chartData = useMemo((): ChartEntry[] | undefined => {
    if (!formattedData?.length) return undefined
    return formattedData.map((d, i) => ({
      liquidity: d.activeLiquidity,
      price0: d.price0,
      price1: d.price1,
      tick: i, // Use index as tick since we don't have actual tick data
    }))
  }, [formattedData])

  // Show chart immediately if we have data, otherwise show loading skeleton
  if (
    chartData &&
    chartData.length > 0 &&
    safeTickLower !== undefined &&
    safeTickUpper !== undefined &&
    safeTickCurrent !== undefined
  ) {
    return (
      <ChartContainer>
        <PositionChartV2
          chartData={chartData}
          tickLower={safeTickLower}
          tickUpper={safeTickUpper}
          tickCurrent={safeTickCurrent}
          priceLower={priceLower?.toSignificant(8) ? parseFloat(priceLower.toSignificant(8)) : 0}
          priceUpper={priceUpper?.toSignificant(8) ? parseFloat(priceUpper.toSignificant(8)) : 0}
          priceCurrent={priceCurrent?.toSignificant(8) ? parseFloat(priceCurrent.toSignificant(8)) : 0}
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
