import { Skeleton, Text } from '@pancakeswap/uikit'
import { useMemo, useState, useEffect } from 'react'
import { usePositionPrices } from 'state/farmsV4/state/accountPositions/hooks/usePositionPrices'
import useIsTickAtLimit from 'hooks/infinity/useIsTickAtLimit'
import { usePoolById } from 'hooks/infinity/usePool'
import styled from 'styled-components'
import { useQuery } from '@tanstack/react-query'
import { Protocol } from '@pancakeswap/farms'
import { chainIdToExplorerInfoChainName } from 'state/info/api/client'
import { fetchTicksSurroundingPrice } from 'views/V3Info/data/pool/tickData'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import { useTranslation } from '@pancakeswap/localization'
import type { InfinityCLPositionChartProps } from './types'
import { ChartContainer } from './ChartContainer.styles'
import { CHART_HEIGHT } from './types'
import { PositionChartV2, ChartEntry } from './PositionChartV2'
import { clampTick } from '../../../utils'
import { ErrorText } from '../../shared/styled'

/**
 * Infinity CL liquidity distribution chart for the expanded position row.
 * Uses the same data source as PoolDetail page (Explorer API via useInfinityCLPoolTickData).
 */
export function InfinityCLPositionChart({
  poolId,
  chainId,
  baseCurrency,
  quoteCurrency,
  tickLower,
  tickUpper,
  tickCurrent: propTickCurrent,
  tickSpacing,
  inverted = false,
}: InfinityCLPositionChartProps) {
  const { t } = useTranslation()
  const [hasError, setHasError] = useState(false)

  // Get pool to fetch tickCurrent
  const [, pool] = usePoolById<'CL'>(poolId, chainId)

  // Use tickCurrent from pool if available, otherwise fall back to prop
  const tickCurrent = useMemo(() => {
    if (pool?.tickCurrent !== undefined) {
      return pool.tickCurrent
    }
    return propTickCurrent
  }, [pool?.tickCurrent, propTickCurrent])

  // Validate and clamp tick values to prevent TICK invariant errors
  const safeTickLower = useMemo(() => clampTick(tickLower), [tickLower])
  const safeTickUpper = useMemo(() => clampTick(tickUpper), [tickUpper])
  const safeTickCurrent = useMemo(() => clampTick(tickCurrent), [tickCurrent])

  // Map chainId to explorer chain name directly instead of using query parameter
  const explorerChainName = useMemo(() => {
    if (!chainId) return undefined
    return chainIdToExplorerInfoChainName[chainId as keyof typeof chainIdToExplorerInfoChainName]
  }, [chainId])

  // Fetch tick data directly with chainId prop instead of relying on URL query
  const { data: poolTickData, error: queryError } = useQuery({
    queryKey: ['info/pool/poolTickData', chainId, poolId, Protocol.InfinityCLAMM, tickSpacing],
    queryFn: async ({ signal }) => {
      if (!explorerChainName || !poolId || !tickSpacing || !chainId) {
        console.warn('[InfinityCLPositionChart] Missing required params:', {
          poolId,
          explorerChainName,
          chainId,
          tickSpacing,
        })
        return undefined
      }
      try {
        const result = await fetchTicksSurroundingPrice({
          poolAddress: poolId,
          chainName: explorerChainName,
          chainId,
          signal,
          protocol: Protocol.InfinityCLAMM,
          tickSpacing,
        })
        if (result.error) {
          console.error('[InfinityCLPositionChart] Error fetching tick data:', { poolId, chainId, explorerChainName })
        }
        return result
      } catch (error) {
        console.error('[InfinityCLPositionChart] Exception fetching tick data:', error, {
          poolId,
          chainId,
          explorerChainName,
        })
        throw error
      }
    },
    enabled: Boolean(explorerChainName && poolId && tickSpacing && chainId),
    ...QUERY_SETTINGS_IMMUTABLE,
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

  // Transform tick data from Explorer API to ChartEntry format with error handling
  const chartData = useMemo((): ChartEntry[] | undefined => {
    try {
      if (!poolTickData?.data?.ticksProcessed?.length) return undefined
      return poolTickData.data.ticksProcessed.map((tick) => ({
        liquidity: parseFloat(tick.liquidityActive.toString()),
        price0: parseFloat(tick.price0),
        price1: parseFloat(tick.price1),
        tick: tick.tickIdx,
      }))
    } catch (error) {
      console.error('[InfinityCLPositionChart] Error processing tick data:', error)
      setHasError(true)
      return undefined
    }
  }, [poolTickData])

  // Reset error state when data changes
  useEffect(() => {
    if (poolTickData && hasError) {
      setHasError(false)
    }
    // Set error state if query failed
    if (queryError || poolTickData?.error) {
      setHasError(true)
    }
  }, [poolTickData, hasError, queryError])

  const isLoading = poolTickData === undefined && !queryError

  if (hasError) {
    return (
      <ChartContainer>
        <ErrorText>{t('Chart display error')}</ErrorText>
      </ChartContainer>
    )
  }

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
