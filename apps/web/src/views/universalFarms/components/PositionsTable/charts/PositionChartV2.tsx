import { AutoColumn, AutoRow, Box, FlexGap, Text } from '@pancakeswap/uikit'
import styled, { useTheme } from 'styled-components'
import useResolvedTheme from 'hooks/useTheme'
import { formatAmount } from '@pancakeswap/utils/formatInfoNumbers'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, XAxis, ReferenceLine, ReferenceArea, Label, YAxis } from 'recharts'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { useTranslation } from '@pancakeswap/localization'
import { ErrorText } from '../../shared/styled'

/** Sanity bounds for price values to filter corrupted data (PAN-10696) */
const SANE_PRICE_MIN = 1e-18
const SANE_PRICE_MAX = 1e18

function isSanePrice(price: number): boolean {
  return Number.isFinite(price) && (price === 0 || (price >= SANE_PRICE_MIN && price <= SANE_PRICE_MAX))
}

/** Zoom scale multipliers: <1 zooms in (narrower range), >1 zooms out (wider range) */
const ZOOM_SCALES = [0.5, 1, 2, 4, 8]
const DEFAULT_ZOOM_INDEX = 1 // index 1 = 1x (current default behavior)

export interface ChartEntry {
  liquidity: number
  price0: number
  price1: number
  tick: number
}

/** Minimum bar width in pixels for visibility when chart is highly zoomed out */
const MIN_BAR_WIDTH_PX = 1

/** Custom bar shape that enforces minimum width for visibility when chart is zoomed out */
function LiquidityBarShape({
  x,
  y,
  width,
  height,
  fill,
}: {
  x: number
  y: number
  width: number
  height: number
  fill: string
}) {
  const barWidth = Math.max(width, MIN_BAR_WIDTH_PX)
  const barHeight = Math.max(height, MIN_BAR_WIDTH_PX)
  // Center the bar when we've increased width beyond original
  const adjustedX = width < MIN_BAR_WIDTH_PX ? x - (barWidth - width) / 2 : x
  return <rect x={adjustedX} y={y} width={barWidth} height={barHeight} fill={fill} rx={2} ry={2} />
}

interface PositionChartV2Props {
  chartData: ChartEntry[]
  tickLower: number
  tickUpper: number
  tickCurrent: number
  priceLower: number
  priceUpper: number
  priceCurrent: number
  baseIn?: boolean
  token0Symbol?: string
  token1Symbol?: string
  compact?: boolean
  height?: number
  isFullRange?: boolean
}

/**
 * Generic position chart component based on Solana PositionChart design.
 * Features: RangeBar with price labels, ReferenceArea for shaded range, color-coded range indicator.
 */
export const PositionChartV2: React.FC<PositionChartV2Props> = ({
  chartData,
  tickLower,
  tickUpper,
  tickCurrent,
  priceLower,
  priceUpper,
  priceCurrent,
  baseIn = true,
  token0Symbol,
  token1Symbol,
  compact = false,
  height = 200,
  isFullRange = false,
}) => {
  const { t } = useTranslation()
  const [renderError, setRenderError] = useState(false)

  // Zoom state: controls how much of the price range is visible
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const zoomScale = ZOOM_SCALES[zoomIndex]

  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.min(ZOOM_SCALES.length - 1, prev + 1))
  }, [])

  // Reset error state when data changes
  useEffect(() => {
    if (renderError) {
      setRenderError(false)
    }
  }, [chartData, tickLower, tickUpper, tickCurrent, renderError])
  const theme = useTheme()
  const { isDark } = useResolvedTheme()
  const gradientId = useId()

  // Filter data to position range +/- margin for better visualization
  const formattedData = useMemo(() => {
    try {
      if (!chartData || chartData.length === 0) return []

      // Filter out insane prices from chart data (PAN-10696)
      const priceKey = baseIn ? 'price0' : 'price1'
      const sanitizedData = chartData.filter((item) => {
        const price = item[priceKey]
        return isSanePrice(price)
      })

      if (sanitizedData.length === 0) {
        console.warn('[PositionChartV2] All chart data filtered out as insane')
        return []
      }
      const dataToUse = sanitizedData

      // Special handling for full range: center data around current tick
      if (isFullRange) {
        // Show data around the current tick, scaled by zoom
        const marginTicks = Math.round(500 * zoomScale)
        const minTick = tickCurrent - marginTicks
        const maxTick = tickCurrent + marginTicks

        let filteredData = dataToUse.filter((item) => {
          return item.tick >= minTick && item.tick <= maxTick
        })

        // If no data found, expand the range
        if (filteredData.length === 0) {
          const expandedMargin = Math.round(150 * zoomScale)
          filteredData = dataToUse.filter((item) => {
            return item.tick >= tickCurrent - expandedMargin && item.tick <= tickCurrent + expandedMargin
          })

          // Last resort: use all data
          if (filteredData.length === 0) {
            filteredData = dataToUse
          }
        }

        return filteredData.sort((a, b) => (baseIn ? a.tick - b.tick : b.tick - a.tick))
      }

      // Normal range handling
      const currentRange = tickUpper - tickLower

      // For very narrow ranges, use a larger relative margin to ensure visibility
      // For wider ranges, use the standard margin, scaled by zoom
      const minMarginTicks = 50 // Minimum margin in ticks for narrow ranges
      const relativeMargin = Math.max(currentRange * 0.3, minMarginTicks) * zoomScale

      const minTick = tickLower - relativeMargin
      const maxTick = tickUpper + relativeMargin

      // Filter data to the range we want to display
      let filteredData = dataToUse.filter((item) => {
        return item.tick >= minTick && item.tick <= maxTick
      })

      // If filtering removed all data, fall back to showing some data around the position
      // This can happen with very narrow ranges or when tick data is sparse
      if (filteredData.length === 0) {
        // Find the closest data points to the position range
        const expandedMargin = Math.max(currentRange * 2, 200) * zoomScale // Much larger margin for fallback
        filteredData = dataToUse.filter((item) => {
          return item.tick >= tickLower - expandedMargin && item.tick <= tickUpper + expandedMargin
        })

        // If still no data, just use all available data (last resort)
        if (filteredData.length === 0) {
          filteredData = dataToUse
        }
      }

      return filteredData.sort((a, b) => (baseIn ? a.tick - b.tick : b.tick - a.tick))
    } catch (error) {
      console.error('[PositionChartV2] Error filtering chart data:', error)
      setRenderError(true)
      return []
    }
  }, [chartData, tickLower, tickUpper, baseIn, isFullRange, tickCurrent, zoomScale])

  // Find x-axis positions for price boundaries and current price
  const [xLower, xCurrent, xUpper] = useMemo(() => {
    let dLower = formattedData.find((item) => item.tick === tickLower)
    const dCurrentExact = formattedData.find((item) => item.tick === tickCurrent)
    let dUpper = formattedData.find((item) => item.tick === tickUpper)

    // Try to find the closest tick for lower boundary if exact match not found
    if (!dLower && formattedData.length) {
      const closestData = formattedData.reduce((acc, item) => {
        return Math.abs(item.tick - tickLower) < Math.abs(acc.tick - tickLower) ? item : acc
      }, formattedData[0])
      dLower = closestData
    }

    // Try to find the closest tick for current if exact match not found (used only when priceCurrent is unavailable)
    let dCurrentFallback: ChartEntry | undefined
    if (!dCurrentExact && formattedData.length) {
      dCurrentFallback = formattedData.reduce((acc, item) => {
        if (item.tick < tickCurrent) {
          return item.tick > acc.tick ? item : acc
        }
        if (item.tick > tickCurrent) {
          return Math.abs(item.tick - tickCurrent) < Math.abs(acc.tick - tickCurrent) ? item : acc
        }
        return acc
      }, formattedData[0])
    }

    // Try to find the closest tick for upper boundary if exact match not found
    if (!dUpper && formattedData.length) {
      const closestData = formattedData.reduce((acc, item) => {
        return Math.abs(item.tick - tickUpper) < Math.abs(acc.tick - tickUpper) ? item : acc
      }, formattedData[0])
      dUpper = closestData
    }

    // Always use the exact priceLower/priceUpper props for positioning ReferenceLines
    // This ensures the range boundaries are positioned at the exact prices, not approximate values from data
    // When baseIn=false (inverted), we need to convert price0 format to price1 format
    const lowerPrice = baseIn ? priceLower : priceUpper > 0 ? 1 / priceUpper : priceLower
    const upperPrice = baseIn ? priceUpper : priceLower > 0 ? 1 / priceLower : priceUpper

    // For current price: prefer priceCurrent prop when valid (fixes PAN-10588)
    // - Prefer prop over data when valid: avoids wrong value from inexact tick match (e.g. Bin uses index as tick)
    // - Convert to display format: priceCurrent is always price0; when !baseIn we need price1 = 1/priceCurrent
    // - Supports price=0 when baseIn (can't invert 0 when !baseIn)
    const dCurrent = dCurrentExact ?? dCurrentFallback
    const currentPriceFromData = baseIn ? dCurrent?.price0 : dCurrent?.price1
    const hasValidProp =
      priceCurrent != null && Number.isFinite(priceCurrent) && (baseIn ? priceCurrent >= 0 : priceCurrent > 0)
    const currentPrice = hasValidProp
      ? baseIn
        ? priceCurrent
        : 1 / priceCurrent
      : currentPriceFromData ?? (baseIn ? priceCurrent : priceCurrent > 0 ? 1 / priceCurrent : undefined)

    return [lowerPrice, currentPrice, upperPrice]
  }, [formattedData, tickCurrent, tickLower, tickUpper, baseIn, priceLower, priceUpper, priceCurrent])

  // Format current price for display - use subscript for very small numbers (like PriceRangeDisplay), never round to blank
  const formattedCurrentPrice = useMemo(() => {
    if (xCurrent == null || !Number.isFinite(Number(xCurrent))) return undefined
    const num = Number(xCurrent)
    // Reject insane current prices (PAN-10696)
    if (!isSanePrice(num)) return undefined
    if (num === 0) return '0'

    // Simple formatting: always show 4 decimals for prices
    return num.toFixed(4)
  }, [xCurrent])

  // Determine range color (green if in range, red if out of range)
  const rangeColor = useMemo(() => {
    return tickCurrent >= tickLower && tickCurrent <= tickUpper ? theme.colors.success : theme.colors.failure
  }, [tickCurrent, tickLower, tickUpper, theme.colors.success, theme.colors.failure])

  // Calculate max Y value for domain
  const maxY = useMemo(() => {
    let max = 0
    for (const item of formattedData) {
      if (item.liquidity > max) {
        max = item.liquidity
      }
    }
    return max
  }, [formattedData])

  // Calculate x-axis domain to include priceLower and priceUpper with padding
  // Always prioritize position boundaries over data points to show full range
  const xAxisDomain = useMemo(() => {
    const priceKey = baseIn ? 'price0' : 'price1'

    // Reject insane priceCurrent for domain calculation (PAN-10696)
    const displayCurrentPrice = baseIn ? priceCurrent : priceCurrent > 0 ? 1 / priceCurrent : 0
    const hasValidCurrentPrice = displayCurrentPrice >= 0 && isSanePrice(displayCurrentPrice)

    // Special handling for full range positions: center around current price
    if (isFullRange && hasValidCurrentPrice) {
      // Show a window around the current price, scaled by zoom
      const rangeMultiplier = 0.1 * zoomScale // 10% on each side at 1x zoom
      const windowSize = displayCurrentPrice * rangeMultiplier

      let minPrice = displayCurrentPrice - windowSize
      let maxPrice = displayCurrentPrice + windowSize

      // If we have chart data, expand the window to include nearby data points
      if (formattedData.length > 0) {
        const dataPrices = formattedData.map((d) => d[priceKey]).filter((p) => p > 0 && isSanePrice(p))
        if (dataPrices.length > 0) {
          // Find data points within a larger window, scaled by zoom
          const largerWindow = displayCurrentPrice * 0.15 * zoomScale
          const relevantPrices = dataPrices.filter(
            (p) => p >= displayCurrentPrice - largerWindow && p <= displayCurrentPrice + largerWindow,
          )

          if (relevantPrices.length > 0) {
            const dataMin = Math.min(...relevantPrices)
            const dataMax = Math.max(...relevantPrices)
            // Expand the window to include relevant data, but keep it centered-ish
            minPrice = Math.min(minPrice, dataMin)
            maxPrice = Math.max(maxPrice, dataMax)
          }
        }
      }

      // Add some padding for aesthetics
      const range = maxPrice - minPrice
      const padding = range * 0.1

      return [Math.max(0, minPrice - padding), maxPrice + padding]
    }

    // Check if position range is valid
    const hasValidRange = priceLower && priceUpper && priceLower > 0 && priceUpper > 0

    // If position range is invalid, fall back to data points only
    if (!hasValidRange) {
      if (formattedData.length === 0) {
        return undefined
      }

      const dataPrices = formattedData.map((d) => d[priceKey]).filter((p) => p > 0 && isSanePrice(p))
      if (dataPrices.length === 0) {
        return undefined
      }

      const minDataPrice = Math.min(...dataPrices)
      const maxDataPrice = Math.max(...dataPrices)
      const range = maxDataPrice - minDataPrice
      const padding = range > 0 ? range * 0.1 : minDataPrice * 0.1 // 10% padding, handle zero range

      let domainMin = Math.max(0, minDataPrice - padding)
      let domainMax = maxDataPrice + padding

      // Include current price in domain when valid (fixes PAN-10588, supports price=0)
      if (hasValidCurrentPrice) {
        if (displayCurrentPrice < domainMin) domainMin = Math.max(0, displayCurrentPrice - padding)
        if (displayCurrentPrice > domainMax) domainMax = displayCurrentPrice + padding
      }

      return [domainMin, domainMax]
    }

    // Convert priceLower/priceUpper to match the displayed price format (price0 or price1)
    // priceLower/priceUpper are always in baseIn format, so invert when baseIn is false
    const displayPriceLower = baseIn ? priceLower : priceUpper > 0 ? 1 / priceUpper : priceLower
    const displayPriceUpper = baseIn ? priceUpper : priceLower > 0 ? 1 / priceLower : priceUpper

    // Ensure lower < upper for domain calculation
    const sortedLower = Math.min(displayPriceLower, displayPriceUpper)
    const sortedUpper = Math.max(displayPriceLower, displayPriceUpper)

    // Calculate the position range - handle very narrow ranges
    const positionRange = sortedUpper - sortedLower
    const isNarrowRange = positionRange < sortedLower * 0.1 // Range is less than 10% of lower price

    let minDataPrice = sortedLower
    let maxDataPrice = sortedUpper

    // If we have data, include it in the domain calculation
    // IMPORTANT: Don't filter data prices here - if data passed the tick filter in formattedData,
    // we need to include it in the domain to ensure it's visible (fixes PAN-10587)
    if (formattedData.length > 0) {
      const dataPrices = formattedData.map((d) => d[priceKey]).filter((p) => p > 0 && isSanePrice(p))

      if (dataPrices.length > 0) {
        minDataPrice = Math.min(minDataPrice, ...dataPrices)
        maxDataPrice = Math.max(maxDataPrice, ...dataPrices)
      }
    }

    // Always ensure position boundaries are included
    const overallMin = Math.min(minDataPrice, sortedLower)
    const overallMax = Math.max(maxDataPrice, sortedUpper)

    // Calculate range and add padding
    // Use larger padding for narrow ranges so the range bars are more visible
    const range = overallMax - overallMin
    const paddingPercent = isNarrowRange ? 0.15 : 0.05 // 15% padding for narrow, 5% for normal
    const padding = range > 0 ? range * paddingPercent : overallMin * paddingPercent

    let domainMin = Math.max(0, overallMin - padding) // Ensure non-negative
    let domainMax = overallMax + padding

    // Ensure current price is included in domain when valid (fixes PAN-10588: purple line missing for some positions)
    // Recharts clips ReferenceLine when x is outside the axis domain - expanding domain fixes this. Supports price=0.
    if (hasValidCurrentPrice) {
      if (displayCurrentPrice < domainMin) {
        const extendPadding = (domainMax - displayCurrentPrice) * 0.1
        domainMin = Math.max(0, displayCurrentPrice - extendPadding)
      }
      if (displayCurrentPrice > domainMax) {
        const extendPadding = (displayCurrentPrice - domainMin) * 0.1
        domainMax = displayCurrentPrice + extendPadding
      }
    }

    return [domainMin, domainMax]
  }, [formattedData, priceLower, priceUpper, baseIn, isFullRange, priceCurrent, zoomScale])

  // Calculate dynamic precision and minTickGap for X-axis to avoid duplicate/overlapping labels
  const { xAxisTickPrecision, dynamicMinTickGap } = useMemo(() => {
    if (!xAxisDomain || formattedData.length === 0)
      return { xAxisTickPrecision: 2, dynamicMinTickGap: compact ? 20 : 30 }

    const priceKey = baseIn ? 'price0' : 'price1'

    // Get all unique prices that would be displayed as ticks
    const prices = formattedData
      .map((d) => d[priceKey])
      .filter((p) => p > 0 && p >= xAxisDomain[0] && p <= xAxisDomain[1])
      .sort((a, b) => a - b)

    if (prices.length < 2) return { xAxisTickPrecision: 2, dynamicMinTickGap: compact ? 20 : 30 }

    // Find the minimum difference between adjacent prices
    let minDiff = Infinity
    for (let i = 1; i < prices.length; i++) {
      const diff = Math.abs(prices[i] - prices[i - 1])
      if (diff > 0 && diff < minDiff) {
        minDiff = diff
      }
    }

    if (!Number.isFinite(minDiff) || minDiff === 0)
      return { xAxisTickPrecision: 2, dynamicMinTickGap: compact ? 20 : 30 }

    // Calculate precision needed to show the minimum difference
    // Start with precision 2 and increase until adjacent values are distinguishable
    let precision = 2
    const maxPrecision = 8

    // Test if current precision is sufficient
    while (precision < maxPrecision) {
      let allDistinct = true
      const formatted = new Set<string>()

      for (const price of prices) {
        const formattedVal = formatAmount(price, { precision }) ?? String(price)
        if (formatted.has(formattedVal)) {
          allDistinct = false
          break
        }
        formatted.add(formattedVal)
      }

      if (allDistinct) {
        break
      }

      precision++
    }

    // Calculate dynamic minTickGap based on precision to prevent physical overlap
    // Higher precision = longer labels = need more space between ticks
    // Base: 30px for compact=false, 20px for compact=true
    // Each digit beyond precision 2 adds ~5px of width (approximate)
    const baseGap = compact ? 20 : 30
    const precisionMultiplier = Math.max(1, precision - 2) // 0 for precision 2, 1 for precision 3, etc.
    const calculatedGap = baseGap + precisionMultiplier * 8 // Add 8px per extra digit

    return {
      xAxisTickPrecision: precision,
      dynamicMinTickGap: calculatedGap,
    }
  }, [xAxisDomain, formattedData, baseIn, compact])

  // State to track x-axis pixel positions for RangeBar
  const [x1, setX1] = useState<number | undefined>(undefined)
  const [x2, setX2] = useState<number | undefined>(undefined)
  const [x0, setX0] = useState<number | undefined>(undefined)

  // Reset pixel positions when baseIn changes to avoid stale values from the old chart scale
  useEffect(() => {
    setX0(undefined)
    setX1(undefined)
    setX2(undefined)
  }, [baseIn])

  if (renderError) {
    return <ErrorText>{t('Chart display error')}</ErrorText>
  }

  if (!formattedData.length) {
    return null
  }

  return (
    <Box width="100%" position="relative">
      {!compact && !isFullRange && (
        <RangeBar x0={x0} x1={x1} x2={x2} xLower={xLower} xUpper={xUpper} rangeColor={rangeColor} baseIn={baseIn} />
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={formattedData}
          barCategoryGap={0}
          barGap={0}
          margin={{
            top: compact ? 20 : 30,
            right: 0,
            left: 0,
            bottom: compact ? 4 : 8,
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={isDark ? 'rgba(168, 129, 252, 0.95)' : 'rgba(118, 69, 217, 0.95)'}
                stopOpacity={0.95}
              />
              <stop
                offset="95%"
                stopColor={isDark ? 'rgba(168, 129, 252, 0.5)' : 'rgba(118, 69, 217, 0.5)'}
                stopOpacity={0.95}
              />
            </linearGradient>
          </defs>

          <XAxis
            type="number"
            dataKey={baseIn ? 'price0' : 'price1'}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: compact ? 10 : 12, fill: theme.colors.textSubtle }}
            tickFormatter={(value) => formatAmount(value, { precision: xAxisTickPrecision }) ?? ''}
            minTickGap={dynamicMinTickGap}
            interval="preserveStartEnd"
            domain={xAxisDomain}
            allowDataOverflow
          />
          <YAxis hide axisLine={false} tickLine={false} domain={[0, maxY]} />

          {/* Current price line with label - show when we have valid current price (fixes PAN-10588) */}
          {xCurrent != null && Number.isFinite(xCurrent) && isSanePrice(xCurrent) && (
            <>
              <ReferenceLine x={xCurrent} stroke={theme.colors.secondary} strokeWidth={2} strokeDasharray="3 3">
                {formattedCurrentPrice && (
                  <Label
                    value={formattedCurrentPrice}
                    position="top"
                    offset={10}
                    style={{
                      fill: theme.colors.secondary,
                      fontSize: compact ? '11px' : '12px',
                      fontWeight: 'bold',
                      stroke: 'white',
                      strokeWidth: 0.5,
                      paintOrder: 'stroke',
                    }}
                  />
                )}
              </ReferenceLine>
              <ReferenceLine
                x={xCurrent}
                stroke={theme.colors.secondary}
                strokeWidth={1}
                shape={(props) => <ComputeX x={props.x1} onEffect={setX0} baseIn={baseIn} />}
              />
            </>
          )}

          {/* Shaded area between range boundaries (or full chart for full range) */}
          {isFullRange && xAxisDomain ? (
            <ReferenceArea x1={xAxisDomain[0]} x2={xAxisDomain[1]} fill={theme.colors.success} fillOpacity={0.1} />
          ) : (
            xLower && xUpper && <ReferenceArea x1={xLower} x2={xUpper} fill={rangeColor} fillOpacity={0.1} />
          )}

          {/* Invisible reference lines to compute x-axis positions for RangeBar (not needed for full range) */}
          {xLower && xUpper && !compact && !isFullRange && (
            <>
              <ReferenceLine
                segment={[
                  { x: xLower, y: maxY },
                  { x: xUpper, y: maxY },
                ]}
                stroke={rangeColor}
                position="start"
                strokeWidth={0}
                shape={(props) => <ComputeX x={props.x1} onEffect={setX1} baseIn={baseIn} />}
              />
              <ReferenceLine
                segment={[
                  { x: xLower, y: maxY },
                  { x: xUpper, y: maxY },
                ]}
                stroke={rangeColor}
                position="end"
                strokeWidth={0}
                shape={(props) => <ComputeX x={props.x2} onEffect={setX2} baseIn={baseIn} />}
              />
            </>
          )}

          {/* Range boundary lines (hide for full range) */}
          {!isFullRange && xLower && <ReferenceLine position="start" x={xLower} stroke={rangeColor} strokeWidth={2} />}
          {!isFullRange && xUpper && <ReferenceLine position="end" x={xUpper} stroke={rangeColor} strokeWidth={2} />}

          <Bar
            dataKey="liquidity"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            minPointSize={MIN_BAR_WIDTH_PX}
            shape={(props: { x?: number; y?: number; width?: number; height?: number; fill?: string }) => (
              <LiquidityBarShape
                x={props.x ?? 0}
                y={props.y ?? 0}
                width={props.width ?? 0}
                height={props.height ?? 0}
                fill={props.fill ?? `url(#${gradientId})`}
              />
            )}
          />
        </BarChart>
      </ResponsiveContainer>
      {/* Zoom controls */}
      <ZoomControlsWrapper>
        <ZoomButton onClick={handleZoomOut} disabled={zoomIndex >= ZOOM_SCALES.length - 1}>
          −
        </ZoomButton>
        <ZoomButton onClick={handleZoomIn} disabled={zoomIndex <= 0}>
          +
        </ZoomButton>
      </ZoomControlsWrapper>
      {/* Current price legend - hide in compact mode */}
      {!compact && token0Symbol && token1Symbol && (
        <AutoRow justifyContent="space-between" mt="8px">
          <FlexGap alignItems="center" gap="4px">
            <Box
              style={{
                width: '7px',
                height: '7px',
                background: theme.colors.secondary,
                borderRadius: '10px',
              }}
            />
            <Text fontSize="12px" lineHeight={1.5}>
              {t('Current Price')}
            </Text>
          </FlexGap>
          <FlexGap alignItems="center" gap="4px">
            <Text fontSize="12px" lineHeight={1.5} fontWeight={600}>
              {formattedCurrentPrice}
            </Text>
            <Text fontSize="12px" lineHeight={1.5} color="textSubtle">
              {t('%subA% per %subB%', {
                subA: baseIn ? token0Symbol : token1Symbol,
                subB: baseIn ? token1Symbol : token0Symbol,
              })}
            </Text>
          </FlexGap>
        </AutoRow>
      )}
    </Box>
  )
}

// Helper component to compute x-axis pixel positions
const ComputeX = ({ x, onEffect, baseIn }) => {
  useEffect(() => {
    onEffect(x)
  }, [x, baseIn, onEffect])
  return null
}

// Range bar component showing min/max prices and position indicator
const RangeBar = ({ x0, x1, x2, xLower, xUpper, rangeColor, baseIn }) => {
  return (
    <AutoColumn width="100%" py="8px" gap="4px">
      <PriceRangeLabel x1={x1} x2={x2} xLower={xLower} xUpper={xUpper} baseIn={baseIn} />
      <Box width="100%" position="relative">
        <TrackerBar />
        {typeof x1 !== 'undefined' && typeof x2 !== 'undefined' ? (
          <PriceRangeBar left={x1} right={x2} rangeColor={rangeColor} />
        ) : null}
        {typeof x0 !== 'undefined' ? <CurrentPin left={x0} /> : null}
      </Box>
    </AutoColumn>
  )
}

// Price range label component
const PriceRangeLabel = ({ x1, x2, xLower, xUpper, baseIn: _baseIn }) => {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState<number | undefined>(undefined)
  const [rightWidth, setRightWidth] = useState<number | undefined>(undefined)

  // Calculate precision needed to distinguish xLower and xUpper
  const rangePrecision = useMemo(() => {
    if (!xLower || !xUpper || xLower === xUpper) return 4

    const diff = Math.abs(Number(xUpper) - Number(xLower))
    if (diff === 0) return 4

    // Calculate how many decimal places we need to show the difference
    let precision = 2
    const maxPrecision = 8

    while (precision < maxPrecision) {
      const lowerStr = formatNumber(Number(xLower), { maxDecimalDisplayDigits: precision })
      const upperStr = formatNumber(Number(xUpper), { maxDecimalDisplayDigits: precision })

      if (lowerStr !== upperStr) {
        break
      }
      precision++
    }

    return Math.max(precision, 4) // Use at least 4 for readability
  }, [xLower, xUpper])

  const displayMinPrice = useMemo(() => {
    // xLower is already adjusted for baseIn in the parent component
    const price = xLower
    if (!price) return '0'
    return Number(price) < 1
      ? formatNumber(price, { maximumDecimalTrailingZeroes: rangePrecision })
      : formatNumber(price, { maxDecimalDisplayDigits: rangePrecision })
  }, [xLower, rangePrecision])

  const displayMaxPrice = useMemo(() => {
    // xUpper is already adjusted for baseIn in the parent component
    const price = xUpper
    if (!price) return '∞'
    return Number(price) < 1
      ? formatNumber(price, { maximumDecimalTrailingZeroes: rangePrecision })
      : formatNumber(price, { maxDecimalDisplayDigits: rangePrecision })
  }, [xUpper, rangePrecision])

  const intersected = useMemo(() => {
    if (!leftWidth || !rightWidth || !x1 || !x2) return false
    return rightWidth + leftWidth > x2 - x1
  }, [leftWidth, rightWidth, x1, x2])

  useEffect(() => {
    if (leftRef.current && rightRef.current) {
      setLeftWidth(leftRef.current?.clientWidth)
      setRightWidth(rightRef.current?.clientWidth)
    }
  }, [x1, x2])

  if (!x1 || !x2) return null

  return (
    <Box width="100%" position="relative" height="30px">
      <PriceRangeContainer left={x1} right={x2}>
        <AutoRow justifyContent="space-between" flexWrap="nowrap">
          <AutoColumn alignItems="flex-start">
            <Transform distance={-(leftWidth ?? 0) / 2} enabled={intersected}>
              <Text fontSize="12px" lineHeight={1.5} fontWeight={600} ref={leftRef}>
                {displayMinPrice}
              </Text>
            </Transform>
          </AutoColumn>

          <AutoColumn alignItems="flex-end">
            <Transform distance={(rightWidth ?? 0) / 2} enabled={intersected}>
              <Text fontSize="12px" lineHeight={1.5} fontWeight={600} ref={rightRef}>
                {displayMaxPrice}
              </Text>
            </Transform>
          </AutoColumn>
        </AutoRow>
      </PriceRangeContainer>
    </Box>
  )
}

// Zoom controls styled components
const ZoomControlsWrapper = styled.div`
  position: absolute;
  right: 8px;
  bottom: -12px;
  display: flex;
  gap: 4px;
  z-index: 1;
`

const ZoomButton = styled.button<{ disabled?: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ disabled }) => (disabled ? 0.4 : 0.9)};
  background-color: ${({ theme }) => theme.colors.backgroundAlt};
  color: ${({ theme }) => theme.colors.text};
  user-select: none;
  padding: 0;

  &:hover {
    opacity: ${({ disabled }) => (disabled ? 0.4 : 0.6)};
  }
`

// Styled components
const TrackerBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 5px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.disabled};
  border: 0.5px solid ${({ theme }) => theme.colors.inputSecondary};
`

const CurrentPin = styled.div<{ left: number }>`
  position: absolute;
  top: -2px;
  left: ${({ left }) => left - 2.5}px;
  width: 5px;
  height: 12px;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.secondary};

  &:before {
    background-image: url(data:image/svg+xml,%3Csvg%20width%3D%227%22%20height%3D%227%22%20viewBox%3D%220%200%207%207%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1.14844%202.4598C0.803786%201.79417%201.28689%201%202.03646%201H4.96209C5.71165%201%206.19476%201.79417%205.85011%202.4598L4.38729%205.28495C4.01435%206.00522%202.98419%206.00522%202.61125%205.28495L1.14844%202.4598Z%22%20fill%3D%22%237645D9%22%20stroke%3D%22white%22%2F%3E%3C%2Fsvg%3E);
    background-size: cover;
    background-repeat: no-repeat;
    content: '';
    position: absolute;
    top: -5px;
    left: -1px;
    width: 7px;
    height: 6px;
  }
`

const PriceRangeBar = styled.div<{ left: number; right: number; rangeColor: string }>`
  position: absolute;
  top: 0;
  left: ${({ left }) => left}px;
  width: ${({ right, left }) => right - left}px;
  height: 5px;
  border-radius: 8px;
  background: ${({ rangeColor }) => rangeColor};
`

const PriceRangeContainer = styled.div<{ left: number; right: number }>`
  position: absolute;
  height: 30px;
  top: 0;
  left: ${({ left }) => left}px;
  width: ${({ right, left }) => right - left}px;
`

const Transform = styled.div<{ distance: number; enabled: boolean }>`
  ${({ distance, enabled }) =>
    enabled &&
    `
    transform: translateX(${distance}px);
  `}
`
