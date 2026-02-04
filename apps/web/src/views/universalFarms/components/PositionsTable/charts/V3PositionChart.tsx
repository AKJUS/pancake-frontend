import { Skeleton, Text } from '@pancakeswap/uikit'
import { useMemo, useState, useEffect } from 'react'
import { usePositionPrices } from 'state/farmsV4/state/accountPositions/hooks/usePositionPrices'
import useIsTickAtLimit from 'hooks/v3/useIsTickAtLimit'
import { usePoolByChainId } from 'hooks/v3/usePools'
import { Pool, TICK_SPACINGS } from '@pancakeswap/v3-sdk'
import { Protocol } from '@pancakeswap/farms'
import styled from 'styled-components'
import { useTranslation } from '@pancakeswap/localization'
import { useQuery } from '@tanstack/react-query'
import { chainIdToExplorerInfoChainName } from 'state/info/api/client'
import { fetchTicksSurroundingPrice } from 'views/V3Info/data/pool/tickData'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import type { V3PositionChartProps } from './types'
import { ChartContainer } from './ChartContainer.styles'
import { CHART_HEIGHT } from './types'
import { PositionChartV2, ChartEntry } from './PositionChartV2'
import { clampTick } from '../../../utils'
import { ErrorText } from '../../shared/styled'

/**
 * V3 liquidity distribution chart for the expanded position row.
 * Uses the same data source as PoolDetail page (Explorer API via usePoolTickData).
 */
export function V3PositionChart({
  currency0,
  currency1,
  feeAmount,
  tickLower,
  tickUpper,
  tickCurrent: propTickCurrent,
  inverted = false,
}: V3PositionChartProps) {
  const { t } = useTranslation()
  const [hasError, setHasError] = useState(false)

  // Get pool to fetch tickCurrent
  // Use wrapped currencies because V3 pools use WBNB, not BNB
  const [, pool] = usePoolByChainId(currency0?.wrapped ?? undefined, currency1?.wrapped ?? undefined, feeAmount)

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

  // Fetch tick data from Explorer API directly with known fee amount
  const poolAddress = useMemo(
    () =>
      currency0 && currency1 && feeAmount
        ? Pool.getAddress(currency0.wrapped, currency1.wrapped, feeAmount)
        : undefined,
    [currency0, currency1, feeAmount],
  )

  // Get chainId and explorerChainName for fetching tick data
  const chainId = pool?.chainId ?? currency0?.chainId

  // Map chainId to explorer chain name directly instead of using query parameter
  const explorerChainName = useMemo(() => {
    if (!chainId) return undefined
    return chainIdToExplorerInfoChainName[chainId as keyof typeof chainIdToExplorerInfoChainName]
  }, [chainId])

  // Calculate tick spacing from fee amount
  const tickSpacing = useMemo(() => (feeAmount ? TICK_SPACINGS[feeAmount] : undefined), [feeAmount])

  // Fetch tick data directly without relying on poolInfo
  const { data: poolTickData, error: queryError } = useQuery({
    queryKey: ['v3/position/chart/tickData', chainId, poolAddress, tickSpacing],
    queryFn: async ({ signal }) => {
      if (!poolAddress || !explorerChainName || !chainId || !tickSpacing) {
        console.warn('[V3PositionChart] Missing required params:', {
          poolAddress,
          explorerChainName,
          chainId,
          tickSpacing,
        })
        return undefined
      }
      try {
        const result = await fetchTicksSurroundingPrice({
          poolAddress,
          chainName: explorerChainName,
          chainId,
          signal,
          protocol: Protocol.V3,
          tickSpacing,
        })
        if (result.error) {
          console.error('[V3PositionChart] Error fetching tick data:', { poolAddress, chainId, explorerChainName })
        }
        return result
      } catch (error) {
        console.error('[V3PositionChart] Exception fetching tick data:', error, {
          poolAddress,
          chainId,
          explorerChainName,
        })
        throw error
      }
    },
    enabled: Boolean(poolAddress && explorerChainName && chainId && tickSpacing),
    ...QUERY_SETTINGS_IMMUTABLE,
  })

  const tickAtLimit = useIsTickAtLimit(feeAmount, safeTickLower, safeTickUpper)
  const isFullRange = tickAtLimit?.LOWER && tickAtLimit?.UPPER

  // Use wrapped currencies for price calculations because V3 uses WBNB, not BNB
  const { priceLower, priceUpper, priceCurrent } = usePositionPrices({
    currencyA: currency0?.wrapped,
    currencyB: currency1?.wrapped,
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
      console.error('[V3PositionChart] Error processing tick data:', error)
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
