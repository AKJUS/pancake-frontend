import { useDebouncedChangeHandler } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Percent, Token, WNATIVE } from '@pancakeswap/sdk'
import { Box, Button, Flex, FlexGap, PreTitle, RowBetween, Slider, Text, Toggle } from '@pancakeswap/uikit'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { formattedCurrencyAmount } from 'components/FormattedCurrencyAmount/FormattedCurrencyAmount'
import Dots from 'components/Loader/Dots'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import { getV2StablePositionCurrencyOverrides } from 'components/PositionModals/shared/v2StablePositionCurrencyOverrides'
import { V2_ROUTER_ADDRESS } from 'config/constants/exchange'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { useV2Pair } from 'hooks/usePairs'
import useTotalSupply from 'hooks/useTotalSupply'
import { useCallback, useMemo, useState } from 'react'
import { useTokenBalancesWithLoadingIndicator } from 'state/wallet/hooks'
import { Field } from 'state/burn/actions'
import { useBurnActionHandlers } from 'state/burn/hooks'
import { useDerivedBurnInfoByChain } from 'state/burn/useDerivedBurnInfoByChain'
import { createFormAtom, RemoveLiquidityV2AtomProvider, useRemoveLiquidityV2FormState } from 'state/burn/reducer'
import { V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useTransactionAdder } from 'state/transactions/hooks'
import { useGasPrice } from 'state/user/hooks'
import { calculateGasMargin } from 'utils'
import { safeGetTokenPairPrice } from 'utils/safeGetTokenPairPrice'
import { wrappedCurrency } from 'utils/wrappedCurrency'
import { parseLiquidityPercentForSlider } from 'components/PositionModals/utils/parseLiquidityPercentForSlider'
import { logGTMClickRemoveLiquidityEvent } from 'utils/customGTMEventTracking'
import { calculateSlippageAmount, useRouterContract } from 'utils/exchange'
import { isUserRejected, logError } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { Hash } from 'viem'

interface V2PositionRemoveProps {
  position: V2LPDetail
  poolInfo: PoolInfo
}

const formAtom = createFormAtom()

export const V2PositionRemove = ({ position, poolInfo }: V2PositionRemoveProps) => {
  return (
    <RemoveLiquidityV2AtomProvider value={{ formAtom }}>
      <V2PositionRemoveInner position={position} poolInfo={poolInfo} />
    </RemoveLiquidityV2AtomProvider>
  )
}

const V2PositionRemoveInner = ({ position, poolInfo }: V2PositionRemoveProps) => {
  const { t } = useTranslation()
  const { account, chainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const positionChainId = poolInfo.chainId
  const gasPrice = useGasPrice()

  const useSnapshotForBurn = Boolean(positionChainId) && chainId !== positionChainId
  const effectiveChainId = useSnapshotForBurn ? positionChainId! : chainId

  const poolToken0 = poolInfo.token0 as Currency
  const poolToken1 = poolInfo.token1 as Currency

  const native = useNativeCurrency(effectiveChainId ?? undefined)
  const [receiveWNATIVE, setReceiveWNATIVE] = useState(false)

  const currency0 = useMemo((): Currency => {
    if (!effectiveChainId) return poolToken0
    const wn = WNATIVE[effectiveChainId]
    if (!wn) return poolToken0
    if (wn.equals(poolToken0.wrapped)) return receiveWNATIVE ? wn : native
    return poolToken0
  }, [poolToken0, effectiveChainId, receiveWNATIVE, native])

  const currency1 = useMemo((): Currency => {
    if (!effectiveChainId) return poolToken1
    const wn = WNATIVE[effectiveChainId]
    if (!wn) return poolToken1
    if (wn.equals(poolToken1.wrapped)) return receiveWNATIVE ? wn : native
    return poolToken1
  }, [poolToken1, effectiveChainId, receiveWNATIVE, native])

  const showCollectAsWNative = Boolean(
    chainId &&
      effectiveChainId &&
      ((poolToken0 && WNATIVE[effectiveChainId]?.equals(poolToken0.wrapped)) ||
        (poolToken1 && WNATIVE[effectiveChainId]?.equals(poolToken1.wrapped)) ||
        poolToken0?.isNative ||
        poolToken1?.isNative),
  )

  const [tokenA, tokenB] = useMemo(() => [currency0?.wrapped, currency1?.wrapped], [currency0, currency1])

  const { independentField, typedValue } = useRemoveLiquidityV2FormState()
  const derivedBurnOptions = useMemo(() => {
    if (!positionChainId || chainId === positionChainId) return undefined
    return {
      targetChainId: positionChainId,
      chainSnapshot: {
        pair: position.pair,
        totalSupply: position.totalSupply,
        userLiquidity: position.nativeBalance,
      },
    }
  }, [positionChainId, chainId, position.pair, position.totalSupply, position.nativeBalance])

  const { pair, parsedAmounts, error } = useDerivedBurnInfoByChain(currency0, currency1, derivedBurnOptions)
  const { onUserInput: _onUserInput } = useBurnActionHandlers()

  const [, pairFromHook] = useV2Pair(currency0, currency1)

  const [relevantTokenBalances] = useTokenBalancesWithLoadingIndicator(
    account ?? undefined,
    useMemo(() => [pairFromHook?.liquidityToken], [pairFromHook?.liquidityToken]),
  )
  const userLiquidityFromBalance: CurrencyAmount<Token> | undefined = pairFromHook?.liquidityToken
    ? relevantTokenBalances?.[`${pairFromHook.liquidityToken.chainId}-${pairFromHook.liquidityToken.address}`]
    : undefined

  const userLiquidityForExceedCheck = useMemo(
    () => (useSnapshotForBurn ? position.nativeBalance : userLiquidityFromBalance),
    [useSnapshotForBurn, position.nativeBalance, userLiquidityFromBalance],
  )

  const totalSupplyFromHook = useTotalSupply(pairFromHook?.liquidityToken)
  const totalSupplyForExceedCheck = useMemo(
    () => (useSnapshotForBurn ? position.totalSupply : totalSupplyFromHook),
    [useSnapshotForBurn, position.totalSupply, totalSupplyFromHook],
  )

  const wrappedBurnTokenA = useMemo(() => wrappedCurrency(currency0, effectiveChainId), [currency0, effectiveChainId])
  const wrappedBurnTokenB = useMemo(() => wrappedCurrency(currency1, effectiveChainId), [currency1, effectiveChainId])

  const liquidityValueAForExceed = useMemo(() => {
    if (
      !pair ||
      !totalSupplyForExceedCheck ||
      !userLiquidityForExceedCheck ||
      !wrappedBurnTokenA ||
      totalSupplyForExceedCheck.quotient < userLiquidityForExceedCheck.quotient
    )
      return undefined
    return CurrencyAmount.fromRawAmount(
      wrappedBurnTokenA,
      pair.getLiquidityValue(wrappedBurnTokenA, totalSupplyForExceedCheck, userLiquidityForExceedCheck, false).quotient,
    )
  }, [pair, totalSupplyForExceedCheck, userLiquidityForExceedCheck, wrappedBurnTokenA])

  const liquidityValueBForExceed = useMemo(() => {
    if (
      !pair ||
      !totalSupplyForExceedCheck ||
      !userLiquidityForExceedCheck ||
      !wrappedBurnTokenB ||
      totalSupplyForExceedCheck.quotient < userLiquidityForExceedCheck.quotient
    )
      return undefined
    return CurrencyAmount.fromRawAmount(
      wrappedBurnTokenB,
      pair.getLiquidityValue(wrappedBurnTokenB, totalSupplyForExceedCheck, userLiquidityForExceedCheck, false).quotient,
    )
  }, [pair, totalSupplyForExceedCheck, userLiquidityForExceedCheck, wrappedBurnTokenB])

  const removeAmountExceedsLpBalance = useMemo(() => {
    if (independentField === Field.LIQUIDITY_PERCENT) return false
    if (independentField === Field.LIQUIDITY) {
      if (!pair?.liquidityToken || !userLiquidityForExceedCheck) return false
      const independentAmount = tryParseAmount(typedValue, pair.liquidityToken)
      return Boolean(independentAmount?.greaterThan(userLiquidityForExceedCheck))
    }
    if (independentField === Field.CURRENCY_A || independentField === Field.CURRENCY_B) {
      const token = independentField === Field.CURRENCY_A ? wrappedBurnTokenA : wrappedBurnTokenB
      const liquidityValue = independentField === Field.CURRENCY_A ? liquidityValueAForExceed : liquidityValueBForExceed
      if (!token || !liquidityValue) return false
      const independentAmount = tryParseAmount(typedValue, token)
      return Boolean(independentAmount?.greaterThan(liquidityValue))
    }
    return false
  }, [
    independentField,
    typedValue,
    pair,
    userLiquidityForExceedCheck,
    wrappedBurnTokenA,
    wrappedBurnTokenB,
    liquidityValueAForExceed,
    liquidityValueBForExceed,
  ])

  const removeButtonError = removeAmountExceedsLpBalance ? t('Remove amount exceeds your LP balance') : error

  const [showDetailed, setShowDetailed] = useState(false)
  const [{ attemptingTxn, liquidityErrorMessage }, setLiquidityState] = useState<{
    attemptingTxn: boolean
    liquidityErrorMessage: string | undefined
    txHash: string | undefined
  }>({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: undefined })

  const [deadline] = useTransactionDeadline()
  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]

  const formattedAmounts = {
    [Field.LIQUIDITY_PERCENT]: parsedAmounts[Field.LIQUIDITY_PERCENT].equalTo('0')
      ? '0'
      : parsedAmounts[Field.LIQUIDITY_PERCENT].lessThan(new Percent('1', '100'))
      ? '<1'
      : parsedAmounts[Field.LIQUIDITY_PERCENT].toFixed(0),
    [Field.LIQUIDITY]:
      independentField === Field.LIQUIDITY
        ? typedValue
        : formattedCurrencyAmount({ currencyAmount: parsedAmounts[Field.LIQUIDITY] }),
    [Field.CURRENCY_A]:
      independentField === Field.CURRENCY_A
        ? typedValue
        : formattedCurrencyAmount({ currencyAmount: parsedAmounts[Field.CURRENCY_A] }),
    [Field.CURRENCY_B]:
      independentField === Field.CURRENCY_B
        ? typedValue
        : formattedCurrencyAmount({ currencyAmount: parsedAmounts[Field.CURRENCY_B] }),
  }

  const { approvalState, approveCallback } = useApproveCallback(
    parsedAmounts[Field.LIQUIDITY],
    chainId ? V2_ROUTER_ADDRESS[chainId] : undefined,
  )

  const onUserInput = useCallback((field: Field, value: string) => _onUserInput(field, value), [_onUserInput])

  const onLiquidityPercentInput = useCallback(
    (value: string) => onUserInput(Field.LIQUIDITY_PERCENT, value),
    [onUserInput],
  )
  const onCurrencyAInput = useCallback((value: string) => onUserInput(Field.CURRENCY_A, value), [onUserInput])
  const onCurrencyBInput = useCallback((value: string) => onUserInput(Field.CURRENCY_B, value), [onUserInput])

  const liquidityPercentChangeCallback = useCallback(
    (value: number) => onLiquidityPercentInput(Math.ceil(value).toString()),
    [onLiquidityPercentInput],
  )

  const [innerLiquidityPercentage, setInnerLiquidityPercentage] = useDebouncedChangeHandler(
    parseLiquidityPercentForSlider(formattedAmounts[Field.LIQUIDITY_PERCENT]),
    liquidityPercentChangeCallback,
  )

  const routerContract = useRouterContract()
  const addTransaction = useTransactionAdder()

  const onRemove = useCallback(async () => {
    if (!chainId || !account || !deadline || !routerContract) return

    const { [Field.CURRENCY_A]: currencyAmountA, [Field.CURRENCY_B]: currencyAmountB } = parsedAmounts
    if (!currencyAmountA || !currencyAmountB || !currency0 || !currency1 || !tokenA || !tokenB) return

    const amountsMin = {
      [Field.CURRENCY_A]: calculateSlippageAmount(currencyAmountA, allowedSlippage)[0],
      [Field.CURRENCY_B]: calculateSlippageAmount(currencyAmountB, allowedSlippage)[0],
    }

    const liquidityAmount = parsedAmounts[Field.LIQUIDITY]
    if (!liquidityAmount) return

    const currencyBIsNative = currency1?.isNative
    const oneCurrencyIsNative = currency0?.isNative || currencyBIsNative

    let methodNames: string[]
    let args: any

    if (approvalState === ApprovalState.APPROVED) {
      if (oneCurrencyIsNative) {
        methodNames = ['removeLiquidityETH', 'removeLiquidityETHSupportingFeeOnTransferTokens']
        args = [
          currencyBIsNative ? tokenA.address : tokenB.address,
          liquidityAmount.quotient.toString(),
          amountsMin[currencyBIsNative ? Field.CURRENCY_A : Field.CURRENCY_B].toString(),
          amountsMin[currencyBIsNative ? Field.CURRENCY_B : Field.CURRENCY_A].toString(),
          account,
          deadline,
        ]
      } else {
        methodNames = ['removeLiquidity']
        args = [
          tokenA.address,
          tokenB.address,
          liquidityAmount.quotient.toString(),
          amountsMin[Field.CURRENCY_A].toString(),
          amountsMin[Field.CURRENCY_B].toString(),
          account,
          deadline,
        ]
      }
    } else {
      return
    }

    let methodSafeGasEstimate: { methodName: string; safeGasEstimate: bigint } | undefined
    for (let i = 0; i < methodNames.length; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const est = await routerContract.estimateGas[methodNames[i]](args, { account })
        methodSafeGasEstimate = { methodName: methodNames[i], safeGasEstimate: calculateGasMargin(est) }
        break
      } catch (e) {
        console.error(`estimateGas failed`, methodNames[i], args, e)
      }
    }

    if (!methodSafeGasEstimate) return

    const { methodName, safeGasEstimate } = methodSafeGasEstimate
    setLiquidityState({ attemptingTxn: true, liquidityErrorMessage: undefined, txHash: undefined })

    await routerContract.write[methodName](args, { gas: safeGasEstimate, gasPrice })
      .then((response: Hash) => {
        setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: response })
        const amountA = parsedAmounts[Field.CURRENCY_A]?.toSignificant(3)
        const amountB = parsedAmounts[Field.CURRENCY_B]?.toSignificant(3)
        addTransaction(
          { hash: response },
          {
            summary: `Remove ${amountA} ${currency0?.symbol} and ${amountB} ${currency1?.symbol}`,
            translatableSummary: {
              text: 'Remove %amountA% %symbolA% and %amountB% %symbolB%',
              data: { amountA, symbolA: currency0?.symbol, amountB, symbolB: currency1?.symbol },
            },
            type: 'remove-liquidity',
          },
        )
      })
      .catch((err: any) => {
        if (err && !isUserRejected(err)) {
          logError(err)
          console.error(`Remove Liquidity failed`, err, args)
        }
        setLiquidityState({
          attemptingTxn: false,
          liquidityErrorMessage:
            err && !isUserRejected(err)
              ? t('Remove liquidity failed: %message%', { message: transactionErrorToUserReadableMessage(err, t) })
              : undefined,
          txHash: undefined,
        })
      })
  }, [
    chainId,
    account,
    deadline,
    routerContract,
    parsedAmounts,
    currency0,
    currency1,
    tokenA,
    tokenB,
    allowedSlippage,
    approvalState,
    gasPrice,
    addTransaction,
    t,
  ])

  const { data: currency0Usd } = useCurrencyUsdPrice(currency0)
  const { data: currency1Usd } = useCurrencyUsdPrice(currency1)

  const { override0: positionBalance0, override1: positionBalance1 } = useMemo(
    () => getV2StablePositionCurrencyOverrides(position, currency0, currency1),
    [position, currency0, currency1],
  )

  /** Burn-derived caps (same as exceed check); min with deposit totals so Max / balance match validation. */
  const panelMaxAmount0 = useMemo(() => {
    const pos = positionBalance0
    const liq = liquidityValueAForExceed
    if (!liq) return pos
    if (!pos) return CurrencyAmount.fromRawAmount(currency0, liq.quotient)
    return pos.wrapped.greaterThan(liq) ? CurrencyAmount.fromRawAmount(currency0, liq.quotient) : pos
  }, [positionBalance0, liquidityValueAForExceed, currency0])

  const panelMaxAmount1 = useMemo(() => {
    const pos = positionBalance1
    const liq = liquidityValueBForExceed
    if (!liq) return pos
    if (!pos) return CurrencyAmount.fromRawAmount(currency1, liq.quotient)
    return pos.wrapped.greaterThan(liq) ? CurrencyAmount.fromRawAmount(currency1, liq.quotient) : pos
  }, [positionBalance1, liquidityValueBForExceed, currency1])

  /** When burn math yields 0% (invalid / incomplete input), panel rows must still show position totals from account state. */
  const canDerivePanelFromParsedRemoval = useMemo(() => {
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (pct.equalTo('0')) return false
    // Token amounts + non-zero % are enough; liquidity amount is derived with them from the same burn pass.
    return Boolean(parsedAmounts[Field.CURRENCY_A] && parsedAmounts[Field.CURRENCY_B])
  }, [parsedAmounts])

  // Full position amounts (at 100%) — for USD; fallback to position snapshot when removal is not derivable
  const fullAmountA = useMemo(() => {
    if (canDerivePanelFromParsedRemoval) {
      const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
      const amt = parsedAmounts[Field.CURRENCY_A]
      if (!amt || pct.equalTo('0')) return undefined
      return BN(amt.toExact()).dividedBy(BN(pct.numerator.toString()).dividedBy(pct.denominator.toString()))
    }
    if (positionBalance0) return BN(positionBalance0.toExact())
    return undefined
  }, [canDerivePanelFromParsedRemoval, parsedAmounts, positionBalance0])

  const fullAmountB = useMemo(() => {
    if (canDerivePanelFromParsedRemoval) {
      const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
      const amt = parsedAmounts[Field.CURRENCY_B]
      if (!amt || pct.equalTo('0')) return undefined
      return BN(amt.toExact()).dividedBy(BN(pct.numerator.toString()).dividedBy(pct.denominator.toString()))
    }
    if (positionBalance1) return BN(positionBalance1.toExact())
    return undefined
  }, [canDerivePanelFromParsedRemoval, parsedAmounts, positionBalance1])

  const currency0Amount = useMemo(() => {
    if (canDerivePanelFromParsedRemoval) {
      const amt = parsedAmounts[Field.CURRENCY_A]
      const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
      if (!amt || pct.equalTo('0')) return '0'
      return amt.multiply(new Percent(pct.denominator.toString(), pct.numerator.toString())).toSignificant(6)
    }
    return positionBalance0?.toSignificant(6) ?? '0'
  }, [canDerivePanelFromParsedRemoval, parsedAmounts, positionBalance0])

  const currency1Amount = useMemo(() => {
    if (canDerivePanelFromParsedRemoval) {
      const amt = parsedAmounts[Field.CURRENCY_B]
      const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
      if (!amt || pct.equalTo('0')) return '0'
      return amt.multiply(new Percent(pct.denominator.toString(), pct.numerator.toString())).toSignificant(6)
    }
    return positionBalance1?.toSignificant(6) ?? '0'
  }, [canDerivePanelFromParsedRemoval, parsedAmounts, positionBalance1])

  const currency0NewAmount = useMemo(() => {
    if (canDerivePanelFromParsedRemoval) {
      const amt = parsedAmounts[Field.CURRENCY_A]
      const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
      if (!amt || pct.equalTo('0')) return currency0Amount
      const fullAmt = amt.multiply(new Percent(pct.denominator.toString(), pct.numerator.toString()))
      const newQuotient = fullAmt.quotient - amt.quotient
      if (newQuotient < 0n) return '0'
      return CurrencyAmount.fromRawAmount(amt.currency, newQuotient).toSignificant(6)
    }
    return positionBalance0?.toSignificant(6) ?? '0'
  }, [canDerivePanelFromParsedRemoval, parsedAmounts, positionBalance0, currency0Amount])

  const currency1NewAmount = useMemo(() => {
    if (canDerivePanelFromParsedRemoval) {
      const amt = parsedAmounts[Field.CURRENCY_B]
      const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
      if (!amt || pct.equalTo('0')) return currency1Amount
      const fullAmt = amt.multiply(new Percent(pct.denominator.toString(), pct.numerator.toString()))
      const newQuotient = fullAmt.quotient - amt.quotient
      if (newQuotient < 0n) return '0'
      return CurrencyAmount.fromRawAmount(amt.currency, newQuotient).toSignificant(6)
    }
    return positionBalance1?.toSignificant(6) ?? '0'
  }, [canDerivePanelFromParsedRemoval, parsedAmounts, positionBalance1, currency1Amount])

  const totalPositionUsd = useMemo(() => {
    if (!fullAmountA || !fullAmountB || !currency0Usd || !currency1Usd) return '$0'
    const usd0 = fullAmountA.multipliedBy(currency0Usd)
    const usd1 = fullAmountB.multipliedBy(currency1Usd)
    return `$${usd0.plus(usd1).toFormat(2)}`
  }, [fullAmountA, fullAmountB, currency0Usd, currency1Usd])

  const removedTokensUsd = useMemo(() => {
    if (!currency0Usd || !currency1Usd) return '0'
    const amt0 = parsedAmounts[Field.CURRENCY_A]
    const amt1 = parsedAmounts[Field.CURRENCY_B]
    const usd0 = amt0 ? BN(amt0.toExact()).multipliedBy(currency0Usd) : BN(0)
    const usd1 = amt1 ? BN(amt1.toExact()).multipliedBy(currency1Usd) : BN(0)
    return usd0.plus(usd1).toFormat(2)
  }, [parsedAmounts, currency0Usd, currency1Usd])

  const totalPositionNewUsd = useMemo(() => {
    if (totalPositionUsd === '$0' || removedTokensUsd === '0' || removedTokensUsd === '0.00') return totalPositionUsd
    const total = BN(totalPositionUsd.replace(/[$,]/g, ''))
    const removed_ = BN(removedTokensUsd.replace(/,/g, ''))
    const result = total.minus(removed_)
    return `$${result.isNegative() ? '0' : result.toFormat(2)}`
  }, [totalPositionUsd, removedTokensUsd])

  // RATES — same as views/RemoveLiquidity: pair.priceOf(token) per displayed currency
  const rateCurrency0PerCurrency1 = useMemo(() => safeGetTokenPairPrice(pair, tokenA), [pair, tokenA])
  const rateCurrency1PerCurrency0 = useMemo(() => safeGetTokenPairPrice(pair, tokenB), [pair, tokenB])

  const isValid = !removeButtonError
  const needsApproval = approvalState !== ApprovalState.APPROVED

  return (
    <Box>
      <RowBetween mb="4px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      {showCollectAsWNative && (
        <Flex justifyContent="space-between" alignItems="center" mt="16px">
          <Text color="textSubtle" small>
            {t('Collect as %symbol%', { symbol: native.wrapped.symbol })}
          </Text>
          <Toggle
            id="receive-as-wnative-v2"
            scale="sm"
            checked={receiveWNATIVE}
            onChange={() => setReceiveWNATIVE((prev) => !prev)}
          />
        </Flex>
      )}

      <Flex justifyContent="space-between" alignItems="center" mt="16px">
        <PreTitle>{t('Amount of liquidity to remove')}</PreTitle>
        <Flex alignItems="center" style={{ gap: '8px' }}>
          <Text color="textSubtle" small>
            {t('Detailed')}
          </Text>
          <Toggle
            scale="sm"
            checked={showDetailed}
            onChange={() => {
              setShowDetailed((prev) => {
                if (prev) {
                  // Leaving detailed mode: burn form may still be on token fields with invalid typed values.
                  // Switch to % mode so slider / quick % buttons match useDerivedBurnInfo.
                  const nextPct = innerLiquidityPercentage > 0 ? innerLiquidityPercentage : 50
                  onLiquidityPercentInput(String(nextPct))
                }
                return !prev
              })
            }}
          />
        </Flex>
      </Flex>

      {showDetailed ? (
        <Box mt="8px">
          <CurrencyInputPanelSimplify
            defaultValue={formattedAmounts[Field.CURRENCY_A]}
            onUserInput={onCurrencyAInput}
            currency={currency0}
            overrideBalance={panelMaxAmount0}
            onMax={() => onCurrencyAInput(panelMaxAmount0?.toExact() ?? '')}
            onPercentInput={(percent) => {
              if (panelMaxAmount0) {
                onCurrencyAInput(panelMaxAmount0.multiply(new Percent(percent, 100)).toExact())
              }
            }}
            maxAmount={panelMaxAmount0}
            id="remove-liquidity-tokena"
            title={<>&nbsp;</>}
            disableCurrencySelect
            showMaxButton
            showUSDPrice
            isUserInsufficientBalance={independentField === Field.CURRENCY_A && removeAmountExceedsLpBalance}
          />
          <Box mt="8px">
            <CurrencyInputPanelSimplify
              defaultValue={formattedAmounts[Field.CURRENCY_B]}
              onUserInput={onCurrencyBInput}
              currency={currency1}
              overrideBalance={panelMaxAmount1}
              onMax={() => onCurrencyBInput(panelMaxAmount1?.toExact() ?? '')}
              onPercentInput={(percent) => {
                if (panelMaxAmount1) {
                  onCurrencyBInput(panelMaxAmount1.multiply(new Percent(percent, 100)).toExact())
                }
              }}
              maxAmount={panelMaxAmount1}
              id="remove-liquidity-tokenb"
              title={<>&nbsp;</>}
              disableCurrencySelect
              showMaxButton
              showUSDPrice
              isUserInsufficientBalance={independentField === Field.CURRENCY_B && removeAmountExceedsLpBalance}
            />
          </Box>
        </Box>
      ) : (
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
      )}

      {/* RATES */}
      {pair && (
        <LightGreyCard mt="16px" padding="12px 16px" borderRadius="24px">
          <PreTitle mb="8px">{t('Rates')}</PreTitle>
          <Flex justifyContent="space-between">
            <Text small color="textSubtle">
              1 {currency0?.symbol}
            </Text>
            <Text small>
              {rateCurrency0PerCurrency1} {currency1?.symbol}
            </Text>
          </Flex>
          <Flex justifyContent="space-between" mt="4px">
            <Text small color="textSubtle">
              1 {currency1?.symbol}
            </Text>
            <Text small>
              {rateCurrency1PerCurrency0} {currency0?.symbol}
            </Text>
          </Flex>
        </LightGreyCard>
      )}

      <BalanceDifferenceDisplay
        currency0={currency0}
        currency1={currency1}
        currency0Amount={currency0Amount}
        currency0NewAmount={currency0NewAmount}
        currency1Amount={currency1Amount}
        currency1NewAmount={currency1NewAmount}
        totalPositionUsd={totalPositionUsd}
        totalPositionNewUsd={totalPositionNewUsd}
        removedAmountUsd={`$${removedTokensUsd}`}
      />

      {chainId !== positionChainId ? (
        <Button
          mt="16px"
          width="100%"
          onClick={() => (positionChainId ? switchNetworkIfNecessary(positionChainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      ) : needsApproval && isValid ? (
        <Button
          mt="16px"
          width="100%"
          // Same as views/RemoveLiquidity: only clickable when NOT_APPROVED (avoids approve while UNKNOWN).
          disabled={approvalState !== ApprovalState.NOT_APPROVED}
          onClick={approveCallback}
        >
          {approvalState === ApprovalState.PENDING ? <Dots>{t('Enabling')}</Dots> : t('Enable.Approval')}
        </Button>
      ) : (
        <Button
          mt="16px"
          width="100%"
          disabled={attemptingTxn || !isValid}
          onClick={() => {
            onRemove()
            logGTMClickRemoveLiquidityEvent()
          }}
        >
          {removeButtonError ?? t('Remove')}
        </Button>
      )}
    </Box>
  )
}
