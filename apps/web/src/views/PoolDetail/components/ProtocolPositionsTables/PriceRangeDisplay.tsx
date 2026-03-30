import { Flex, FlexGap, Text } from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import styled from 'styled-components'

const PriceRangeContainer = styled.div`
  position: relative;
  width: 100%;
  height: 20px;
  display: flex;
  align-items: center;
`

const PriceRangeBar = styled.div<{ outOfRange: boolean; disabled?: boolean }>`
  width: 100%;
  height: 6px;
  background: ${({ theme, outOfRange, disabled }) =>
    disabled ? theme.colors.disabled : outOfRange ? theme.colors.failure : theme.colors.success};
  border-radius: 4px;
  position: relative;
`

const ExtendedPriceRangeBar = styled.div`
  width: 100%;
  height: 6px;
  border-radius: 4px;
  position: relative;
  display: flex;
`

const BarSegment = styled.div<{
  width: number
  isGray?: boolean
  outOfRange?: boolean
  disabled?: boolean
}>`
  height: 100%;
  background: ${({ theme, isGray, outOfRange, disabled }) => {
    if (disabled) return theme.colors.disabled
    if (isGray) return theme.colors.tertiary // More visible gray color
    return outOfRange ? theme.colors.failure : theme.colors.success
  }};
  ${({ width }) => `width: ${width}%;`}

  &:first-child {
    border-radius: 4px 0 0 4px;
  }

  &:last-child {
    border-radius: 0 4px 4px 0;
  }

  &:only-child {
    border-radius: 4px;
  }
`

const CurrentPriceLine = styled.div<{
  position: number
  outOfRange: boolean
  disabled?: boolean
  isOverflow?: boolean
}>`
  position: absolute;
  left: ${({ position }) => Math.max(0, Math.min(100, position))}%;
  top: -5px;
  transform: translateX(-50%);
  width: 4px;
  height: 16px;
  background: ${({ theme, outOfRange, disabled, isOverflow }) =>
    disabled
      ? theme.colors.disabled
      : isOverflow
      ? theme.colors.tertiary
      : outOfRange
      ? theme.colors.failure
      : theme.colors.success};
  border-radius: 3px;
  z-index: 2;
`

const RangeMarker = styled.div<{ position: number; disabled?: boolean }>`
  position: absolute;
  left: ${({ position }) => Math.max(0, Math.min(100, position))}%;
  top: -5px;
  transform: translateX(-50%);
  width: 4px;
  height: 16px;
  background: ${({ theme, disabled }) => (disabled ? theme.colors.disabled : theme.colors.failure)};
  border-radius: 3px;
  z-index: 2;
`

const PercentageText = styled(Text)`
  color: ${({ theme }) => theme.colors.textSubtle};
  font-size: 12px;
  font-weight: 400;
`

const PercentageContainer = styled.div<{
  leftPosition: number
  rightPosition: number
  $maxWidth?: string
}>`
  position: relative;
  width: 100%;
  max-width: ${({ $maxWidth }) => $maxWidth};
  height: 16px;
  margin-bottom: 4px;
  margin-left: auto;
  margin-right: auto;

  .left-percentage {
    position: absolute;
    left: ${({ leftPosition }) => leftPosition}%;
    transform: translateX(-50%);
  }

  .right-percentage {
    position: absolute;
    left: ${({ rightPosition }) => rightPosition}%;
    transform: translateX(-50%);
  }
`

const PriceContainer = styled.div<{ leftPosition: number; rightPosition: number; $maxWidth?: string }>`
  position: relative;
  width: 100%;
  max-width: ${({ $maxWidth }) => $maxWidth};
  height: 24px;
  margin-bottom: 2px;
  margin-left: auto;
  margin-right: auto;

  .left-price {
    position: absolute;
    left: ${({ leftPosition }) => leftPosition}%;
    transform: translateX(-40%);
  }

  .right-price {
    position: absolute;
    left: ${({ rightPosition }) => rightPosition}%;
    transform: translateX(-50%);
  }
`

const BarWrapper = styled.div<{ $maxWidth?: string }>`
  width: 100%;
  max-width: ${({ $maxWidth }) => $maxWidth};
  margin-bottom: 4px;
  margin-left: auto;
  margin-right: auto;
`

interface PriceRangeDisplayProps {
  minPrice: string
  maxPrice: string
  currentPrice?: string
  minPercentage?: string
  maxPercentage?: string
  rangePosition?: number
  outOfRange?: boolean
  removed?: boolean
  showPercentages?: boolean
  maxWidth?: string
  // Raw numeric values for validation (avoid parsing formatted strings)
  minPriceRaw?: number
  maxPriceRaw?: number
  currentPriceRaw?: number
}

export const PriceRangeDisplay: React.FC<PriceRangeDisplayProps> = ({
  minPrice,
  maxPrice,
  currentPrice,
  minPercentage,
  maxPercentage,
  rangePosition = 50,
  outOfRange = false,
  removed = false,
  showPercentages = true,
  maxWidth = '190px',
  minPriceRaw,
  maxPriceRaw,
  currentPriceRaw,
}) => {
  // Use raw values if provided, otherwise mark as invalid
  const currentPriceNum = currentPriceRaw ?? null
  let minPriceNum = minPriceRaw ?? NaN
  let maxPriceNum = maxPriceRaw ?? NaN

  // CRITICAL FIX: If prices are inverted, swap them before display
  // This is a final safeguard in case prices are still inverted after upstream fixes
  let displayMinPriceStr = minPrice
  let displayMaxPriceStr = maxPrice
  if (!Number.isNaN(minPriceNum) && !Number.isNaN(maxPriceNum) && minPriceNum > maxPriceNum) {
    const temp = minPriceNum
    minPriceNum = maxPriceNum
    maxPriceNum = temp
    // Also swap the string values for display
    displayMinPriceStr = maxPrice
    displayMaxPriceStr = minPrice
  }

  // Check if current price is out of range - skip if prices are invalid
  const isOverflowLeft =
    currentPriceNum !== null &&
    !Number.isNaN(minPriceNum) &&
    !Number.isNaN(maxPriceNum) &&
    currentPriceNum < minPriceNum
  const isOverflowRight =
    currentPriceNum !== null &&
    !Number.isNaN(minPriceNum) &&
    !Number.isNaN(maxPriceNum) &&
    currentPriceNum > maxPriceNum
  const hasOverflow = outOfRange && (isOverflowLeft || isOverflowRight)

  // Calculate display values and positions
  // Prices are now smartly formatted upstream in priceRange.ts functions
  // Only need to handle edge cases and validate the input
  let displayMinPrice = displayMinPriceStr
  let displayMaxPrice = displayMaxPriceStr

  // Handle special values based on raw numeric values and formatted strings
  if (displayMinPriceStr === '0') {
    displayMinPrice = '0'
  } else if (
    displayMinPriceStr === '-' ||
    displayMinPriceStr === 'NaN' ||
    displayMinPriceStr.includes('NaN') ||
    Number.isNaN(minPriceNum)
  ) {
    displayMinPrice = '-'
  }

  if (displayMaxPriceStr === '∞' || displayMaxPriceStr === 'Infinity') {
    displayMaxPrice = '∞'
  } else if (
    displayMaxPriceStr === '-' ||
    displayMaxPriceStr === 'NaN' ||
    displayMaxPriceStr.includes('NaN') ||
    Number.isNaN(maxPriceNum)
  ) {
    displayMaxPrice = '-'
  }

  let currentPriceLinePosition = rangePosition
  let percentageLeftPosition = 0
  let percentageRightPosition = 100

  // Check if we have valid prices for position calculations
  // If any price is invalid (-, NaN, etc.), keep default edge positions (0 and 100)
  const hasValidPrices =
    displayMinPrice !== '-' &&
    displayMaxPrice !== '-' &&
    !Number.isNaN(minPriceNum) &&
    !Number.isNaN(maxPriceNum) &&
    Number.isFinite(minPriceNum) &&
    Number.isFinite(maxPriceNum)

  // Accommodate longer numbers
  const EXTRA_DISTANCE = Math.min(
    displayMinPrice.length + displayMaxPrice.length > 12 ? displayMinPrice.length + displayMaxPrice.length : 0,
    40, // Max extra distance 40%
  )

  // Minimum distance between text positions (in percentage)
  const MIN_TEXT_DISTANCE = 35 + EXTRA_DISTANCE

  // Minimum width for the main range (colored segment) in percentage
  const MIN_RANGE_WIDTH = 35 + EXTRA_DISTANCE

  // Only calculate custom positions if we have valid prices and overflow condition
  if (hasOverflow && hasValidPrices && currentPriceNum !== null) {
    if (isOverflowLeft) {
      const totalRange = maxPriceNum - currentPriceNum
      const graySegmentWidth = ((minPriceNum - currentPriceNum) / totalRange) * 100

      currentPriceLinePosition = 0

      // Calculate ideal positions
      let idealLeftPosition = graySegmentWidth
      let idealRightPosition = 100

      // Enforce minimum distance
      const currentDistance = idealRightPosition - idealLeftPosition
      if (currentDistance < MIN_TEXT_DISTANCE) {
        // Expand the range to maintain minimum distance
        const expansion = (MIN_TEXT_DISTANCE - currentDistance) / 2
        idealLeftPosition = Math.max(0, idealLeftPosition - expansion)
        idealRightPosition = Math.min(100, idealRightPosition + expansion)

        // If we can't expand both sides equally, prioritize the side that can expand more
        if (idealLeftPosition === 0) {
          idealRightPosition = Math.min(100, idealLeftPosition + MIN_TEXT_DISTANCE)
        } else if (idealRightPosition === 100) {
          idealLeftPosition = Math.max(0, idealRightPosition - MIN_TEXT_DISTANCE)
        }
      }

      percentageLeftPosition = idealLeftPosition
      percentageRightPosition = idealRightPosition
    }

    if (isOverflowRight) {
      const totalRange = currentPriceNum - minPriceNum
      const coloredSegmentWidth = ((maxPriceNum - minPriceNum) / totalRange) * 100

      currentPriceLinePosition = 100

      // Calculate ideal positions
      let idealLeftPosition = 0
      let idealRightPosition = coloredSegmentWidth

      // Enforce minimum distance
      const currentDistance = idealRightPosition - idealLeftPosition
      if (currentDistance < MIN_TEXT_DISTANCE) {
        // Expand the range to maintain minimum distance
        const expansion = (MIN_TEXT_DISTANCE - currentDistance) / 2
        idealLeftPosition = Math.max(0, idealLeftPosition - expansion)
        idealRightPosition = Math.min(100, idealRightPosition + expansion)

        // If we can't expand both sides equally, prioritize the side that can expand more
        if (idealLeftPosition === 0) {
          idealRightPosition = Math.min(100, idealLeftPosition + MIN_TEXT_DISTANCE)
        } else if (idealRightPosition === 100) {
          idealLeftPosition = Math.max(0, idealRightPosition - MIN_TEXT_DISTANCE)
        }
      }

      percentageLeftPosition = idealLeftPosition
      percentageRightPosition = idealRightPosition
    }
  }

  const renderBar = () => {
    if (!hasOverflow) {
      // Original behavior - single colored bar
      return (
        <PriceRangeBar outOfRange={outOfRange} disabled={removed}>
          <CurrentPriceLine position={currentPriceLinePosition} outOfRange={outOfRange} disabled={removed} />
        </PriceRangeBar>
      )
    }

    // Extended bar with segments
    if (isOverflowLeft) {
      const totalRange = maxPriceNum - currentPriceNum!
      let graySegmentWidth = ((minPriceNum - currentPriceNum!) / totalRange) * 100
      let coloredSegmentWidth = ((maxPriceNum - minPriceNum) / totalRange) * 100

      // Enforce minimum width for colored segment
      if (coloredSegmentWidth < MIN_RANGE_WIDTH) {
        coloredSegmentWidth = MIN_RANGE_WIDTH
        graySegmentWidth = 100 - coloredSegmentWidth
      }

      return (
        <ExtendedPriceRangeBar>
          <BarSegment width={graySegmentWidth} isGray disabled={removed} />
          <BarSegment width={coloredSegmentWidth} outOfRange={outOfRange} disabled={removed} />
          <CurrentPriceLine
            position={currentPriceLinePosition}
            outOfRange={outOfRange}
            disabled={removed}
            isOverflow={hasOverflow}
          />
          {/* Range markers at the edges of the main range */}
          <RangeMarker position={graySegmentWidth} disabled={removed} />
          <RangeMarker position={100} disabled={removed} />
        </ExtendedPriceRangeBar>
      )
    }

    if (isOverflowRight) {
      const totalRange = currentPriceNum! - minPriceNum
      let coloredSegmentWidth = ((maxPriceNum - minPriceNum) / totalRange) * 100
      let graySegmentWidth = ((currentPriceNum! - maxPriceNum) / totalRange) * 100

      // Enforce minimum width for colored segment
      if (coloredSegmentWidth < MIN_RANGE_WIDTH) {
        coloredSegmentWidth = MIN_RANGE_WIDTH
        graySegmentWidth = 100 - coloredSegmentWidth
      }

      return (
        <ExtendedPriceRangeBar>
          <BarSegment width={coloredSegmentWidth} outOfRange={outOfRange} disabled={removed} />
          <BarSegment width={graySegmentWidth} isGray disabled={removed} />
          <CurrentPriceLine
            position={currentPriceLinePosition}
            outOfRange={outOfRange}
            disabled={removed}
            isOverflow={hasOverflow}
          />
          {/* Range markers at the edges of the main range */}
          <RangeMarker position={0} disabled={removed} />
          <RangeMarker position={coloredSegmentWidth} disabled={removed} />
        </ExtendedPriceRangeBar>
      )
    }

    return null
  }

  const renderPercentages = () => {
    if (!showPercentages) return null

    if (!hasOverflow) {
      // Original behavior - percentages at the edges
      return (
        <BarWrapper $maxWidth={maxWidth}>
          <FlexGap alignItems="center" justifyContent="space-between" width="100%">
            <PercentageText>{minPercentage}</PercentageText>
            <PercentageText>{maxPercentage}</PercentageText>
          </FlexGap>
        </BarWrapper>
      )
    }

    // For overflow cases, position percentages under the actual position range
    return (
      <PercentageContainer
        leftPosition={percentageLeftPosition}
        rightPosition={percentageRightPosition}
        $maxWidth={maxWidth}
      >
        <div className="left-percentage">
          <PercentageText>{minPercentage}</PercentageText>
        </div>
        <div className="right-percentage">
          <PercentageText>{maxPercentage}</PercentageText>
        </div>
      </PercentageContainer>
    )
  }

  const renderPrices = () => {
    if (!hasOverflow) {
      // Original behavior - prices at the edges with dash
      return (
        <BarWrapper $maxWidth={maxWidth} style={{ marginBottom: '2px' }}>
          <FlexGap alignItems="center" gap="8px" width="100%">
            <Flex alignItems="center" justifyContent="space-between" width="100%">
              <Text fontSize="16px" bold>
                {displayMinPrice}
              </Text>
              <Text fontSize="16px" bold>
                -
              </Text>
              <Text fontSize="16px" bold>
                {displayMaxPrice}
              </Text>
            </Flex>
          </FlexGap>
        </BarWrapper>
      )
    }

    // For overflow cases, position prices at the actual position range
    return (
      <PriceContainer
        leftPosition={percentageLeftPosition}
        rightPosition={percentageRightPosition}
        $maxWidth={maxWidth}
      >
        <div className="left-price">
          <Text fontSize="16px" bold>
            {displayMinPrice}
          </Text>
        </div>
        <div className="right-price">
          <Text fontSize="16px" bold>
            {displayMaxPrice}
          </Text>
        </div>
      </PriceContainer>
    )
  }

  return (
    <Flex flexDirection="column" alignItems="flex-start" width="100%">
      {/* Price range display */}
      {renderPrices()}

      {/* Price range bar — always rendered; showPercentages only gates the percentage labels */}
      <BarWrapper $maxWidth={maxWidth}>
        <PriceRangeContainer>{renderBar()}</PriceRangeContainer>
      </BarWrapper>

      {/* Percentage display below the range bar */}
      {renderPercentages()}
    </Flex>
  )
}
