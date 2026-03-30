import { useDebouncedChangeHandler } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, Percent, WNATIVE } from '@pancakeswap/sdk'
import { Box, Button, Flex, FlexGap, PreTitle, RowBetween, Slider, Text, Toggle } from '@pancakeswap/uikit'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import Dots from 'components/Loader/Dots'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { useStableSwapNativeHelperContract } from 'hooks/useContract'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useCallback, useMemo, useState } from 'react'
import { Field } from 'state/burn/actions'
import { useBurnActionHandlers } from 'state/burn/hooks'
import { createFormAtom, RemoveLiquidityV2AtomProvider, useRemoveLiquidityV2FormState } from 'state/burn/reducer'
import { StableLPDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useTransactionAdder } from 'state/transactions/hooks'
import { useGasPrice } from 'state/user/hooks'
import { calculateGasMargin } from 'utils'
import { parseLiquidityPercentForSlider } from 'components/PositionModals/utils/parseLiquidityPercentForSlider'
import { logGTMClickRemoveLiquidityEvent } from 'utils/customGTMEventTracking'
import { calculateSlippageAmount } from 'utils/exchange'
import { isUserRejected, logError } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { useStableDerivedBurnInfoByChain } from 'views/RemoveLiquidity/RemoveStableLiquidity/hooks/useStableDerivedBurnInfoByChain'
import useStableConfig, { StableConfigContext, useStableConfigContext } from 'views/Swap/hooks/useStableConfig'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { Hash } from 'viem'

interface SSPositionRemoveProps {
  position: StableLPDetail
  poolInfo: PoolInfo
}

const formAtom = createFormAtom()

export const SSPositionRemove = ({ position, poolInfo }: SSPositionRemoveProps) => {
  const currency0 = poolInfo.token0 as Currency
  const currency1 = poolInfo.token1 as Currency

  const stableConfig = useStableConfig({
    tokenA: currency0,
    tokenB: currency1,
  })

  return (
    <StableConfigContext.Provider value={stableConfig}>
      <RemoveLiquidityV2AtomProvider value={{ formAtom }}>
        <SSPositionRemoveInner position={position} poolInfo={poolInfo} />
      </RemoveLiquidityV2AtomProvider>
    </StableConfigContext.Provider>
  )
}

const SSPositionRemoveInner = ({ position, poolInfo }: SSPositionRemoveProps) => {
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

  const nativeHelperContract = useStableSwapNativeHelperContract()
  const needUnwrapped = currency0?.isNative || currency1?.isNative

  const { independentField, typedValue } = useRemoveLiquidityV2FormState()
  const stableDerivedBurnOptions = useMemo(() => {
    if (!positionChainId || chainId === positionChainId) return undefined
    return {
      targetChainId: positionChainId,
      chainSnapshot: {
        pair: position.pair,
        nativeBalance: position.nativeBalance,
      },
    }
  }, [positionChainId, chainId, position.pair, position.nativeBalance])

  const { pair, parsedAmounts, error } = useStableDerivedBurnInfoByChain(currency0, currency1, stableDerivedBurnOptions)
  const { onUserInput: _onUserInput } = useBurnActionHandlers()

  const { stableSwapConfig, stableSwapContract } = useStableConfigContext()

  const [{ attemptingTxn, liquidityErrorMessage }, setLiquidityState] = useState<{
    attemptingTxn: boolean
    liquidityErrorMessage: string | undefined
    txHash: string | undefined
  }>({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: undefined })

  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]

  const formattedAmounts = {
    [Field.LIQUIDITY_PERCENT]: parsedAmounts[Field.LIQUIDITY_PERCENT].equalTo('0')
      ? '0'
      : parsedAmounts[Field.LIQUIDITY_PERCENT].lessThan(new Percent('1', '100'))
      ? '<1'
      : parsedAmounts[Field.LIQUIDITY_PERCENT].toFixed(0),
  }

  const { approvalState, approveCallback } = useApproveCallback(
    parsedAmounts[Field.LIQUIDITY],
    needUnwrapped ? nativeHelperContract?.address : stableSwapConfig?.stableSwapAddress,
  )

  const onUserInput = useCallback((field: Field, value: string) => _onUserInput(field, value), [_onUserInput])

  const onLiquidityPercentInput = useCallback(
    (value: string) => onUserInput(Field.LIQUIDITY_PERCENT, value),
    [onUserInput],
  )

  const liquidityPercentChangeCallback = useCallback(
    (value: number) => onLiquidityPercentInput(Math.ceil(value).toString()),
    [onLiquidityPercentInput],
  )

  const [innerLiquidityPercentage, setInnerLiquidityPercentage] = useDebouncedChangeHandler(
    parseLiquidityPercentForSlider(formattedAmounts[Field.LIQUIDITY_PERCENT]),
    liquidityPercentChangeCallback,
  )

  const addTransaction = useTransactionAdder()

  const onRemove = useCallback(async () => {
    const contract = needUnwrapped ? nativeHelperContract : stableSwapContract
    if (!chainId || !account || !contract) return

    const { [Field.CURRENCY_A]: currencyAmountA, [Field.CURRENCY_B]: currencyAmountB } = parsedAmounts
    if (!currencyAmountA || !currencyAmountB || !tokenA || !tokenB) return

    const amountsMin = {
      [Field.CURRENCY_A]: calculateSlippageAmount(currencyAmountA, allowedSlippage)[0],
      [Field.CURRENCY_B]: calculateSlippageAmount(currencyAmountB, allowedSlippage)[0],
    }

    const liquidityAmount = parsedAmounts[Field.LIQUIDITY]
    if (!liquidityAmount) return

    let methodNames: string[]
    let args: Array<string | string[] | number | boolean>

    if (approvalState === ApprovalState.APPROVED) {
      methodNames = ['remove_liquidity']
      if (needUnwrapped && stableSwapContract) {
        args = [
          stableSwapContract.address,
          liquidityAmount.quotient.toString(),
          [amountsMin[Field.CURRENCY_A].toString(), amountsMin[Field.CURRENCY_B].toString()],
        ]
      } else {
        args = [
          liquidityAmount.quotient.toString(),
          [amountsMin[Field.CURRENCY_A].toString(), amountsMin[Field.CURRENCY_B].toString()],
        ]
      }
    } else {
      return
    }

    let methodSafeGasEstimate: { methodName: string; safeGasEstimate: bigint } | undefined
    for (let i = 0; i < methodNames.length; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const est = await contract.estimateGas[methodNames[i]](args, { account })
        methodSafeGasEstimate = { methodName: methodNames[i], safeGasEstimate: calculateGasMargin(est) }
        break
      } catch (e) {
        console.error(`estimateGas failed`, methodNames[i], args, e)
      }
    }

    if (!methodSafeGasEstimate) return

    const { methodName, safeGasEstimate } = methodSafeGasEstimate
    setLiquidityState({ attemptingTxn: true, liquidityErrorMessage: undefined, txHash: undefined })

    await contract.write[methodName](args, { gas: safeGasEstimate, gasPrice })
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
    needUnwrapped,
    nativeHelperContract,
    stableSwapContract,
    chainId,
    account,
    parsedAmounts,
    tokenA,
    tokenB,
    allowedSlippage,
    approvalState,
    gasPrice,
    addTransaction,
    currency0,
    currency1,
    t,
  ])

  const { data: currency0Usd } = useCurrencyUsdPrice(currency0)
  const { data: currency1Usd } = useCurrencyUsdPrice(currency1)

  const fullAmountA = useMemo(() => {
    if (!parsedAmounts[Field.CURRENCY_A] || parsedAmounts[Field.LIQUIDITY_PERCENT].equalTo('0')) return undefined
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    const amt = parsedAmounts[Field.CURRENCY_A]
    return BN(amt.toExact()).dividedBy(BN(pct.numerator.toString()).dividedBy(pct.denominator.toString()))
  }, [parsedAmounts])

  const fullAmountB = useMemo(() => {
    if (!parsedAmounts[Field.CURRENCY_B] || parsedAmounts[Field.LIQUIDITY_PERCENT].equalTo('0')) return undefined
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    const amt = parsedAmounts[Field.CURRENCY_B]
    return BN(amt.toExact()).dividedBy(BN(pct.numerator.toString()).dividedBy(pct.denominator.toString()))
  }, [parsedAmounts])

  const currency0Amount = useMemo(() => {
    const amt = parsedAmounts[Field.CURRENCY_A]
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (!amt || pct.equalTo('0')) return '0'
    return amt.multiply(new Percent(pct.denominator.toString(), pct.numerator.toString())).toSignificant(6)
  }, [parsedAmounts])

  const currency1Amount = useMemo(() => {
    const amt = parsedAmounts[Field.CURRENCY_B]
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (!amt || pct.equalTo('0')) return '0'
    return amt.multiply(new Percent(pct.denominator.toString(), pct.numerator.toString())).toSignificant(6)
  }, [parsedAmounts])

  const currency0NewAmount = useMemo(() => {
    const amt = parsedAmounts[Field.CURRENCY_A]
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (!amt || pct.equalTo('0')) return currency0Amount
    if (innerLiquidityPercentage >= 100) return '0'
    // total × (100 - live%) / 100
    return amt
      .multiply(new Percent(pct.denominator.toString(), pct.numerator.toString()))
      .multiply(new Percent(100 - innerLiquidityPercentage, 100))
      .toSignificant(6)
  }, [parsedAmounts, currency0Amount, innerLiquidityPercentage])

  const currency1NewAmount = useMemo(() => {
    const amt = parsedAmounts[Field.CURRENCY_B]
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (!amt || pct.equalTo('0')) return currency1Amount
    if (innerLiquidityPercentage >= 100) return '0'
    // total × (100 - live%) / 100
    return amt
      .multiply(new Percent(pct.denominator.toString(), pct.numerator.toString()))
      .multiply(new Percent(100 - innerLiquidityPercentage, 100))
      .toSignificant(6)
  }, [parsedAmounts, currency1Amount, innerLiquidityPercentage])

  const totalPositionUsd = useMemo(() => {
    if (!fullAmountA || !fullAmountB || !currency0Usd || !currency1Usd) return '$0'
    const usd0 = fullAmountA.multipliedBy(currency0Usd)
    const usd1 = fullAmountB.multipliedBy(currency1Usd)
    return `$${usd0.plus(usd1).toFormat(2)}`
  }, [fullAmountA, fullAmountB, currency0Usd, currency1Usd])

  const removedTokensUsd = useMemo(() => {
    if (!fullAmountA || !fullAmountB || !currency0Usd || !currency1Usd) return '0'
    const usd0 = fullAmountA.multipliedBy(currency0Usd).multipliedBy(innerLiquidityPercentage / 100)
    const usd1 = fullAmountB.multipliedBy(currency1Usd).multipliedBy(innerLiquidityPercentage / 100)
    return usd0.plus(usd1).toFormat(2)
  }, [fullAmountA, fullAmountB, currency0Usd, currency1Usd, innerLiquidityPercentage])

  const totalPositionNewUsd = useMemo(() => {
    if (totalPositionUsd === '$0' || removedTokensUsd === '0') return totalPositionUsd
    const total = BN(totalPositionUsd.replace(/[$,]/g, ''))
    const removed_ = BN(removedTokensUsd.replace(/,/g, ''))
    const result = total.minus(removed_)
    return `$${result.isNegative() ? '0' : result.toFormat(2)}`
  }, [totalPositionUsd, removedTokensUsd])

  const isValid = !error
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
            id="receive-as-wnative-ss"
            scale="sm"
            checked={receiveWNATIVE}
            onChange={() => setReceiveWNATIVE((prev) => !prev)}
          />
        </Flex>
      )}

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
      ) : needsApproval ? (
        <Button
          mt="16px"
          width="100%"
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
          {error ?? t('Remove')}
        </Button>
      )}
    </Box>
  )
}
