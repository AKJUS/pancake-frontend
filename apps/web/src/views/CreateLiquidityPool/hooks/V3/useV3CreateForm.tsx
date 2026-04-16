import { useV3FormAddLiquidityCallback, useV3FormState } from 'views/AddLiquidityV3/formViews/V3FormView/form/reducer'
import useV3DerivedInfo from 'hooks/v3/useV3DerivedInfo'
import { useFeeLevelQueryState } from 'state/infinity/create'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { PRESET_FEE_LEVELS_V3 } from 'views/CreateLiquidityPool/constants'
import { useV3MintActionHandlers } from 'views/AddLiquidityV3/formViews/V3FormView/form/hooks/useV3MintActionHandlers'
import { tryParsePrice } from 'hooks/v3/utils'
import { V3SubmitButton } from 'views/AddLiquidityV3/components/V3SubmitButton'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useTranslation } from '@pancakeswap/localization'
import {
  Currency,
  CurrencyAmount,
  isUnifiedCurrencySorted,
  NativeCurrency,
  UnifiedCurrency,
} from '@pancakeswap/swap-sdk-core'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { CurrencyField as Field } from 'utils/types'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { useRouter } from 'next/router'
import {
  logGTMAddLiquidityTxSentEvent,
  logGTMClickAddLiquidityConfirmEvent,
  logGTMClickAddLiquidityEvent,
} from 'utils/customGTMEventTracking'
import { useIsExpertMode, useUserSlippage } from '@pancakeswap/utils/user'
import { useTokenRisk } from 'hooks/useTokenRisk'
import { useV3NFTPositionManagerContract } from 'hooks/useContract'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import V3RangeSelector from 'views/AddLiquidityV3/formViews/V3FormView/components/V3RangeSelector'
import { useRangeHopCallbacks } from 'views/AddLiquidityV3/formViews/V3FormView/form/hooks/useRangeHopCallbacks'
import { getViemErrorMessage } from 'utils/errors'
import { Bound, ZoomLevels } from '@pancakeswap/widgets-internal'
import {
  AutoColumn,
  Box,
  Button,
  FlexGap,
  IconButton,
  Message,
  MessageText,
  PreTitle,
  RowBetween,
  SwapHorizIcon,
  Text,
  useModalV2,
  useToast,
} from '@pancakeswap/uikit'
import { useSendTransaction, useWalletClient } from 'wagmi'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { NonfungiblePositionManager, priceToClosestTick } from '@pancakeswap/v3-sdk'
import { basisPointsToPercent } from 'utils/exchange'
import { hexToBigInt } from 'viem/utils'
import { getViemClients } from 'utils/viem'
import { calculateGasMargin } from 'utils'
import { formatRawAmount } from 'utils/formatCurrencyAmount'
import { useTransactionAdder } from 'state/transactions/hooks'
import { isUserRejected } from 'utils/sentry'
import { formatPreviewPrice } from 'views/CreateLiquidityPool/utils'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { PreviewModal } from 'views/CreateLiquidityPool/components/PreviewModal'
import { QUICK_ACTION_CONFIGS } from 'views/AddLiquidityV3/types'
import { useCurrencies } from '../useCurrencies'

export const useV3CreateForm = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { account, chainId, isWrongNetwork } = useAccountActiveChain()
  const { data: signer } = useWalletClient()
  const { onOpen: onOpenPreviewModal, isOpen: isPreviewModalOpen, onDismiss: onDismissPreviewModal } = useModalV2()
  const { toastError } = useToast()

  // User Settings
  const expertMode = useIsExpertMode()
  const [allowedSlippage] = useUserSlippage()
  const [deadline] = useTransactionDeadline()

  // Shared Create Liquidity State
  const { switchCurrencies: switchCurrenciesRoute } = useSelectIdRouteParams()
  const { baseCurrency, quoteCurrency } = useCurrencies()

  const [feeLevel] = useFeeLevelQueryState()
  const feeAmount = useMemo(() => {
    if (!feeLevel || !PRESET_FEE_LEVELS_V3.includes(feeLevel)) return undefined
    return feeLevel * 1e4
  }, [feeLevel])

  // V3 Form State
  const [txHash, setTxHash] = useState<string>('')
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm
  const [txnErrorMessage, setTxnErrorMessage] = useState<string | undefined>()
  const [showCapitalEfficiencyWarning, setShowCapitalEfficiencyWarning] = useState<boolean>(false)
  const [activeQuickAction, setActiveQuickAction] = useState<number>()
  const isQuickButtonUsed = useRef(false)
  const [quickAction, setQuickAction] = useState<number | null>(null)
  const [customZoomLevel, setCustomZoomLevel] = useState<ZoomLevels | undefined>(undefined)

  // Transaction Actions
  const { sendTransactionAsync } = useSendTransaction()
  const addTransaction = useTransactionAdder()
  const onAddLiquidityCallback = useV3FormAddLiquidityCallback()

  const formState = useV3FormState()
  const { independentField, typedValue, startPriceTypedValue, leftRangeTypedValue, rightRangeTypedValue } = formState

  const {
    pool,
    ticks,
    dependentField,
    price,
    pricesAtTicks,
    parsedAmounts,
    currencyBalances,
    position,
    noLiquidity,
    currencies,
    errorMessage,
    invalidPool,
    invalidRange,
    outOfRange,
    depositADisabled,
    depositBDisabled,
    invertPrice,
    ticksAtLimit,
    tickSpaceLimits,
  } = useV3DerivedInfo(
    (baseCurrency as Currency) ?? undefined,
    (quoteCurrency as Currency) ?? undefined,
    feeAmount,
    (baseCurrency as Currency) ?? undefined,
    undefined,
    formState,
  )

  // Currency validation
  const { shouldBlock: addIsUnsupported } = useTokenRisk(currencies?.CURRENCY_A, currencies?.CURRENCY_B)
  const isValid = !errorMessage && !invalidRange

  // Derivative States
  // Formatted amounts for input fields
  const formattedAmounts = useMemo(() => {
    return {
      [independentField]: typedValue,
      [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? '',
    }
  }, [independentField, typedValue, dependentField, parsedAmounts])

  // Get the max amounts user can add
  const maxAmounts: { [field in Field]?: CurrencyAmount<Currency> } = useMemo(
    () =>
      [Field.CURRENCY_A, Field.CURRENCY_B].reduce((accumulator, field) => {
        return {
          ...accumulator,
          [field]: maxAmountSpend(currencyBalances[field]),
        }
      }, {}),
    [currencyBalances],
  )

  // Approval States
  const positionManager = useV3NFTPositionManagerContract()
  const nftPositionManagerAddress = positionManager?.address

  const {
    approvalState: approvalA,
    approveCallback: approveACallback,
    revokeCallback: revokeACallback,
    currentAllowance: currentAllowanceA,
  } = useApproveCallback(parsedAmounts[Field.CURRENCY_A], nftPositionManagerAddress)
  const {
    approvalState: approvalB,
    approveCallback: approveBCallback,
    revokeCallback: revokeBCallback,
    currentAllowance: currentAllowanceB,
  } = useApproveCallback(parsedAmounts[Field.CURRENCY_B], nftPositionManagerAddress)

  // Existence check on parsed amounts for single-asset deposits
  const showApprovalA = useMemo(
    () => approvalA !== ApprovalState.APPROVED && !!parsedAmounts[Field.CURRENCY_A],
    [approvalA, parsedAmounts],
  )
  const showApprovalB = useMemo(
    () => approvalB !== ApprovalState.APPROVED && !!parsedAmounts[Field.CURRENCY_B],
    [approvalB, parsedAmounts],
  )

  // TICKS
  // Value and Prices at ticks
  const { [Bound.LOWER]: tickLower, [Bound.UPPER]: tickUpper } = ticks
  const { [Bound.LOWER]: priceLower, [Bound.UPPER]: priceUpper } = pricesAtTicks

  // Left and Right values for displaying in Preview Modal
  const isSorted = Boolean(
    baseCurrency &&
      quoteCurrency &&
      isUnifiedCurrencySorted(
        baseCurrency.wrapped as unknown as UnifiedCurrency,
        quoteCurrency.wrapped as unknown as UnifiedCurrency,
      ),
  )

  const rangeLeftPrice = isSorted ? priceLower : priceUpper?.invert()
  const rangeRightPrice = isSorted ? priceUpper : priceLower?.invert()
  const rangeLeftValue = useMemo(() => {
    if (ticksAtLimit[isSorted ? Bound.LOWER : Bound.UPPER]) return '0'

    if (
      tickSpaceLimits?.[Bound.LOWER] !== undefined &&
      rangeLeftPrice &&
      priceToClosestTick(rangeLeftPrice) <= tickSpaceLimits[Bound.LOWER]
    ) {
      return '0'
    }

    return formatPreviewPrice(rangeLeftPrice)
  }, [isSorted, rangeLeftPrice, tickSpaceLimits, ticksAtLimit])

  const rangeRightValue = useMemo(() => {
    if (ticksAtLimit[isSorted ? Bound.UPPER : Bound.LOWER]) return '∞'

    if (
      tickSpaceLimits?.[Bound.LOWER] !== undefined &&
      rangeRightPrice &&
      priceToClosestTick(rangeRightPrice) <= tickSpaceLimits[Bound.LOWER]
    ) {
      return '0'
    }

    if (
      tickSpaceLimits?.[Bound.UPPER] !== undefined &&
      rangeRightPrice &&
      priceToClosestTick(rangeRightPrice) >= tickSpaceLimits[Bound.UPPER]
    ) {
      return '∞'
    }

    return formatPreviewPrice(rangeRightPrice)
  }, [isSorted, rangeRightPrice, tickSpaceLimits, ticksAtLimit])

  const { onFieldAInput, onFieldBInput, onLeftRangeInput, onRightRangeInput, onStartPriceInput, onBothRangeInput } =
    useV3MintActionHandlers(noLiquidity, false)

  // Enhanced switchCurrencies that also inverts range values and swaps deposit amounts
  const switchCurrencies = useCallback(() => {
    // First, switch the currencies in the route
    switchCurrenciesRoute()

    // Invert the range values to maintain the same price ranges
    if (
      leftRangeTypedValue &&
      rightRangeTypedValue &&
      typeof leftRangeTypedValue !== 'boolean' &&
      typeof rightRangeTypedValue !== 'boolean'
    ) {
      const invertedLeft = rightRangeTypedValue.invert()
      const invertedRight = leftRangeTypedValue.invert()

      onBothRangeInput({
        leftTypedValue: invertedLeft,
        rightTypedValue: invertedRight,
      })
    }

    // Switch the deposit amounts
    onFieldAInput(parsedAmounts[Field.CURRENCY_B]?.toSignificant(6) ?? '')
    onFieldBInput(parsedAmounts[Field.CURRENCY_A]?.toSignificant(6) ?? '')
  }, [
    switchCurrenciesRoute,
    leftRangeTypedValue,
    rightRangeTypedValue,
    onBothRangeInput,
    parsedAmounts,
    onFieldAInput,
    onFieldBInput,
  ])

  // Range Inputs
  const { getDecrementLower, getIncrementLower, getDecrementUpper, getIncrementUpper, getSetFullRange } =
    useRangeHopCallbacks(
      (baseCurrency as Currency) ?? undefined,
      (quoteCurrency as Currency) ?? undefined,
      feeAmount,
      tickLower,
      tickUpper,
      pool,
    )

  const onBothRangePriceInput = useCallback(
    (leftRangeValue: string, rightRangeValue: string) => {
      onBothRangeInput({
        leftTypedValue: tryParsePrice(baseCurrency?.wrapped, quoteCurrency?.wrapped, leftRangeValue),
        rightTypedValue: tryParsePrice(baseCurrency?.wrapped, quoteCurrency?.wrapped, rightRangeValue),
      })
    },
    [baseCurrency, quoteCurrency, onBothRangeInput],
  )

  const onLeftRangePriceInput = useCallback(
    (leftRangeValue: string) => {
      onLeftRangeInput(tryParsePrice(baseCurrency?.wrapped, quoteCurrency?.wrapped, leftRangeValue))
    },
    [baseCurrency, quoteCurrency, onLeftRangeInput],
  )

  const onRightRangePriceInput = useCallback(
    (rightRangeValue: string) => {
      onRightRangeInput(tryParsePrice(baseCurrency?.wrapped, quoteCurrency?.wrapped, rightRangeValue))
    },
    [baseCurrency, quoteCurrency, onRightRangeInput],
  )

  // Range refresh function to set ranges based on zoom levels
  const handleRefresh = useCallback(
    (zoomLevel?: ZoomLevels) => {
      setActiveQuickAction(undefined)
      if (!zoomLevel) {
        setCustomZoomLevel(undefined)
        return
      }
      const currentPrice = price ? parseFloat((invertPrice ? price.invert() : price).toSignificant(8)) : undefined
      if (currentPrice) {
        const leftRangeValue = currentPrice * zoomLevel.initialMin
        const rightRangeValue = currentPrice * zoomLevel.initialMax

        onBothRangePriceInput(leftRangeValue.toString(), rightRangeValue.toString())
      }
    },
    [price, invertPrice, onBothRangePriceInput],
  )

  const handleQuickAction = useCallback(
    (value: number | null, zoomLevel: ZoomLevels) => {
      setQuickAction(value)
      if (value !== null) {
        // Check if it's a full range action (100)
        if (value === 100) {
          setCustomZoomLevel(undefined)
          setShowCapitalEfficiencyWarning(true)
          setActiveQuickAction(100)
          isQuickButtonUsed.current = true
        } else {
          const isPredefinedAction = feeAmount && QUICK_ACTION_CONFIGS[feeAmount]?.[value]

          if (isPredefinedAction) {
            setCustomZoomLevel(undefined)
            handleRefresh(QUICK_ACTION_CONFIGS[feeAmount][value])
            setActiveQuickAction(value)
            isQuickButtonUsed.current = true
          } else {
            setCustomZoomLevel(zoomLevel)
            handleRefresh(zoomLevel)
            setActiveQuickAction(value)
            isQuickButtonUsed.current = true
          }
        }
      }
    },
    [feeAmount, handleRefresh, setShowCapitalEfficiencyWarning],
  )

  // CREATE POOL ACTIONS
  const onAdd = useCallback(async () => {
    logGTMClickAddLiquidityConfirmEvent()
    if (
      !chainId ||
      !signer ||
      !account ||
      !nftPositionManagerAddress ||
      !positionManager ||
      !baseCurrency ||
      !quoteCurrency ||
      !position ||
      !deadline
    )
      return

    if (position?.liquidity === 0n) {
      setTxnErrorMessage(t('The liquidity of this position is 0. Please try increasing the amount.'))
      return
    }

    const useNative = baseCurrency?.isNative
      ? (baseCurrency as NativeCurrency)
      : quoteCurrency?.isNative
      ? (quoteCurrency as NativeCurrency)
      : undefined

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
      slippageTolerance: basisPointsToPercent(allowedSlippage),
      recipient: account,
      deadline: deadline.toString(),
      useNative,
      createPool: noLiquidity,
    })

    setAttemptingTxn(true)
    const txn = {
      data: calldata,
      to: nftPositionManagerAddress,
      value: hexToBigInt(value),
      account,
    }
    getViemClients({ chainId })
      ?.estimateGas(txn)
      .then((gas) => {
        sendTransactionAsync({
          ...txn,
          gas: calculateGasMargin(gas),
        })
          .then(async (hash) => {
            logGTMAddLiquidityTxSentEvent()
            const baseAmount = formatRawAmount(
              parsedAmounts[Field.CURRENCY_A]?.quotient?.toString() ?? '0',
              baseCurrency.decimals,
              4,
            )
            const quoteAmount = formatRawAmount(
              parsedAmounts[Field.CURRENCY_B]?.quotient?.toString() ?? '0',
              quoteCurrency.decimals,
              4,
            )

            setAttemptingTxn(false)
            addTransaction(
              { hash },
              {
                type: 'add-liquidity-v3',
                summary: `Add ${baseAmount} ${baseCurrency?.symbol} and ${quoteAmount} ${quoteCurrency?.symbol}`,
              },
            )
            setTxHash(hash)
            onAddLiquidityCallback(hash)

            // toastSuccess(
            //   `${t('Create Pool')}!`,
            //   <ToastDescriptionWithTx txHash={hash}>{t('Successfully created pool')}</ToastDescriptionWithTx>,
            // )

            // Redirect to liquidity pools page
            router.push('/liquidity/pools')
          })
          .catch((error) => {
            console.error('Failed to send transaction', error)
            // we only care if the error is something _other_ than the user rejected the tx
            if (!isUserRejected(error)) {
              setTxnErrorMessage(transactionErrorToUserReadableMessage(error, t))
              toastError(t('Error'), getViemErrorMessage(error))
            }

            setAttemptingTxn(false)
          })
      })
  }, [
    account,
    addTransaction,
    allowedSlippage,
    baseCurrency,
    chainId,
    deadline,
    nftPositionManagerAddress,
    noLiquidity,
    onAddLiquidityCallback,
    parsedAmounts,
    position,
    positionManager,
    quoteCurrency,
    sendTransactionAsync,
    signer,
    t,
    router,
    toastError,
  ])

  // Button Submit, with handle expert mode
  const handleButtonSubmit = useCallback(() => {
    // eslint-disable-next-line no-unused-expressions
    expertMode ? onAdd() : onOpenPreviewModal()
    logGTMClickAddLiquidityEvent()
  }, [expertMode, onAdd, onOpenPreviewModal])

  // Effects
  useEffect(() => {
    setShowCapitalEfficiencyWarning(false)
  }, [baseCurrency, quoteCurrency, feeAmount])

  // Reset ranges when fee tier changes
  useEffect(() => {
    if (feeAmount) {
      setActiveQuickAction(undefined)
      onBothRangeInput({
        leftTypedValue: undefined,
        rightTypedValue: undefined,
      })
    }
    // NOTE: ignore exhaustive-deps to avoid infinite re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeAmount])

  // Manage quick action state
  useEffect(() => {
    if (!isQuickButtonUsed.current && activeQuickAction) {
      setActiveQuickAction(undefined)
      setQuickAction(null)
      setCustomZoomLevel(undefined)
    } else if (isQuickButtonUsed.current) {
      isQuickButtonUsed.current = false
    }
  }, [isQuickButtonUsed, activeQuickAction, leftRangeTypedValue, rightRangeTypedValue])

  const buttons = (
    <V3SubmitButton
      addIsUnsupported={addIsUnsupported}
      account={account ?? undefined}
      isWrongNetwork={Boolean(isWrongNetwork)}
      approvalA={approvalA}
      approvalB={approvalB}
      isValid={isValid}
      showApprovalA={showApprovalA}
      approveACallback={approveACallback}
      currentAllowanceA={currentAllowanceA}
      revokeACallback={revokeACallback}
      currencies={currencies}
      showApprovalB={showApprovalB}
      approveBCallback={approveBCallback}
      currentAllowanceB={currentAllowanceB}
      revokeBCallback={revokeBCallback}
      parsedAmounts={parsedAmounts}
      onClick={handleButtonSubmit}
      attemptingTxn={attemptingTxn}
      errorMessage={errorMessage}
      buttonText={t('Add')}
      depositADisabled={depositADisabled}
      depositBDisabled={depositBDisabled}
    />
  )

  const rangeSelector = (
    <AutoColumn gap="8px">
      <PreTitle>{t('Set Price Range')}</PreTitle>

      {!showCapitalEfficiencyWarning && (
        <V3RangeSelector
          priceLower={priceLower}
          priceUpper={priceUpper}
          getDecrementLower={getDecrementLower}
          getIncrementLower={getIncrementLower}
          getDecrementUpper={getDecrementUpper}
          getIncrementUpper={getIncrementUpper}
          onLeftRangeInput={onLeftRangeInput}
          onRightRangeInput={onRightRangeInput}
          currencyA={baseCurrency}
          currencyB={quoteCurrency}
          feeAmount={feeAmount}
          ticksAtLimit={ticksAtLimit}
          tickSpaceLimits={tickSpaceLimits}
          quickAction={activeQuickAction ?? null}
          handleQuickAction={handleQuickAction}
        />
      )}

      {showCapitalEfficiencyWarning && (
        <Message variant="warning">
          <Box>
            <Text fontSize="16px">{t('Efficiency Comparison')}</Text>
            <Text color="textSubtle">{t('Full range positions may earn less fees than concentrated positions.')}</Text>
            <Button
              mt="16px"
              onClick={() => {
                setShowCapitalEfficiencyWarning(false)
                getSetFullRange()
                setActiveQuickAction(100)
              }}
              scale="md"
              variant="danger"
            >
              {t('I understand')}
            </Button>
          </Box>
        </Message>
      )}

      {outOfRange ? (
        <Message variant="warning">
          <RowBetween>
            <Text ml="12px" fontSize="12px">
              {t('Your position will not earn fees or be used in trades until the market price moves into your range.')}
            </Text>
          </RowBetween>
        </Message>
      ) : null}

      {invalidRange ? (
        <Message variant="warning">
          <MessageText>{t('Invalid range selected. The min price must be lower than the max price.')}</MessageText>
        </Message>
      ) : null}
    </AutoColumn>
  )

  const previewModal = useMemo(() => {
    return (
      <PreviewModal
        currencies={currencies}
        parsedAmounts={parsedAmounts}
        onConfirm={onAdd}
        isOpen={isPreviewModalOpen}
        onDismiss={onDismissPreviewModal}
        feeTier={feeAmount ? `${(feeAmount / 10_000).toFixed(2)}%` : undefined}
        details={{
          priceRange: (
            <>
              <FlexGap gap="4px" alignItems="center">
                <AutoColumn>
                  <div>
                    {rangeLeftValue} - {rangeRightValue}
                  </div>
                  <div>
                    {t('%assetA% = 1 %assetB%', {
                      assetA: quoteCurrency?.symbol,
                      assetB: baseCurrency?.symbol,
                    })}
                  </div>
                </AutoColumn>

                <IconButton variant="text" scale="sm" onClick={switchCurrencies}>
                  <SwapHorizIcon color="textSubtle" />
                </IconButton>
              </FlexGap>
            </>
          ),
          startPrice: (
            <>
              {invertPrice ? price?.invert().toSignificant(6) : price?.toSignificant(6)}{' '}
              {t('%assetA% = 1 %assetB%', {
                assetA: quoteCurrency?.symbol,
                assetB: baseCurrency?.symbol,
              })}
            </>
          ),
        }}
      />
    )
  }, [
    currencies,
    parsedAmounts,
    onAdd,
    isPreviewModalOpen,
    onDismissPreviewModal,
    feeAmount,
    price,
    baseCurrency,
    quoteCurrency,
    t,
    invertPrice,
    rangeLeftValue,
    rangeRightValue,
    switchCurrencies,
  ])

  return {
    // State
    formState,
    currencies,
    leftRangeTypedValue,
    rightRangeTypedValue,
    startPriceTypedValue,
    formattedAmounts,
    maxAmounts,
    depositADisabled,
    depositBDisabled,
    noLiquidity,

    // Components
    buttons,
    rangeSelector,
    previewModal,

    // Actions
    onBothRangePriceInput,
    onLeftRangePriceInput,
    onRightRangePriceInput,
    onFieldAInput,
    onFieldBInput,
    onStartPriceInput,
    switchCurrencies,
  }
}
