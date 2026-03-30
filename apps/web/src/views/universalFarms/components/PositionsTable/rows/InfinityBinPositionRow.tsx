import { CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { BigNumber as BN } from 'bignumber.js'
import { usePoolById } from 'hooks/infinity/usePool'
import { useInfinityBinPosition } from 'hooks/infinity/useInfinityPositions'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { useUnclaimedFarmRewardsUSDByPoolId } from 'hooks/infinity/useFarmReward'
import { useHookByPoolId } from 'hooks/infinity/useHooksList'
import { useAccount } from 'wagmi'
import dayjs from 'dayjs'
import { useMemo, useState, memo, useCallback } from 'react'
import { getPoolId } from '@pancakeswap/infinity-sdk'
import { calculateBinBasedPriceRange } from 'views/PoolDetail/utils'
import { InfinityBinPositionDetail, InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { InfinityPoolInfo, type PoolInfo } from 'state/farmsV4/state/type'
import { Protocol } from '@pancakeswap/farms'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { useModalV2 } from '@pancakeswap/uikit'
import { useCurrencyByChainId } from 'hooks/Tokens'
import useFarmInfinityActions from '../../../hooks/useFarmInfinityActions'
import { useInfinityPositionsData } from '../../../hooks/useInfinityPositions'
import { InfinityHarvestModal } from '../../Modals/InfinityHarvestModal'
import { InfinityBinPoolPositionAprButton } from '../../PoolAprButton'
import { PositionRowDisplay, PositionDisplayData } from '../PositionRowDisplay'
import { useInfinityBinPositionApr } from '../../../hooks/usePositionAPR'

interface InfinityBinPositionRowProps {
  position: InfinityBinPositionDetail
  chainId: number
  hideEarningsColumn?: boolean
}

export const InfinityBinPositionRow: React.FC<InfinityBinPositionRowProps> = memo(
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

    // Get all infinity positions for harvest modal
    const { data: allInfinityPositions } = useInfinityPositionsData()

    // Prepare harvest list for modal
    const harvestList = useMemo(() => {
      const isSamePosition = (p: InfinityCLPositionDetail | InfinityBinPositionDetail) => {
        if (p.chainId !== position.chainId || p.protocol !== position.protocol) return false
        if (p.protocol === Protocol.InfinityBIN && position.protocol === Protocol.InfinityBIN) {
          return (p as InfinityBinPositionDetail).activeId === position.activeId
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

    const handleOpenHarvestModal = useCallback(() => {
      modalState.onOpen()
    }, [modalState])

    // Use usePoolById for BIN pools - this gets binStep and activeId
    const [, binPool] = usePoolById<'Bin'>(poolId as `0x${string}`, chainId)

    // Also get pool info for other data
    const pool = usePoolInfo({
      poolAddress: poolId,
      chainId,
    })

    const hookData = useHookByPoolId(chainId, (pool as InfinityPoolInfo)?.poolId)

    // Fetch fresh on-chain position data to get accurate liquidity values
    const { data: freshPosition } = useInfinityBinPosition(poolId, chainId, address)

    // Calculate amounts from reserveX/reserveY - use ?? 0n fallback like liquidity view page
    // Use pool tokens (from usePoolInfo) for price calculation to preserve on-chain token order
    // binPool tokens go through sortCurrencies which can reorder native tokens differently
    const currency0 = pool?.token0 || binPool?.token0
    const currency1 = pool?.token1 || binPool?.token1

    const amount0 = useMemo(
      () =>
        binPool?.token0
          ? CurrencyAmount.fromRawAmount(binPool.token0, freshPosition?.reserveX ?? position?.reserveX ?? 0n)
          : undefined,
      [freshPosition?.reserveX, position?.reserveX, binPool?.token0],
    )
    const amount1 = useMemo(
      () =>
        binPool?.token1
          ? CurrencyAmount.fromRawAmount(binPool.token1, freshPosition?.reserveY ?? position?.reserveY ?? 0n)
          : undefined,
      [freshPosition?.reserveY, position?.reserveY, binPool?.token1],
    )

    // Position status
    const hasLiquidity = amount0?.greaterThan('0') || amount1?.greaterThan('0')
    const removed = !hasLiquidity

    // Calculate outOfRange based on price range percentages
    // If both percentages have the same sign (both positive or both negative), position is out of range
    const outOfRange = useMemo(() => {
      const binStep = binPool?.binStep
      const activeId = binPool?.activeId

      if (
        position.minBinId === null ||
        position.minBinId === undefined ||
        position.maxBinId === null ||
        position.maxBinId === undefined ||
        !binStep ||
        activeId === undefined
      )
        return false

      const rangeData = calculateBinBasedPriceRange(
        position.minBinId,
        position.maxBinId,
        binStep,
        activeId,
        currency0,
        currency1,
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
    }, [binPool, position, currency0, currency1])

    const { data: price0Usd } = useCurrencyUsdPrice(binPool?.token0 ?? undefined, {
      enabled: Boolean(binPool?.token0 && amount0?.greaterThan('0')),
    })
    const { data: price1Usd } = useCurrencyUsdPrice(binPool?.token1 ?? undefined, {
      enabled: Boolean(binPool?.token1 && amount1?.greaterThan('0')),
    })

    // Calculate liquidity USD - match ProtocolPositionsTables calculation
    const totalPriceUSD = useMemo(() => {
      return new BN(amount0?.toExact() ?? 0)
        .times(price0Usd ?? 0)
        .plus(new BN(amount1?.toExact() ?? 0).times(price1Usd ?? 0))
        .toNumber()
    }, [amount0, amount1, price0Usd, price1Usd])

    // Earnings
    const infinityBinEarnings = useUnclaimedFarmRewardsUSDByPoolId({
      chainId,
      poolId,
      address,
      timestamp: dayjs().startOf('hour').unix(),
    })

    const earningsBreakdown = useMemo(() => {
      const rewardsAmount = infinityBinEarnings.data?.rewardsAmount
      const farmRewardsAmount = rewardsAmount
        ? BN(rewardsAmount.toFixed(Math.min(rewardsAmount.currency.decimals, 18))).toNumber()
        : 0

      return {
        farmRewardsAmount: farmRewardsAmount > 0 ? farmRewardsAmount : undefined,
        farmRewardsUSD:
          infinityBinEarnings.data?.rewardsUSD && infinityBinEarnings.data.rewardsUSD > 0
            ? infinityBinEarnings.data.rewardsUSD
            : undefined,
        rewardCurrency: rewardsAmount?.currency,
      }
    }, [infinityBinEarnings.data])

    const earnings = useMemo(() => {
      const usd =
        typeof infinityBinEarnings.data?.rewardsUSD === 'number' && infinityBinEarnings.data.rewardsUSD > 0
          ? infinityBinEarnings.data.rewardsUSD
          : null
      const display = usd ? `~${formatDollarAmount(usd)}` : '$0'
      return { display }
    }, [infinityBinEarnings.data])

    // Price range using binPool data
    const priceRangeDisplay = useMemo(() => {
      const binStep = binPool?.binStep
      const activeId = binPool?.activeId

      if (
        position.minBinId === null ||
        position.minBinId === undefined ||
        position.maxBinId === null ||
        position.maxBinId === undefined ||
        !binStep ||
        activeId === null ||
        activeId === undefined
      )
        return null

      return calculateBinBasedPriceRange(position.minBinId, position.maxBinId, binStep, activeId, currency0, currency1)
    }, [binPool, position, currency0, currency1])

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
    const aprData = useInfinityBinPositionApr(infinityPool || ({} as InfinityPoolInfo), position)
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
          <InfinityBinPoolPositionAprButton pool={infinityPool} userPosition={position} textProps={{ bold: true }} />
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
            pos={position}
            showPositionFees
            closeOnOverlayClick
          />
        )}
      </>
    )
  },
)
