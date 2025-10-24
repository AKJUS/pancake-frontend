import { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { AutoColumn, Button, Dots, Message, MessageText, Text, useModal } from '@pancakeswap/uikit'
import { useAddressBalance } from 'hooks/useAddressBalance'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useTranslation } from '@pancakeswap/localization'
import { PriceOrder } from '@pancakeswap/price-api-sdk'
import { getUniversalRouterAddress } from '@pancakeswap/universal-router-sdk'
import { TimeoutError } from '@pancakeswap/utils/withTimeout'
import { ConfirmModalState } from '@pancakeswap/widgets-internal'
import { GreyCard } from 'components/Card'
import { CommitButton } from 'components/CommitButton'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { AutoRow } from 'components/Layout/Row'
import { RoutingSettingsButton, RoutingSettingsModalContent } from 'components/Menu/GlobalSettings/SettingsModalV2'
import { BIG_INT_ZERO } from 'config/constants/exchange'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { useIsTransactionUnsupported } from 'hooks/Trades'
import { useUnifiedCurrencyBalances } from 'hooks/useUnifiedCurrencyBalance'
import useWrapCallback, { WrapType } from 'hooks/useWrapCallback'
import { useAtomValue } from 'jotai'
import { baseAllTypeBestTradeAtom } from 'quoter/atom/bestTradeUISyncAtom'
import { BridgeTradeError, NoValidRouteError, XTradeError } from 'quoter/quoter.types'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { useSwapActionHandlers } from 'state/swap/useSwapActionHandlers'
import { useRoutingSettingChanged } from 'state/user/smartRouter'
import {
  logGTMClickSwapConfirmEvent,
  logGTMClickSwapEvent,
  logGTMSwapTxSuccessEvent,
} from 'utils/customGTMEventTracking'
import { warningSeverity } from 'utils/exchange'
import { useBridgeCheckApproval } from 'views/Swap/Bridge/hooks/useBridgeCheckApproval'
import { getBridgeOrderPriceImpact } from 'views/Swap/Bridge/utils'
import { ConfirmSwapModalV2 } from 'views/Swap/V3Swap/containers/ConfirmSwapModalV2'
import { EVMInterfaceOrder, isBridgeOrder, isClassicOrder, isSVMOrder, isXOrder } from 'views/Swap/utils'
import { useBridgeTradeErrorHandler } from 'views/Swap/Bridge/CrossChainConfirmSwapModal/hooks/useBridgeErrorMessages'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { isEvm, isSolana, NonEVMChainId } from '@pancakeswap/chains'

import { ConfirmSwapModalV3 } from '../../Swap/Bridge/CrossChainConfirmSwapModal/ConfirmSwapModalV3'
import { useParsedAmounts, useSlippageAdjustedAmounts, useSwapInputError } from '../../Swap/V3Swap/hooks'
import { useConfirmModalState } from '../../Swap/V3Swap/hooks/useConfirmModalState'
import { useSwapConfig } from '../../Swap/V3Swap/hooks/useSwapConfig'
import { useSwapCurrency } from '../../Swap/V3Swap/hooks/useSwapCurrency'
import { CommitButtonProps } from '../../Swap/V3Swap/types'
import { useIsRecipientError } from '../hooks/useIsRecipientError'
import { useQuoteTrackingStateMachine } from '../hooks/useQuoteTrackingStateMachine'
import { usePriceBreakdown } from '../hooks/usePriceBreakdown'

interface SwapCommitButtonPropsType {
  order?: PriceOrder
  tradeError?: Error | null
  tradeLoading?: boolean
}

const useSwapCurrencies = () => {
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
  } = useSwapState()
  const inputCurrency = useUnifiedCurrency(inputCurrencyId, inputChainId) as Currency
  const outputCurrency = useUnifiedCurrency(outputCurrencyId, outputChainId) as Currency
  return useMemo(() => ({ inputCurrency, outputCurrency }), [inputCurrency, outputCurrency])
}

function useCheckConnectSolanaForSolanaBridge() {
  const { account, solanaAccount } = useAccountActiveChain()

  const { outputCurrency, inputCurrency } = useSwapCurrencies()

  if (!outputCurrency || !inputCurrency) return false

  const isSolanaBridge =
    inputCurrency.chainId !== outputCurrency.chainId &&
    (isSolana(outputCurrency.chainId) || isSolana(inputCurrency.chainId))

  if (!isSolanaBridge) return false

  if (isSolana(outputCurrency.chainId) && account && !solanaAccount) {
    return true
  }

  if (isEvm(outputCurrency.chainId) && solanaAccount && !account) {
    return true
  }

  return false
}

const WrapCommitButtonReplace: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation()
  const { inputCurrency, outputCurrency } = useSwapCurrencies()
  const { typedValue } = useSwapState()
  const {
    wrapType,
    execute: onWrap,
    inputError: wrapInputError,
  } = useWrapCallback(inputCurrency, outputCurrency, typedValue)
  const showWrap = wrapType !== WrapType.NOT_APPLICABLE

  const buttonText = useMemo(() => {
    return (
      wrapInputError ?? (wrapType === WrapType.WRAP ? t('Wrap') : wrapType === WrapType.UNWRAP ? t('Unwrap') : null)
    )
  }, [t, wrapInputError, wrapType])
  if (!showWrap) return children

  return (
    <CommitButton width="100%" disabled={Boolean(wrapInputError)} onClick={onWrap}>
      {buttonText}
    </CommitButton>
  )
}

const ConnectButtonReplace = ({ children }) => {
  const { chainId, account, solanaAccount } = useAccountActiveChain()
  const noAccount = useMemo(() => {
    return (chainId === NonEVMChainId.SOLANA && !solanaAccount) || (chainId !== NonEVMChainId.SOLANA && !account)
  }, [chainId, solanaAccount, account])

  const needConnectSolanaForBridgeFromEVMToSolana = useCheckConnectSolanaForSolanaBridge()

  if (noAccount || needConnectSolanaForBridgeFromEVMToSolana) {
    return <ConnectWalletButton width="100%" withIcon />
  }

  return children
}

const UnsupportedSwapButtonReplace = ({ children }) => {
  const { t } = useTranslation()
  const { inputCurrency, outputCurrency } = useSwapCurrencies()
  const swapIsUnsupported = useIsTransactionUnsupported(inputCurrency, outputCurrency)

  if (swapIsUnsupported) {
    return (
      <Button width="100%" disabled>
        {t('Unsupported Asset')}
      </Button>
    )
  }
  return children
}

const SwapCommitButtonComp: React.FC<SwapCommitButtonPropsType & CommitButtonProps> = (props) => {
  return (
    <UnsupportedSwapButtonReplace>
      <ConnectButtonReplace>
        <WrapCommitButtonReplace>
          <SwapCommitButtonInner {...props} />
        </WrapCommitButtonReplace>
      </ConnectButtonReplace>
    </UnsupportedSwapButtonReplace>
  )
}

export const SwapCommitButton = memo(SwapCommitButtonComp)

function isSupportedErrorType(err: any) {
  return err instanceof NoValidRouteError || err instanceof TimeoutError || err instanceof XTradeError
}

const SwapCommitButtonInner = memo(function SwapCommitButtonInner({
  order,
  tradeError,
  tradeLoading,
  beforeCommit,
  afterCommit,
}: SwapCommitButtonPropsType & CommitButtonProps) {
  const { account, solanaAccount } = useAccountActiveChain()

  const { t } = useTranslation()
  const { chainId } = useAccountActiveChain()
  const handleBridgeTradeErrorMessage = useBridgeTradeErrorHandler()
  // form data
  const { independentField, typedValue } = useSwapState()
  const [inputCurrency, outputCurrency] = useSwapCurrency()
  const { isExpertMode: isExpertMode_ } = useSwapConfig()
  const isExpertMode = useMemo(() => isExpertMode_ && isEvm(chainId), [chainId, isExpertMode_])
  const { isRecipientEmpty, isRecipientError } = useIsRecipientError()

  const tradePriceBreakdown = usePriceBreakdown(order)

  // warnings on slippage
  const priceImpactSeverity = warningSeverity(
    tradePriceBreakdown
      ? // if tradePriceBreakdown is array, it means it's a bridge order
        Array.isArray(tradePriceBreakdown)
        ? getBridgeOrderPriceImpact(tradePriceBreakdown)
        : tradePriceBreakdown.priceImpactWithoutFee
      : undefined,
  )

  const pairCurrencies = useMemo(() => {
    return [inputCurrency ?? undefined, outputCurrency ?? undefined]
  }, [inputCurrency, outputCurrency])

  const relevantTokenBalances = useUnifiedCurrencyBalances(pairCurrencies)
  const currencyBalances = useMemo(
    () => ({
      [Field.INPUT]: relevantTokenBalances[0],
      [Field.OUTPUT]: relevantTokenBalances[1],
    }),
    [relevantTokenBalances],
  )
  const parsedAmounts = useParsedAmounts(order?.trade, currencyBalances, false)
  const parsedIndependentFieldAmount = parsedAmounts[independentField]
  const swapInputError = useSwapInputError(order, currencyBalances, pairCurrencies)
  const [tradeToConfirm, setTradeToConfirm] = useState<PriceOrder | undefined>(undefined)
  const [indirectlyOpenConfirmModalState, setIndirectlyOpenConfirmModalState] = useState(false)

  // FIXME: using order as fallback here simply to avoid empty permit2 detail
  // Need to fetch permit2 information on the fly instead
  const orderToExecute = useMemo(
    () => (isExpertMode ? order : tradeToConfirm?.trade ? tradeToConfirm : order),
    [isExpertMode, order, tradeToConfirm],
  )
  const slippageAdjustedAmounts = useSlippageAdjustedAmounts(orderToExecute)
  const amountToApprove = useMemo(
    () =>
      isSVMOrder(orderToExecute)
        ? undefined
        : inputCurrency?.isNative
        ? isXOrder(orderToExecute)
          ? slippageAdjustedAmounts[Field.INPUT]
          : undefined
        : slippageAdjustedAmounts[Field.INPUT],
    [inputCurrency?.isNative, orderToExecute, slippageAdjustedAmounts],
  ) as CurrencyAmount<Currency> | undefined

  const { callToAction, confirmState, txHash, orderHash, confirmActions, errorMessage, resetState } =
    useConfirmModalState(
      orderToExecute,
      amountToApprove?.wrapped,
      isEvm(chainId) ? getUniversalRouterAddress(chainId) : undefined,
    )

  const { onUserInput } = useSwapActionHandlers()
  const reset = useCallback(() => {
    afterCommit?.()
    setTradeToConfirm(undefined)
    if (confirmState === ConfirmModalState.COMPLETED) {
      onUserInput(Field.INPUT, '')
    }
    resetState()
  }, [afterCommit, confirmState, onUserInput, resetState])

  const handleAcceptChanges = useCallback(() => {
    setTradeToConfirm(order)
  }, [order])

  const hasNoValidRouteError = useMemo(() => Boolean(tradeError && isSupportedErrorType(tradeError)), [tradeError])

  const noRoute = useMemo(
    () => (isClassicOrder(order) && !((order.trade?.routes?.length ?? 0) > 0)) || hasNoValidRouteError,
    [order, hasNoValidRouteError],
  )

  const hasBridgeTradeError = useMemo(() => Boolean(tradeError && tradeError instanceof BridgeTradeError), [tradeError])
  const hasXTradeError = useMemo(() => Boolean(tradeError && tradeError instanceof XTradeError), [tradeError])

  const isValid = useMemo(
    () =>
      !swapInputError &&
      !tradeLoading &&
      !hasBridgeTradeError &&
      !hasXTradeError &&
      parsedAmounts[Field.INPUT]?.greaterThan(BIG_INT_ZERO) &&
      parsedAmounts[Field.OUTPUT]?.greaterThan(BIG_INT_ZERO),
    [swapInputError, tradeLoading, hasBridgeTradeError, hasXTradeError, parsedAmounts],
  )

  const { isLoading: isBridgeCheckApprovalLoading } = useBridgeCheckApproval(order)

  const disabled = useMemo(
    () =>
      isBridgeCheckApprovalLoading ||
      !isValid ||
      (priceImpactSeverity > 3 && !isExpertMode) ||
      isRecipientEmpty ||
      isRecipientError,
    [isExpertMode, isRecipientEmpty, isRecipientError, isValid, priceImpactSeverity, isBridgeCheckApprovalLoading],
  )

  const userHasSpecifiedInputOutput = Boolean(
    inputCurrency && outputCurrency && parsedIndependentFieldAmount?.greaterThan(BIG_INT_ZERO),
  )

  // Get the refresh function from useAddressBalance to update balances after swap
  const { refresh: refreshBalances } = useAddressBalance(isSolana(chainId) ? solanaAccount : account, chainId, {
    enabled: false,
  })

  const onConfirm = useCallback(() => {
    beforeCommit?.()
    logGTMClickSwapConfirmEvent({
      fromChain: order?.trade?.inputAmount?.currency?.chainId,
      toChain: order?.trade?.outputAmount?.currency?.chainId,
      fromToken: order?.trade?.inputAmount?.currency?.symbol,
      toToken: order?.trade?.outputAmount?.currency?.symbol,
      amount: order?.trade?.inputAmount?.toExact(),
      amountOut: order?.trade?.outputAmount?.toExact(),
      priceImpact: priceImpactSeverity,
    })
    callToAction()
  }, [beforeCommit, callToAction, priceImpactSeverity, order])

  const [openConfirmSwapModal] = useModal(
    isBridgeOrder(order) ? (
      <ConfirmSwapModalV3
        order={order}
        orderHash={orderHash}
        originalOrder={tradeToConfirm as EVMInterfaceOrder}
        txHash={txHash}
        confirmModalState={confirmState}
        pendingModalSteps={confirmActions ?? []}
        swapErrorMessage={errorMessage}
        currencyBalances={
          // NOTE: since Bridge not support Solana yet, can safely cast to CurrencyAmount<Currency>
          currencyBalances as { [field in Field]?: CurrencyAmount<Currency> | undefined }
        }
        onAcceptChanges={handleAcceptChanges}
        onConfirm={onConfirm}
        customOnDismiss={reset}
      />
    ) : (
      <ConfirmSwapModalV2
        order={order as EVMInterfaceOrder}
        orderHash={orderHash}
        originalOrder={tradeToConfirm as EVMInterfaceOrder}
        txHash={txHash}
        confirmModalState={confirmState}
        pendingModalSteps={confirmActions ?? []}
        swapErrorMessage={errorMessage}
        currencyBalances={currencyBalances as { [field in Field]?: CurrencyAmount<Currency> | undefined }}
        onAcceptChanges={handleAcceptChanges}
        onConfirm={onConfirm}
        customOnDismiss={reset}
      />
    ),
    true,
    true,
    isBridgeOrder(order) ? 'confirmSwapModalV3' : 'confirmSwapModalV2',
  )

  const handleSwap = useCallback(() => {
    setTradeToConfirm(order)
    resetState()

    // if expert mode turn-on, will not show preview modal
    // start swap directly
    if (isExpertMode) {
      onConfirm()
    }

    openConfirmSwapModal()

    logGTMClickSwapEvent({
      fromChain: order?.trade?.inputAmount?.currency?.chainId,
      toChain: order?.trade?.outputAmount?.currency?.chainId,
      fromToken: order?.trade?.inputAmount?.currency?.symbol,
      toToken: order?.trade?.outputAmount?.currency?.symbol,
      amount: order?.trade?.inputAmount?.toExact(),
      amountOut: order?.trade?.outputAmount?.toExact(),
      priceImpact: priceImpactSeverity,
    })
  }, [isExpertMode, onConfirm, openConfirmSwapModal, resetState, order, priceImpactSeverity])

  useEffect(() => {
    if (indirectlyOpenConfirmModalState) {
      setIndirectlyOpenConfirmModalState(false)
      openConfirmSwapModal()
    }
  }, [indirectlyOpenConfirmModalState, openConfirmSwapModal])

  // Keep track of processed txHashes to avoid duplicate refreshes using a ref
  const processedTxHashesRef = useRef<string[]>([])

  // Watch for completed transactions and refresh balances
  useEffect(() => {
    // Only refresh when transaction is completed, txHash exists, and hasn't been processed yet
    if (
      [ConfirmModalState.COMPLETED, ConfirmModalState.ORDER_SUBMITTED].includes(confirmState) &&
      txHash &&
      !processedTxHashesRef.current.includes(txHash)
    ) {
      // track success txn
      logGTMSwapTxSuccessEvent({
        txHash: txHash ?? '',
      })

      // Add this txHash to the processed list
      processedTxHashesRef.current.push(txHash)

      // Refresh balances
      if (refreshBalances) {
        // delay refresh balances
        setTimeout(() => {
          refreshBalances()
        }, 15000)
      }
    }
  }, [confirmState, txHash, refreshBalances])

  // Use quote tracking state machine hook to ensure proper order: start -> success/fail
  // if any quote logic is changed, please update the hook
  useQuoteTrackingStateMachine({
    typedValue,
    tradeLoading,
    tradeError,
    inputCurrency,
    outputCurrency,
    swapInputError,
    parsedAmounts,
    disabled,
    isValid,
    order,
  })

  const buttonText = useMemo(() => {
    // Priority order for button text

    if (isRecipientEmpty) return t('Enter a recipient')
    if (isRecipientError) return t('Invalid recipient')

    // Handle bridge trade errors
    if (tradeError instanceof BridgeTradeError) {
      const errorMessage = handleBridgeTradeErrorMessage(tradeError)

      if (errorMessage) return errorMessage
    }

    if (swapInputError) return swapInputError

    if (tradeLoading) return <Dots>{t('Searching For The Best Price')}</Dots>

    if (isBridgeCheckApprovalLoading) return <Dots>{t('Checking for approval')}</Dots>

    if (priceImpactSeverity > 3 && !isExpertMode) return t('Price Impact Too High')

    if (priceImpactSeverity > 2) return t('Swap Anyway')

    return t('Swap')
  }, [
    isExpertMode,
    isRecipientEmpty,
    isRecipientError,
    priceImpactSeverity,
    swapInputError,
    t,
    tradeLoading,
    tradeError,
    isBridgeCheckApprovalLoading,
    handleBridgeTradeErrorMessage,
  ])

  if (noRoute && userHasSpecifiedInputOutput && tradeError instanceof TimeoutError) {
    return <TimeoutButton />
  }

  if (noRoute && userHasSpecifiedInputOutput && tradeError instanceof XTradeError) {
    return <ErrorButton tradeError={tradeError} />
  }

  if (noRoute && userHasSpecifiedInputOutput && (hasNoValidRouteError || !tradeLoading)) {
    return <ResetRoutesButton />
  }

  return (
    <CommitButton
      id="swap-button"
      width="100%"
      data-dd-action-name="Swap commit button"
      variant={isValid && priceImpactSeverity > 2 && !errorMessage ? 'danger' : 'primary'}
      disabled={disabled}
      onClick={handleSwap}
      checkChainId={isValid ? inputCurrency?.chainId : undefined}
    >
      {buttonText}
    </CommitButton>
  )
})

const ErrorButton = ({ tradeError }: { tradeError: XTradeError }) => {
  const { t } = useTranslation()
  const message = useMemo(() => {
    if (tradeError instanceof XTradeError) {
      if (tradeError.code === 'MARKET_CLOSED') {
        return t('Market is closed.')
      }
      if (tradeError.code === 'MARKET_PAUSED') {
        return t('Market is temporarily paused.')
      }
      if (tradeError.code === 'ASSET_PAUSED') {
        return t('Specific asset is paused.')
      }
      return t('Market is temporarily unavailable.')
    }
    throw new Error('Unsupported error type')
  }, [tradeError, t])

  return (
    <AutoColumn gap="12px">
      <GreyCard style={{ textAlign: 'center', padding: '0.75rem' }}>
        <Text color="textSubtle">{message}</Text>
      </GreyCard>
    </AutoColumn>
  )
}

const TimeoutButton = () => {
  const { refreshTrade, pauseQuoting, resumeQuoting } = useAtomValue(baseAllTypeBestTradeAtom)
  const { t } = useTranslation()

  const [seconds, setSeconds] = useState(3)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const resume = useCallback(() => {
    resumeQuoting()
    refreshTrade()
  }, [resumeQuoting, refreshTrade])

  useEffect(() => {
    pauseQuoting()
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          resume()
          return 3
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [resume, pauseQuoting])

  const manualRetry = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    resume()
  }, [resume])

  return (
    <AutoColumn gap="12px">
      <Message variant="warning" icon={<></>}>
        <AutoColumn gap="8px">
          <MessageText>{t('Routing timeout, will retry in %seconds%s...', { seconds })}</MessageText>
          <AutoRow gap="4px">
            <Button variant="text" scale="xs" p="0" onClick={manualRetry}>
              {t('Manual Retry')}
            </Button>
          </AutoRow>
        </AutoColumn>
      </Message>
    </AutoColumn>
  )
}
const ResetRoutesButton = () => {
  const { t } = useTranslation()
  const [isRoutingSettingChange, resetRoutingSetting] = useRoutingSettingChanged()
  return (
    <AutoColumn gap="12px">
      <GreyCard style={{ textAlign: 'center', padding: '0.75rem' }}>
        <Text color="textSubtle">{t('Insufficient liquidity for this trade.')}</Text>
      </GreyCard>
      {isRoutingSettingChange && (
        <Message variant="warning" icon={<></>}>
          <AutoColumn gap="8px">
            <MessageText>{t('Unable to establish trading route due to customized routing.')}</MessageText>
            <AutoRow gap="4px">
              <RoutingSettingsButton
                modalContent={<RoutingSettingsModalContent />}
                buttonProps={{
                  scale: 'xs',
                  p: 0,
                }}
                showRedDot={false}
              >
                {t('Check route settings')}
              </RoutingSettingsButton>
              <MessageText
                style={{
                  position: 'relative',
                  top: '-1px',
                }}
              >
                {t('or')}
              </MessageText>
              <Button variant="text" scale="xs" p="0" onClick={resetRoutingSetting}>
                {t('Reset to default')}
              </Button>
            </AutoRow>
          </AutoColumn>
        </Message>
      )}
    </AutoColumn>
  )
}
