import { useIsMounted } from '@pancakeswap/hooks'
import { PoolKey } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { WNATIVE } from '@pancakeswap/sdk'
import { Box, Button, Flex, Message, PreTitle, RowBetween, Text, Toggle } from '@pancakeswap/uikit'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import { BinRangeSelector } from 'components/Liquidity/Form/BinRangeSelector'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import { usePoolById } from 'hooks/infinity/usePool'
import { usePoolKeyByPoolId } from 'hooks/infinity/usePoolKeyByPoolId'
import { useBinRemoveLiquidity } from 'hooks/infinity/useRemoveBinLiquidity'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useInfinityBinPosition } from 'hooks/infinity/useInfinityPositions'
import { InfinityBinPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useBinRangeQueryState } from 'state/infinity/shared'
import { logGTMClickRemoveLiquidityEvent } from 'utils/customGTMEventTracking'
import { calculateSlippageAmount } from 'utils/exchange'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { BinSlider } from 'views/RemoveLiquidityInfinity/components/BinSlider'
import { zeroAddress } from 'viem'
import { useAccount } from 'wagmi'

interface InfinityBinPositionRemoveProps {
  position: InfinityBinPositionDetail
  poolInfo: PoolInfo
}

export const InfinityBinPositionRemove = ({ position, poolInfo }: InfinityBinPositionRemoveProps) => {
  const { t } = useTranslation()
  const { address: account } = useAccount()
  const { chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()

  const chainId = position.chainId ?? poolInfo.chainId
  const { poolId } = position
  const [, pool] = usePoolById<'Bin'>(poolId, chainId)
  const poolIdToPoolKey = usePoolKeyByPoolId(poolId, chainId, 'Bin')
  const poolKey = (position.poolKey ?? poolIdToPoolKey?.data) as PoolKey<'Bin'> | undefined

  const currency0 = pool?.token0
  const currency1 = pool?.token1
  const nativeCurrency = useNativeCurrency(chainId)

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

  const [, setBinQueryState] = useBinRangeQueryState()
  const [selectedBinNums, setSelectedBinNums] = useState<number[]>([position.minBinId ?? 0, position.maxBinId ?? 0])

  const { data: freshPosition } = useInfinityBinPosition(poolId, chainId, account)

  const effectiveReserveOfBins = useMemo(() => {
    if (freshPosition?.reserveOfBins) return freshPosition.reserveOfBins
    if (!position.reserveOfBins) return []
    return position.reserveOfBins
      .filter((bin) => bin.userSharesOfBin > 0n)
      .map((bin) => ({
        ...bin,
        reserveX: bin.totalShares > 0n ? (bin.userSharesOfBin * bin.reserveX) / bin.totalShares : 0n,
        reserveY: bin.totalShares > 0n ? (bin.userSharesOfBin * bin.reserveY) / bin.totalShares : 0n,
      }))
  }, [freshPosition?.reserveOfBins, position.reserveOfBins])

  const amount0 = useMemo(() => {
    if (!currency0 || !effectiveReserveOfBins.length) return undefined
    const [min, max] = selectedBinNums
    const reserveX = effectiveReserveOfBins.reduce((acc, bin) => {
      if (bin.binId >= min && bin.binId <= max) return acc + bin.reserveX
      return acc
    }, 0n)
    return CurrencyAmount.fromRawAmount(currency0, reserveX)
  }, [effectiveReserveOfBins, currency0, selectedBinNums])

  const amount1 = useMemo(() => {
    if (!currency1 || !effectiveReserveOfBins.length) return undefined
    const [min, max] = selectedBinNums
    const reserveY = effectiveReserveOfBins.reduce((acc, bin) => {
      if (bin.binId >= min && bin.binId <= max) return acc + bin.reserveY
      return acc
    }, 0n)
    return CurrencyAmount.fromRawAmount(currency1, reserveY)
  }, [effectiveReserveOfBins, currency1, selectedBinNums])

  const totalAmount0 = useMemo(() => {
    if (!currency0 || !effectiveReserveOfBins.length) return undefined
    const total = effectiveReserveOfBins.reduce((acc, bin) => acc + bin.reserveX, 0n)
    return CurrencyAmount.fromRawAmount(currency0, total)
  }, [effectiveReserveOfBins, currency0])

  const totalAmount1 = useMemo(() => {
    if (!currency1 || !effectiveReserveOfBins.length) return undefined
    const total = effectiveReserveOfBins.reduce((acc, bin) => acc + bin.reserveY, 0n)
    return CurrencyAmount.fromRawAmount(currency1, total)
  }, [effectiveReserveOfBins, currency1])

  const { data: currency0Usd } = useCurrencyUsdPrice(currency0)
  const { data: currency1Usd } = useCurrencyUsdPrice(currency1)

  const removed = useMemo(() => {
    return position.reserveX === 0n && position.reserveY === 0n
  }, [position])

  const error = useMemo(() => {
    if (!account) return t('Connect Wallet')
    return undefined
  }, [t, account])

  useEffect(() => {
    if (position.minBinId && position.maxBinId && !selectedBinNums[0] && !selectedBinNums[1]) {
      setSelectedBinNums([position.minBinId, position.maxBinId])
    }
  }, [position, selectedBinNums])

  const handleBinRangeChanged = useCallback(
    (newValue: number | number[]) => {
      const [min, max] = Array.isArray(newValue) ? newValue : [newValue, newValue]
      setSelectedBinNums([min, max])
      setBinQueryState({ lowerBinId: min, upperBinId: max })
    },
    [setBinQueryState],
  )

  const { removeLiquidity: removeBinLiquidity, attemptingTx } = useBinRemoveLiquidity(chainId, account)
  const [deadline] = useTransactionDeadline()
  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]
  const wrapAddress = useMemo(() => {
    if (!currency0 || !currency1 || !collectAsWrappedNative) return zeroAddress
    if (currency0.isNative) return currency0.wrapped.address
    if (currency1.isNative) return currency1.wrapped.address
    return zeroAddress
  }, [collectAsWrappedNative, currency0, currency1])

  const handleRemoveLiquidity = useCallback(async () => {
    if (!pool || !account || !poolKey || !effectiveReserveOfBins.length) return
    const selectedBins = effectiveReserveOfBins.filter(
      (bin) => bin.binId >= selectedBinNums[0] && bin.binId <= selectedBinNums[1],
    )
    const ids = selectedBins.map((bin) => bin.binId)
    const amounts = selectedBins.map((bin) => bin.userSharesOfBin)
    const amountX = CurrencyAmount.fromRawAmount(
      pool.token0,
      selectedBins.reduce((acc, bin) => acc + bin.reserveX, 0n),
    )
    const amountY = CurrencyAmount.fromRawAmount(
      pool.token1,
      selectedBins.reduce((acc, bin) => acc + bin.reserveY, 0n),
    )
    const amount0Min = calculateSlippageAmount(amountX, allowedSlippage)[0]
    const amount1Min = calculateSlippageAmount(amountY, allowedSlippage)[0]

    await removeBinLiquidity({
      poolKey,
      ids,
      amounts,
      amount0Min,
      amount1Min,
      wrapAddress,
      hookData: undefined,
      deadline: deadline ?? BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
    })
  }, [
    account,
    allowedSlippage,
    effectiveReserveOfBins,
    deadline,
    pool,
    poolKey,
    removeBinLiquidity,
    selectedBinNums,
    wrapAddress,
  ])

  const [{ lowerBinId, upperBinId }] = useBinRangeQueryState()
  const invalidRange = useMemo(() => {
    if (!lowerBinId || !upperBinId) return true
    if (lowerBinId > upperBinId) return true
    if ((position.minBinId && lowerBinId < position.minBinId) || (position.maxBinId && lowerBinId > position.maxBinId))
      return true
    if ((position.minBinId && upperBinId < position.minBinId) || (position.maxBinId && upperBinId > position.maxBinId))
      return true
    return false
  }, [position.maxBinId, position.minBinId, lowerBinId, upperBinId])

  useEffect(() => {
    if (
      !invalidRange &&
      lowerBinId &&
      upperBinId &&
      (selectedBinNums[0] !== lowerBinId || selectedBinNums[1] !== upperBinId)
    ) {
      setSelectedBinNums([lowerBinId, upperBinId])
    }
  }, [invalidRange, lowerBinId, selectedBinNums, upperBinId])

  const isMounted = useIsMounted()
  useEffect(() => {
    if (
      isMounted &&
      position.minBinId &&
      position.maxBinId &&
      (lowerBinId === null ||
        upperBinId === null ||
        lowerBinId < position.minBinId ||
        lowerBinId > position.maxBinId ||
        upperBinId < position.minBinId ||
        upperBinId > position.maxBinId)
    ) {
      setBinQueryState({ lowerBinId: position.minBinId, upperBinId: position.maxBinId })
    }
  }, [position.maxBinId, position.minBinId, isMounted, lowerBinId, setBinQueryState, upperBinId])

  const submitDisabled = useMemo(() => {
    if (attemptingTx || removed || Boolean(error)) return true
    if (!amount0 || !amount1) return true
    if (amount0.asFraction.add(amount1.asFraction).equalTo(0)) return true
    return false
  }, [attemptingTx, removed, error, amount0, amount1])

  const showCollectAsWNative = useMemo(
    () => Boolean(currency0 && currency1 && (currency0.isNative || currency1.isNative)),
    [currency0, currency1],
  )

  // Balance difference display values
  const currency0AmountStr = totalAmount0?.toSignificant(6) ?? '0'
  const currency1AmountStr = totalAmount1?.toSignificant(6) ?? '0'

  const currency0NewAmount = useMemo(() => {
    if (!totalAmount0 || !amount0) return currency0AmountStr
    const newQuotient = totalAmount0.quotient - amount0.quotient
    if (newQuotient < 0n) return '0'
    return CurrencyAmount.fromRawAmount(totalAmount0.currency, newQuotient).toSignificant(6)
  }, [totalAmount0, amount0, currency0AmountStr])

  const currency1NewAmount = useMemo(() => {
    if (!totalAmount1 || !amount1) return currency1AmountStr
    const newQuotient = totalAmount1.quotient - amount1.quotient
    if (newQuotient < 0n) return '0'
    return CurrencyAmount.fromRawAmount(totalAmount1.currency, newQuotient).toSignificant(6)
  }, [totalAmount1, amount1, currency1AmountStr])

  const totalPositionUsd = useMemo(() => {
    if (!totalAmount0 || !totalAmount1 || !currency0Usd || !currency1Usd) return '$0'
    const usd0 = BN(totalAmount0.toExact()).multipliedBy(currency0Usd)
    const usd1 = BN(totalAmount1.toExact()).multipliedBy(currency1Usd)
    return `$${usd0.plus(usd1).toFormat(2)}`
  }, [totalAmount0, totalAmount1, currency0Usd, currency1Usd])

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

  if (!pool) return null

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
        <PreTitle textTransform="uppercase">{t('Price Range')}</PreTitle>
        {position.minBinId != null && position.maxBinId != null ? (
          <>
            {position.maxBinId - position.minBinId > 1 ? (
              <Box height="48px" my="8px">
                <BinSlider
                  defaultValue={[position.minBinId, position.maxBinId]}
                  min={position.minBinId}
                  max={position.maxBinId}
                  value={selectedBinNums}
                  step={1}
                  onChange={handleBinRangeChanged}
                />
              </Box>
            ) : null}
            <BinRangeSelector
              currency0={currency0}
              currency1={currency1}
              binStep={pool.binStep}
              minBinId={position.minBinId}
              maxBinId={position.maxBinId}
            />
          </>
        ) : null}
      </LightGreyCard>

      <Message variant="primary" mt="16px">
        <Text small>
          {t('Displayed amounts include fees. In LBAMM pools, accrued fees are added back to the pool reserves.')}
        </Text>
      </Message>

      {currency0 && currency1 && (
        <BalanceDifferenceDisplay
          currency0={displayCurrency0 ?? currency0}
          currency1={displayCurrency1 ?? currency1}
          currency0Amount={currency0AmountStr}
          currency0NewAmount={currency0NewAmount}
          currency1Amount={currency1AmountStr}
          currency1NewAmount={currency1NewAmount}
          totalPositionUsd={totalPositionUsd}
          totalPositionNewUsd={totalPositionNewUsd}
          removedAmountUsd={`$${removedTokensUsd}`}
        />
      )}

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
          disabled={submitDisabled}
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
