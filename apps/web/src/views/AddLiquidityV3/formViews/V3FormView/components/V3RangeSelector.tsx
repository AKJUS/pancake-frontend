import { useTranslation } from '@pancakeswap/localization'
import { Currency, isUnifiedCurrencySorted, Price, UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import { AutoColumn, FlexGap, Text, Input, Button, Box, RowBetween, useMatchBreakpoints } from '@pancakeswap/uikit'
import { priceToClosestTick, FeeAmount } from '@pancakeswap/v3-sdk'
import { ZoomLevels } from '@pancakeswap/widgets-internal'
import { Bound } from 'config/constants/types'
import { useMemo, useState, useCallback } from 'react'
import { formatRangeSelectorPrice } from 'utils/formatRangeSelectorPrice'
import { styled } from 'styled-components'
import { useQuickActionConfigs } from 'views/AddLiquidityV3/hooks/useQuickActionConfigs'
import StepCounter from './StepCounter'

const CustomInputContainer = styled(Box)<{ $small?: boolean }>`
  position: relative;
  max-width: 160px;

  ${({ $small }) =>
    $small
      ? `
          height: 40px;
          width: 30%;
        `
      : `
          height: 56px;
          width: 120%;
        `}
`

const StyledInput = styled(Input)<{ $isValid?: boolean }>`
  height: 100%;
  font-size: 16px;
  text-align: center;
  padding-left: 8px !important;
  padding-right: 32px !important;
  border: ${({ theme, $isValid }) =>
    $isValid === false ? `1px solid ${theme.colors.failure}` : `1px solid ${theme.colors.inputSecondary}`};
`

const PercentageLabel = styled.div`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textSubtle};
`

const ButtonsContainer = styled(FlexGap).attrs({ gap: '8px' })`
  background-color: ${({ theme }) => theme.colors.input};
  border: 1px solid ${({ theme }) => theme.colors.inputSecondary};
  border-radius: ${({ theme }) => theme.radii.default};
  box-shadow: ${({ theme }) => theme.shadows.inset2};
`

const QuickActionButton = styled(Button).attrs(({ $isActive }) => ({
  scale: 'xs',
  variant: $isActive ? 'subtle' : 'light',
}))<{
  $isActive?: boolean
}>`
  height: 56px;
  font-size: 16px;
  padding: 0 12px;
  font-weight: ${({ $isActive }) => ($isActive ? 600 : 400)};
`

// currencyA is the base token
export default function V3RangeSelector({
  priceLower,
  priceUpper,
  onLeftRangeInput,
  onRightRangeInput,
  getDecrementLower,
  getIncrementLower,
  getDecrementUpper,
  getIncrementUpper,
  currencyA,
  currencyB,
  feeAmount,
  ticksAtLimit,
  tickSpaceLimits,
  quickAction,
  handleQuickAction,
  defaultRangePoints,
}: {
  priceLower?: Price<Currency, Currency>
  priceUpper?: Price<Currency, Currency>
  getDecrementLower: () => Price<Currency, Currency> | undefined
  getIncrementLower: () => Price<Currency, Currency> | undefined
  getDecrementUpper: () => Price<Currency, Currency> | undefined
  getIncrementUpper: () => Price<Currency, Currency> | undefined
  onLeftRangeInput: (typedValue: Price<Currency, Currency> | undefined) => void
  onRightRangeInput: (typedValue: Price<Currency, Currency> | undefined) => void
  currencyA?: UnifiedCurrency | undefined | null
  currencyB?: UnifiedCurrency | undefined | null
  feeAmount?: FeeAmount
  ticksAtLimit: { [bound in Bound]?: boolean | undefined }
  tickSpaceLimits?: { [bound in Bound]?: number | undefined }
  quickAction: number | null
  handleQuickAction: (value: number | null, zoomLevel: ZoomLevels) => void
  defaultRangePoints?: number[]
}) {
  const { t } = useTranslation()
  const { isMobile, isTablet } = useMatchBreakpoints()
  const isSmallScreen = isMobile || isTablet

  const tokenA = (currencyA ?? undefined)?.wrapped
  const tokenB = (currencyB ?? undefined)?.wrapped
  const isSorted = Boolean(tokenA && tokenB && isUnifiedCurrencySorted(tokenA, tokenB))

  const leftPrice = isSorted ? priceLower : priceUpper?.invert()
  const rightPrice = isSorted ? priceUpper : priceLower?.invert()

  const leftValue = useMemo(() => {
    if (ticksAtLimit[isSorted ? Bound.LOWER : Bound.UPPER]) return '0'
    if (leftPrice?.denominator === 0n) return ''
    try {
      if (
        tickSpaceLimits?.[Bound.LOWER] !== undefined &&
        leftPrice &&
        priceToClosestTick(leftPrice) <= tickSpaceLimits[Bound.LOWER]
      ) {
        return '0'
      }

      return formatRangeSelectorPrice(leftPrice)
    } catch (error) {
      return ''
    }
  }, [isSorted, leftPrice, tickSpaceLimits, ticksAtLimit])

  const rightValue = useMemo(() => {
    if (ticksAtLimit[isSorted ? Bound.UPPER : Bound.LOWER]) return '∞'
    if (rightPrice?.denominator === 0n) return ''
    try {
      if (
        tickSpaceLimits?.[Bound.LOWER] !== undefined &&
        rightPrice &&
        priceToClosestTick(rightPrice) <= tickSpaceLimits[Bound.LOWER]
      ) {
        return '0'
      }

      if (
        tickSpaceLimits?.[Bound.UPPER] !== undefined &&
        rightPrice &&
        priceToClosestTick(rightPrice) >= tickSpaceLimits[Bound.UPPER]
      ) {
        return '∞'
      }

      return formatRangeSelectorPrice(rightPrice)
    } catch (error) {
      return ''
    }
  }, [isSorted, rightPrice, tickSpaceLimits, ticksAtLimit])

  const quickActionConfigs = useQuickActionConfigs({
    defaultRangePoints,
    feeAmount,
  })

  // Custom input state - completely separate from quick actions
  const [customInput, setCustomInput] = useState('')

  // Calculate zoom level based purely on percentage - ensure range is always visible
  const calculateZoomLevel = useCallback(
    (percentage: number): ZoomLevels => {
      const initialMin = 1 - percentage / 100
      const initialMax = 1 + percentage / 100
      const { min, max } = quickActionConfigs ? Object.values(quickActionConfigs)[0] : { min: 0.00001, max: 20 }

      return {
        initialMin,
        initialMax,
        min,
        max,
      }
    },
    [quickActionConfigs],
  )

  // Handle predefined quick action clicks
  const handleQuickActionClick = useCallback(
    (percentage: number) => {
      // Ignore if current quick action is the same as the clicked one
      if (quickAction === percentage) return

      const zoomLevel = calculateZoomLevel(percentage)

      handleQuickAction(percentage, zoomLevel)
      setCustomInput('') // Clear custom input when using quick action
    },
    [quickAction, handleQuickAction, calculateZoomLevel],
  )

  // Handle custom input - ONLY update input value with 0-100 validation
  const handleCustomInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target

    // Allow empty input for clearing
    if (value === '') {
      setCustomInput('')
      return
    }

    // Only allow numbers, decimal points, and prevent invalid values
    if (!/^\d*\.?\d*$/.test(value)) {
      return
    }

    const numericValue = parseFloat(value)

    // Allow partial typing (like "1" while typing "10") but block out-of-range completed numbers
    if (!Number.isNaN(numericValue) && (numericValue < 0 || numericValue > 100)) {
      return
    }

    setCustomInput(value)
  }, [])

  // Apply custom input's zoom
  const applyCustomZoom = useCallback(() => {
    const numericValue = parseFloat(customInput)
    if (!Number.isNaN(numericValue)) {
      const zoomLevel = calculateZoomLevel(numericValue)
      handleQuickAction(numericValue, zoomLevel)
    }
  }, [customInput, calculateZoomLevel, handleQuickAction])

  // Handle Full Range - simplified without fee tier logic
  const handleFullRange = useCallback(() => {
    const fullRangeZoomLevel = {
      initialMin: 0,
      initialMax: 2,
      min: 0.00001,
      max: 5,
    }
    handleQuickAction(100, fullRangeZoomLevel)
    setCustomInput('') // Clear custom input
  }, [handleQuickAction])

  return (
    <AutoColumn gap="8px">
      <FlexGap gap="8px" width="100%" flexDirection={['column', null, null, 'row']}>
        <StepCounter
          value={leftValue}
          onUserInput={onLeftRangeInput}
          width="48%"
          decrement={isSorted ? getDecrementLower : getIncrementUpper}
          increment={isSorted ? getIncrementLower : getDecrementUpper}
          decrementDisabled={ticksAtLimit[isSorted ? Bound.LOWER : Bound.UPPER]}
          incrementDisabled={ticksAtLimit[isSorted ? Bound.LOWER : Bound.UPPER]}
          feeAmount={feeAmount}
          label={leftPrice ? `${currencyB?.symbol}` : '-'}
          title={
            <Text color="secondary" textTransform="uppercase" small bold>
              {t('Min Price')}
            </Text>
          }
          tokenA={currencyA}
          tokenB={currencyB}
        />
        <StepCounter
          value={rightValue}
          onUserInput={onRightRangeInput}
          width="48%"
          decrement={isSorted ? getDecrementUpper : getIncrementLower}
          increment={isSorted ? getIncrementUpper : getDecrementLower}
          incrementDisabled={ticksAtLimit[isSorted ? Bound.UPPER : Bound.LOWER]}
          decrementDisabled={ticksAtLimit[isSorted ? Bound.UPPER : Bound.LOWER]}
          feeAmount={feeAmount}
          label={rightPrice ? `${currencyB?.symbol}` : '-'}
          tokenA={currencyA}
          tokenB={currencyB}
          title={
            <Text color="secondary" textTransform="uppercase" small bold>
              {t('Max Price')}
            </Text>
          }
        />
      </FlexGap>

      {/* Quick Action Buttons with Simple Validation */}
      <ButtonsContainer width="100%" justifyContent="space-between">
        {quickActionConfigs &&
          Object.entries(quickActionConfigs)
            ?.sort(([a], [b]) => +a - +b)
            .map(([percentage]) => (
              <QuickActionButton
                key={percentage}
                onClick={() => handleQuickActionClick(Number(percentage))}
                $isActive={Number(percentage) === quickAction}
                width="100%"
              >
                {percentage}%
              </QuickActionButton>
            ))}

        <QuickActionButton
          width="100%"
          minWidth="max-content"
          onClick={handleFullRange}
          $isActive={quickAction === 100}
        >
          {t('Full Range')}
        </QuickActionButton>

        {!isSmallScreen && (
          <CustomInputContainer width="120%" minWidth="100px">
            <StyledInput
              value={customInput}
              onChange={handleCustomInputChange}
              onBlur={applyCustomZoom}
              onKeyDown={(e) => e.key === 'Enter' && applyCustomZoom()}
              placeholder={t('Custom')}
              type="text"
              inputMode="decimal"
            />
            <PercentageLabel>%</PercentageLabel>
          </CustomInputContainer>
        )}
      </ButtonsContainer>

      {isSmallScreen && (
        <RowBetween mt="8px" alignItems="center">
          <Text>{t('Custom')}</Text>
          <CustomInputContainer $small>
            <StyledInput
              value={customInput}
              onChange={handleCustomInputChange}
              onBlur={applyCustomZoom}
              onKeyDown={(e) => e.key === 'Enter' && applyCustomZoom()}
              placeholder="2.5"
              type="text"
              inputMode="decimal"
            />
            <PercentageLabel>%</PercentageLabel>
          </CustomInputContainer>
        </RowBetween>
      )}
    </AutoColumn>
  )
}
