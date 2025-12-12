import Decimal from 'decimal.js'
import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import {
  Price,
  UnifiedCurrency,
  UnifiedCurrencyAmount,
  Percent,
  isUnifiedCurrencySorted,
  Token,
  SPLToken,
  sortUnifiedCurrencies,
} from '@pancakeswap/swap-sdk-core'
//
import { useUnifiedUSDPriceAmount } from 'hooks/useStablecoinPrice'
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
  useMatchBreakpoints,
  useModal,
  useTooltip,
} from '@pancakeswap/uikit'
import { useIsExpertMode } from '@pancakeswap/utils/user'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import {
  ConfirmationModalContent,
  Liquidity,
  NumericalInput,
  PricePeriodRangeChart,
  ZOOM_LEVELS,
  ZoomLevels,
  DoubleCurrencyLogo,
} from '@pancakeswap/widgets-internal'
import BigNumber from 'bignumber.js'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import TransactionConfirmationModal from 'components/TransactionConfirmationModal'
import { LightGreyCard } from 'components/Card'
import Divider from 'components/Divider'
import CurrencyLogo from 'components/Logo/CurrencyLogo'
import { RangePriceSection } from 'components/RangePriceSection'
import { RangeTag } from 'components/RangeTag'
import { Bound } from 'config/constants/types'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { usePoolMarketPriceSlippage } from 'hooks/usePoolMarketPriceSlippage'
import { tryParsePrice } from 'hooks/v3/utils'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { styled } from 'styled-components'
import {
  logGTMAddLiquidityTxSentEvent,
  logGTMClickAddLiquidityConfirmEvent,
  logGTMClickAddLiquidityEvent,
} from 'utils/customGTMEventTracking'
import { formatPrice } from 'utils/formatCurrencyAmount'
import { maxUnifiedAmountSpend } from 'utils/maxAmountSpend'
import { CurrencyField as Field } from 'utils/types'
import { useTokenRateData } from 'views/AddLiquidityInfinity/components/useTokenToTokenRateData'
import { getAxisTicks } from 'views/AddLiquidityInfinity/utils'
import { SolanaSubmitButton } from 'views/CreateLiquidityPool/components/Solana/SolanaSubmitButton'
import { useSolanaDensityChartData } from 'views/AddLiquidityV3/hooks/useSolanaDensityChartData'
import {
  useCurrencyInversionEvent,
  useHeaderInvertCurrencies,
} from 'views/AddLiquidityV3/hooks/useHeaderInvertCurrencies'
import { MarketPriceSlippageWarning } from 'views/CreateLiquidityPool/components/SubmitCreateButton'
import { Dot } from 'views/Notifications/styles'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { useSolanaDerivedInfo } from 'hooks/solana/useSolanaDerivedInfo'
import { useSolanaPoolByMint } from 'hooks/solana/useSolanaPoolsByMint'
import { FieldFeeLevel } from 'views/CreateLiquidityPool/components/V3/FieldFeeLevel'
import { useSolanaRangeHopCallbacks } from 'views/CreateLiquidityPool/hooks/useRangeHopCallbacks'
import { formatTickPrice } from 'hooks/v3/utils/formatTickPrice'
//
import { useRaydium } from 'hooks/solana/useRaydium'
import { useCreatePosition } from 'hooks/solana/useCreatePosition'
import { usePreviousValue } from '@pancakeswap/hooks'
import { CreatePoolBuildData, useCreateClmmPool } from 'hooks/solana/useCreateClmmPool'
import { useUnifiedTokenUsdPrice } from 'hooks/useUnifiedTokenUsdPrice'
import { useQuickActionConfigs } from 'views/AddLiquidityV3/hooks/useQuickActionConfigs'
import { useTransactionAdder } from 'state/transactions/hooks'

import { useWallet } from '@solana/wallet-adapter-react'
import { isMultisigWallet } from 'utils/solana/isMultisigWallet'
import LockedDeposit from '../V3FormView/components/LockedDeposit'
import { RangeSelector } from './RangeSelector'
import { useV3MintActionHandlers } from '../V3FormView/form/hooks/useV3MintActionHandlers'
import { useV3FormAddLiquidityCallback, useV3FormState } from '../V3FormView/form/reducer'
import { useInitialRange } from '../V3FormView/form/hooks/useInitialRange'

const StyledInput = styled(NumericalInput)`
  background-color: ${({ theme }) => theme.colors.input};
  box-shadow: ${({ theme, error }) => theme.shadows[error ? 'warning' : 'inset']};
  border-radius: 16px;
  padding: 8px 16px;
  font-size: 16px;
  width: 100%;
  margin-bottom: 16px;
`

const LeftContainer = styled(AutoColumn)`
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

interface SolanaFormViewPropsType {
  baseCurrency?: UnifiedCurrency
  quoteCurrency?: UnifiedCurrency
  currencyIdA?: string
  currencyIdB?: string
  feeAmount?: number
}

export function SolanaFormView({
  feeAmount,
  baseCurrency,
  quoteCurrency,
  currencyIdA,
  currencyIdB,
}: SolanaFormViewPropsType) {
  const router = useRouter()
  const { isMobile } = useMatchBreakpoints()

  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm
  const [txnErrorMessage, setTxnErrorMessage] = useState<string | undefined>()

  const {
    t,
    currentLanguage: { locale },
  } = useTranslation()
  const expertMode = useIsExpertMode()
  const previousFeeAmount = usePreviousValue(feeAmount)

  const { data: solPoolInfo } = useSolanaPoolByMint(
    baseCurrency?.wrapped?.address,
    quoteCurrency?.wrapped?.address,
    feeAmount,
  )

  const { solanaAccount: account, isWrongNetwork } = useAccountActiveChain()
  const [pricePeriod, setPricePeriod] = useState<Liquidity.PresetRangeItem>(Liquidity.PRESET_RANGE_ITEMS[0])
  const axisTicks = useMemo(() => getAxisTicks(pricePeriod.value, isMobile), [pricePeriod.value, isMobile])

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
  } = useSolanaDerivedInfo(baseCurrency, quoteCurrency, feeAmount, baseCurrency, undefined, formState)
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

  // capital efficiency warning
  const [showCapitalEfficiencyWarning, setShowCapitalEfficiencyWarning] = useState<boolean>(false)

  useEffect(() => {
    setShowCapitalEfficiencyWarning(false)
  }, [baseCurrency, quoteCurrency, feeAmount])

  useEffect(() => {
    if (feeAmount && previousFeeAmount !== feeAmount) {
      setActiveQuickAction(undefined)
      onBothRangeInput({
        leftTypedValue: undefined,
        rightTypedValue: undefined,
      })
    }
    // NOTE: ignore exhaustive-deps to avoid infinite re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeAmount])

  useInitialRange(baseCurrency?.wrapped as Token, quoteCurrency?.wrapped as Token)

  const onAddLiquidityCallback = useV3FormAddLiquidityCallback()

  const [txHash, setTxHash] = useState<string>('')

  // get formatted amounts
  const formattedAmounts = useMemo(
    () => ({
      [independentField]: typedValue,
      [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? '',
    }),
    [dependentField, independentField, parsedAmounts, typedValue],
  )

  // Get Total USD Value of input amounts
  const usdA = useUnifiedUSDPriceAmount(
    parsedAmounts[Field.CURRENCY_A]?.currency,
    parsedAmounts[Field.CURRENCY_A] ? Number(parsedAmounts[Field.CURRENCY_A]?.toExact()) : undefined,
    { enabled: Boolean(parsedAmounts[Field.CURRENCY_A]) },
  )
  const usdB = useUnifiedUSDPriceAmount(
    parsedAmounts[Field.CURRENCY_B]?.currency,
    parsedAmounts[Field.CURRENCY_B] ? Number(parsedAmounts[Field.CURRENCY_B]?.toExact()) : undefined,
    { enabled: Boolean(parsedAmounts[Field.CURRENCY_B]) },
  )
  const totalUsdValue = (usdA ?? 0) + (usdB ?? 0)

  // Get the max amounts user can add
  const maxAmounts: { [field in Field]?: UnifiedCurrencyAmount<UnifiedCurrency> } = useMemo(
    () =>
      [Field.CURRENCY_A, Field.CURRENCY_B].reduce((accumulator, field) => {
        return {
          ...accumulator,
          [field]: maxUnifiedAmountSpend(currencyBalances[field] as UnifiedCurrencyAmount<UnifiedCurrency> | undefined),
        }
      }, {}),
    [currencyBalances],
  )

  const handleFeePoolSelect = useCallback(
    (_idx: number, newFeeAmount: number) => {
      if (!newFeeAmount || !router.isReady) {
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

  const raydium = useRaydium()

  const handleDismissConfirmation = useCallback(() => {
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      onFieldAInput('')
    }
    setTxHash('')
    setTxnErrorMessage(undefined)
  }, [onFieldAInput, txHash])

  const { [Bound.LOWER]: priceLower, [Bound.UPPER]: priceUpper } = pricesAtTicks
  const { [Bound.LOWER]: tickLower, [Bound.UPPER]: tickUpper } = ticks

  const { getDecrementLower, getIncrementLower, getDecrementUpper, getIncrementUpper, getSetFullRange } =
    useSolanaRangeHopCallbacks(baseCurrency, quoteCurrency, feeAmount, tickLower, tickUpper, pool)
  // we need an existence check on parsed amounts for single-asset deposits
  const translationData = useMemo(() => {
    if (depositADisabled) {
      return {
        amount: parsedAmounts[Field.CURRENCY_B]?.toSignificant(4) ?? '-',
        symbol: currencies[Field.CURRENCY_B]?.symbol ? currencies[Field.CURRENCY_B].symbol : '',
      }
    }
    if (depositBDisabled) {
      return {
        amount: parsedAmounts[Field.CURRENCY_A]?.toSignificant(4) ?? '-',
        symbol: currencies[Field.CURRENCY_A]?.symbol ? currencies[Field.CURRENCY_A].symbol : '',
      }
    }
    return {
      amountA: parsedAmounts[Field.CURRENCY_A]?.toSignificant(4) ?? '-',
      symbolA: currencies[Field.CURRENCY_A]?.symbol ? currencies[Field.CURRENCY_A].symbol : '',
      amountB: parsedAmounts[Field.CURRENCY_B]?.toSignificant(4) ?? '-',
      symbolB: currencies[Field.CURRENCY_B]?.symbol ? currencies[Field.CURRENCY_B].symbol : '',
    }
  }, [depositADisabled, depositBDisabled, parsedAmounts, currencies])

  const pendingText = useMemo(
    () =>
      !outOfRange
        ? t('Supplying %amountA% %symbolA% and %amountB% %symbolB%', translationData)
        : t('Supplying %amount% %symbol%', translationData),
    [t, outOfRange, translationData],
  )

  // Sorted orientation vs token0/token1 for display purposes
  const isSorted = useMemo(
    () => (baseCurrency && quoteCurrency ? isUnifiedCurrencySorted(baseCurrency, quoteCurrency) : false),
    [baseCurrency, quoteCurrency],
  )
  const displayedPrice = useMemo(() => (isSorted ? price : price?.invert()), [isSorted, price])

  const [activeQuickAction, setActiveQuickAction] = useState<number>()
  const isQuickButtonUsed = useRef(false)
  const [quickAction, setQuickAction] = useState<number | null>(null)
  const [customZoomLevel, setCustomZoomLevel] = useState<ZoomLevels | undefined>(undefined)
  const addTransaction = useTransactionAdder()

  const createClmm = useCreateClmmPool()
  const addLiquidity = useCreatePosition()
  const { wallet } = useWallet()

  const isMultisig = isMultisigWallet(wallet)

  const onAdd = useCallback(async () => {
    logGTMClickAddLiquidityConfirmEvent()
    try {
      if (!baseCurrency || !quoteCurrency) return
      if (!raydium) return
      if (!ticks?.[Bound.LOWER] || !ticks?.[Bound.UPPER]) return

      setAttemptingTxn(true)

      let createBuildData: CreatePoolBuildData | undefined
      if (noLiquidity && feeAmount && price) {
        const { buildData } = await createClmm({
          mintA: baseCurrency.wrapped as SPLToken,
          mintB: quoteCurrency.wrapped as SPLToken,
          tradeFeeRate: feeAmount,
          initialPrice: parseFloat(price.toSignificant(18)),
          position:
            typeof tickLower === 'number' && typeof tickUpper === 'number'
              ? {
                  tickLower,
                  tickUpper,
                  amountA: parsedAmounts[isSorted ? Field.CURRENCY_A : Field.CURRENCY_B] as any,
                  amountB: parsedAmounts[isSorted ? Field.CURRENCY_B : Field.CURRENCY_A] as any,
                }
              : undefined,
        })
        createBuildData = buildData
      }
      const res = await addLiquidity({
        createBuildData,
        independentField,
        dependentField,
        parsedAmounts,
        ticks,
        poolInfo: solPoolInfo?.rawPool ?? createBuildData?.extInfo.mockPoolInfo,
      })
      setAttemptingTxn(false)
      logGTMAddLiquidityTxSentEvent()
      const hash = res ? ('txId' in res ? res.txId : 'txIds' in res ? res.txIds[0] : '') : ''
      setTxHash(hash)
      if (!isMultisig) {
        addTransaction(
          { hash },
          {
            type: 'add-liquidity-v3',
            summary: `Add ${parsedAmounts[independentField]?.toExact()} ${
              parsedAmounts[independentField]?.currency?.symbol
            } and ${parsedAmounts[dependentField]?.toExact()} ${parsedAmounts[dependentField]?.currency?.symbol}`,
          },
        )
      }
      onAddLiquidityCallback(hash)
    } catch (e: any) {
      setAttemptingTxn(false)
      setTxnErrorMessage(e?.message ?? 'Failed to add liquidity')
    }
  }, [
    addTransaction,
    dependentField,
    independentField,
    solPoolInfo?.rawPool,
    addLiquidity,
    createClmm,
    feeAmount,
    isSorted,
    noLiquidity,
    price,
    tickLower,
    tickUpper,
    baseCurrency,
    quoteCurrency,
    parsedAmounts,
    ticks,
    onAddLiquidityCallback,
    raydium,
    isMultisig,
  ])

  const confirmationContent = useCallback(() => {
    const [currency0, currency1] = solPoolInfo
      ? [solPoolInfo?.token0, solPoolInfo?.token1]
      : baseCurrency && quoteCurrency
      ? sortUnifiedCurrencies([baseCurrency, quoteCurrency])
      : []
    return (
      <ConfirmationModalContent
        topContent={() => (
          <AutoColumn gap="md" style={{ marginTop: '0.5rem' }}>
            <RowBetween style={{ marginBottom: '0.5rem' }}>
              <FlexGap gap="8px" alignItems="center">
                <DoubleCurrencyLogo currency0={currency0} currency1={currency1} size={24} />
                <Text bold>
                  {currency0?.symbol}-{currency1?.symbol}
                </Text>
              </FlexGap>
              <RangeTag removed={false} outOfRange={Boolean(outOfRange)} />
            </RowBetween>

            <LightGreyCard>
              <AutoColumn gap="sm">
                <RowBetween>
                  <FlexGap gap="4px" alignItems="center">
                    <CurrencyLogo currency={currency0} />
                    <Text>{currency0?.symbol}</Text>
                  </FlexGap>
                  <Box>
                    <Text>
                      {parsedAmounts[isSorted ? Field.CURRENCY_A : Field.CURRENCY_B]?.toSignificant(6) || '-'}
                    </Text>
                    <Text fontSize="10px" color="textSubtle" textAlign="right">
                      ~{formatDollarAmount(isSorted ? usdA : usdB)}
                    </Text>
                  </Box>
                </RowBetween>
                <RowBetween>
                  <FlexGap gap="4px" alignItems="center">
                    <CurrencyLogo currency={currency1} />
                    <Text>{currency1?.symbol}</Text>
                  </FlexGap>
                  <Box>
                    <Text>
                      {parsedAmounts[isSorted ? Field.CURRENCY_B : Field.CURRENCY_A]?.toSignificant(6) || '-'}
                    </Text>
                    <Text fontSize="10px" color="textSubtle" textAlign="right">
                      ~{formatDollarAmount(isSorted ? usdB : usdA)}
                    </Text>
                  </Box>
                </RowBetween>
                <Divider />
                <RowBetween>
                  <Text color="textSubtle">{t('Fee Tier')}</Text>
                  <Text>{((feeAmount ?? solPoolInfo?.feeTier ?? 0) / 10000).toString()}%</Text>
                </RowBetween>
              </AutoColumn>
            </LightGreyCard>

            <AutoColumn gap="md">
              <RowBetween>
                <div />
              </RowBetween>

              <RowBetween>
                <RangePriceSection
                  width="48%"
                  title={t('Min Price')}
                  currency0={quoteCurrency}
                  currency1={baseCurrency}
                  price={formatTickPrice(pricesAtTicks[Bound.LOWER], ticksAtLimit, Bound.LOWER, locale)}
                />
                <RangePriceSection
                  width="48%"
                  title={t('Max Price')}
                  currency0={quoteCurrency}
                  currency1={baseCurrency}
                  price={formatTickPrice(pricesAtTicks[Bound.UPPER], ticksAtLimit, Bound.UPPER, locale)}
                />
              </RowBetween>
              <RangePriceSection
                title={t('Current Price')}
                currency0={quoteCurrency}
                currency1={baseCurrency}
                price={formatPrice(displayedPrice, 6, locale)}
              />
            </AutoColumn>

            <LightGreyCard>
              <RowBetween>
                <Text color="textSubtle">{t('Total Deposit')}</Text>
                <Text>~{formatDollarAmount(totalUsdValue, 2, false)}</Text>
              </RowBetween>
            </LightGreyCard>
          </AutoColumn>
        )}
        bottomContent={() => (
          <Button width="100%" mt="16px" onClick={onAdd}>
            {t('Add')}
          </Button>
        )}
      />
    )
  }, [
    solPoolInfo,
    baseCurrency,
    displayedPrice,
    feeAmount,
    isSorted,
    locale,
    onAdd,
    outOfRange,
    parsedAmounts,
    quoteCurrency,
    t,
    ticksAtLimit,
    totalUsdValue,
    usdA,
    usdB,
    pricesAtTicks,
  ])

  const [onPresentAddLiquidityModal] = useModal(
    <TransactionConfirmationModal
      minWidth={['100%', null, '420px']}
      title={t('Add Liquidity')}
      customOnDismiss={handleDismissConfirmation}
      attemptingTxn={attemptingTxn}
      hash={txHash}
      isMultisig={isMultisig}
      errorMessage={txnErrorMessage}
      content={confirmationContent}
      pendingText={pendingText}
    />,
    true,
    true,
    'TransactionConfirmationModal',
  )

  const handleButtonSubmit = useCallback(() => {
    if (expertMode) {
      onAdd()
    } else {
      onPresentAddLiquidityModal()
    }
    logGTMClickAddLiquidityEvent()
  }, [expertMode, onAdd, onPresentAddLiquidityModal])

  const poolCurrentPrice = useMemo(() => {
    if (!pool) return undefined
    return new Price(pool.token0 as any, pool.token1 as any, 2n ** 192n, pool.sqrtRatioX96 * pool.sqrtRatioX96)
  }, [pool])

  // Current token prices
  const { data: baseCurrencyCurrentPrice } = useUnifiedTokenUsdPrice(baseCurrency)
  const { data: quoteCurrencyCurrentPrice } = useUnifiedTokenUsdPrice(quoteCurrency)
  const currentPrice = useMemo(() => {
    if (!baseCurrencyCurrentPrice || !quoteCurrencyCurrentPrice) return undefined
    return new Decimal(baseCurrencyCurrentPrice).dividedBy(quoteCurrencyCurrentPrice)
  }, [baseCurrencyCurrentPrice, quoteCurrencyCurrentPrice])

  const [, marketPriceSlippage] = usePoolMarketPriceSlippage(baseCurrency, quoteCurrency, poolCurrentPrice)
  const displayMarketPriceSlippageWarning = useMemo(() => {
    if (marketPriceSlippage === undefined) return false
    const slippage = new BigNumber(marketPriceSlippage.toFixed(0)).abs()
    return slippage.gt(5) // 5% slippage
  }, [marketPriceSlippage])

  const buttons = (
    <SolanaSubmitButton
      addIsUnsupported={false}
      addIsWarning={false}
      account={account ?? undefined}
      isWrongNetwork={Boolean(isWrongNetwork)}
      isValid={isValid}
      parsedAmounts={parsedAmounts as any}
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

  const invertRange = useCallback(() => {
    if (!ticksAtLimit[Bound.LOWER] && !ticksAtLimit[Bound.UPPER]) {
      onBothRangeInput({
        leftTypedValue: priceUpper?.invert() ?? undefined,
        rightTypedValue: priceLower?.invert() ?? undefined,
      })
      if (invertPrice) {
        onFieldAInput(formattedAmounts[Field.CURRENCY_B] ?? '')
      } else {
        onFieldBInput(formattedAmounts[Field.CURRENCY_A] ?? '')
      }
    }
  }, [
    onBothRangeInput,
    ticksAtLimit,
    onFieldAInput,
    onFieldBInput,
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
      invertRange()
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
  } = useSolanaDensityChartData({
    currencyA: baseCurrency ?? undefined,
    currencyB: quoteCurrency ?? undefined,
    feeAmount,
  })

  const chartCurrentPrice = useMemo(() => {
    return price ? parseFloat((invertPrice ? price.invert() : price).toSignificant(8)) : undefined
  }, [price, invertPrice])

  const { data: rateData } = useTokenRateData({
    period: pricePeriod.value,
    baseCurrency: baseCurrency ?? undefined,
    quoteCurrency: quoteCurrency ?? undefined,
    chainId: baseCurrency?.chainId,
    protocol: Protocol.V3,
    poolId: solPoolInfo?.poolId,
  })

  const handleUseCurrentPrice = useCallback(() => {
    onStartPriceInput(currentPrice?.toSignificantDigits(18).toString() ?? '')
  }, [currentPrice, onStartPriceInput])

  const {
    tooltip: currentPriceTooltip,
    tooltipVisible: currentPriceTooltipVisible,
    targetRef: currentPriceTargetRef,
  } = useTooltip(t('The price is an estimation of the current market price. Please verify before using it.'), {
    placement: 'bottom',
    avoidToStopPropagation: true,
  })

  const defaultRangePoints = useMemo(
    () => solPoolInfo?.rawPool?.config?.defaultRangePoint.map((p) => Number(p) * 100),
    [solPoolInfo?.rawPool?.config?.defaultRangePoint],
  )
  const quickActionConfigs = useQuickActionConfigs({
    defaultRangePoints,
    feeAmount,
  })

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
          const isPredefinedAction = quickActionConfigs?.[value]

          if (isPredefinedAction) {
            setCustomZoomLevel(undefined)
            handleRefresh(isPredefinedAction)
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
    [quickActionConfigs, handleRefresh, setShowCapitalEfficiencyWarning],
  )

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
                            {currentPrice.toNumber()} {quoteCurrency?.symbol} per {baseCurrency?.symbol}
                          </Text>
                          <SwapHorizIcon
                            role="button"
                            color="primary60"
                            onClick={handleInvertStartPriceCurrencies}
                            style={{ cursor: 'pointer' }}
                          />
                        </FlexGap>
                      </FlexGap>
                    ) : null}
                  </FlexGap>
                  <Message variant="warning" my="8px">
                    <MessageText>
                      {t('This pool needs to be initialized before you can add liquidity.')}
                      <br />
                      {t(
                        'First, set the pool’s starting price. Then, choose your liquidity price range and enter the amount you want to deposit. Please note that creating a pool has higher fees compared to normal SOL transactions, since ticks must be initialized during setup.',
                      )}
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
                        <Dot color="primary" show />
                        <Text color="textSubtle" small>
                          {t('Current Price')}
                        </Text>
                      </FlexGap>
                      <FlexGap gap="8px" alignItems="center">
                        <Dot color="secondary" show />
                        <Text color="textSubtle" small>
                          {t('Position Range')}
                        </Text>
                      </FlexGap>
                      <FlexGap gap="8px" alignItems="center">
                        <Dot color="input" show />
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
                          customZoomLevel || (activeQuickAction ? quickActionConfigs?.[activeQuickAction] : undefined)
                        }
                        baseCurrency={baseCurrency as any}
                        quoteCurrency={quoteCurrency as any}
                        ticksAtLimit={ticksAtLimit}
                        price={chartCurrentPrice}
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
                  <RangeSelector
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
                    defaultRangePoints={defaultRangePoints}
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
            <FieldFeeLevel
              baseCurrency={baseCurrency ?? undefined}
              quoteCurrency={quoteCurrency ?? undefined}
              onSelect={handleFeePoolSelect}
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
            <LockedDeposit locked={depositADisabled}>
              <Box mb="8px">
                <CurrencyInputPanelSimplify
                  showUSDPrice
                  maxDecimals={currencies[Field.CURRENCY_A]?.decimals}
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
                maxDecimals={currencies[Field.CURRENCY_B]?.decimals}
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
              <RowBetween>
                <Text color="textSubtle">{t('Total')}</Text>
                <Text>~{formatDollarAmount(totalUsdValue, 2, false)}</Text>
              </RowBetween>
              <RowBetween>
                <Text color="textSubtle">{t('Slippage Tolerance')}</Text>
                <LiquiditySlippageButton />
              </RowBetween>
            </Column>
            <Box mt="8px">{buttons}</Box>
          </DynamicSection>
        </CardBody>
      </Card>
    </>
  )
}
