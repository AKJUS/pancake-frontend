import { useTranslation } from '@pancakeswap/localization'
import { AutoRow, BottomDrawer, Box, Flex, StyledLink, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useCurrency } from 'hooks/Tokens'
import { useSwapHotTokenDisplay } from 'hooks/useSwapHotTokenDisplay'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { Field } from 'state/swap/actions'
import { useDefaultsFromURLSearch, useSwapState } from 'state/swap/hooks'
import { styled } from 'styled-components'

import { QuoteProvider } from 'quoter/QuoteProvider'
import { SwapSelection } from '../../SwapSimplify/InfinitySwap/SwapSelectionTab'
import { SwapFeaturesContext } from '../SwapFeaturesContext'
import { SwapType } from '../types'
import { OrderHistory, TWAPPanel } from './Twap'

const ChartWithPriceHeader = dynamic(() => import('components/Chart/ChartWithPriceHeader'), { ssr: false })

export default function TwapAndLimitSwap({ limit }: { limit?: boolean }) {
  return (
    <QuoteProvider>
      <TwapAndLimitSwapInner limit={limit} />
    </QuoteProvider>
  )
}
const TwapAndLimitSwapInner = ({ limit }: { limit?: boolean }) => {
  const { query } = useRouter()
  const { t } = useTranslation()
  const { isDesktop, isMobile } = useMatchBreakpoints()
  const { setIsChartDisplayed, setIsChartExpanded, isChartExpanded, isChartSupported, isChartDisplayed } =
    useContext(SwapFeaturesContext)
  const [isSwapHotTokenDisplay, setIsSwapHotTokenDisplay] = useSwapHotTokenDisplay()
  const [firstTime, setFirstTime] = useState(true)

  useEffect(() => {
    if (firstTime && query.showTradingReward) {
      setFirstTime(false)
      setIsSwapHotTokenDisplay(true)

      if (!isSwapHotTokenDisplay && isChartDisplayed) {
        setIsChartDisplayed?.((currentIsChartDisplayed) => !currentIsChartDisplayed)
      }
    }
  }, [firstTime, isChartDisplayed, isSwapHotTokenDisplay, query, setIsSwapHotTokenDisplay, setIsChartDisplayed])

  // swap state & price data
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
  } = useSwapState()
  const inputCurrency = useCurrency(inputCurrencyId, inputChainId)
  const outputCurrency = useCurrency(outputCurrencyId, outputChainId)

  useDefaultsFromURLSearch()

  return (
    <>
      <Flex
        width="100%"
        height={isMobile ? 'auto' : '100%'}
        justifyContent="center"
        position="relative"
        alignItems="flex-start"
        mb={isMobile ? '40px' : '0'}
        style={{ zIndex: 1 }}
        mt={isChartExpanded ? undefined : isMobile ? '18px' : '42px'}
        p={isChartExpanded ? undefined : isMobile ? '16px' : '24px'}
      >
        {isDesktop && (
          <Flex width={isChartExpanded ? '100%' : '50%'} maxWidth="928px" flexDirection="column" style={{ gap: 20 }}>
            {isChartDisplayed && (
              <ChartWithPriceHeader
                currency0={inputCurrency || undefined}
                currency1={outputCurrency || undefined}
                symbol={`${inputCurrency?.symbol}/${outputCurrency?.symbol}`}
              />
            )}
            <OrderHistory />
          </Flex>
        )}
        {!isDesktop && (
          <BottomDrawer
            content={
              <ChartWithPriceHeader
                currency0={inputCurrency || undefined}
                currency1={outputCurrency || undefined}
                symbol={`${inputCurrency?.symbol}/${outputCurrency?.symbol}`}
              />
            }
            isOpen={isChartDisplayed}
            setIsOpen={(isOpen) => setIsChartDisplayed?.(isOpen)}
            hideCloseButton
          />
        )}
        <Flex flexDirection="column" width={isDesktop ? undefined : '100%'}>
          <StyledSwapContainer $isChartExpanded={isChartExpanded}>
            <StyledInputCurrencyWrapper mt={isChartExpanded ? '24px' : '0'}>
              <SwapSelection
                swapType={limit ? SwapType.LIMIT : SwapType.TWAP}
                style={{ marginBottom: 16 }}
                withToolkit
              />
              <TWAPPanel limit={limit} />
              <Flex flexDirection={!isDesktop ? 'column-reverse' : 'column'}>
                {limit && (
                  <AutoRow gap="4px" justifyContent="center">
                    <Text fontSize="14px" color="textSubtle">
                      {t('Orders missing? Check out:')}
                    </Text>
                    <Link href="/limit-orders" passHref prefetch={false}>
                      <StyledLink fontSize="14px" color="primary">
                        {t('Limit V2 (deprecated)')}
                      </StyledLink>
                    </Link>
                  </AutoRow>
                )}
                {!isDesktop && <OrderHistory />}
              </Flex>
            </StyledInputCurrencyWrapper>
          </StyledSwapContainer>
        </Flex>
      </Flex>
    </>
  )
}

export const StyledSwapContainer = styled(Flex)<{ $isChartExpanded: boolean }>`
  flex-shrink: 0;
  height: fit-content;
  padding: 0;
  ${({ theme }) => theme.mediaQueries.md} {
    padding: 0 16px;
  }

  ${({ theme }) => theme.mediaQueries.xxl} {
    ${({ $isChartExpanded }) => ($isChartExpanded ? 'padding:  0 0px 0px 40px' : 'padding: 0 0px 0px 40px')};
  }
`

export const StyledInputCurrencyWrapper = styled(Box)`
  width: 100%;

  ${({ theme }) => theme.mediaQueries.md} {
    width: 480px;
  }
`
