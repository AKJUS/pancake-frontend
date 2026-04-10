import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Percent } from '@pancakeswap/sdk'
import { Price, UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import {
  AutoColumn,
  Box,
  Button,
  Card,
  CardBody,
  Column,
  DynamicSection,
  FlexGap,
  InfoIcon,
  Message,
  MessageText,
  PreTitle,
  RowBetween,
  SwapHorizIcon,
  Text,
  Toggle,
  useMatchBreakpoints,
  useModal,
  useTooltip,
} from '@pancakeswap/uikit'
import { formatPrice } from '@pancakeswap/utils/formatFractions'
import { useIsExpertMode, useUserSlippage } from '@pancakeswap/utils/user'
import { FeeAmount, NonfungiblePositionManager, Pool } from '@pancakeswap/v3-sdk'
import {
  ConfirmationModalContent,
  Liquidity,
  NumericalInput,
  PricePeriodRangeChart,
  ZOOM_LEVELS,
  ZoomLevels,
} from '@pancakeswap/widgets-internal'
import BigNumber from 'bignumber.js'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import TransactionConfirmationModal from 'components/TransactionConfirmationModal'
import { ZapLiquidityWidget } from 'components/ZapLiquidityWidget'
import { Bound } from 'config/constants/types'
import { ZAP_V3_POOL_ADDRESSES } from 'config/constants/zap'
import { useIsTransactionUnsupported, useIsTransactionWarning } from 'hooks/Trades'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { useV3NFTPositionManagerContract } from 'hooks/useContract'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { usePoolMarketPrice, usePoolMarketPriceSlippage } from 'hooks/usePoolMarketPriceSlippage'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import useV3DerivedInfo from 'hooks/v3/useV3DerivedInfo'
import { tryParsePrice } from 'hooks/v3/utils'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTransactionAdder } from 'state/transactions/hooks'
import { styled } from 'styled-components'
import { calculateGasMargin } from 'utils'
import {
  logGTMAddLiquidityTxSentEvent,
  logGTMClickAddLiquidityConfirmEvent,
  logGTMClickAddLiquidityEvent,
} from 'utils/customGTMEventTracking'
import { basisPointsToPercent } from 'utils/exchange'
import { formatCurrencyAmount, formatRawAmount } from 'utils/formatCurrencyAmount'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { buildPostHogBaseProperties, capturePostHogEvent, getPostHogErrorProperties } from 'utils/posthog'
import { isUserRejected } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { CurrencyField as Field } from 'utils/types'
import { getViemClients } from 'utils/viem'
import { hexToBigInt } from 'viem'
import { useWalletRuntime } from 'wallet/hook/useWalletEnv'
import { useTokenRateData } from 'views/AddLiquidityInfinity/components/useTokenToTokenRateData'
import { getAxisTicks } from 'views/AddLiquidityInfinity/utils'
import { V3SubmitButton } from 'views/AddLiquidityV3/components/V3SubmitButton'
import { useDensityChartData } from 'views/AddLiquidityV3/hooks/useDensityChartData'
import {
  useCurrencyInversionEvent,
  useHeaderInvertCurrencies,
} from 'views/AddLiquidityV3/hooks/useHeaderInvertCurrencies'
import { useNativeCurrencyInstead } from 'views/AddLiquidityV3/hooks/useNativeCurrencyInstead'
import { HandleFeePoolSelectFn, QUICK_ACTION_CONFIGS } from 'views/AddLiquidityV3/types'
import { MarketPriceSlippageWarning } from 'views/CreateLiquidityPool/components/SubmitCreateButton'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { useSendTransaction, useWalletClient } from 'wagmi'
import { useTotalUsdValue } from '../../../AddLiquidity/hooks/useTotalUsdValue'
import FeeSelector from './components/FeeSelector'
import LockedDeposit from './components/LockedDeposit'
import { PositionPreview } from './components/PositionPreview'
import V3RangeSelector from './components/V3RangeSelector'
import { useInitialRange } from './form/hooks/useInitialRange'
import { useRangeHopCallbacks } from './form/hooks/useRangeHopCallbacks'
import { useV3MintActionHandlers } from './form/hooks/useV3MintActionHandlers'
import { useV3FormAddLiquidityCallback, useV3FormState } from './form/reducer'

const StyledInput = styled(NumericalInput)`
  background-color: ${({ theme }) => theme.colors.input};
  box-shadow: ${({ theme, error }) => theme.shadows[error ? 'warning' : 'inset']};
  border-radius: 16px;
  padding: 8px 16px;
  font-size: 16px;
  width: 100%;
  margin-bottom: 16px;
`

const LegendDot = styled.span<{ $color: 'primary' | 'secondary' | 'input' }>`
  display: inline-flex;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${({ theme, $color }) => theme.colors[$color]};
`

export const LeftContainer = styled(AutoColumn)`
  height: fit-content;

  grid-column: 1;
`

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

interface V3FormViewPropsType {
  baseCurrency?: Currency | null
  quoteCurrency?: Currency | null
  currencyIdA?: string
  currencyIdB?: string
  feeAmount?: number
}

export default function V3FormView({
  feeAmount,
  baseCurrency,
  quoteCurrency,
  currencyIdA,
  currencyIdB,
}: V3FormViewPropsType) {
  const router = useRouter()
  const { isMobile } = useMatchBreakpoints()
  const { data: signer } = useWalletClient()
  const { sendTransactionAsync } = useSendTransaction()
  const native = useNativeCurrency()

  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm
  const [txnErrorMessage, setTxnErrorMessage] = useState<string | undefined>()

  const {
    t,
    currentLanguage: { locale },
  } = useTranslation()
  const expertMode = useIsExpertMode()

  const { canUseNativeCurrency, handleUseNative, useNativeInstead } = useNativeCurrencyInstead({
    baseCurrency,
    quoteCurrency,
    feeAmount,
  })

  // Negate the effect of useNativeCurrencyInstead when we need actual WNATIVE currency
  const baseCurrencyWithoutNative = useMemo(() => {
    return baseCurrency?.isNative ? (baseCurrency.wrapped as Currency) : baseCurrency
  }, [baseCurrency])
  const quoteCurrencyWithoutNative = useMemo(() => {
    return quoteCurrency?.isNative ? (quoteCurrency.wrapped as Currency) : quoteCurrency
  }, [quoteCurrency])

  const positionManager = useV3NFTPositionManagerContract()
  const { account, chainId, isWrongNetwork } = useAccountActiveChain()
  const runtime = useWalletRuntime()
  const addTransaction = useTransactionAdder()

  const [pricePeriod, setPricePeriod] = useState<Liquidity.PresetRangeItem>(Liquidity.PRESET_RANGE_ITEMS[0])
  const axisTicks = useMemo(() => getAxisTicks(pricePeriod.value, isMobile), [pricePeriod.value, isMobile])

  // mint state
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
    hasInsufficentBalance,
    invalidPool,
    invalidRange,
    outOfRange,
    depositADisabled,
    depositBDisabled,
    invertPrice,
    ticksAtLimit,
    tickSpaceLimits,
  } = useV3DerivedInfo(
    baseCurrency ?? undefined,
    quoteCurrency ?? undefined,
    feeAmount,
    baseCurrency ?? undefined,
    undefined,
    formState,
  )
  const hasZapV3Pool = useMemo(() => {
    if (pool) {
      const zapV3Whitelist = ZAP_V3_POOL_ADDRESSES[pool.chainId]
      if (zapV3Whitelist) {
        if (zapV3Whitelist.length === 0) return true
        return zapV3Whitelist.includes(Pool.getAddress(pool.token0, pool.token1, pool.fee))
      }
    }
    return false
  }, [pool])
  const { onFieldAInput, onFieldBInput, onLeftRangeInput, onRightRangeInput, onStartPriceInput, onBothRangeInput } =
    useV3MintActionHandlers(noLiquidity)

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

  const isValid = !errorMessage && !invalidRange

  // modal and loading
  // capital efficiency warning
  const [showCapitalEfficiencyWarning, setShowCapitalEfficiencyWarning] = useState<boolean>(false)

  useEffect(() => {
    setShowCapitalEfficiencyWarning(false)
  }, [baseCurrency, quoteCurrency, feeAmount])

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

  const onAddLiquidityCallback = useV3FormAddLiquidityCallback()

  // Current token prices - using market price from USD prices
  const [, , currentPrice] = usePoolMarketPrice(
    (baseCurrency as UnifiedCurrency | null) ?? undefined,
    (quoteCurrency as UnifiedCurrency | null) ?? undefined,
  )

  // txn values
  const [deadline] = useTransactionDeadline() // custom from users settings
  const [txHash, setTxHash] = useState<string>('')

  // get formatted amounts
  const formattedAmounts = useMemo(
    () => ({
      [independentField]: typedValue,
      [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? '',
    }),
    [dependentField, independentField, typedValue, parsedAmounts],
  )

  // Get Total USD Value of input amounts
  const { totalUsdValue } = useTotalUsdValue({
    parsedAmountA: parsedAmounts[Field.CURRENCY_A],
    parsedAmountB: parsedAmounts[Field.CURRENCY_B],
  })

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

  const nftPositionManagerAddress = useV3NFTPositionManagerContract()?.address
  // check whether the user has approved the router on the tokens
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

  const [allowedSlippage] = useUserSlippage() // custom from users

  const handleFeePoolSelect = useCallback<HandleFeePoolSelectFn>(
    ({ feeAmount: newFeeAmount }) => {
      // Avoid replacing stable and v2 due to navigation issues when using universal farms overlay
      if (!newFeeAmount || router.pathname.includes('stable') || router.pathname.includes('v2')) {
        return
      }
      router.replace(
        {
          query: {
            ...router.query,
            currency: newFeeAmount
              ? [currencyIdA!, currencyIdB!, newFeeAmount.toString()]
              : [currencyIdA!, currencyIdB!],
          },
        },
        undefined,
        { shallow: true },
      )
    },
    [currencyIdA, currencyIdB, router],
  )

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

    const useNative = baseCurrency.isNative ? baseCurrency : quoteCurrency.isNative ? quoteCurrency : undefined

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
      slippageTolerance: basisPointsToPercent(allowedSlippage),
      recipient: account,
      deadline: deadline.toString(),
      useNative,
      createPool: noLiquidity,
    })
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
    const postHogBaseProperties = buildPostHogBaseProperties({
      account,
      chainId,
      runtime,
    })

    setAttemptingTxn(true)
    capturePostHogEvent('liquidity_add_started', {
      ...postHogBaseProperties,
      pool_type: 'v3',
      token_a_symbol: baseCurrency.symbol ?? null,
      token_a_amount: baseAmount,
      token_b_symbol: quoteCurrency.symbol ?? null,
      token_b_amount: quoteAmount,
      no_liquidity: noLiquidity,
      fee_tier: feeAmount ?? null,
    })
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
          .then((hash) => {
            logGTMAddLiquidityTxSentEvent()
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
            capturePostHogEvent('liquidity_add_succeeded', {
              ...postHogBaseProperties,
              pool_type: 'v3',
              token_a_symbol: baseCurrency.symbol ?? null,
              token_a_amount: baseAmount,
              token_b_symbol: quoteCurrency.symbol ?? null,
              token_b_amount: quoteAmount,
              tx_hash: hash,
              no_liquidity: noLiquidity,
              fee_tier: feeAmount ?? null,
            })
          })
          .catch((error) => {
            console.error('Failed to send transaction', error)
            capturePostHogEvent('liquidity_add_failed', {
              ...postHogBaseProperties,
              pool_type: 'v3',
              token_a_symbol: baseCurrency.symbol ?? null,
              token_a_amount: baseAmount,
              token_b_symbol: quoteCurrency.symbol ?? null,
              token_b_amount: quoteAmount,
              rejected_by_user: isUserRejected(error),
              no_liquidity: noLiquidity,
              fee_tier: feeAmount ?? null,
              ...getPostHogErrorProperties(error, isUserRejected(error) ? 'Transaction rejected.' : undefined),
            })
            // we only care if the error is something _other_ than the user rejected the tx
            if (!isUserRejected(error)) {
              setTxnErrorMessage(transactionErrorToUserReadableMessage(error, t))
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
  ])

  const handleDismissConfirmation = useCallback(() => {
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      onFieldAInput('')
    }
    setTxHash('')
    setTxnErrorMessage(undefined)
  }, [onFieldAInput, txHash])
  const addIsUnsupported = useIsTransactionUnsupported(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

  // get value and prices at ticks
  const { [Bound.LOWER]: tickLower, [Bound.UPPER]: tickUpper } = ticks
  const { [Bound.LOWER]: priceLower, [Bound.UPPER]: priceUpper } = pricesAtTicks

  useInitialRange(baseCurrency?.wrapped, quoteCurrency?.wrapped)

  const { getDecrementLower, getIncrementLower, getDecrementUpper, getIncrementUpper, getSetFullRange } =
    useRangeHopCallbacks(baseCurrency ?? undefined, quoteCurrency ?? undefined, feeAmount, tickLower, tickUpper, pool)
  // we need an existence check on parsed amounts for single-asset deposits
  const showApprovalA = approvalA !== ApprovalState.APPROVED && !!parsedAmounts[Field.CURRENCY_A]
  const showApprovalB = approvalB !== ApprovalState.APPROVED && !!parsedAmounts[Field.CURRENCY_B]

  const translationData = useMemo(() => {
    if (depositADisabled) {
      return {
        amount: formatCurrencyAmount(parsedAmounts[Field.CURRENCY_B], 4, locale),
        symbol: currencies[Field.CURRENCY_B]?.symbol ? currencies[Field.CURRENCY_B].symbol : '',
      }
    }
    if (depositBDisabled) {
      return {
        amount: formatCurrencyAmount(parsedAmounts[Field.CURRENCY_A], 4, locale),
        symbol: currencies[Field.CURRENCY_A]?.symbol ? currencies[Field.CURRENCY_A].symbol : '',
      }
    }
    return {
      amountA: formatCurrencyAmount(parsedAmounts[Field.CURRENCY_A], 4, locale),
      symbolA: currencies[Field.CURRENCY_A]?.symbol ? currencies[Field.CURRENCY_A].symbol : '',
      amountB: formatCurrencyAmount(parsedAmounts[Field.CURRENCY_B], 4, locale),
      symbolB: currencies[Field.CURRENCY_B]?.symbol ? currencies[Field.CURRENCY_B].symbol : '',
    }
  }, [depositADisabled, depositBDisabled, parsedAmounts, locale, currencies])

  const pendingText = useMemo(
    () =>
      !outOfRange
        ? t('Supplying %amountA% %symbolA% and %amountB% %symbolB%', translationData)
        : t('Supplying %amount% %symbol%', translationData),
    [t, outOfRange, translationData],
  )

  const [activeQuickAction, setActiveQuickAction] = useState<number>()
  const isQuickButtonUsed = useRef(false)
  const [quickAction, setQuickAction] = useState<number | null>(null)
  const [customZoomLevel, setCustomZoomLevel] = useState<ZoomLevels | undefined>(undefined)

  const [onPresentAddLiquidityModal] = useModal(
    <TransactionConfirmationModal
      minWidth={['100%', null, '420px']}
      title={t('Add Liquidity')}
      customOnDismiss={handleDismissConfirmation}
      attemptingTxn={attemptingTxn}
      hash={txHash}
      errorMessage={txnErrorMessage}
      content={() => (
        <ConfirmationModalContent
          topContent={() =>
            position ? (
              <PositionPreview
                position={position}
                inRange={!outOfRange}
                ticksAtLimit={ticksAtLimit}
                baseCurrencyDefault={baseCurrency}
              />
            ) : null
          }
          bottomContent={() => (
            <Button width="100%" mt="16px" onClick={onAdd}>
              {t('Add')}
            </Button>
          )}
        />
      )}
      pendingText={pendingText}
    />,
    true,
    true,
    'TransactionConfirmationModal',
  )

  const addIsWarning = useIsTransactionWarning(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

  const handleButtonSubmit = useCallback(() => {
    // eslint-disable-next-line no-unused-expressions
    expertMode ? onAdd() : onPresentAddLiquidityModal()
    logGTMClickAddLiquidityEvent()
  }, [expertMode, onAdd, onPresentAddLiquidityModal])

  const poolCurrentPrice = useMemo(() => {
    if (!pool) return undefined
    return new Price(pool.token0, pool.token1, 2n ** 192n, pool.sqrtRatioX96 * pool.sqrtRatioX96)
  }, [pool])
  const [, marketPriceSlippage] = usePoolMarketPriceSlippage(pool?.token0, pool?.token1, poolCurrentPrice)
  const displayMarketPriceSlippageWarning = useMemo(() => {
    if (marketPriceSlippage === undefined) return false
    const slippage = new BigNumber(marketPriceSlippage.toFixed(0)).abs()
    return slippage.gt(5) // 5% slippage
  }, [marketPriceSlippage])

  const buttons = (
    <V3SubmitButton
      addIsUnsupported={addIsUnsupported}
      addIsWarning={addIsWarning}
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

  useEffect(() => {
    if (!isQuickButtonUsed.current && activeQuickAction) {
      setActiveQuickAction(undefined)
      setQuickAction(null)
      setCustomZoomLevel(undefined)
    } else if (isQuickButtonUsed.current) {
      isQuickButtonUsed.current = false
    }
  }, [isQuickButtonUsed, activeQuickAction, leftRangeTypedValue, rightRangeTypedValue])

  const handleRefresh = useCallback(
    (zoomLevel?: ZoomLevels) => {
      setActiveQuickAction(undefined)
      if (!zoomLevel) {
        setCustomZoomLevel(undefined)
      }
      const currentPrice = price ? parseFloat((invertPrice ? price.invert() : price).toSignificant(8)) : undefined
      if (currentPrice) {
        onBothRangeInput({
          leftTypedValue: tryParsePrice(
            baseCurrency?.wrapped,
            quoteCurrency?.wrapped,
            (
              currentPrice * (zoomLevel?.initialMin ?? ZOOM_LEVELS[feeAmount ?? FeeAmount.MEDIUM].initialMin)
            ).toString(),
          ),
          rightTypedValue: tryParsePrice(
            baseCurrency?.wrapped,
            quoteCurrency?.wrapped,
            (
              currentPrice * (zoomLevel?.initialMax ?? ZOOM_LEVELS[feeAmount ?? FeeAmount.MEDIUM].initialMax)
            ).toString(),
          ),
        })
      }
    },
    [price, feeAmount, invertPrice, onBothRangeInput, baseCurrency, quoteCurrency],
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
            // if (value === activeQuickAction) {
            //   handleRefresh(ZOOM_LEVELS[feeAmount])
            // } else

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
    [activeQuickAction, feeAmount, handleRefresh, setShowCapitalEfficiencyWarning],
  )

  const handleOnZapSubmit = useCallback(() => {
    router.push('/liquidity/positions')
  }, [router])

  const invertRange = useCallback(() => {
    if (!ticksAtLimit[Bound.LOWER] && !ticksAtLimit[Bound.UPPER]) {
      onLeftRangeInput((invertPrice ? priceLower : priceUpper?.invert()) ?? undefined)
      onRightRangeInput((invertPrice ? priceUpper : priceLower?.invert()) ?? undefined)
      onFieldAInput(formattedAmounts[Field.CURRENCY_B] ?? '')
    }
  }, [
    ticksAtLimit,
    onLeftRangeInput,
    onRightRangeInput,
    onFieldAInput,
    invertPrice,
    priceLower,
    priceUpper,
    formattedAmounts,
  ])

  // Currency Inversion
  const inversionEvent = useCurrencyInversionEvent()

  const { handleInvertCurrencies } = useHeaderInvertCurrencies({
    currencyIdA,
    currencyIdB,
    feeAmount,
  })

  useEffect(() => {
    if (inversionEvent) {
      const { currencyIdA: newCurrencyIdA, currencyIdB: newCurrencyIdB } = inversionEvent
      if (newCurrencyIdA && newCurrencyIdB && newCurrencyIdA !== currencyIdA && newCurrencyIdB !== currencyIdB) {
        invertRange()
      }
    }
  }, [inversionEvent])

  const handleInvertStartPriceCurrencies = useCallback(() => {
    handleInvertCurrencies()
    onStartPriceInput(price?.invert()?.toSignificant(18) ?? '')
  }, [price, onStartPriceInput, handleInvertCurrencies])

  const {
    isLoading: isChartDataLoading,
    error: chartDataError,
    formattedData,
  } = useDensityChartData({
    currencyA: baseCurrency ?? undefined,
    currencyB: quoteCurrency ?? undefined,
    feeAmount,
  })

  // Price Rate Data
  const { data: rateData } = useTokenRateData({
    period: pricePeriod.value,
    baseCurrency: baseCurrencyWithoutNative ?? undefined,
    quoteCurrency: quoteCurrencyWithoutNative ?? undefined,
    chainId: baseCurrency?.chainId,
    protocol: Protocol.V3,
    poolId: pool ? Pool.getAddress(pool.token0, pool.token1, pool.fee) : undefined,
  })

  const handleUseCurrentPrice = useCallback(() => {
    if (currentPrice) {
      const formattedPrice = formatPrice(currentPrice)
      if (!formattedPrice) return
      onStartPriceInput(formattedPrice)
    }
  }, [currentPrice, onStartPriceInput])

  const {
    tooltip: currentPriceTooltip,
    tooltipVisible: currentPriceTooltipVisible,
    targetRef: currentPriceTargetRef,
  } = useTooltip(t('The price is an estimation of the current market price. Please verify before using it.'), {
    avoidToStopPropagation: true,
  })

  return (
    <>
      <LeftContainer>
        <Card>
          <CardBody>
            <AutoColumn gap="16px">
              {noLiquidity && (
                <Box>
                  <FlexGap gap="8px" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                    <PreTitle mb="8px">{t('Set Starting Price')}</PreTitle>

                    {currentPrice ? (
                      <FlexGap mb="8px" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                        <div />
                        <FlexGap gap="4px" alignItems="center" flexWrap="wrap">
                          <div ref={currentPriceTargetRef}>
                            <CurrentPriceButton onClick={handleUseCurrentPrice}>
                              <span>{t('Use Market Price')}</span>
                              <InfoIcon color="primary60" width="18px" />
                            </CurrentPriceButton>
                            {currentPriceTooltipVisible && currentPriceTooltip}
                          </div>
                          <Text color="textSubtle" small>
                            {currentPrice.toSignificant(8)} {quoteCurrency?.symbol} per {baseCurrency?.symbol}
                          </Text>
                          <SwapHorizIcon
                            role="button"
                            color="primary60"
                            onClick={handleInvertStartPriceCurrencies}
                            style={{ cursor: 'pointer' }}
                          />
                        </FlexGap>
                      </FlexGap>
                    ) : (
                      <Liquidity.RateToggle
                        currencyA={baseCurrency}
                        handleRateToggle={handleInvertStartPriceCurrencies}
                      />
                    )}
                  </FlexGap>
                  <Message variant="warning" my="8px">
                    <MessageText>
                      {t(
                        'This pool must be initialized before you can add liquidity. To initialize, select a starting price for the pool. Then, enter your liquidity price range and deposit amount. Gas fees will be higher than usual due to the initialization transaction.',
                      )}
                      <br />
                      <br />

                      <span style={{ fontWeight: 600 }}>
                        {t('Fee-on transfer tokens and rebasing tokens are NOT compatible with V3.')}
                      </span>
                    </MessageText>
                  </Message>
                  <FlexGap gap="8px" alignItems="baseline" justifyContent="space-between">
                    <StyledInput
                      className="start-price-input"
                      value={startPriceTypedValue}
                      onUserInput={onStartPriceInput}
                    />
                    <Text color="textSubtle">{quoteCurrency?.symbol}</Text>
                  </FlexGap>
                </Box>
              )}
              <DynamicSection disabled={!feeAmount || invalidPool}>
                <FlexGap gap="8px" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                  <PreTitle>{t('Set position range')}</PreTitle>
                  {!noLiquidity && (
                    <FlexGap gap="8px" alignItems="center" flexWrap="wrap">
                      <FlexGap gap="8px" alignItems="center">
                        <LegendDot $color="primary" />
                        <Text color="textSubtle" small>
                          {t('Current Price')}
                        </Text>
                      </FlexGap>
                      <FlexGap gap="8px" alignItems="center">
                        <LegendDot $color="secondary" />
                        <Text color="textSubtle" small>
                          {t('Position Range')}
                        </Text>
                      </FlexGap>
                      <FlexGap gap="8px" alignItems="center">
                        <LegendDot $color="input" />
                        <Text color="textSubtle" small>
                          {t('Liquidity Depth')}
                        </Text>
                      </FlexGap>
                    </FlexGap>
                  )}
                </FlexGap>

                {!noLiquidity && (
                  <>
                    <Box mt="22px" border="1px solid" borderColor="cardBorder" borderRadius="24px" p="8px">
                      <FlexGap
                        flexDirection={isMobile ? 'column' : 'row'}
                        justifyContent={isMobile ? 'flex-start' : 'space-between'}
                        gap="16px"
                        mb="24px"
                      >
                        <Liquidity.PriceRangeDatePicker onChange={setPricePeriod} value={pricePeriod} />
                      </FlexGap>

                      <PricePeriodRangeChart
                        isLoading={isChartDataLoading}
                        key={baseCurrency?.wrapped.address}
                        zoomLevel={
                          customZoomLevel ||
                          (activeQuickAction && feeAmount
                            ? QUICK_ACTION_CONFIGS?.[feeAmount]?.[activeQuickAction]
                            : undefined)
                        }
                        baseCurrency={baseCurrencyWithoutNative}
                        quoteCurrency={quoteCurrencyWithoutNative}
                        ticksAtLimit={ticksAtLimit}
                        price={price ? parseFloat((invertPrice ? price.invert() : price).toSignificant(8)) : undefined}
                        priceLower={priceLower}
                        priceUpper={priceUpper}
                        onBothRangeInput={onBothRangePriceInput}
                        onMinPriceInput={onLeftRangePriceInput}
                        onMaxPriceInput={onRightRangePriceInput}
                        formattedData={formattedData}
                        priceHistoryData={rateData}
                        axisTicks={axisTicks}
                        error={chartDataError}
                        interactive
                      />
                    </Box>
                  </>
                )}
              </DynamicSection>

              <DynamicSection disabled={!feeAmount || invalidPool || (noLiquidity && !startPriceTypedValue)} gap="16px">
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
                    quickAction={quickAction}
                    handleQuickAction={handleQuickAction}
                  />
                )}

                {showCapitalEfficiencyWarning && (
                  <Message variant="warning">
                    <Box>
                      <Text fontSize="16px">{t('Efficiency Comparison')}</Text>
                      <Text color="textSubtle">
                        {t('Full range positions may earn less fees than concentrated positions.')}
                      </Text>
                      <Button
                        mt="16px"
                        onClick={() => {
                          setShowCapitalEfficiencyWarning(false)
                          getSetFullRange()
                        }}
                        scale="md"
                        variant="danger"
                      >
                        {t('I understand')}
                      </Button>
                    </Box>
                  </Message>
                )}

                {displayMarketPriceSlippageWarning ? (
                  <MarketPriceSlippageWarning slippage={`${marketPriceSlippage?.toFixed(0)} %`} />
                ) : null}

                {outOfRange ? (
                  <Message variant="warning">
                    <RowBetween>
                      <Text ml="12px" fontSize="12px">
                        {t(
                          'Your position will not earn fees or be used in trades until the market price moves into your range.',
                        )}
                      </Text>
                    </RowBetween>
                  </Message>
                ) : null}
                {invalidRange ? (
                  <Message variant="warning">
                    <MessageText>
                      {t('Invalid range selected. The min price must be lower than the max price.')}
                    </MessageText>
                  </Message>
                ) : null}
              </DynamicSection>
            </AutoColumn>
          </CardBody>
        </Card>
      </LeftContainer>
      <Card style={{ height: 'fit-content' }}>
        <CardBody>
          <DynamicSection disabled={!baseCurrency || !quoteCurrency}>
            <FeeSelector
              currencyA={baseCurrency ?? undefined}
              currencyB={quoteCurrency ?? undefined}
              handleFeePoolSelect={handleFeePoolSelect}
              feeAmount={feeAmount}
            />
          </DynamicSection>
          <DynamicSection
            mt="16px"
            style={{
              gridAutoRows: 'max-content',
              gridAutoColumns: '100%',
            }}
            gap="8px"
            disabled={
              !feeAmount || invalidPool || (noLiquidity && !startPriceTypedValue) || (!priceLower && !priceUpper)
            }
          >
            {hasZapV3Pool && hasInsufficentBalance && (
              <Box mb="8px">
                <ZapLiquidityWidget
                  tickLower={tickLower}
                  tickUpper={tickUpper}
                  pool={pool}
                  baseCurrency={baseCurrency}
                  baseCurrencyAmount={formattedAmounts[Field.CURRENCY_A]}
                  quoteCurrency={quoteCurrency}
                  quoteCurrencyAmount={formattedAmounts[Field.CURRENCY_B]}
                  onSubmit={handleOnZapSubmit}
                />
              </Box>
            )}

            <LockedDeposit locked={depositADisabled}>
              <Box mb="8px">
                <CurrencyInputPanelSimplify
                  showUSDPrice
                  maxAmount={maxAmounts[Field.CURRENCY_A]}
                  onMax={() => onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')}
                  onPercentInput={(percent) =>
                    onFieldAInput(maxAmounts[Field.CURRENCY_A]?.multiply(new Percent(percent, 100))?.toExact() ?? '')
                  }
                  disableCurrencySelect
                  defaultValue={formattedAmounts[Field.CURRENCY_A] ?? '0'}
                  onUserInput={onFieldAInput}
                  showQuickInputButton
                  showMaxButton
                  currency={currencies[Field.CURRENCY_A]}
                  id="add-liquidity-input-tokena"
                  title={<PreTitle>{t('Deposit Amount')}</PreTitle>}
                />
              </Box>
            </LockedDeposit>

            <LockedDeposit locked={depositBDisabled}>
              <CurrencyInputPanelSimplify
                showUSDPrice
                maxAmount={maxAmounts[Field.CURRENCY_B]}
                onMax={() => onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')}
                onPercentInput={(percent) =>
                  onFieldBInput(maxAmounts[Field.CURRENCY_B]?.multiply(new Percent(percent, 100))?.toExact() ?? '')
                }
                disableCurrencySelect
                defaultValue={formattedAmounts[Field.CURRENCY_B] ?? '0'}
                onUserInput={onFieldBInput}
                showQuickInputButton
                showMaxButton
                currency={currencies[Field.CURRENCY_B]}
                id="add-liquidity-input-tokenb"
                title={<>&nbsp;</>}
              />
            </LockedDeposit>
            <Column mt="16px" gap="16px">
              {canUseNativeCurrency && (
                <RowBetween>
                  <Text color="textSubtle">Use {native.symbol} instead</Text>
                  <Toggle scale="sm" checked={useNativeInstead} onChange={handleUseNative} />
                </RowBetween>
              )}
              <RowBetween>
                <Text color="textSubtle">{t('Total.amount')}</Text>
                <Text>~{formatDollarAmount(totalUsdValue, 2, false)}</Text>
              </RowBetween>
              <RowBetween>
                <Text color="textSubtle">{t('Slippage Tolerance')}</Text>
                <LiquiditySlippageButton />
              </RowBetween>
            </Column>
            <MevProtectToggle size="sm" />
            <Box mt="8px">{buttons}</Box>
          </DynamicSection>
        </CardBody>
      </Card>
    </>
  )
}
