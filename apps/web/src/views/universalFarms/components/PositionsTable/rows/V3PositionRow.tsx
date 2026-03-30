import { usePoolByChainId } from 'hooks/v3/usePools'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useTotalPriceUSD } from 'hooks/useTotalPriceUSD'
import {
  useExtraV3PositionInfo,
  usePoolInfo,
  getPoolAddressByToken,
  useV3PoolStatus,
  useV3PoolsLength,
} from 'state/farmsV4/hooks'
import { getPoolMultiplier } from 'state/farmsV4/state/utils'
import { useMemo, useState, memo, useCallback } from 'react'
import type { Currency as CoreCurrency } from '@pancakeswap/swap-sdk-core'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import type { Currency } from '@pancakeswap/sdk'
import { CAKE } from '@pancakeswap/tokens'
import {
  calculateTickBasedPriceRange,
  getTickAtLimitStatus,
  calculateTickLimits,
  getTickSpacing,
} from 'views/PoolDetail/utils'
import { Protocol } from '@pancakeswap/farms'
import { PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { type PoolInfo } from 'state/farmsV4/state/type'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { BigNumber as BN } from 'bignumber.js'
import { useV3PositionFees } from 'hooks/v3/useV3PositionFees'
import { formatAmount as formatCurrencyAmount } from '@pancakeswap/utils/formatFractions'
import { useV3CakeEarning } from '../../../hooks/useCakeEarning'
import { V3PoolPositionAprButton } from '../../PoolAprButton'
import { PositionRowDisplay, PositionDisplayData } from '../PositionRowDisplay'
import { useV3PositionApr } from '../../../hooks/usePositionAPR'

interface V3PositionRowProps {
  position: PositionDetail
  chainId: number
  hideEarningsColumn?: boolean
}

export const V3PositionRow: React.FC<V3PositionRowProps> = memo(({ position, chainId, hideEarningsColumn }) => {
  const [expanded, setExpanded] = useState(false)

  const v3Info = useExtraV3PositionInfo(position)

  const { currency0 } = v3Info
  const { currency1 } = v3Info

  const [, v3Pool] = usePoolByChainId(currency0?.wrapped, currency1?.wrapped, position.fee)

  const amount0 = v3Info.position?.amount0
  const amount1 = v3Info.position?.amount1

  const removed = v3Info.removed || false

  const outOfRangeFromPriceRange = useMemo(() => {
    const poolForCalc = v3Pool || v3Info.pool
    if (!poolForCalc) return false

    const { tickLower, tickUpper, fee } = position

    if (tickLower === undefined || tickUpper === undefined) return false

    const tickSpacing = getTickSpacing(poolForCalc, fee)
    const ticksLimit = calculateTickLimits(tickSpacing)
    const isTickAtLimit = getTickAtLimitStatus(tickLower, tickUpper, ticksLimit)

    const isFlipped = Boolean(
      currency0?.wrapped?.address &&
        poolForCalc.token1?.address &&
        currency0.wrapped.address.toLowerCase() === poolForCalc.token1.address.toLowerCase(),
    )

    const rangeData = calculateTickBasedPriceRange(
      tickLower,
      tickUpper,
      currency0?.wrapped,
      currency1?.wrapped,
      poolForCalc,
      isTickAtLimit,
      isFlipped,
    )

    if (rangeData.showPercentages && rangeData.minPercentage && rangeData.maxPercentage) {
      const minIsNegative = rangeData.minPercentage.startsWith('-') && rangeData.minPercentage !== '-%'
      const minIsPositive = rangeData.minPercentage.startsWith('+')
      const maxIsNegative = rangeData.maxPercentage.startsWith('-') && rangeData.maxPercentage !== '-%'
      const maxIsPositive = rangeData.maxPercentage.startsWith('+')

      const inRange = (minIsNegative && maxIsPositive) || (minIsPositive && maxIsNegative)
      return !inRange && (minIsNegative || minIsPositive) && (maxIsNegative || maxIsPositive)
    }

    return false
  }, [v3Pool, v3Info.pool, position, currency0, currency1])

  const outOfRange = v3Info.outOfRange || outOfRangeFromPriceRange

  const evmCurrency0 = currency0 as unknown as Currency
  const evmCurrency1 = currency1 as unknown as Currency

  // Get LP fees for V3 position (used in earnings breakdown)
  const poolForFees = v3Pool || v3Info.pool
  const [feeValue0, feeValue1] = useV3PositionFees(poolForFees ?? undefined, position.tokenId, false, !removed)

  const { data: price0Usd } = useCurrencyUsdPrice(evmCurrency0, {
    enabled: Boolean(evmCurrency0),
  })
  const { data: price1Usd } = useCurrencyUsdPrice(evmCurrency1, {
    enabled: Boolean(evmCurrency1),
  })

  const totalPriceUSD = useTotalPriceUSD({
    currency0: currency0 as unknown as CoreCurrency,
    currency1: currency1 as unknown as CoreCurrency,
    amount0,
    amount1,
  })

  // Earnings - memoize tokenId array to avoid rerenders
  const tokenIds = useMemo(() => (position.tokenId ? [position.tokenId] : []), [position.tokenId])
  const v3Earnings = useV3CakeEarning(tokenIds, chainId)

  const earningsBreakdown = useMemo(() => {
    if (removed) return undefined

    const fee0AmountStr = feeValue0 ? formatCurrencyAmount(feeValue0) : undefined
    const fee1AmountStr = feeValue1 ? formatCurrencyAmount(feeValue1) : undefined
    const fee0Amount = fee0AmountStr ? BN(fee0AmountStr).toNumber() : 0
    const fee1Amount = fee1AmountStr ? BN(fee1AmountStr).toNumber() : 0
    const fee0USD = price0Usd && feeValue0 ? BN(fee0Amount).times(price0Usd).toNumber() : 0
    const fee1USD = price1Usd && feeValue1 ? BN(fee1Amount).times(price1Usd).toNumber() : 0

    return {
      fee0Amount: fee0Amount > 0 ? fee0Amount : undefined,
      fee1Amount: fee1Amount > 0 ? fee1Amount : undefined,
      fee0USD: fee0USD > 0 ? fee0USD : undefined,
      fee1USD: fee1USD > 0 ? fee1USD : undefined,
      farmRewardsAmount:
        v3Earnings.earningsAmount && v3Earnings.earningsAmount > 0 ? v3Earnings.earningsAmount : undefined,
      farmRewardsUSD: v3Earnings.earningsBusd && v3Earnings.earningsBusd > 0 ? v3Earnings.earningsBusd : undefined,
      rewardCurrency: CAKE[chainId], // MasterChefV3 always pays in CAKE
    }
  }, [feeValue0, feeValue1, price0Usd, price1Usd, v3Earnings, removed])

  const earnings = useMemo(() => {
    const lpFeesUSD = (earningsBreakdown?.fee0USD || 0) + (earningsBreakdown?.fee1USD || 0)
    const totalUSD = (v3Earnings.earningsBusd || 0) + lpFeesUSD
    const display = totalUSD > 0 ? `~${formatDollarAmount(totalUSD)}` : '$0'
    return { display }
  }, [v3Earnings, earningsBreakdown])

  // Price range using V3 pool
  const priceRangeDisplay = useMemo(() => {
    const poolForCalc = v3Pool || v3Info.pool
    if (!poolForCalc) return null

    const { tickLower, tickUpper, fee } = position

    if (tickLower === undefined || tickUpper === undefined) return null

    const tickSpacing = getTickSpacing(poolForCalc, fee)
    const ticksLimit = calculateTickLimits(tickSpacing)
    const isTickAtLimit = getTickAtLimitStatus(tickLower, tickUpper, ticksLimit)

    const isFlipped = Boolean(
      currency0?.wrapped?.address &&
        poolForCalc.token1?.address &&
        currency0.wrapped.address.toLowerCase() === poolForCalc.token1.address.toLowerCase(),
    )

    return calculateTickBasedPriceRange(
      tickLower,
      tickUpper,
      currency0?.wrapped,
      currency1?.wrapped,
      poolForCalc,
      isTickAtLimit,
      isFlipped,
    )
  }, [v3Pool, v3Info.pool, position, currency0, currency1])

  // Get pool address using the same method as V3PositionItem
  const poolAddress = useMemo(
    () => getPoolAddressByToken(chainId, position.token0, position.token1, position.fee),
    [chainId, position.token0, position.token1, position.fee],
  )

  // Get pool info for APR button
  const pool = usePoolInfo({
    poolAddress,
    chainId,
  })

  // Calculate APR - ensure we have a valid pool with required properties
  // If pool is null but we have currencies, create a minimal valid PoolInfo
  const poolForApr: PoolInfo = useMemo(() => {
    if (pool) return pool as PoolInfo
    // Ensure chainId is defined - use position.chainId as fallback
    const validChainId = chainId || position.chainId
    if (!validChainId) {
      // This should never happen, but provide a safe fallback
      console.warn('chainId is undefined for V3 position APR calculation')
    }
    // Create minimal PoolInfo if pool is null but we have currencies and poolAddress
    // This ensures the hook always receives a valid PoolInfo object
    if (currency0 && currency1 && poolAddress) {
      return {
        chainId: validChainId,
        lpAddress: poolAddress,
        token0: currency0,
        token1: currency1,
        protocol: Protocol.V3,
      } as PoolInfo
    }
    // If currencies aren't available yet, use v3Info.pool tokens or create minimal PoolInfo
    // The hook should handle this gracefully and return 0s for APR
    // This should rarely happen as v3Info should provide currencies
    // Use the best available currencies (prefer resolved from v3Info)
    const token0 = currency0 || v3Info.pool?.token0
    const token1 = currency1 || v3Info.pool?.token1

    // Always return a PoolInfo, but with undefined tokens if not available
    // The APR hook expects undefined, not empty objects
    return {
      chainId: validChainId,
      lpAddress: poolAddress || ZERO_ADDRESS,
      token0: token0 || undefined,
      token1: token1 || undefined,
      protocol: Protocol.V3,
    } as PoolInfo
  }, [pool, chainId, position.chainId, poolAddress, currency0, currency1, v3Info.pool])

  const aprData = useV3PositionApr(poolForApr, position)
  const lpApr = useMemo(() => (pool ? BN(aprData.lpApr || 0).toNumber() : 0), [aprData.lpApr, pool])
  const merklApr = useMemo(() => (pool ? BN(aprData.merklApr ?? 0).toNumber() : 0), [aprData.merklApr, pool])
  const incentraApr = useMemo(() => (pool ? BN(aprData.incentraApr ?? 0).toNumber() : 0), [aprData.incentraApr, pool])
  const farmApr = useMemo(
    () => (pool ? BN(aprData.cakeApr?.value ?? '0').toNumber() || 0 : 0),
    [aprData.cakeApr?.value, pool],
  )
  const totalApr = useMemo(() => {
    return lpApr + merklApr + incentraApr + farmApr
  }, [lpApr, merklApr, incentraApr, farmApr])

  // Use old logic for isFarmLive: check allocPoint via useV3PoolStatus
  // Only call useV3PoolStatus if pool exists and has pid (required for the hook)
  const poolForStatus = pool?.pid ? pool : null
  const [allocPoint] = useV3PoolStatus(poolForStatus)
  const poolMultiplier = getPoolMultiplier(allocPoint)
  const { data: poolsLength } = useV3PoolsLength([chainId])
  const poolLength = poolsLength?.[chainId]

  const isFarmLive = useMemo(() => {
    // If pool doesn't exist or doesn't have pid, farm is not live
    if (!pool || !pool.pid) {
      return false
    }
    // Check if multiplier is not 0X (allocPoint > 0) and pid is within valid range
    return poolMultiplier !== `0X` && (!poolLength || pool.pid <= poolLength)
  }, [pool, pool?.pid, poolLength, poolMultiplier])

  const handleToggleExpand = useCallback(() => setExpanded((prev) => !prev), [])

  // APR button component - memoized to prevent data object from being recreated every render
  const aprButton = useMemo(
    () =>
      pool ? (
        <V3PoolPositionAprButton pool={pool as PoolInfo} userPosition={position} textProps={{ bold: true }} />
      ) : null,
    [pool, position],
  )

  const data: PositionDisplayData = useMemo(
    () => ({
      currency0,
      currency1,
      removed,
      outOfRange,
      // When the pool is not in the farm config (e.g. Monad), `pool` is null but we still need
      // protocol/lpAddress for expanded actions (+/-) and PositionModal — use APR fallback pool.
      pool: (pool ?? poolForApr) as PoolInfo | null,
      totalPriceUSD,
      aprButton,
      hookData: undefined,
      chainId,
      earnings,
      earningsBreakdown,
      amount0,
      amount1,
      price0Usd,
      price1Usd,
      priceRangeDisplay,
      lpApr,
      merklApr,
      incentraApr,
      farmApr,
      totalApr,
      hasFarm: isFarmLive,
      // Pass the SDK pool for cross-chain fee fetching
      v3SdkPool: poolForFees,
    }),
    [
      currency0,
      currency1,
      removed,
      outOfRange,
      pool,
      poolForApr,
      totalPriceUSD,
      aprButton,
      chainId,
      earnings,
      earningsBreakdown,
      amount0,
      amount1,
      price0Usd,
      price1Usd,
      priceRangeDisplay,
      lpApr,
      merklApr,
      incentraApr,
      farmApr,
      totalApr,
      isFarmLive,
      poolForFees,
    ],
  )

  return (
    <PositionRowDisplay
      position={position}
      data={data}
      expanded={expanded}
      onToggleExpand={handleToggleExpand}
      hideEarningsColumn={hideEarningsColumn}
    />
  )
})
