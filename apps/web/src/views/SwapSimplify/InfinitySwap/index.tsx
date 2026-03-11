import { SmartRouter } from '@pancakeswap/smart-router/evm'
import { FlexGap } from '@pancakeswap/uikit'
import { SwapUIV2 } from '@pancakeswap/widgets-internal'
import { useTokenRisk } from 'components/AccessRisk'
import { RiskDetailsPanel, useShouldRiskPanelDisplay } from 'components/AccessRisk/SwapRevampRiskDisplay'

import { OrderType } from '@pancakeswap/price-api-sdk'
import { TradeType } from '@pancakeswap/swap-sdk-core'
import { isSolana } from '@pancakeswap/chains'
import { GasTokenSelector } from 'components/Paymaster/GasTokenSelector'
import { useCurrency } from 'hooks/Tokens'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import { usePaymaster } from 'hooks/usePaymaster'
import { useAllTypeBestTrade } from 'quoter/hook/useAllTypeBestTrade'
import { memo, Suspense, useMemo } from 'react'

import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { MevSwapDetail } from 'views/Mev/MevSwapDetail'
import { MevToggle } from 'views/Mev/MevToggle'
import { useSolanaUserSlippage } from '@pancakeswap/utils/user'
import { SwapType } from '../../Swap/types'
import { useIsWrapping } from '../../Swap/V3Swap/hooks'
import { useBuyCryptoInfo } from '../hooks/useBuyCryptoInfo'
import { useIsPriceImpactTooHigh } from '../hooks/useIsPriceImpactTooHigh'
import { useUserInsufficientBalance } from '../hooks/useUserInsufficientBalance'
import { ButtonAndDetailsPanel } from './ButtonAndDetailsPanel'
import { BuyCryptoPanel } from './BuyCryptoPanel'
import { CommitButton } from './CommitButton'
import { FormMain } from './FormMainInfinity'
import { PricingAndSlippage } from './PricingAndSlippage'
import { RefreshButton } from './RefreshButton'
import { SwapSelection } from './SwapSelectionTab'
import { TradeDetails } from './TradeDetails'
import { TradingFee } from './TradingFee'
import { UnwrapTips } from './UnwrapTips'
import { SlippageRow } from './SlippageRow'

export const InfinitySwapForm = memo(() => {
  const { bestOrder, refreshOrder, tradeError, tradeLoaded, refreshDisabled, pauseQuoting, resumeQuoting } =
    useAllTypeBestTrade()

  const isWrapping = useIsWrapping()
  const { chainId: activeChianId } = useActiveChainId()
  const isUserInsufficientBalance = useUserInsufficientBalance(bestOrder)
  const { shouldShowBuyCrypto, buyCryptoLink } = useBuyCryptoInfo(bestOrder)

  const executionPrice = useMemo(
    () => (bestOrder?.trade ? SmartRouter.getExecutionPrice(bestOrder.trade as any) : undefined),
    [bestOrder?.trade],
  )

  const isPriceImpactTooHigh = useIsPriceImpactTooHigh(!tradeError ? bestOrder : undefined, !tradeLoaded)

  const commitHooks = useMemo(() => {
    return {
      beforeCommit: pauseQuoting,
      afterCommit: resumeQuoting,
    }
  }, [pauseQuoting, resumeQuoting])
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
    independentField,
    typedValue,
  } = useSwapState()

  const inputCurrency = useCurrency(inputCurrencyId, inputChainId)
  const outputCurrency = useCurrency(outputCurrencyId, outputChainId)

  const { slippageTolerance: userSlippageTolerance } = useAutoSlippageWithFallback()

  const [solanaSlippage] = useSolanaUserSlippage()

  const userSlippageCurrentChain = isSolana(activeChianId) ? solanaSlippage : userSlippageTolerance

  const isSlippageTooHigh = useMemo(() => userSlippageCurrentChain > 500, [userSlippageCurrentChain])
  const shouldRiskPanelDisplay = useShouldRiskPanelDisplay(inputCurrency?.wrapped, outputCurrency?.wrapped)
  const isExactOutWarning = useMemo(
    () =>
      (independentField === Field.OUTPUT && isSolana(activeChianId) && !!typedValue) ||
      (bestOrder?.type === OrderType.PCS_SVM && bestOrder.trade.tradeType === TradeType.EXACT_OUTPUT),
    [bestOrder?.trade.tradeType, bestOrder?.type, independentField, activeChianId, typedValue],
  )
  const token0Risk = useTokenRisk(inputCurrency?.wrapped)
  const token1Risk = useTokenRisk(outputCurrency?.wrapped)

  const { isPaymasterAvailable } = usePaymaster()

  return (
    <SwapUIV2.SwapFormWrapper>
      <SwapUIV2.SwapTabAndInputPanelWrapper>
        <SwapSelection swapType={SwapType.MARKET} withToolkit />
        <FormMain
          tradeLoading={!tradeLoaded}
          inputAmount={bestOrder?.trade?.inputAmount}
          outputAmount={bestOrder?.trade?.outputAmount}
          isUserInsufficientBalance={isUserInsufficientBalance}
        />
      </SwapUIV2.SwapTabAndInputPanelWrapper>
      {shouldShowBuyCrypto && <BuyCryptoPanel link={buyCryptoLink} />}
      {(shouldRiskPanelDisplay || isPriceImpactTooHigh || isSlippageTooHigh || isExactOutWarning) && (
        <RiskDetailsPanel
          isPriceImpactTooHigh={isPriceImpactTooHigh}
          isSlippageTooHigh={isSlippageTooHigh}
          isExactOutWarning={Boolean(isExactOutWarning)}
          token0={inputCurrency?.wrapped}
          token1={outputCurrency?.wrapped}
          token0RiskLevelDescription={token0Risk.data?.riskLevelDescription}
          token1RiskLevelDescription={token1Risk.data?.riskLevelDescription}
        />
      )}
      <ButtonAndDetailsPanel
        tips={<UnwrapTips />}
        slippage={isWrapping ? null : <SlippageRow order={bestOrder} />}
        swapCommitButton={
          <CommitButton order={bestOrder} tradeLoaded={tradeLoaded} tradeError={tradeError} {...commitHooks} />
        }
        mevSlot={<MevSwapDetail />}
        pricingAndSlippage={
          <Suspense>
            <>
              <FlexGap
                alignItems="center"
                flexWrap="wrap"
                justifyContent="space-between"
                width="calc(100% - 20px)"
                gap="8px"
              >
                <FlexGap
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <RefreshButton
                    onRefresh={refreshOrder}
                    refreshDisabled={refreshDisabled}
                    chainId={activeChianId}
                    loading={!tradeLoaded}
                  />
                  <PricingAndSlippage priceLoading={!tradeLoaded} price={executionPrice ?? undefined} />
                </FlexGap>
                <TradingFee loaded={tradeLoaded} order={bestOrder} />
              </FlexGap>
            </>
          </Suspense>
        }
        tradeDetails={
          <Suspense>
            <TradeDetails loaded={tradeLoaded} order={bestOrder} />
          </Suspense>
        }
        shouldRenderDetails={Boolean(executionPrice) && Boolean(bestOrder) && !isWrapping && !tradeError}
        mevToggleSlot={
          <Suspense>
            <MevToggle />
          </Suspense>
        }
        gasTokenSelector={
          isPaymasterAvailable && <GasTokenSelector mt="8px" inputCurrency={inputCurrency || undefined} />
        }
      />
    </SwapUIV2.SwapFormWrapper>
  )
})
