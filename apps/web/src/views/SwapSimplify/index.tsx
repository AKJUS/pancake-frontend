import { BottomDrawer, Box, Flex, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { useAtom } from 'jotai'

import { MobileCard } from 'components/AdPanel/MobileCard'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { useSolanaTokenList } from 'hooks/solana/useSolanaTokenList'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { isSolana } from '@pancakeswap/chains'
import { AutoSlippageProvider } from 'hooks/useAutoSlippageWithFallback'
import { useSwapHotTokenDisplay } from 'hooks/useSwapHotTokenDisplay'
import dynamic from 'next/dynamic'
import { QuoteProvider } from 'quoter/QuoteProvider'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { styled } from 'styled-components'
import { SWAP_CHART_UNSUPPORTED_CHAINS } from 'config/constants/supportChains'
import Page from '../Page'
import { StyledSwapContainer } from '../Swap/styles'
import { SwapFeaturesContext } from '../Swap/SwapFeaturesContext'
import { InfinitySwapForm } from './InfinitySwap'
import { chartDisplayAtom } from './InfinitySwap/atoms'
import { Festival } from './InfinitySwap/Festival'

const ChartWithPriceHeader = dynamic(() => import('components/Chart/ChartWithPriceHeader'), { ssr: false })

const Wrapper = styled(Box)`
  width: 100%;
  ${({ theme }) => theme.mediaQueries.md} {
    min-width: 488px;
  }
`

const InfinitySwapInner = () => {
  const { query } = useRouter()
  const { chainId } = useActiveChainId()
  const { isMobile, isDesktop } = useMatchBreakpoints()
  const { isChartExpanded } = useContext(SwapFeaturesContext)
  const [isChartDisplayed, setIsChartDisplayed] = useAtom(chartDisplayAtom)
  const [isSwapHotTokenDisplay, setIsSwapHotTokenDisplay] = useSwapHotTokenDisplay()
  const [firstTime, setFirstTime] = useState(true)

  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
  } = useSwapState()

  const inputCurrency = useUnifiedCurrency(inputCurrencyId, inputChainId)
  const outputCurrency = useUnifiedCurrency(outputCurrencyId, outputChainId)

  // Prefetch Solana tokens when user switches to Solana
  useSolanaTokenList(isSolana(chainId) || isSolana(inputChainId) || isSolana(outputChainId))

  useEffect(() => {
    if (firstTime && query.showTradingReward) {
      setFirstTime(false)
      setIsSwapHotTokenDisplay(true)

      if (!isSwapHotTokenDisplay && isChartDisplayed) {
        setIsChartDisplayed((currentIsChartDisplayed) => !currentIsChartDisplayed)
      }
    }
  }, [firstTime, isChartDisplayed, isSwapHotTokenDisplay, query, setIsSwapHotTokenDisplay, setIsChartDisplayed])

  return (
    <Page removePadding hideFooterOnDesktop={isChartExpanded || false} showExternalLink={false} showHelpLink={false}>
      <Festival />
      <Flex
        width="100%"
        height="100%"
        justifyContent="center"
        position="relative"
        mt={isChartExpanded ? undefined : isMobile ? '18px' : '42px'}
        p={isChartExpanded ? undefined : isMobile ? '16px' : '24px'}
      >
        {isDesktop && isChartDisplayed && !SWAP_CHART_UNSUPPORTED_CHAINS.includes(chainId) && (
          <Flex width={isChartExpanded ? '100%' : '50%'} maxWidth="928px" flexDirection="column" style={{ gap: 20 }}>
            <ChartWithPriceHeader
              currency0={inputCurrency || undefined}
              currency1={outputCurrency || undefined}
              symbol={`${inputCurrency?.symbol}/${outputCurrency?.symbol}`}
            />
          </Flex>
        )}

        {!isDesktop && !SWAP_CHART_UNSUPPORTED_CHAINS.includes(chainId) && (
          <BottomDrawer
            content={
              <ChartWithPriceHeader
                currency0={inputCurrency || undefined}
                currency1={outputCurrency || undefined}
                symbol={`${inputCurrency?.symbol}/${outputCurrency?.symbol}`}
              />
            }
            isOpen={isChartDisplayed}
            setIsOpen={(isOpen) => setIsChartDisplayed(isOpen)}
            hideCloseButton
          />
        )}
        <Flex
          flexDirection="column"
          alignItems="center"
          height="100%"
          width={isDesktop ? undefined : '100%'}
          mt={isChartExpanded && !isMobile ? '42px' : undefined}
          position="relative"
          zIndex={1}
        >
          <StyledSwapContainer
            justifyContent="center"
            width="100%"
            style={{ height: '100%' }}
            $isChartExpanded={isChartExpanded}
          >
            <AutoSlippageProvider>
              <Wrapper height="100%">
                <InfinitySwapForm />
              </Wrapper>
            </AutoSlippageProvider>
          </StyledSwapContainer>
        </Flex>
      </Flex>

      <MobileCard />
    </Page>
  )
}

export default function InfinitySwap() {
  return (
    <QuoteProvider>
      <InfinitySwapInner />
    </QuoteProvider>
  )
}
