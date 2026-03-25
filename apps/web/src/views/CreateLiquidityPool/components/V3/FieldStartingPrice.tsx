import { useIsMounted, usePreviousValue } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import {
  BalanceInput,
  Box,
  BoxProps,
  Button,
  FlexGap,
  InfoIcon,
  PreTitle,
  SwapHorizIcon,
  Text,
  useMatchBreakpoints,
  useTooltip,
} from '@pancakeswap/uikit'
import { escapeRegExp } from '@pancakeswap/utils/escapeRegExp'
import { formatPrice } from '@pancakeswap/utils/formatFractions'
import BigNumber from 'bignumber.js'
import { usePoolMarketPrice } from 'hooks/usePoolMarketPriceSlippage'
import { tryParsePrice } from 'hooks/v3/utils'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { useInverted } from 'state/infinity/shared'
import styled from 'styled-components'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { truncateText } from 'utils'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { TickMath, tickToPrice } from '@pancakeswap/v3-sdk'
import { useCurrencies } from '../../hooks/useCurrencies'

export type FieldStartingPriceProps = {
  startPrice: string
  setStartPrice: (startPrice: string) => void
  switchCurrencies?: () => void
} & BoxProps

const inputRegex = RegExp(`^\\d*(?:\\\\[.])?\\d*$`) // match escaped "." characters via in a non-capturing group

export const FieldStartingPrice: React.FC<FieldStartingPriceProps> = ({
  startPrice,
  setStartPrice,
  switchCurrencies: switchCurrenciesProp,
  ...boxProps
}) => {
  const { t } = useTranslation()
  const { quoteCurrency, baseCurrency, currency0, currency1 } = useCurrencies()

  const { isMobile, isTablet } = useMatchBreakpoints()
  const MAX_SYMBOL_LENGTH = isMobile || isTablet ? 12 : 7

  const unit = useMemo(() => {
    return truncateText(quoteCurrency?.symbol, MAX_SYMBOL_LENGTH)
  }, [quoteCurrency, MAX_SYMBOL_LENGTH])

  const isMounted = useIsMounted()
  const [inverted] = useInverted()
  const prevInverted = usePreviousValue(inverted)

  const { switchCurrencies: switchCurrenciesDefault } = useSelectIdRouteParams()
  const switchCurrencies = switchCurrenciesProp || switchCurrenciesDefault

  const [, , marketPrice] = usePoolMarketPrice(currency0, currency1)

  const { minPrice, maxPrice } = useMemo(() => {
    if (!baseCurrency || !quoteCurrency) return { minPrice: undefined, maxPrice: undefined }

    const min = tickToPrice(
      baseCurrency as unknown as Currency,
      quoteCurrency as unknown as Currency,
      TickMath.MIN_TICK + 1, // avoid absolute bounds so swaps remain possible
    )
    const max = tickToPrice(
      baseCurrency as unknown as Currency,
      quoteCurrency as unknown as Currency,
      TickMath.MAX_TICK - 1,
    )

    return {
      minPrice: inverted ? min.invert() : min,
      maxPrice: inverted ? max.invert() : max,
    }
  }, [inverted, baseCurrency, quoteCurrency])

  const updatePrice = useCallback(
    (input: string | null) => {
      if (input === null) return
      if (input === '') {
        setStartPrice('')
        return
      }

      if (maxPrice && minPrice) {
        const maxVal = new BigNumber(maxPrice.toFixed(18))
        const minVal = new BigNumber(minPrice.toFixed(18))
        const clamped = BigNumber.max(minVal, BigNumber.min(maxVal, new BigNumber(input)))
        setStartPrice(clamped.toJSON())
        return
      }

      setStartPrice(new BigNumber(input).toJSON())
    },
    [setStartPrice, maxPrice, minPrice],
  )

  useEffect(() => {
    if (isMounted && prevInverted !== inverted && startPrice !== null) {
      const b = baseCurrency ? (baseCurrency as unknown as Currency) : undefined
      const q = quoteCurrency ? (quoteCurrency as unknown as Currency) : undefined
      const newPrice = prevInverted
        ? tryParsePrice(q, b, startPrice.toString())
        : tryParsePrice(b, q, startPrice.toString())
      const revertPrice = newPrice?.invert()
      updatePrice(revertPrice?.denominator ? revertPrice.toFixed(8) : null)
    }
  }, [prevInverted, inverted, isMounted, startPrice, updatePrice, quoteCurrency, baseCurrency])

  const handleSetMarketPrice = useCallback(() => {
    if (marketPrice) {
      const price = inverted ? marketPrice.invert() : marketPrice
      const formattedPrice = formatPrice(price)
      if (!formattedPrice) return
      updatePrice(formattedPrice)
    }
  }, [inverted, marketPrice, updatePrice])

  const {
    tooltip: currentPriceTooltip,
    tooltipVisible: currentPriceTooltipVisible,
    targetRef: currentPriceTargetRef,
  } = useTooltip(t('The price is an estimation of the current market price. Please verify before using it.'), {
    avoidToStopPropagation: true,
  })

  return (
    <Box {...boxProps}>
      <FlexGap gap="8px" mb="8px" justifyContent="space-between" flexWrap="wrap">
        <FlexGap gap="5px" alignItems="center">
          <PreTitle>{t('Set Starting Price')}</PreTitle>
        </FlexGap>
        {marketPrice && (
          <FlexGap gap="4px" alignItems="center" flexWrap="wrap">
            <div ref={currentPriceTargetRef}>
              <CurrentPriceButton onClick={handleSetMarketPrice}>
                <span>{t('Use Market Price')}</span>
                <InfoIcon color="primary60" width="18px" />
              </CurrentPriceButton>
              {currentPriceTooltipVisible && currentPriceTooltip}
            </div>

            <FlexGap gap="4px" alignItems="center" flexWrap="wrap">
              <Text color="textSubtle" small bold>
                {formatPrice(inverted ? marketPrice.invert() : marketPrice)}{' '}
              </Text>
              <Text color="textSubtle" small>
                {t('%assetA% = 1 %assetB%', {
                  assetA: inverted ? currency0?.symbol : currency1?.symbol,
                  assetB: inverted ? currency1?.symbol : currency0?.symbol,
                })}
              </Text>
              <SwapHorizIcon role="button" color="primary60" onClick={switchCurrencies} style={{ cursor: 'pointer' }} />
            </FlexGap>
          </FlexGap>
        )}
      </FlexGap>
      <StartingPriceInput
        value={startPrice}
        onUserInput={updatePrice}
        unit={unit}
        currency={quoteCurrency as unknown as Currency}
      />
    </Box>
  )
}

type StartingPriceInputProps = {
  value: string | null
  onUserInput: (input: string) => void
  unit: string
  currency?: Currency
}

const StartingPriceInput: React.FC<StartingPriceInputProps> = ({ value, onUserInput, unit, currency }) => {
  const [inputValue, setInputValue] = useState<string | null>(value)
  const isMounted = useIsMounted()

  useEffect(() => {
    if (!isMounted) return
    if (value === null && inputValue !== null) {
      setInputValue(null)
      return
    }
    if (
      value !== null &&
      inputValue !== null &&
      !new BigNumber(inputValue).eq(new BigNumber(value)) &&
      !String(value).endsWith('.')
    ) {
      setInputValue(value)
      return
    }

    if (inputValue === null && value !== null) {
      setInputValue(value)
    }
  }, [inputValue, isMounted, value])

  const handleInputChange = useCallback(
    (input: string) => {
      const v = input.replace(/,/g, '.')
      if (v === '' || inputRegex.test(escapeRegExp(v))) {
        setInputValue(v)

        if (v.endsWith('.')) return
        onUserInput(v)
      }
    },
    [onUserInput],
  )

  return (
    <BalanceInput
      value={inputValue ?? ''}
      onUserInput={handleInputChange}
      appendComponent={currency ? <CurrencyLogo currency={currency} size="24px" showChainLogo /> : null}
      unit={
        <Text color="textSubtle" bold>
          {unit}
        </Text>
      }
      placeholder="0.00"
      inputProps={{
        style: { height: '24px' },
        step: 'any',
        pattern: '^[0-9]*[.,]?[0-9]{0,18}$',
        inputMode: 'decimal',
      }}
    />
  )
}

const CurrentPriceButton = styled(Button).attrs({ scale: 'xs', variant: 'text' })`
  height: 24px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;

  display: flex;
  align-items: center;
  gap: 4px;

  background: transparent;
  border: 2px solid ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primary60};
`
