import { useDebouncedChangeHandler } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Percent, Token } from '@pancakeswap/swap-sdk-core'
import { AutoRow, Box, Button, FlexGap, Flex, PreTitle, RowBetween, Slider, Text, useModal } from '@pancakeswap/uikit'
import { CurrencyLogo, LightGreyCard } from '@pancakeswap/widgets-internal'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import ConfirmLiquidityModal from 'components/Liquidity/ConfirmRemoveLiquidityModal'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { useTotalPriceUSD } from 'hooks/useTotalPriceUSD'
import { ApprovalState } from 'hooks/useApproveCallback'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { StableLPDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useTransactionAdder } from 'state/transactions/hooks'
import { calculateSlippageAmount } from 'utils/exchange'
import { isUserRejected, logError } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useUserSlippage } from '@pancakeswap/utils/user'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { logGTMClickRemoveLiquidityEvent } from 'utils/customGTMEventTracking'
import { Field } from 'state/burn/actions'
import { useRemoveLiquidityInfinityStablePool } from 'views/StableInfinity/hooks/useRemoveLiquidityInfinityStablePool'
import {
  useCalcTokenAmount,
  useCalcWithdrawOneCoin,
  useUserLPBalance,
  useTotalSupply,
  usePoolBalances,
} from 'views/StableInfinity/hooks/useCalcTokenAmount'
import { CardCheckBox } from 'views/StableInfinity/components/shared/CardCheckBox'
import { RemoveMode } from 'views/StableInfinity/types/removeMode'

interface InfinitySSPositionRemoveProps {
  position?: StableLPDetail
  poolInfo: PoolInfo
}

export const InfinitySSPositionRemove = ({ poolInfo }: InfinitySSPositionRemoveProps) => {
  const { t } = useTranslation()
  const { account, chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const positionChainId = poolInfo.chainId
  const queryClient = useQueryClient()
  const publicClient = usePublicClient({ chainId: positionChainId })

  const currency0 = poolInfo.token0 as Currency
  const currency1 = poolInfo.token1 as Currency
  const poolAddress = poolInfo.lpAddress as string

  const [percentToRemove, setPercentToRemove] = useState(0)
  const [removeMode, setRemoveMode] = useState<RemoveMode>(RemoveMode.BALANCE)
  const [selectedCoinIndex, setSelectedCoinIndex] = useState<0 | 1>(0)
  const [customAmount0, setCustomAmount0] = useState('')
  const [customAmount1, setCustomAmount1] = useState('')

  const [{ attemptingTxn, liquidityErrorMessage, txHash }, setLiquidityState] = useState<{
    attemptingTxn: boolean
    liquidityErrorMessage: string | undefined
    txHash: string | undefined
  }>({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: undefined })

  const [preflightError, setPreflightError] = useState<string | undefined>(undefined)
  const [isPreflightChecking, setIsPreflightChecking] = useState(false)

  const {
    removeLiquidityInfinityStablePool,
    removeLiquidityOneCoin,
    removeLiquidityImbalance,
    estimateRemoveLiquidityInfinityStablePool,
    estimateRemoveLiquidityOneCoin,
    estimateRemoveLiquidityImbalance,
    isReady,
  } = useRemoveLiquidityInfinityStablePool({ poolAddress, chainId: positionChainId })

  const addTransaction = useTransactionAdder()
  const [userSlippageTolerance] = useUserSlippage()

  const userLPBalance = useUserLPBalance({
    poolAddress,
    account: account as `0x${string}` | undefined,
    chainId: positionChainId,
  })
  const totalSupply = useTotalSupply({ poolAddress, chainId: positionChainId })
  const [balance0, balance1] = usePoolBalances({ poolAddress, chainId: positionChainId })

  const lpAmountToBurn = useMemo(() => {
    if (!userLPBalance || percentToRemove === 0) return 0n
    return (userLPBalance * BigInt(percentToRemove)) / 100n
  }, [userLPBalance, percentToRemove])

  const [amount0Withdrawn, amount1Withdrawn] = useMemo<[bigint, bigint]>(() => {
    if (!totalSupply || totalSupply === 0n || !balance0 || !balance1 || lpAmountToBurn === 0n) return [0n, 0n]
    return [(lpAmountToBurn * balance0) / totalSupply, (lpAmountToBurn * balance1) / totalSupply]
  }, [lpAmountToBurn, balance0, balance1, totalSupply])

  const amounts = useMemo<[bigint, bigint]>(
    () => [amount0Withdrawn, amount1Withdrawn],
    [amount0Withdrawn, amount1Withdrawn],
  )

  const { tokenAmount: expectedTokensOut } = useCalcTokenAmount({
    poolAddress,
    amounts,
    deposit: false,
    enabled: isReady && lpAmountToBurn > 0n,
    chainId: positionChainId,
  })

  const parsedAmountA = useMemo(() => {
    if (!currency0 || amount0Withdrawn === 0n) return undefined
    return CurrencyAmount.fromRawAmount(currency0, amount0Withdrawn)
  }, [currency0, amount0Withdrawn])

  const parsedAmountB = useMemo(() => {
    if (!currency1 || amount1Withdrawn === 0n) return undefined
    return CurrencyAmount.fromRawAmount(currency1, amount1Withdrawn)
  }, [currency1, amount1Withdrawn])

  const { amount: oneCoinAmountRaw } = useCalcWithdrawOneCoin({
    poolAddress,
    burnAmount: lpAmountToBurn,
    index: selectedCoinIndex,
    enabled: removeMode === RemoveMode.ONE_COIN && lpAmountToBurn > 0n && isReady,
    chainId: positionChainId,
  })
  const oneCoinAmount = oneCoinAmountRaw ?? 0n

  useEffect(() => {
    if (removeMode !== RemoveMode.CUSTOM) return
    if (percentToRemove === 0) {
      setCustomAmount0('')
      setCustomAmount1('')
      return
    }
    if (currency0)
      setCustomAmount0(amount0Withdrawn > 0n ? CurrencyAmount.fromRawAmount(currency0, amount0Withdrawn).toExact() : '')
    if (currency1)
      setCustomAmount1(amount1Withdrawn > 0n ? CurrencyAmount.fromRawAmount(currency1, amount1Withdrawn).toExact() : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeMode, percentToRemove])

  const customCurrencyAmount0 = useMemo(() => {
    if (!currency0 || !customAmount0) return undefined
    return tryParseAmount(customAmount0, currency0)
  }, [currency0, customAmount0])

  const customCurrencyAmount1 = useMemo(() => {
    if (!currency1 || !customAmount1) return undefined
    return tryParseAmount(customAmount1, currency1)
  }, [currency1, customAmount1])

  const customAmount0Parsed = useMemo(() => customCurrencyAmount0?.quotient ?? 0n, [customCurrencyAmount0])
  const customAmount1Parsed = useMemo(() => customCurrencyAmount1?.quotient ?? 0n, [customCurrencyAmount1])

  const { tokenAmount: customMaxBurnAmount } = useCalcTokenAmount({
    poolAddress,
    amounts: [customAmount0Parsed, customAmount1Parsed],
    deposit: false,
    enabled: removeMode === RemoveMode.CUSTOM && customAmount0Parsed > 0n && customAmount1Parsed > 0n,
    chainId: positionChainId,
  })

  const lpToken = useMemo(() => {
    if (!currency0 || !poolAddress) return undefined
    return new Token(currency0.chainId, poolAddress as `0x${string}`, 18, 'LP', 'LP Token')
  }, [currency0, poolAddress])

  const [currentAmount0, currentAmount1] = useMemo<[bigint, bigint]>(() => {
    if (!totalSupply || totalSupply === 0n || !balance0 || !balance1 || !userLPBalance) return [0n, 0n]
    return [(userLPBalance * balance0) / totalSupply, (userLPBalance * balance1) / totalSupply]
  }, [userLPBalance, balance0, balance1, totalSupply])

  const onRemove = useCallback(async () => {
    if (!currency0 || !currency1) return
    setLiquidityState({ attemptingTxn: true, liquidityErrorMessage: undefined, txHash: undefined })

    try {
      let response: string
      const symbolA = currency0?.symbol
      const symbolB = currency1?.symbol
      let amtA = '0'
      let amtB = '0'

      if (removeMode === RemoveMode.BALANCE) {
        if (!lpAmountToBurn || lpAmountToBurn === 0n) return
        const minAmount0 = parsedAmountA ? calculateSlippageAmount(parsedAmountA, userSlippageTolerance)[0] : 0n
        const minAmount1 = parsedAmountB ? calculateSlippageAmount(parsedAmountB, userSlippageTolerance)[0] : 0n
        response = await removeLiquidityInfinityStablePool(lpAmountToBurn, minAmount0, minAmount1)
        amtA = parsedAmountA?.toSignificant(3) || '0'
        amtB = parsedAmountB?.toSignificant(3) || '0'
      } else if (removeMode === RemoveMode.ONE_COIN) {
        if (!lpAmountToBurn || lpAmountToBurn === 0n || oneCoinAmount === 0n) return
        const selectedCurrency = selectedCoinIndex === 0 ? currency0 : currency1
        const parsedOneCoinAmount = CurrencyAmount.fromRawAmount(selectedCurrency, oneCoinAmount)
        const minReceived = calculateSlippageAmount(parsedOneCoinAmount, userSlippageTolerance)[0]
        response = await removeLiquidityOneCoin(lpAmountToBurn, selectedCoinIndex === 0, minReceived)
        if (selectedCoinIndex === 0) {
          amtA = parsedOneCoinAmount.toSignificant(3)
        } else {
          amtB = parsedOneCoinAmount.toSignificant(3)
        }
      } else {
        if (customCurrencyAmount0 === undefined || customCurrencyAmount1 === undefined) return
        if (!customMaxBurnAmount || customMaxBurnAmount === 0n) return
        if (!lpToken) return
        const slippedMaxBurnAmount = calculateSlippageAmount(
          CurrencyAmount.fromRawAmount(lpToken, customMaxBurnAmount),
          userSlippageTolerance,
        )[1]
        response = await removeLiquidityImbalance(customAmount0Parsed, customAmount1Parsed, slippedMaxBurnAmount)
        amtA = customCurrencyAmount0.toSignificant(3)
        amtB = customCurrencyAmount1.toSignificant(3)
      }

      setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: response })
      addTransaction(
        { hash: response },
        {
          summary: `Remove ${amtA} ${symbolA} and ${amtB} ${symbolB}`,
          translatableSummary: {
            text: 'Remove %amountA% %symbolA% and %amountB% %symbolB%',
            data: { amountA: amtA, symbolA, amountB: amtB, symbolB },
          },
          type: 'remove-liquidity',
        },
      )

      if (publicClient) {
        publicClient
          .waitForTransactionReceipt({ hash: response as `0x${string}` })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['infinity-stable-user-lp-balance', poolAddress, account] })
            queryClient.invalidateQueries({ queryKey: ['infinity-stable-total-supply', poolAddress] })
            queryClient.invalidateQueries({ queryKey: ['infinity-stable-pool-balances', poolAddress] })
            queryClient.invalidateQueries({ queryKey: ['infinity-stable-calc-token-amount', poolAddress] })
            queryClient.invalidateQueries({ queryKey: ['infinity-stable-calc-withdraw-one-coin', poolAddress] })
          })
          .catch(() => {})
      }
    } catch (error) {
      if (error && !isUserRejected(error)) {
        logError(error)
        console.error('Remove liquidity failed:', error)
      }
      setLiquidityState({
        attemptingTxn: false,
        liquidityErrorMessage:
          error && !isUserRejected(error)
            ? t('Remove liquidity failed: %message%', { message: transactionErrorToUserReadableMessage(error, t) })
            : undefined,
        txHash: undefined,
      })
    }
  }, [
    currency0,
    currency1,
    removeMode,
    lpAmountToBurn,
    parsedAmountA,
    parsedAmountB,
    oneCoinAmount,
    selectedCoinIndex,
    customCurrencyAmount0,
    customCurrencyAmount1,
    customAmount0Parsed,
    customAmount1Parsed,
    customMaxBurnAmount,
    lpToken,
    removeLiquidityInfinityStablePool,
    removeLiquidityOneCoin,
    removeLiquidityImbalance,
    userSlippageTolerance,
    addTransaction,
    t,
    publicClient,
    queryClient,
    poolAddress,
    account,
  ])

  const handleDismissConfirmation = useCallback(() => {
    if (txHash) setPercentToRemove(0)
    setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: undefined })
  }, [txHash])

  const liquidityPercentChangeCallback = useCallback((value: number) => setPercentToRemove(value), [])

  const [innerLiquidityPercentage, setInnerLiquidityPercentage] = useDebouncedChangeHandler(
    percentToRemove,
    liquidityPercentChangeCallback,
  )

  const onLiquidityPercentInput = useCallback(
    (value: string) => setInnerLiquidityPercentage(Math.ceil(Number(value))),
    [setInnerLiquidityPercentage],
  )

  const modalParsedAmounts = useMemo(() => {
    let amountA: CurrencyAmount<Currency> | undefined
    let amountB: CurrencyAmount<Currency> | undefined

    if (removeMode === RemoveMode.BALANCE) {
      amountA = parsedAmountA
      amountB = parsedAmountB
    } else if (removeMode === RemoveMode.ONE_COIN) {
      if (selectedCoinIndex === 0 && currency0 && oneCoinAmount > 0n) {
        amountA = CurrencyAmount.fromRawAmount(currency0, oneCoinAmount)
      } else if (selectedCoinIndex === 1 && currency1 && oneCoinAmount > 0n) {
        amountB = CurrencyAmount.fromRawAmount(currency1, oneCoinAmount)
      }
    } else if (removeMode === RemoveMode.CUSTOM) {
      amountA =
        currency0 && customAmount0Parsed > 0n ? CurrencyAmount.fromRawAmount(currency0, customAmount0Parsed) : undefined
      amountB =
        currency1 && customAmount1Parsed > 0n ? CurrencyAmount.fromRawAmount(currency1, customAmount1Parsed) : undefined
    }

    return {
      [Field.LIQUIDITY_PERCENT]: new Percent(percentToRemove, 100),
      CURRENCY_A: amountA,
      CURRENCY_B: amountB,
    }
  }, [
    removeMode,
    parsedAmountA,
    parsedAmountB,
    selectedCoinIndex,
    currency0,
    currency1,
    oneCoinAmount,
    customAmount0Parsed,
    customAmount1Parsed,
    percentToRemove,
  ])

  const pendingText = useMemo(() => {
    return t('Removing %amountA% %symbolA% and %amountB% %symbolB%', {
      amountA: modalParsedAmounts.CURRENCY_A?.toSignificant(6) ?? '',
      symbolA: currency0?.symbol ?? '',
      amountB: modalParsedAmounts.CURRENCY_B?.toSignificant(6) ?? '',
      symbolB: currency1?.symbol ?? '',
    })
  }, [modalParsedAmounts, currency0, currency1, t])

  const [onPresentRemoveLiquidity] = useModal(
    currency0?.wrapped && currency1?.wrapped ? (
      <ConfirmLiquidityModal
        approval={ApprovalState.APPROVED}
        title={t('You will receive')}
        customOnDismiss={handleDismissConfirmation}
        attemptingTxn={attemptingTxn}
        hash={txHash || ''}
        allowedSlippage={userSlippageTolerance}
        onRemove={onRemove}
        pendingText={pendingText}
        tokenA={currency0.wrapped}
        tokenB={currency1.wrapped}
        liquidityErrorMessage={liquidityErrorMessage}
        parsedAmounts={modalParsedAmounts}
        currencyA={currency0}
        currencyB={currency1}
      />
    ) : (
      <></>
    ),
    true,
    true,
    'infinitySSRemoveLiquidityModal',
  )

  const handleOpenRemoveLiquidityModal = useCallback(() => {
    if (preflightError) return
    setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: undefined })
    onPresentRemoveLiquidity()
  }, [onPresentRemoveLiquidity, preflightError])

  // Preflight gas estimation
  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(async () => {
      if (!isReady || !account) {
        setPreflightError(undefined)
        setIsPreflightChecking(false)
        return
      }

      try {
        let shouldEstimate = false
        let estimatePromise: Promise<bigint> | null = null

        if (removeMode === RemoveMode.BALANCE) {
          shouldEstimate = lpAmountToBurn > 0n
          if (shouldEstimate && parsedAmountA && parsedAmountB) {
            const minAmount0 = calculateSlippageAmount(parsedAmountA, userSlippageTolerance)[0]
            const minAmount1 = calculateSlippageAmount(parsedAmountB, userSlippageTolerance)[0]
            estimatePromise = estimateRemoveLiquidityInfinityStablePool(lpAmountToBurn, minAmount0, minAmount1)
          }
        } else if (removeMode === RemoveMode.ONE_COIN) {
          shouldEstimate = lpAmountToBurn > 0n && oneCoinAmount > 0n
          if (shouldEstimate) {
            const selectedCurrency = selectedCoinIndex === 0 ? currency0 : currency1
            if (selectedCurrency) {
              const parsedOneCoinAmount = CurrencyAmount.fromRawAmount(selectedCurrency, oneCoinAmount)
              const minReceived = calculateSlippageAmount(parsedOneCoinAmount, userSlippageTolerance)[0]
              estimatePromise = estimateRemoveLiquidityOneCoin(lpAmountToBurn, selectedCoinIndex === 0, minReceived)
            }
          }
        } else if (removeMode === RemoveMode.CUSTOM) {
          const hasAmount = customAmount0Parsed > 0n || customAmount1Parsed > 0n
          const amount0Valid = customAmount0Parsed === 0n || customAmount0Parsed <= currentAmount0
          const amount1Valid = customAmount1Parsed === 0n || customAmount1Parsed <= currentAmount1
          const hasValidBurnAmount =
            customMaxBurnAmount !== undefined && customMaxBurnAmount !== null && customMaxBurnAmount > 0n
          shouldEstimate = hasAmount && amount0Valid && amount1Valid && hasValidBurnAmount
          if (shouldEstimate && customMaxBurnAmount && lpToken) {
            const slippedMaxBurnAmount = calculateSlippageAmount(
              CurrencyAmount.fromRawAmount(lpToken, customMaxBurnAmount),
              userSlippageTolerance,
            )[1]
            estimatePromise = estimateRemoveLiquidityImbalance(
              customAmount0Parsed,
              customAmount1Parsed,
              slippedMaxBurnAmount,
            )
          }
        }

        if (!shouldEstimate || !estimatePromise) {
          setPreflightError(undefined)
          setIsPreflightChecking(false)
          return
        }

        setIsPreflightChecking(true)
        setPreflightError(undefined)
        await estimatePromise

        if (!cancelled) {
          setPreflightError(undefined)
          setIsPreflightChecking(false)
        }
      } catch (error) {
        if (!cancelled) {
          if (error && !isUserRejected(error)) {
            const errorMessage = transactionErrorToUserReadableMessage(
              error,
              t,
              [RemoveMode.ONE_COIN, RemoveMode.CUSTOM].includes(removeMode)
                ? t('Unknown error: might be due to low liquidity. Try to remove with Balance mode.')
                : undefined,
            )
            setPreflightError(errorMessage)
          } else {
            setPreflightError(undefined)
          }
          setIsPreflightChecking(false)
        }
      }
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [
    removeMode,
    lpAmountToBurn,
    parsedAmountA,
    parsedAmountB,
    oneCoinAmount,
    selectedCoinIndex,
    customAmount0Parsed,
    customAmount1Parsed,
    customMaxBurnAmount,
    lpToken,
    currentAmount0,
    currentAmount1,
    userSlippageTolerance,
    estimateRemoveLiquidityInfinityStablePool,
    estimateRemoveLiquidityOneCoin,
    estimateRemoveLiquidityImbalance,
    isReady,
    account,
    currency0,
    currency1,
    t,
  ])

  const isValid = useMemo(() => {
    if (!isReady || preflightError) return false
    if (removeMode === RemoveMode.BALANCE) return lpAmountToBurn > 0n
    if (removeMode === RemoveMode.ONE_COIN) return lpAmountToBurn > 0n && oneCoinAmount > 0n
    if (removeMode === RemoveMode.CUSTOM) {
      const hasAmount = customAmount0Parsed > 0n || customAmount1Parsed > 0n
      const amount0Valid = customAmount0Parsed === 0n || customAmount0Parsed <= currentAmount0
      const amount1Valid = customAmount1Parsed === 0n || customAmount1Parsed <= currentAmount1
      const hasValidBurnAmount =
        customMaxBurnAmount !== undefined && customMaxBurnAmount !== null && customMaxBurnAmount > 0n
      return hasAmount && amount0Valid && amount1Valid && hasValidBurnAmount
    }
    return false
  }, [
    removeMode,
    lpAmountToBurn,
    oneCoinAmount,
    customAmount0Parsed,
    customAmount1Parsed,
    customMaxBurnAmount,
    isReady,
    currentAmount0,
    currentAmount1,
    preflightError,
  ])

  const insufficientBalanceError = useMemo(() => {
    if (removeMode !== RemoveMode.CUSTOM) return null
    const tokens: string[] = []
    if (customAmount0Parsed > 0n && customAmount0Parsed > currentAmount0 && currency0)
      tokens.push(currency0.symbol || 'Token')
    if (customAmount1Parsed > 0n && customAmount1Parsed > currentAmount1 && currency1)
      tokens.push(currency1.symbol || 'Token')
    return tokens.length > 0 ? tokens.join(' and ') : null
  }, [removeMode, customAmount0Parsed, customAmount1Parsed, currentAmount0, currentAmount1, currency0, currency1])

  const cleanupSmallValue = (value: bigint): bigint => (value < 0n || value < 100n ? 0n : value)

  const [newAmount0, newAmount1] = useMemo<[bigint, bigint]>(() => {
    const computeFromRemainingLP = (lpBurn: bigint): [bigint, bigint] => {
      if (!totalSupply || totalSupply === 0n || !balance0 || !balance1 || !userLPBalance)
        return [currentAmount0, currentAmount1]
      const remaining = userLPBalance > lpBurn ? userLPBalance - lpBurn : 0n
      return [
        cleanupSmallValue((remaining * balance0) / totalSupply),
        cleanupSmallValue((remaining * balance1) / totalSupply),
      ]
    }

    if (removeMode === RemoveMode.BALANCE && expectedTokensOut) return computeFromRemainingLP(expectedTokensOut)
    if (removeMode === RemoveMode.ONE_COIN) return computeFromRemainingLP(lpAmountToBurn)
    if (removeMode === RemoveMode.CUSTOM) {
      return [
        cleanupSmallValue(currentAmount0 > customAmount0Parsed ? currentAmount0 - customAmount0Parsed : 0n),
        cleanupSmallValue(currentAmount1 > customAmount1Parsed ? currentAmount1 - customAmount1Parsed : 0n),
      ]
    }
    return [currentAmount0, currentAmount1]
  }, [
    removeMode,
    currentAmount0,
    currentAmount1,
    expectedTokensOut,
    lpAmountToBurn,
    customAmount0Parsed,
    customAmount1Parsed,
    userLPBalance,
    totalSupply,
    balance0,
    balance1,
  ])

  const currentParsedAmountA = useMemo(
    () => (currency0 && currentAmount0 > 0n ? CurrencyAmount.fromRawAmount(currency0, currentAmount0) : undefined),
    [currency0, currentAmount0],
  )
  const currentParsedAmountB = useMemo(
    () => (currency1 && currentAmount1 > 0n ? CurrencyAmount.fromRawAmount(currency1, currentAmount1) : undefined),
    [currency1, currentAmount1],
  )
  const newParsedAmountA = useMemo(
    () => (currency0 ? CurrencyAmount.fromRawAmount(currency0, newAmount0) : undefined),
    [currency0, newAmount0],
  )
  const newParsedAmountB = useMemo(
    () => (currency1 ? CurrencyAmount.fromRawAmount(currency1, newAmount1) : undefined),
    [currency1, newAmount1],
  )

  const currentTotalUSD = useTotalPriceUSD({
    currency0,
    currency1,
    amount0: currentParsedAmountA,
    amount1: currentParsedAmountB,
  })
  const newTotalUSD = useTotalPriceUSD({ currency0, currency1, amount0: newParsedAmountA, amount1: newParsedAmountB })

  const [removedAmount0, removedAmount1] = useMemo(() => {
    if (removeMode === RemoveMode.BALANCE) return [parsedAmountA, parsedAmountB]
    if (removeMode === RemoveMode.ONE_COIN) {
      if (selectedCoinIndex === 0 && currency0 && oneCoinAmount > 0n)
        return [CurrencyAmount.fromRawAmount(currency0, oneCoinAmount), undefined]
      if (selectedCoinIndex === 1 && currency1 && oneCoinAmount > 0n)
        return [undefined, CurrencyAmount.fromRawAmount(currency1, oneCoinAmount)]
    }
    if (removeMode === RemoveMode.CUSTOM) {
      return [
        currency0 && customAmount0Parsed > 0n
          ? CurrencyAmount.fromRawAmount(currency0, customAmount0Parsed)
          : undefined,
        currency1 && customAmount1Parsed > 0n
          ? CurrencyAmount.fromRawAmount(currency1, customAmount1Parsed)
          : undefined,
      ]
    }
    return [undefined, undefined]
  }, [
    removeMode,
    parsedAmountA,
    parsedAmountB,
    selectedCoinIndex,
    currency0,
    currency1,
    oneCoinAmount,
    customAmount0Parsed,
    customAmount1Parsed,
  ])

  const removedTotalUSD = useTotalPriceUSD({ currency0, currency1, amount0: removedAmount0, amount1: removedAmount1 })

  const expectedRemainingUSDIfNoSlippage = currentTotalUSD - removedTotalUSD
  const slippageLossUSD = Math.max(expectedRemainingUSDIfNoSlippage - newTotalUSD, 0)
  const slippageLossPct = newTotalUSD > 0 ? (slippageLossUSD / newTotalUSD) * 100 : 0

  const { data: currencyAUsdPrice } = useCurrencyUsdPrice(currency0, { enabled: !!currency0 })
  const { data: currencyBUsdPrice } = useCurrencyUsdPrice(currency1, { enabled: !!currency1 })

  const parsedAmountAUSD = useMemo(() => {
    if (!parsedAmountA || !currencyAUsdPrice) return 0
    return parseFloat(parsedAmountA.toExact()) * currencyAUsdPrice
  }, [parsedAmountA, currencyAUsdPrice])

  const parsedAmountBUSD = useMemo(() => {
    if (!parsedAmountB || !currencyBUsdPrice) return 0
    return parseFloat(parsedAmountB.toExact()) * currencyBUsdPrice
  }, [parsedAmountB, currencyBUsdPrice])

  const oneCoinAmountAUSD = useMemo(() => {
    if (selectedCoinIndex !== 0 || !currency0 || oneCoinAmount === 0n || !currencyAUsdPrice) return 0
    return parseFloat(CurrencyAmount.fromRawAmount(currency0, oneCoinAmount).toExact()) * currencyAUsdPrice
  }, [selectedCoinIndex, currency0, oneCoinAmount, currencyAUsdPrice])

  const oneCoinAmountBUSD = useMemo(() => {
    if (selectedCoinIndex !== 1 || !currency1 || oneCoinAmount === 0n || !currencyBUsdPrice) return 0
    return parseFloat(CurrencyAmount.fromRawAmount(currency1, oneCoinAmount).toExact()) * currencyBUsdPrice
  }, [selectedCoinIndex, currency1, oneCoinAmount, currencyBUsdPrice])

  const buttonText = !isReady
    ? t('Pool not ready')
    : isPreflightChecking
    ? t('Checking...')
    : preflightError ||
      (lpAmountToBurn === 0n && removeMode !== RemoveMode.CUSTOM
        ? t('Enter an amount')
        : removeMode === RemoveMode.CUSTOM && customAmount0Parsed === 0n && customAmount1Parsed === 0n
        ? t('Enter an amount')
        : insufficientBalanceError
        ? t('Insufficient %symbol% balance', { symbol: insufficientBalanceError })
        : t('Remove'))

  return (
    <Box>
      <RowBetween mb="4px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      <PreTitle mt="16px">{t('Amount of liquidity to remove')}</PreTitle>

      <LightGreyCard mt="8px" padding="16px" borderRadius="24px">
        <Text fontSize="40px" bold mb="16px" style={{ lineHeight: 1 }}>
          {innerLiquidityPercentage}%
        </Text>
        <Slider
          name="lp-amount"
          min={0}
          max={100}
          value={innerLiquidityPercentage}
          onValueChanged={(value) => setInnerLiquidityPercentage(Math.ceil(value))}
          mb="16px"
        />
        <FlexGap gap="8px" justifyContent="space-between">
          <Button
            variant="primary60Outline"
            scale="sm"
            onClick={() => onLiquidityPercentInput('10')}
            width="100%"
            borderRadius="12px"
          >
            10%
          </Button>
          <Button
            variant="primary60Outline"
            scale="sm"
            onClick={() => onLiquidityPercentInput('20')}
            width="100%"
            borderRadius="12px"
          >
            20%
          </Button>
          <Button
            variant="primary60Outline"
            scale="sm"
            onClick={() => onLiquidityPercentInput('75')}
            width="100%"
            borderRadius="12px"
          >
            75%
          </Button>
          <Button
            variant="primary60Outline"
            scale="sm"
            onClick={() => onLiquidityPercentInput('100')}
            width="100%"
            borderRadius="12px"
          >
            {t('Max.fill-max')}
          </Button>
        </FlexGap>
      </LightGreyCard>

      <PreTitle mt="16px" mb="8px">
        {t('Collect as')}
      </PreTitle>
      <LightGreyCard padding="16px" borderRadius="24px">
        <AutoRow gap="16px" mb="16px">
          <CardCheckBox
            label={t('One coin')}
            checked={removeMode === RemoveMode.ONE_COIN}
            onChange={() => setRemoveMode(RemoveMode.ONE_COIN)}
          />
          <CardCheckBox
            label={t('Balance')}
            checked={removeMode === RemoveMode.BALANCE}
            onChange={() => setRemoveMode(RemoveMode.BALANCE)}
          />
          <CardCheckBox
            label={t('Custom')}
            checked={removeMode === RemoveMode.CUSTOM}
            onChange={() => setRemoveMode(RemoveMode.CUSTOM)}
          />
        </AutoRow>

        {removeMode === RemoveMode.BALANCE && (
          <FlexGap flexDirection="column" gap="8px">
            <LightGreyCard padding="8px 16px">
              <Flex justifyContent="space-between" alignItems="center">
                <FlexGap gap="8px" alignItems="center">
                  <CurrencyLogo showChainLogo currency={currency0} size="32px" />
                  <Text bold>{currency0?.symbol}</Text>
                </FlexGap>
                <Flex flexDirection="column" alignItems="flex-end" style={{ gap: '4px' }}>
                  <Text bold>{parsedAmountA?.toSignificant(6) || '0'}</Text>
                  <Text fontSize="12px" color="textSubtle">
                    ~{formatDollarAmount(parsedAmountAUSD, 2, true)}
                  </Text>
                </Flex>
              </Flex>
            </LightGreyCard>
            <LightGreyCard padding="8px 16px">
              <Flex justifyContent="space-between" alignItems="center">
                <FlexGap gap="8px" alignItems="center">
                  <CurrencyLogo showChainLogo currency={currency1} size="32px" />
                  <Text bold>{currency1?.symbol}</Text>
                </FlexGap>
                <Flex flexDirection="column" alignItems="flex-end" style={{ gap: '4px' }}>
                  <Text bold>{parsedAmountB?.toSignificant(6) || '0'}</Text>
                  <Text fontSize="12px" color="textSubtle">
                    ~{formatDollarAmount(parsedAmountBUSD, 2, true)}
                  </Text>
                </Flex>
              </Flex>
            </LightGreyCard>
          </FlexGap>
        )}

        {removeMode === RemoveMode.ONE_COIN && (
          <FlexGap flexDirection="column" gap="8px">
            <LightGreyCard
              padding="8px 16px"
              style={{ cursor: 'pointer', border: selectedCoinIndex === 0 ? '1px solid #31D0AA' : undefined }}
              onClick={() => setSelectedCoinIndex(0)}
            >
              <Flex justifyContent="space-between" alignItems="center">
                <FlexGap gap="8px" alignItems="center" ml="-8px">
                  <CardCheckBox label="" checked={selectedCoinIndex === 0} onChange={() => setSelectedCoinIndex(0)} />
                  <CurrencyLogo showChainLogo currency={currency0} size="32px" />
                  <Text bold>{currency0?.symbol}</Text>
                </FlexGap>
                <Flex flexDirection="column" alignItems="flex-end" style={{ gap: '4px' }}>
                  <Text bold>
                    {selectedCoinIndex === 0 && oneCoinAmount > 0n
                      ? CurrencyAmount.fromRawAmount(currency0, oneCoinAmount).toSignificant(6)
                      : '0'}
                  </Text>
                  <Text fontSize="12px" color="textSubtle">
                    ~{formatDollarAmount(oneCoinAmountAUSD, 2, true)}
                  </Text>
                </Flex>
              </Flex>
            </LightGreyCard>
            <LightGreyCard
              padding="8px 16px"
              style={{ cursor: 'pointer', border: selectedCoinIndex === 1 ? '1px solid #31D0AA' : undefined }}
              onClick={() => setSelectedCoinIndex(1)}
            >
              <Flex justifyContent="space-between" alignItems="center">
                <FlexGap gap="8px" alignItems="center" ml="-8px">
                  <CardCheckBox label="" checked={selectedCoinIndex === 1} onChange={() => setSelectedCoinIndex(1)} />
                  <CurrencyLogo showChainLogo currency={currency1} size="32px" />
                  <Text bold>{currency1?.symbol}</Text>
                </FlexGap>
                <Flex flexDirection="column" alignItems="flex-end" style={{ gap: '4px' }}>
                  <Text bold>
                    {selectedCoinIndex === 1 && oneCoinAmount > 0n
                      ? CurrencyAmount.fromRawAmount(currency1, oneCoinAmount).toSignificant(6)
                      : '0'}
                  </Text>
                  <Text fontSize="12px" color="textSubtle">
                    ~{formatDollarAmount(oneCoinAmountBUSD, 2, true)}
                  </Text>
                </Flex>
              </Flex>
            </LightGreyCard>
          </FlexGap>
        )}

        {removeMode === RemoveMode.CUSTOM && (
          <FlexGap flexDirection="column" gap="8px">
            <CurrencyInputPanelSimplify
              title={<>&nbsp;</>}
              id="remove-liquidity-infinity-ss-custom-0"
              defaultValue={customAmount0}
              onUserInput={setCustomAmount0}
              currency={currency0}
              overrideBalance={currentParsedAmountA}
              maxAmount={currentParsedAmountA}
              showMaxButton
              onMax={() => setCustomAmount0(currentParsedAmountA?.toExact() ?? '')}
              onPercentInput={(percent) => {
                if (currentParsedAmountA) {
                  setCustomAmount0(currentParsedAmountA.multiply(new Percent(percent, 100)).toExact())
                }
              }}
              showUSDPrice
              disableCurrencySelect
            />
            <CurrencyInputPanelSimplify
              title={<>&nbsp;</>}
              id="remove-liquidity-infinity-ss-custom-1"
              defaultValue={customAmount1}
              onUserInput={setCustomAmount1}
              currency={currency1}
              overrideBalance={currentParsedAmountB}
              maxAmount={currentParsedAmountB}
              showMaxButton
              onMax={() => setCustomAmount1(currentParsedAmountB?.toExact() ?? '')}
              onPercentInput={(percent) => {
                if (currentParsedAmountB) {
                  setCustomAmount1(currentParsedAmountB.multiply(new Percent(percent, 100)).toExact())
                }
              }}
              showUSDPrice
              disableCurrencySelect
            />
          </FlexGap>
        )}
      </LightGreyCard>

      {((removeMode !== RemoveMode.CUSTOM && percentToRemove > 0) ||
        (removeMode === RemoveMode.CUSTOM && (customAmount0Parsed > 0n || customAmount1Parsed > 0n))) && (
        <>
          <BalanceDifferenceDisplay
            currency0={currency0}
            currency1={currency1}
            currency0Amount={currentParsedAmountA?.toSignificant(6) || '0'}
            currency0NewAmount={newParsedAmountA?.toSignificant(6) || '0'}
            currency1Amount={currentParsedAmountB?.toSignificant(6) || '0'}
            currency1NewAmount={newParsedAmountB?.toSignificant(6) || '0'}
            totalPositionUsd={formatDollarAmount(currentTotalUSD, 2, false)}
            totalPositionNewUsd={formatDollarAmount(newTotalUSD, 2, false)}
            removedAmountUsd={formatDollarAmount(removedTotalUSD, 2, false)}
          />
          {slippageLossUSD > 0 && (
            <RowBetween mt="8px">
              <Text color="textSubtle" small>
                {t('Slippage loss')}
              </Text>
              <Text color="failure" small>
                {formatDollarAmount(slippageLossUSD, 2, false)}
                {slippageLossPct >= 0.001 ? ` (${slippageLossPct.toFixed(2)}%)` : ''}
              </Text>
            </RowBetween>
          )}
        </>
      )}

      {activeChainId !== positionChainId ? (
        <Button
          mt="16px"
          width="100%"
          onClick={() => (positionChainId ? switchNetworkIfNecessary(positionChainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      ) : (
        <Button
          mt="16px"
          width="100%"
          variant={!isValid && lpAmountToBurn > 0n ? 'danger' : 'primary'}
          onClick={() => {
            handleOpenRemoveLiquidityModal()
            logGTMClickRemoveLiquidityEvent()
          }}
          disabled={!isValid || isPreflightChecking}
        >
          {buttonText}
        </Button>
      )}
    </Box>
  )
}
