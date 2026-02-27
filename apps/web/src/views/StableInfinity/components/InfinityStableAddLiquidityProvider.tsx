import { useState, useCallback, useMemo, useEffect } from 'react'
import { parseUnits } from 'viem'
import { useCurrency } from 'hooks/Tokens'
import { ApprovalState, useApproveCallbackFromAmount } from 'hooks/useApproveCallback'
import { Currency, CurrencyAmount, Percent, Token } from '@pancakeswap/swap-sdk-core'
import { useUserSlippage } from '@pancakeswap/utils/user'
import { useCurrencyBalancesWithChain } from 'state/wallet/hooks'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { CurrencyField as Field } from 'utils/types'
import { useAccount } from 'wagmi'
import StableFormView from 'views/AddLiquidityV3/formViews/StableFormView'
import { useTotalPriceUSD } from 'hooks/useTotalPriceUSD'
import { useTranslation } from '@pancakeswap/localization'
import { useModal } from '@pancakeswap/uikit'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import { calculateSlippageAmount } from 'utils/exchange'
import { useTransactionAdder } from 'state/transactions/hooks'
import { isUserRejected, logError } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import ConfirmAddLiquidityModal from 'views/AddLiquidity/components/ConfirmAddLiquidityModal'
import { useAddLiquidityInfinityStablePool } from '../hooks/useAddLiquidityStableInfinityPool'
import { useCalcTokenAmount, useTotalSupply } from '../hooks/useCalcTokenAmount'

export default function InfinityStableAddLiquidityProvider({
  hookAddress,
  currency0,
  currency1,
}: {
  hookAddress: `0x${string}`
  currency0: `0x${string}`
  currency1: `0x${string}`
}) {
  const { address: account } = useAccount()
  const {
    t,
    currentLanguage: { locale },
  } = useTranslation()

  const currencyA = useCurrency(currency0)
  const currencyB = useCurrency(currency1)

  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')

  // modal and loading state
  const [{ attemptingTxn, liquidityErrorMessage, txHash }, setLiquidityState] = useState<{
    attemptingTxn: boolean
    liquidityErrorMessage: string | undefined
    txHash: string | undefined
  }>({
    attemptingTxn: false,
    liquidityErrorMessage: undefined,
    txHash: undefined,
  })

  // Preflight gas estimation state (separate from transaction state)
  const [preflightError, setPreflightError] = useState<string | undefined>(undefined)
  const [isPreflightChecking, setIsPreflightChecking] = useState(false)

  // Use the hook address as the pool address
  const poolAddress = hookAddress
  const { addLiquidityInfinityStablePool, estimateAddLiquidityInfinityStablePool, isReady } =
    useAddLiquidityInfinityStablePool({ poolAddress })

  // Transaction adder
  const addTransaction = useTransactionAdder()

  // Get user's currency balances
  const [balanceA, balanceB] = useCurrencyBalancesWithChain(account, [currencyA, currencyB], currencyA?.chainId)

  const formattedAmounts = useMemo(
    () => ({
      CURRENCY_A: amountA,
      CURRENCY_B: amountB,
    }),
    [amountA, amountB],
  )

  // Parse currency amounts for approvals
  const parsedAmountA = useMemo(() => {
    if (!currencyA || !amountA) return undefined
    try {
      return CurrencyAmount.fromRawAmount(currencyA, parseUnits(amountA, currencyA.decimals))
    } catch {
      return undefined
    }
  }, [currencyA, amountA])

  const parsedAmountB = useMemo(() => {
    if (!currencyB || !amountB) return undefined
    try {
      return CurrencyAmount.fromRawAmount(currencyB, parseUnits(amountB, currencyB.decimals))
    } catch {
      return undefined
    }
  }, [currencyB, amountB])

  // Calculate amounts in bigint for the calc token amount hook
  const amounts = useMemo<[bigint, bigint]>(() => {
    const amountABigint = parsedAmountA?.quotient ?? 0n
    const amountBBigint = parsedAmountB?.quotient ?? 0n
    return [amountABigint, amountBBigint]
  }, [parsedAmountA, parsedAmountB])

  // Use the calc token amount hook for real-time LP token calculation
  const { tokenAmount: expectedLP, error: calcError } = useCalcTokenAmount({
    poolAddress,
    amounts,
    deposit: true,
    enabled: isReady && (amounts[0] > 0n || amounts[1] > 0n),
  })

  // Get total supply using the dedicated hook
  const totalSupply = useTotalSupply({ poolAddress })

  // Get user's slippage tolerance setting
  const [userSlippageTolerance] = useUserSlippage()

  // Calculate total USD value of input amounts
  const inputAmountsTotalUsdValue = useTotalPriceUSD({
    currency0: currencyA,
    currency1: currencyB,
    amount0: parsedAmountA,
    amount1: parsedAmountB,
  })

  // Calculate max amounts that can be spent (accounting for gas reserves for native tokens)
  const maxAmounts = useMemo(() => {
    return [Field.CURRENCY_A, Field.CURRENCY_B].reduce((accumulator, field) => {
      const balance = field === Field.CURRENCY_A ? balanceA : balanceB
      return {
        ...accumulator,
        [field]: maxAmountSpend(balance),
      }
    }, {} as { [field in Field]?: CurrencyAmount<any> })
  }, [balanceA, balanceB])

  // Check if entered amounts exceed wallet balances
  const insufficientBalanceError = useMemo(() => {
    if (parsedAmountA && balanceA && parsedAmountA.greaterThan(balanceA)) {
      return t('Insufficient %symbol% balance', { symbol: currencyA?.symbol ?? '' })
    }
    if (parsedAmountB && balanceB && parsedAmountB.greaterThan(balanceB)) {
      return t('Insufficient %symbol% balance', { symbol: currencyB?.symbol ?? '' })
    }
    return undefined
  }, [parsedAmountA, parsedAmountB, balanceA, balanceB, currencyA, currencyB, t])

  // Calculate pool token percentage
  const poolTokenPercentage = useMemo(() => {
    if (expectedLP && totalSupply && totalSupply > 0n) {
      return new Percent(expectedLP, totalSupply + expectedLP)
    }
    return new Percent(0n, 1n) // Default to 0%
  }, [expectedLP, totalSupply])

  // Debounced preflight gas estimation effect
  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(async () => {
      const hasAmount = amounts[0] > 0n || amounts[1] > 0n
      if (!isReady || !account || !hasAmount || !expectedLP || insufficientBalanceError || calcError) {
        setPreflightError(undefined)
        setIsPreflightChecking(false)
        return
      }

      const minMintAmount = calculateSlippageAmount(
        CurrencyAmount.fromRawAmount(currencyA!, expectedLP),
        userSlippageTolerance,
      )[0]

      setIsPreflightChecking(true)
      setPreflightError(undefined)

      console.log('[AddLiquidity preflight] amounts:', amounts, 'minMintAmount:', minMintAmount)

      try {
        await estimateAddLiquidityInfinityStablePool(amounts[0], amounts[1], minMintAmount)
        if (!cancelled) {
          setPreflightError(undefined)
          setIsPreflightChecking(false)
        }
      } catch (error) {
        if (!cancelled) {
          if (error && !isUserRejected(error)) {
            setPreflightError(transactionErrorToUserReadableMessage(error, t))
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
    isReady,
    account,
    amounts,
    expectedLP,
    currencyA,
    userSlippageTolerance,
    insufficientBalanceError,
    calcError,
    estimateAddLiquidityInfinityStablePool,
    t,
  ])

  // Approval hooks for both tokens using useApproveCallbackFromAmount
  const { approvalState: approvalA, approveCallback: approveACallback } = useApproveCallbackFromAmount({
    token: currencyA?.isToken ? currencyA : undefined,
    minAmount: parsedAmountA?.quotient,
    spender: poolAddress,
  })

  const { approvalState: approvalB, approveCallback: approveBCallback } = useApproveCallbackFromAmount({
    token: currencyB?.isToken ? currencyB : undefined,
    minAmount: parsedAmountB?.quotient,
    spender: poolAddress,
  })

  // Determine if approvals are needed
  const showFieldAApproval = [ApprovalState.NOT_APPROVED, ApprovalState.PENDING].includes(approvalA) && !!parsedAmountA
  const showFieldBApproval = [ApprovalState.NOT_APPROVED, ApprovalState.PENDING].includes(approvalB) && !!parsedAmountB
  const shouldShowApprovalGroup = showFieldAApproval || showFieldBApproval

  const onAdd = useCallback(async () => {
    if (!currencyA || !currencyB || (!parsedAmountA && !parsedAmountB) || !expectedLP) return

    // Calculate minimum mint amount using user's slippage tolerance
    const minMintAmount = calculateSlippageAmount(
      CurrencyAmount.fromRawAmount(currencyA, expectedLP),
      userSlippageTolerance,
    )[0]

    // Add liquidity - use 0 for amounts that are not provided
    const amountAToAdd = parsedAmountA?.quotient ?? 0n
    const amountBToAdd = parsedAmountB?.quotient ?? 0n

    setLiquidityState({ attemptingTxn: true, liquidityErrorMessage: undefined, txHash: undefined })

    try {
      const response = await addLiquidityInfinityStablePool(amountAToAdd, amountBToAdd, minMintAmount)

      setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: response })

      const symbolA = currencyA?.symbol
      const amountA = parsedAmountA?.toSignificant(3) || '0'
      const symbolB = currencyB?.symbol
      const amountB = parsedAmountB?.toSignificant(3) || '0'

      addTransaction(
        { hash: response },
        {
          summary: `Add ${amountA} ${symbolA} and ${amountB} ${symbolB}`,
          translatableSummary: {
            text: 'Add %amountA% %symbolA% and %amountB% %symbolB%',
            data: { amountA, symbolA, amountB, symbolB },
          },
          type: 'add-liquidity',
        },
      )
    } catch (error) {
      if (error && !isUserRejected(error)) {
        logError(error)
        console.error('Add liquidity failed:', error)
      }
      setLiquidityState({
        attemptingTxn: false,
        liquidityErrorMessage:
          error && !isUserRejected(error)
            ? t('Add liquidity failed: %message%', { message: transactionErrorToUserReadableMessage(error, t) })
            : undefined,
        txHash: undefined,
      })
    }
  }, [
    currencyA,
    currencyB,
    parsedAmountA,
    parsedAmountB,
    expectedLP,
    addLiquidityInfinityStablePool,
    userSlippageTolerance,
    addTransaction,
    t,
  ])

  const pendingText = t('Supplying %amountA% %symbolA% and %amountB% %symbolB%', {
    amountA: formatCurrencyAmount(parsedAmountA, 4, locale),
    symbolA: currencyA?.symbol ?? '',
    amountB: formatCurrencyAmount(parsedAmountB, 4, locale),
    symbolB: currencyB?.symbol ?? '',
  })

  const handleDismissConfirmation = useCallback(() => {
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      setAmountA('')
      setAmountB('')
    }

    setLiquidityState({
      attemptingTxn: false,
      liquidityErrorMessage: undefined,
      txHash: undefined,
    })
  }, [txHash])

  const currencies = useMemo(
    () => ({
      [Field.CURRENCY_A]: currencyA ?? undefined,
      [Field.CURRENCY_B]: currencyB ?? undefined,
    }),
    [currencyA, currencyB],
  )

  const parsedAmounts = useMemo(
    () => ({
      [Field.CURRENCY_A]: parsedAmountA,
      [Field.CURRENCY_B]: parsedAmountB,
    }),
    [parsedAmountA, parsedAmountB],
  )

  // Create a mock LP token for displaying in confirmation modal
  const lpToken = useMemo(() => {
    if (!expectedLP || !currencyA || !poolAddress) return undefined
    return new Token(currencyA.chainId, poolAddress, 18, 'LP', 'LP Token')
  }, [currencyA, poolAddress, expectedLP])

  const liquidityMinted = useMemo(() => {
    if (!lpToken || !expectedLP) return undefined
    return CurrencyAmount.fromRawAmount(lpToken, expectedLP)
  }, [lpToken, expectedLP])

  const [onPresentAddLiquidityModal] = useModal(
    <ConfirmAddLiquidityModal
      title={t('You will receive')}
      customOnDismiss={handleDismissConfirmation}
      attemptingTxn={attemptingTxn}
      hash={txHash}
      pendingText={pendingText}
      currencyToAdd={undefined}
      allowedSlippage={userSlippageTolerance}
      onAdd={onAdd}
      parsedAmounts={parsedAmounts}
      currencies={currencies}
      liquidityErrorMessage={liquidityErrorMessage}
      price={undefined}
      noLiquidity={false}
      poolTokenPercentage={poolTokenPercentage}
      liquidityMinted={liquidityMinted}
      isStable
    />,
    true,
    true,
    'addLiquidityModal',
  )

  return (
    <StableFormView
      formattedAmounts={formattedAmounts}
      onFieldAInput={setAmountA}
      onFieldBInput={setAmountB}
      maxAmounts={maxAmounts}
      currencies={currencies}
      buttonDisabled={
        !isReady ||
        (!amountA && !amountB) ||
        !!insufficientBalanceError ||
        !expectedLP ||
        !!calcError ||
        approvalA === ApprovalState.PENDING ||
        approvalB === ApprovalState.PENDING ||
        showFieldAApproval ||
        showFieldBApproval ||
        !!preflightError ||
        isPreflightChecking
      }
      onAdd={onAdd}
      onPresentAddLiquidityModal={onPresentAddLiquidityModal}
      errorText={
        !isReady
          ? t('Pool not ready')
          : !amountA && !amountB
          ? t('Please enter at least one amount')
          : insufficientBalanceError ||
            (calcError
              ? t('Cannot add liquidity with current amounts')
              : approvalA === ApprovalState.PENDING || approvalB === ApprovalState.PENDING
              ? t('Waiting for approval...')
              : showFieldAApproval || showFieldBApproval
              ? t('Approval required')
              : isPreflightChecking
              ? t('Checking...')
              : preflightError
              ? t('Cannot add liquidity with current amounts')
              : undefined)
      }
      inputAmountsTotalUsdValue={inputAmountsTotalUsdValue}
      shouldShowApprovalGroup={shouldShowApprovalGroup}
      showFieldAApproval={showFieldAApproval}
      approvalA={approvalA}
      showFieldBApproval={showFieldBApproval}
      approvalB={approvalB}
      approveBCallback={approveBCallback}
      approveACallback={approveACallback}
      loading={isPreflightChecking}
      poolTokenPercentage={poolTokenPercentage}
      executionSlippage={new Percent(userSlippageTolerance, 10000)}
    />
  )
}
