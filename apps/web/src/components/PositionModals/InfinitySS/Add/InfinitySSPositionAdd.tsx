import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Percent, Token } from '@pancakeswap/swap-sdk-core'
import { Box, Button, Dots, FlexGap, PreTitle, QuestionHelper, RowBetween, Text, useModal } from '@pancakeswap/uikit'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { CommitButton } from 'components/CommitButton'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { ApprovalState, useApproveCallbackFromAmount } from 'hooks/useApproveCallback'
import { useIsTransactionUnsupported, useIsTransactionWarning } from 'hooks/Trades'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useTotalPriceUSD } from 'hooks/useTotalPriceUSD'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useTransactionAdder } from 'state/transactions/hooks'
import { useCurrencyBalancesWithChain } from 'state/wallet/hooks'
import { logGTMClickAddLiquidityEvent } from 'utils/customGTMEventTracking'
import { calculateSlippageAmount } from 'utils/exchange'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { isUserRejected, logError } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { CurrencyField as Field } from 'utils/types'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { useExpertMode, useUserSlippage } from '@pancakeswap/utils/user'
import { FormattedSlippage } from 'views/AddLiquidity/AddStableLiquidity/components'
import { useAccount } from 'wagmi'
import { parseUnits } from 'viem'
import ConfirmAddLiquidityModal from 'views/AddLiquidity/components/ConfirmAddLiquidityModal'
import { useAddLiquidityInfinityStablePool } from 'views/StableInfinity/hooks/useAddLiquidityStableInfinityPool'
import { useCalcTokenAmount, useTotalSupply } from 'views/StableInfinity/hooks/useCalcTokenAmount'

interface InfinitySSPositionAddProps {
  poolInfo: PoolInfo
}

export const InfinitySSPositionAdd = ({ poolInfo }: InfinitySSPositionAddProps) => {
  const { t } = useTranslation()
  const {
    currentLanguage: { locale },
  } = useTranslation()
  const { address: account } = useAccount()
  const { chainId: activeChainId } = useAccountActiveChain()

  const currency0 = poolInfo.token0 as Currency
  const currency1 = poolInfo.token1 as Currency
  const chainId = currency0?.chainId
  const poolAddress = poolInfo.lpAddress as string

  const isWrongNetwork = activeChainId !== chainId
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const [expertMode] = useExpertMode()
  const [userSlippageTolerance] = useUserSlippage()
  const addIsUnsupported = useIsTransactionUnsupported(currency0, currency1)
  const addIsWarning = useIsTransactionWarning(currency0, currency1)

  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')

  const [{ attemptingTxn, liquidityErrorMessage, txHash }, setLiquidityState] = useState<{
    attemptingTxn: boolean
    liquidityErrorMessage: string | undefined
    txHash: string | undefined
  }>({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: undefined })

  const [preflightError, setPreflightError] = useState<string | undefined>(undefined)
  const [isPreflightChecking, setIsPreflightChecking] = useState(false)

  const { addLiquidityInfinityStablePool, estimateAddLiquidityInfinityStablePool, isReady } =
    useAddLiquidityInfinityStablePool({ poolAddress })

  const addTransaction = useTransactionAdder()

  const [balanceA, balanceB] = useCurrencyBalancesWithChain(account, [currency0, currency1], chainId)

  const parsedAmountA = useMemo(() => {
    if (!currency0 || !amountA) return undefined
    try {
      return CurrencyAmount.fromRawAmount(currency0, parseUnits(amountA, currency0.decimals))
    } catch {
      return undefined
    }
  }, [currency0, amountA])

  const parsedAmountB = useMemo(() => {
    if (!currency1 || !amountB) return undefined
    try {
      return CurrencyAmount.fromRawAmount(currency1, parseUnits(amountB, currency1.decimals))
    } catch {
      return undefined
    }
  }, [currency1, amountB])

  const amounts = useMemo<[bigint, bigint]>(
    () => [parsedAmountA?.quotient ?? 0n, parsedAmountB?.quotient ?? 0n],
    [parsedAmountA, parsedAmountB],
  )

  const { tokenAmount: expectedLP, error: calcError } = useCalcTokenAmount({
    poolAddress,
    amounts,
    deposit: true,
    enabled: isReady && (amounts[0] > 0n || amounts[1] > 0n),
  })

  const totalSupply = useTotalSupply({ poolAddress })

  const inputAmountsTotalUsdValue = useTotalPriceUSD({
    currency0,
    currency1,
    amount0: parsedAmountA,
    amount1: parsedAmountB,
  })

  const maxAmounts = useMemo(
    () => ({
      [Field.CURRENCY_A]: maxAmountSpend(balanceA),
      [Field.CURRENCY_B]: maxAmountSpend(balanceB),
    }),
    [balanceA, balanceB],
  )

  const isUserInsufficientBalanceA = useMemo(() => {
    const max = maxAmounts[Field.CURRENCY_A]
    if (!account || !parsedAmountA || !max) return false
    return max.lessThan(parsedAmountA)
  }, [account, parsedAmountA, maxAmounts])

  const isUserInsufficientBalanceB = useMemo(() => {
    const max = maxAmounts[Field.CURRENCY_B]
    if (!account || !parsedAmountB || !max) return false
    return max.lessThan(parsedAmountB)
  }, [account, parsedAmountB, maxAmounts])

  const insufficientBalanceError = useMemo(() => {
    if (parsedAmountA && balanceA && parsedAmountA.greaterThan(balanceA)) {
      return t('Insufficient %symbol% balance', { symbol: currency0?.symbol ?? '' })
    }
    if (parsedAmountB && balanceB && parsedAmountB.greaterThan(balanceB)) {
      return t('Insufficient %symbol% balance', { symbol: currency1?.symbol ?? '' })
    }
    return undefined
  }, [parsedAmountA, parsedAmountB, balanceA, balanceB, currency0, currency1, t])

  const poolTokenPercentage = useMemo(() => {
    if (expectedLP && totalSupply && totalSupply > 0n) {
      return new Percent(expectedLP, totalSupply + expectedLP)
    }
    return new Percent(0n, 1n)
  }, [expectedLP, totalSupply])

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
        CurrencyAmount.fromRawAmount(currency0, expectedLP),
        userSlippageTolerance,
      )[0]

      setIsPreflightChecking(true)
      setPreflightError(undefined)

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
    currency0,
    userSlippageTolerance,
    insufficientBalanceError,
    calcError,
    estimateAddLiquidityInfinityStablePool,
    t,
  ])

  const { approvalState: approvalA, approveCallback: approveACallback } = useApproveCallbackFromAmount({
    token: currency0?.isToken ? currency0 : undefined,
    minAmount: parsedAmountA?.quotient,
    spender: poolAddress as `0x${string}`,
  })

  const { approvalState: approvalB, approveCallback: approveBCallback } = useApproveCallbackFromAmount({
    token: currency1?.isToken ? currency1 : undefined,
    minAmount: parsedAmountB?.quotient,
    spender: poolAddress as `0x${string}`,
  })

  const showFieldAApproval = [ApprovalState.NOT_APPROVED, ApprovalState.PENDING].includes(approvalA) && !!parsedAmountA
  const showFieldBApproval = [ApprovalState.NOT_APPROVED, ApprovalState.PENDING].includes(approvalB) && !!parsedAmountB
  const shouldShowApprovalGroup = showFieldAApproval || showFieldBApproval

  const onAdd = useCallback(async () => {
    if (!currency0 || !currency1 || (!parsedAmountA && !parsedAmountB) || !expectedLP) return

    const minMintAmount = calculateSlippageAmount(
      CurrencyAmount.fromRawAmount(currency0, expectedLP),
      userSlippageTolerance,
    )[0]

    const amountAToAdd = parsedAmountA?.quotient ?? 0n
    const amountBToAdd = parsedAmountB?.quotient ?? 0n

    setLiquidityState({ attemptingTxn: true, liquidityErrorMessage: undefined, txHash: undefined })

    try {
      const response = await addLiquidityInfinityStablePool(amountAToAdd, amountBToAdd, minMintAmount)
      setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: response })

      const symbolA = currency0?.symbol
      const amtA = parsedAmountA?.toSignificant(3) || '0'
      const symbolB = currency1?.symbol
      const amtB = parsedAmountB?.toSignificant(3) || '0'

      addTransaction(
        { hash: response },
        {
          summary: `Add ${amtA} ${symbolA} and ${amtB} ${symbolB}`,
          translatableSummary: {
            text: 'Add %amountA% %symbolA% and %amountB% %symbolB%',
            data: { amountA: amtA, symbolA, amountB: amtB, symbolB },
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
    currency0,
    currency1,
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
    symbolA: currency0?.symbol ?? '',
    amountB: formatCurrencyAmount(parsedAmountB, 4, locale),
    symbolB: currency1?.symbol ?? '',
  })

  const handleDismissConfirmation = useCallback(() => {
    if (txHash) {
      setAmountA('')
      setAmountB('')
    }
    setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: undefined })
  }, [txHash])

  const currencies = useMemo(
    () => ({ [Field.CURRENCY_A]: currency0, [Field.CURRENCY_B]: currency1 }),
    [currency0, currency1],
  )

  const parsedAmounts = useMemo(
    () => ({ [Field.CURRENCY_A]: parsedAmountA, [Field.CURRENCY_B]: parsedAmountB }),
    [parsedAmountA, parsedAmountB],
  )

  const lpToken = useMemo(() => {
    if (!expectedLP || !currency0 || !poolAddress) return undefined
    return new Token(currency0.chainId, poolAddress as `0x${string}`, 18, 'LP', 'LP Token')
  }, [currency0, poolAddress, expectedLP])

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
    'infinitySSAddLiquidityModal',
  )

  const buttonDisabled =
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

  const errorText = !isReady
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

  const renderButtons = useCallback(() => {
    if (isWrongNetwork)
      return (
        <Button
          width="100%"
          onClick={() => (chainId ? switchNetworkIfNecessary(chainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      )
    if (addIsUnsupported || addIsWarning) return <Button disabled>{t('Unsupported Asset')}</Button>
    return (
      <>
        {shouldShowApprovalGroup && (
          <RowBetween style={{ gap: '8px' }} mb="8px">
            {showFieldAApproval && (
              <Button onClick={approveACallback} disabled={approvalA === ApprovalState.PENDING} width="100%">
                {approvalA === ApprovalState.PENDING ? (
                  <Dots>{t('Enabling %asset%', { asset: currency0?.symbol })}</Dots>
                ) : (
                  t('Enable %asset%', { asset: currency0?.symbol })
                )}
              </Button>
            )}
            {showFieldBApproval && (
              <Button onClick={approveBCallback} disabled={approvalB === ApprovalState.PENDING} width="100%">
                {approvalB === ApprovalState.PENDING ? (
                  <Dots>{t('Enabling %asset%', { asset: currency1?.symbol })}</Dots>
                ) : (
                  t('Enable %asset%', { asset: currency1?.symbol })
                )}
              </Button>
            )}
          </RowBetween>
        )}

        <CommitButton
          variant={buttonDisabled ? 'danger' : 'primary'}
          onClick={() => {
            // eslint-disable-next-line no-unused-expressions
            expertMode ? onAdd() : onPresentAddLiquidityModal()
            logGTMClickAddLiquidityEvent()
          }}
          disabled={buttonDisabled}
          width="100%"
        >
          {errorText || t('Add')}
        </CommitButton>
      </>
    )
  }, [
    isWrongNetwork,
    buttonDisabled,
    errorText,
    chainId,
    isSwitchNetworkLoading,
    switchNetworkIfNecessary,
    addIsUnsupported,
    addIsWarning,
    shouldShowApprovalGroup,
    showFieldAApproval,
    showFieldBApproval,
    approveACallback,
    approveBCallback,
    approvalA,
    approvalB,
    currency0,
    currency1,
    expertMode,
    onAdd,
    onPresentAddLiquidityModal,
    t,
  ])

  return (
    <Box>
      <PreTitle>{t('Amount of Liquidity to Add')}</PreTitle>

      <RowBetween mt="8px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      <RowBetween mt="8px">
        <FlexGap gap="4px" alignItems="center">
          <Text color="textSubtle" small>
            {t('Slippage Bonus')}
          </Text>
          <QuestionHelper
            text={t(
              'Extra LP tokens earned when depositing the low-balance coin in the pool, appearing as a bonus for helping rebalance.',
            )}
            placement="top-start"
            mt="1px"
          />
        </FlexGap>
        <FormattedSlippage slippage={new Percent(userSlippageTolerance, 10000)} loading={isPreflightChecking} small />
      </RowBetween>

      <LightGreyCard mt="16px" borderRadius="24px" padding="16px">
        <CurrencyInputPanelSimplify
          id="position-modal-increase-infinity-ss-A"
          defaultValue={amountA}
          currency={currency0}
          onUserInput={setAmountA}
          title={<>&nbsp;</>}
          wrapperProps={{ style: { backgroundColor: 'transparent' } }}
          onPercentInput={(percent) => {
            if (maxAmounts[Field.CURRENCY_A]) {
              setAmountA(maxAmounts[Field.CURRENCY_A]?.multiply(new Percent(percent, 100)).toExact() ?? '')
            }
          }}
          onMax={() => setAmountA(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')}
          maxAmount={maxAmounts[Field.CURRENCY_A]}
          showMaxButton
          disableCurrencySelect
          showUSDPrice
          isUserInsufficientBalance={isUserInsufficientBalanceA}
        />
        <br />
        <CurrencyInputPanelSimplify
          id="position-modal-increase-infinity-ss-B"
          defaultValue={amountB}
          currency={currency1}
          onUserInput={setAmountB}
          title={<>&nbsp;</>}
          wrapperProps={{ style: { backgroundColor: 'transparent' } }}
          onPercentInput={(percent) => {
            if (maxAmounts[Field.CURRENCY_B]) {
              setAmountB(maxAmounts[Field.CURRENCY_B]?.multiply(new Percent(percent, 100)).toExact() ?? '')
            }
          }}
          onMax={() => setAmountB(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')}
          maxAmount={maxAmounts[Field.CURRENCY_B]}
          showMaxButton
          disableCurrencySelect
          showUSDPrice
          isUserInsufficientBalance={isUserInsufficientBalanceB}
        />
      </LightGreyCard>

      <RowBetween mt="16px">
        <Text color="textSubtle" small>
          {t('Total Deposit Value')}
        </Text>
        <Text small>~{formatDollarAmount(inputAmountsTotalUsdValue, 2, false)}</Text>
      </RowBetween>

      <Box mt="16px">
        <MevProtectToggle size="sm" />
      </Box>

      <Box mt="16px">{renderButtons()}</Box>
    </Box>
  )
}
