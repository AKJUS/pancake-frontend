import { useDebouncedChangeHandler } from '@pancakeswap/hooks'
import { getPoolId, type PoolKey } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { zeroAddress } from '@pancakeswap/price-api-sdk'
import { CurrencyAmount, Percent } from '@pancakeswap/swap-sdk-core'
import { WNATIVE } from '@pancakeswap/sdk'
import { Box, Button, Flex, FlexGap, PreTitle, RowBetween, Slider, Text, Toggle } from '@pancakeswap/uikit'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import { useFeesEarned } from 'hooks/infinity/useFeesEarned'
import { usePoolById } from 'hooks/infinity/usePool'
import { usePositionAmount } from 'hooks/infinity/usePositionAmount'
import { useRemoveClLiquidity } from 'hooks/infinity/useRemoveClLiquidity'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useCallback, useMemo, useState } from 'react'
import { InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { logGTMClickRemoveLiquidityEvent } from 'utils/customGTMEventTracking'
import { calculateSlippageAmount } from 'utils/exchange'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { maxUint128 } from 'viem'
import { useAccount } from 'wagmi'

interface InfinityCLPositionRemoveProps {
  position: InfinityCLPositionDetail
  poolInfo: PoolInfo
}

export const InfinityCLPositionRemove = ({ position, poolInfo }: InfinityCLPositionRemoveProps) => {
  const { t } = useTranslation()
  const { address: account } = useAccount()
  const { chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()

  const chainId = position.chainId ?? poolInfo.chainId
  const currency0 = poolInfo.token0
  const currency1 = poolInfo.token1
  const { poolKey, liquidity, tickLower, tickUpper } = position
  const removed = position.liquidity === 0n

  const poolId = useMemo(() => (poolKey ? getPoolId(poolKey) : undefined), [poolKey])
  const [, pool] = usePoolById<'CL'>(poolId, chainId)

  const nativeCurrency = useNativeCurrency(chainId)

  const [percent, setPercent] = useState(50)
  const [percentForSlider, onPercentSelectForSlider] = useDebouncedChangeHandler(percent, setPercent)
  const [collectAsWrappedNative, setCollectAsWrappedNative] = useState(false)

  const displayCurrency0 = useMemo(() => {
    if (!currency0 || !chainId) return currency0
    const wn = WNATIVE[chainId]
    if (!wn || !currency0.isNative) return currency0
    return collectAsWrappedNative ? wn : nativeCurrency
  }, [currency0, chainId, collectAsWrappedNative, nativeCurrency])

  const displayCurrency1 = useMemo(() => {
    if (!currency1 || !chainId) return currency1
    const wn = WNATIVE[chainId]
    if (!wn || !currency1.isNative) return currency1
    return collectAsWrappedNative ? wn : nativeCurrency
  }, [currency1, chainId, collectAsWrappedNative, nativeCurrency])

  const handleChangePercent = useCallback(
    (value: any) => onPercentSelectForSlider(Math.ceil(value)),
    [onPercentSelectForSlider],
  )

  const { amount0: allAmount0, amount1: allAmount1 } = usePositionAmount({
    token0: currency0,
    token1: currency1,
    tickCurrent: pool?.tickCurrent,
    tickLower,
    tickUpper,
    sqrtRatioX96: pool?.sqrtRatioX96,
    liquidity,
  })

  const [amount0, amount1] = useMemo(
    () => [
      allAmount0?.multiply(new Percent(percentForSlider, 100)),
      allAmount1?.multiply(new Percent(percentForSlider, 100)),
    ],
    [allAmount0, allAmount1, percentForSlider],
  )

  const { data: currency0Usd } = useCurrencyUsdPrice(currency0)
  const { data: currency1Usd } = useCurrencyUsdPrice(currency1)

  const wrapAddress = useMemo(() => {
    if (!collectAsWrappedNative) return zeroAddress
    if (currency0?.isNative) return currency0?.wrapped.address ?? zeroAddress
    if (currency1?.isNative) return currency1?.wrapped.address ?? zeroAddress
    return zeroAddress
  }, [collectAsWrappedNative, currency0, currency1])

  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]

  const { removeLiquidity: removeCLLiquidity, attemptingTx } = useRemoveClLiquidity(chainId, account)

  const handleRemoveLiquidity = useCallback(async () => {
    if (!position || !position.tokenId) return

    const [amount0Min] = amount0 ? calculateSlippageAmount(amount0, allowedSlippage) : [maxUint128]
    const [amount1Min] = amount1 ? calculateSlippageAmount(amount1, allowedSlippage) : [maxUint128]

    await removeCLLiquidity({
      tokenId: position.tokenId,
      poolKey: position.poolKey as PoolKey<'CL'>,
      liquidity: (position.liquidity * BigInt(percentForSlider)) / 100n,
      amount0Min,
      amount1Min,
      wrapAddress,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
    })
  }, [position, amount0, allowedSlippage, amount1, removeCLLiquidity, percentForSlider, wrapAddress])

  const error = useMemo(() => {
    if (!account) return t('Connect Wallet')
    if (percent === 0) return t('Enter a percent')
    return undefined
  }, [t, account, percent])

  const showCollectAsWNative = useMemo(
    () => Boolean(currency0 && currency1 && (currency0.isNative || currency1.isNative)),
    [currency0, currency1],
  )

  // Balance difference display values
  const currency0Amount = allAmount0?.toSignificant(6) ?? '0'
  const currency1Amount = allAmount1?.toSignificant(6) ?? '0'

  const currency0NewAmount = useMemo(() => {
    if (!allAmount0 || !amount0) return currency0Amount
    const newQuotient = allAmount0.quotient - amount0.quotient
    if (newQuotient < 0n) return '0'
    return CurrencyAmount.fromRawAmount(allAmount0.currency, newQuotient).toSignificant(6)
  }, [allAmount0, amount0, currency0Amount])

  const currency1NewAmount = useMemo(() => {
    if (!allAmount1 || !amount1) return currency1Amount
    const newQuotient = allAmount1.quotient - amount1.quotient
    if (newQuotient < 0n) return '0'
    return CurrencyAmount.fromRawAmount(allAmount1.currency, newQuotient).toSignificant(6)
  }, [allAmount1, amount1, currency1Amount])

  const totalPositionUsd = useMemo(() => {
    if (!allAmount0 || !allAmount1 || !currency0Usd || !currency1Usd) return '$0'
    const usd0 = BN(allAmount0.toExact()).multipliedBy(currency0Usd)
    const usd1 = BN(allAmount1.toExact()).multipliedBy(currency1Usd)
    return `$${usd0.plus(usd1).toFormat(2)}`
  }, [allAmount0, allAmount1, currency0Usd, currency1Usd])

  const removedTokensUsd = useMemo(() => {
    if (!amount0 || !amount1 || !currency0Usd || !currency1Usd) return '0'
    const usd0 = BN(amount0.toExact()).multipliedBy(currency0Usd)
    const usd1 = BN(amount1.toExact()).multipliedBy(currency1Usd)
    return usd0.plus(usd1).toFormat(2)
  }, [amount0, amount1, currency0Usd, currency1Usd])

  const totalPositionNewUsd = useMemo(() => {
    if (totalPositionUsd === '$0' || removedTokensUsd === '0') return totalPositionUsd
    const total = BN(totalPositionUsd.replace(/[$,]/g, ''))
    const removed_ = BN(removedTokensUsd.replace(/,/g, ''))
    const result = total.minus(removed_)
    return `$${result.isNegative() ? '0' : result.toFormat(2)}`
  }, [totalPositionUsd, removedTokensUsd])

  const [feeValue0, feeValue1] = useFeesEarned({
    currency0,
    currency1,
    tokenId: position.tokenId !== undefined ? BigInt(position.tokenId) : undefined,
    poolId,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
  })

  const feesEarnedUsdFormatted = useMemo(() => {
    if (!feeValue0?.greaterThan(0) && !feeValue1?.greaterThan(0)) return undefined
    const usd0 = feeValue0?.greaterThan(0) && currency0Usd ? BN(feeValue0.toExact()).multipliedBy(currency0Usd) : BN(0)
    const usd1 = feeValue1?.greaterThan(0) && currency1Usd ? BN(feeValue1.toExact()).multipliedBy(currency1Usd) : BN(0)
    return `$${usd0.plus(usd1).toFormat(2)}`
  }, [feeValue0, feeValue1, currency0Usd, currency1Usd])

  const buttonDisabled = attemptingTx || removed || Boolean(error) || percent === 0

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
            {t('Collect as %symbol%', { symbol: nativeCurrency.wrapped.symbol })}
          </Text>
          <Toggle
            scale="sm"
            checked={collectAsWrappedNative}
            onChange={() => setCollectAsWrappedNative((prev) => !prev)}
          />
        </Flex>
      )}

      <PreTitle mt="16px">{t('Amount of liquidity to remove')}</PreTitle>

      <LightGreyCard mt="8px" padding="16px" borderRadius="24px">
        <Text fontSize="40px" bold mb="16px" style={{ lineHeight: 1 }}>
          {percentForSlider}%
        </Text>
        <Slider
          name="lp-amount"
          min={0}
          max={100}
          value={percentForSlider}
          onValueChanged={handleChangePercent}
          mb="16px"
        />
        <FlexGap gap="8px" justifyContent="space-between">
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(10)} width="100%" borderRadius="12px">
            10%
          </Button>
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(20)} width="100%" borderRadius="12px">
            20%
          </Button>
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(75)} width="100%" borderRadius="12px">
            75%
          </Button>
          <Button
            variant="primary60Outline"
            scale="sm"
            onClick={() => setPercent(100)}
            width="100%"
            borderRadius="12px"
          >
            {t('Max.fill-max')}
          </Button>
        </FlexGap>
      </LightGreyCard>

      <BalanceDifferenceDisplay
        currency0={displayCurrency0 ?? currency0}
        currency1={displayCurrency1 ?? currency1}
        currency0Amount={currency0Amount}
        currency0NewAmount={currency0NewAmount}
        currency1Amount={currency1Amount}
        currency1NewAmount={currency1NewAmount}
        totalPositionUsd={totalPositionUsd}
        totalPositionNewUsd={totalPositionNewUsd}
        removedAmountUsd={`$${removedTokensUsd}`}
        feeValue0={feeValue0}
        feeValue1={feeValue1}
        feesEarnedUsd={feesEarnedUsdFormatted}
      />

      {activeChainId !== chainId ? (
        <Button
          mt="16px"
          width="100%"
          onClick={() => (chainId ? switchNetworkIfNecessary(chainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      ) : (
        <Button
          mt="16px"
          width="100%"
          disabled={buttonDisabled}
          onClick={() => {
            handleRemoveLiquidity()
            logGTMClickRemoveLiquidityEvent()
          }}
        >
          {removed ? t('Closed') : error ?? t('Remove')}
        </Button>
      )}
    </Box>
  )
}
