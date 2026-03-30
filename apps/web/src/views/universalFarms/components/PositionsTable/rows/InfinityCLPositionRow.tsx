import { usePoolById } from 'hooks/infinity/usePool'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useTotalPriceUSD } from 'hooks/useTotalPriceUSD'
import { useExtraInfinityPositionInfo, usePoolInfo } from 'state/farmsV4/hooks'
import { useUnclaimedFarmRewardsUSDByTokenId } from 'hooks/infinity/useFarmReward'
import { useFeesEarnedUSD } from 'hooks/infinity/useFeesEarned'
import { useHookByPoolId } from 'hooks/infinity/useHooksList'
import { useAccount } from 'wagmi'
import dayjs from 'dayjs'
import { useMemo, useState, memo, useCallback } from 'react'
import { getPoolId, PoolKey } from '@pancakeswap/infinity-sdk'
import type { Currency as CoreCurrency } from '@pancakeswap/swap-sdk-core'
import type { Currency } from '@pancakeswap/sdk'
import { calculateTickBasedPriceRange, getTickAtLimitStatus, calculateTickLimits } from 'views/PoolDetail/utils'
import { InfinityCLPositionDetail, InfinityBinPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { InfinityPoolInfo, type PoolInfo } from 'state/farmsV4/state/type'
import { Protocol } from '@pancakeswap/farms'
import { BigNumber as BN } from 'bignumber.js'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { useModalV2 } from '@pancakeswap/uikit'
import { useCurrencyByChainId } from 'hooks/Tokens'
import useFarmInfinityActions from '../../../hooks/useFarmInfinityActions'
import useInfinityCollectFeeAction from '../../../hooks/useInfinityCollectFeeAction'
import { useInfinityPositionsData } from '../../../hooks/useInfinityPositions'
import { InfinityHarvestModal } from '../../Modals/InfinityHarvestModal'
import { InfinityCLPoolPositionAprButton } from '../../PoolAprButton'
import { PositionRowDisplay, PositionDisplayData } from '../PositionRowDisplay'
import { useInfinityCLPositionApr } from '../../../hooks/usePositionAPR'

interface InfinityCLPositionRowProps {
  position: InfinityCLPositionDetail
  chainId: number
  hideEarningsColumn?: boolean
}

export const InfinityCLPositionRow: React.FC<InfinityCLPositionRowProps> = memo(
  ({ position, chainId, hideEarningsColumn }) => {
    const [expanded, setExpanded] = useState(false)
    const { address } = useAccount()
    const [, setLatestTxReceipt] = useLatestTxReceipt()
    const modalState = useModalV2()

    const poolId = useMemo(() => {
      if (position.poolKey) {
        return getPoolId(position.poolKey)
      }
      if (position.poolId) {
        return position.poolId
      }
      return undefined
    }, [position])

    // Get harvest actions for closed positions
    const {
      onHarvest,
      hasUnclaimedRewards,
      isMerkleRootMismatch,
      attemptingTx: harvestAttemptingTxn,
    } = useFarmInfinityActions({
      chainId,
      onDone: setLatestTxReceipt,
    })

    const { onCollect, attemptingTx: collectAttemptingTxn } = useInfinityCollectFeeAction({ chainId })

    // Get all infinity positions for harvest modal
    const { data: allInfinityPositions } = useInfinityPositionsData()

    // Prepare harvest list for modal
    const harvestList = useMemo(() => {
      const isSamePosition = (p: InfinityCLPositionDetail | InfinityBinPositionDetail) => {
        if (p.chainId !== position.chainId || p.protocol !== position.protocol) return false
        if (p.protocol === Protocol.InfinityCLAMM && position.protocol === Protocol.InfinityCLAMM) {
          return (p as InfinityCLPositionDetail).tokenId === position.tokenId
        }
        return false
      }

      const filtered = allInfinityPositions.filter((p) => p.chainId === chainId).filter((p) => !isSamePosition(p))

      filtered.unshift(position)
      return filtered
    }, [allInfinityPositions, position, chainId])

    // Get currencies for modal
    const currency0Modal = useCurrencyByChainId(position.poolKey?.currency0, chainId) ?? undefined
    const currency1Modal = useCurrencyByChainId(position.poolKey?.currency1, chainId) ?? undefined

    const handleCollect = useCallback(() => {
      onCollect({
        tokenId: position.tokenId,
        poolKey: position.poolKey as PoolKey<'CL'>,
      })
    }, [position.poolKey, position.tokenId, onCollect])

    const handleOpenHarvestModal = useCallback(() => {
      modalState.onOpen()
    }, [modalState])

    // Use usePoolById for CL pools
    const [, clPool] = usePoolById<'CL'>(poolId as `0x${string}`, chainId)

    const pool = usePoolInfo({
      poolAddress: poolId,
      chainId,
    })

    const hookData = useHookByPoolId(chainId, (pool as InfinityPoolInfo)?.poolId)

    // Use useExtraInfinityPositionInfo for CL positions
    const infinityInfo = useExtraInfinityPositionInfo(position)

    // Use pool tokens (from usePoolInfo) for price calculation to preserve on-chain token order
    // infinityInfo.currency0/currency1 come from position data which may not match pool order
    // This is critical for native token pools where sorting can differ
    const currency0 = (pool && 'token0' in pool ? pool.token0 : undefined) || infinityInfo.currency0
    const currency1 = (pool && 'token1' in pool ? pool.token1 : undefined) || infinityInfo.currency1

    const { amount0 } = infinityInfo
    const { amount1 } = infinityInfo

    const removed = infinityInfo.removed || false

    // Calculate outOfRange from infinityInfo, but also check price range percentages as fallback
    // If both percentages have the same sign (both positive or both negative), position is out of range
    const outOfRangeFromPriceRange = useMemo(() => {
      const poolForCalc = clPool || infinityInfo.pool
      if (!poolForCalc) return false

      const { tickLower, tickUpper, tickSpacing } = position

      if (tickLower === undefined || tickUpper === undefined) return false

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
        currency0,
        currency1,
        poolForCalc,
        isTickAtLimit,
        isFlipped,
      )

      // Check if both percentages have the same sign, indicating out of range
      // If one is negative and one is positive, the current price is within range
      if (rangeData.showPercentages && rangeData.minPercentage && rangeData.maxPercentage) {
        const minIsNegative = rangeData.minPercentage.startsWith('-') && rangeData.minPercentage !== '-%'
        const minIsPositive = rangeData.minPercentage.startsWith('+')
        const maxIsNegative = rangeData.maxPercentage.startsWith('-') && rangeData.maxPercentage !== '-%'
        const maxIsPositive = rangeData.maxPercentage.startsWith('+')

        // In range: one negative, one positive
        // Out of range: both negative or both positive
        const inRange = (minIsNegative && maxIsPositive) || (minIsPositive && maxIsNegative)
        return !inRange && (minIsNegative || minIsPositive) && (maxIsNegative || maxIsPositive)
      }

      return false
    }, [clPool, infinityInfo.pool, position, currency0, currency1])

    const outOfRange = infinityInfo.outOfRange || outOfRangeFromPriceRange

    const evmCurrency0 = currency0 as unknown as Currency
    const evmCurrency1 = currency1 as unknown as Currency
    const { data: price0Usd } = useCurrencyUsdPrice(evmCurrency0, { enabled: Boolean(evmCurrency0) })
    const { data: price1Usd } = useCurrencyUsdPrice(evmCurrency1, { enabled: Boolean(evmCurrency1) })

    const totalPriceUSD = useTotalPriceUSD({
      currency0: currency0 as unknown as CoreCurrency,
      currency1: currency1 as unknown as CoreCurrency,
      amount0,
      amount1,
    })

    // Earnings
    const infinityCLEarnings = useUnclaimedFarmRewardsUSDByTokenId({
      chainId,
      tokenId: position.tokenId,
      poolId,
      address,
      timestamp: dayjs().startOf('hour').unix(),
    })

    // Get LP fees for Infinity CL
    const infinityCLFees = useFeesEarnedUSD({
      currency0: currency0 as Currency | undefined,
      currency1: currency1 as Currency | undefined,
      tokenId: position.tokenId,
      poolId,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      enabled: !removed,
    })

    const earningsBreakdown = useMemo(() => {
      if (removed) return undefined

      const fee0Amount = infinityCLFees.feeAmount0 ? BN(infinityCLFees.feeAmount0.toExact()).toNumber() : 0
      const fee1Amount = infinityCLFees.feeAmount1 ? BN(infinityCLFees.feeAmount1.toExact()).toNumber() : 0
      const fee0USD = fee0Amount > 0 && price0Usd != null ? BN(fee0Amount).times(price0Usd).toNumber() : 0
      const fee1USD = fee1Amount > 0 && price1Usd != null ? BN(fee1Amount).times(price1Usd).toNumber() : 0

      const rewardsAmount = infinityCLEarnings.data?.rewardsAmount
      const farmRewardsAmount = rewardsAmount
        ? BN(rewardsAmount.toFixed(Math.min(rewardsAmount.currency.decimals, 18))).toNumber()
        : 0

      return {
        fee0Amount: fee0Amount > 0 ? fee0Amount : undefined,
        fee1Amount: fee1Amount > 0 ? fee1Amount : undefined,
        fee0USD: fee0USD > 0 ? fee0USD : undefined,
        fee1USD: fee1USD > 0 ? fee1USD : undefined,
        farmRewardsAmount: farmRewardsAmount > 0 ? farmRewardsAmount : undefined,
        farmRewardsUSD:
          infinityCLEarnings.data?.rewardsUSD && infinityCLEarnings.data.rewardsUSD > 0
            ? infinityCLEarnings.data.rewardsUSD
            : undefined,
        rewardCurrency: rewardsAmount?.currency,
      }
    }, [infinityCLFees, infinityCLEarnings.data, removed, price0Usd, price1Usd])

    const earnings = useMemo(() => {
      const fee0Amt = infinityCLFees.feeAmount0 ? BN(infinityCLFees.feeAmount0.toExact()).toNumber() : 0
      const fee1Amt = infinityCLFees.feeAmount1 ? BN(infinityCLFees.feeAmount1.toExact()).toNumber() : 0
      const lpFeesUSD = (fee0Amt > 0 && price0Usd != null ? BN(fee0Amt).times(price0Usd) : BN(0))
        .plus(fee1Amt > 0 && price1Usd != null ? BN(fee1Amt).times(price1Usd) : BN(0))
        .toNumber()
      const farmRewardsUSD = infinityCLEarnings.data?.rewardsUSD || 0
      const totalUSD = BN(lpFeesUSD).plus(farmRewardsUSD).toNumber()
      const display = totalUSD > 0 ? `~${formatDollarAmount(totalUSD)}` : '$0'
      return { display }
    }, [infinityCLFees, infinityCLEarnings.data, price0Usd, price1Usd])

    // Price range using CL pool data
    const priceRangeDisplay = useMemo(() => {
      const poolForCalc = clPool || infinityInfo.pool
      if (!poolForCalc) return null

      const { tickLower, tickUpper, tickSpacing } = position

      if (tickLower === undefined || tickUpper === undefined) return null

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
        currency0,
        currency1,
        poolForCalc,
        isTickAtLimit,
        isFlipped,
      )
    }, [clPool, infinityInfo.pool, position, currency0, currency1])

    // Type guard to check if pool is InfinityPoolInfo
    const isInfinityPool = (p: PoolInfo | InfinityPoolInfo | null | undefined): p is InfinityPoolInfo => {
      return (
        p !== null &&
        p !== undefined &&
        'poolId' in p &&
        (p.protocol === Protocol.InfinityBIN || p.protocol === Protocol.InfinityCLAMM)
      )
    }

    const infinityPool = isInfinityPool(pool) ? pool : null

    // Calculate APR
    const aprData = useInfinityCLPositionApr(infinityPool || ({} as InfinityPoolInfo), position)
    const lpApr = useMemo(() => (infinityPool ? BN(aprData.lpApr).toNumber() || 0 : 0), [aprData.lpApr, infinityPool])
    const merklApr = useMemo(
      () => (infinityPool ? BN(aprData.merklApr).toNumber() || 0 : 0),
      [aprData.merklApr, infinityPool],
    )
    const incentraApr = useMemo(
      () => (infinityPool ? BN(aprData.incentraApr).toNumber() || 0 : 0),
      [aprData.incentraApr, infinityPool],
    )
    const farmApr = useMemo(
      () => (infinityPool ? BN(aprData.cakeApr?.value ?? '0').toNumber() || 0 : 0),
      [aprData.cakeApr?.value, infinityPool],
    )
    const totalApr = useMemo(() => {
      return lpApr + merklApr + incentraApr + farmApr
    }, [lpApr, merklApr, incentraApr, farmApr])
    // Check if pool has an active farm
    // Only use farmApr as fallback when pool info is not available (farmApr can be stale)
    const hasFarm = useMemo(
      () => Boolean(pool?.isActiveFarm ?? pool?.isFarming) || (!pool && farmApr > 0),
      [pool?.isActiveFarm, pool?.isFarming, pool, farmApr],
    )

    const handleToggleExpand = useCallback(() => setExpanded((prev) => !prev), [])

    // APR button component - memoized to prevent data object from being recreated every render
    const aprButton = useMemo(
      () =>
        infinityPool ? (
          <InfinityCLPoolPositionAprButton pool={infinityPool} userPosition={position} textProps={{ bold: true }} />
        ) : null,
      [infinityPool, position],
    )

    const data: PositionDisplayData = useMemo(
      () => ({
        currency0,
        currency1,
        removed,
        outOfRange,
        pool: pool as PoolInfo | InfinityPoolInfo | null,
        totalPriceUSD,
        aprButton,
        hookData,
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
        hasFarm,
        hasUnclaimedRewards,
        isMerkleRootMismatch,
        onHarvest: removed && hasUnclaimedRewards ? handleOpenHarvestModal : undefined,
      }),
      [
        currency0,
        currency1,
        removed,
        outOfRange,
        pool,
        totalPriceUSD,
        aprButton,
        hookData,
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
        hasFarm,
        hasUnclaimedRewards,
        isMerkleRootMismatch,
        handleOpenHarvestModal,
      ],
    )

    return (
      <>
        <PositionRowDisplay
          position={position}
          data={data}
          expanded={expanded}
          onToggleExpand={handleToggleExpand}
          hideEarningsColumn={hideEarningsColumn}
        />
        {modalState.isOpen && currency0Modal && currency1Modal && (
          <InfinityHarvestModal
            {...modalState}
            positionList={harvestList}
            currency0={currency0Modal}
            currency1={currency1Modal}
            chainId={chainId}
            onHarvest={onHarvest}
            onCollect={handleCollect}
            pos={position}
            showPositionFees
            closeOnOverlayClick
          />
        )}
      </>
    )
  },
)
