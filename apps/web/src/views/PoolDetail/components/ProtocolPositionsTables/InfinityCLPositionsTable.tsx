import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { AddIcon, Flex, FlexGap, MinusIcon, Tag, Text } from '@pancakeswap/uikit'
import { displayApr } from '@pancakeswap/utils/displayApr'
import { PositionMath } from '@pancakeswap/v3-sdk'

import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import dayjs from 'dayjs'
import { useUnclaimedFarmRewardsUSDByPoolId } from 'hooks/infinity/useFarmReward'
import { usePoolById } from 'hooks/infinity/usePool'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { $path } from 'next-typesafe-url'
import router from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccountPositionDetailByPool } from 'state/farmsV4/hooks'
import { InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { InfinityCLPoolInfo } from 'state/farmsV4/state/type'
import { useChainIdByQuery } from 'state/info/hooks'
import { Tooltips } from 'components/Tooltips'
import { useFlipCurrentPrice } from 'views/PoolDetail/state/flipCurrentPrice'
import {
  AprData,
  calculateTickBasedPriceRange,
  calculateTickLimits,
  calculateTotalApr,
  convertAprDataToNumbers,
  formatPoolDetailFiatNumber,
  getTickAtLimitStatus,
  isTickBasedPositionOutOfRange,
  isTickBasedPositionRemoved,
} from 'views/PoolDetail/utils'
import { AprTooltipContent } from 'views/universalFarms/components/PoolAprButtonV3/AprTooltipContent'
import { InfinityPositionActions } from 'views/universalFarms/components/PositionActions/InfinityPositionActions'
import { useInfinityPositionsData } from 'views/universalFarms/hooks/useInfinityPositions'
import { useInfinityCLPositionApr } from 'views/universalFarms/hooks/usePositionAPR'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { ActionButton } from '../styles'
import { InfinityCLEarningsCell } from './PoolEarningsCells'
import { PositionsTable } from './PositionsTable'
import { PriceRangeDisplay } from './PriceRangeDisplay'
import { PositionFilter } from './types'
import { EmptyPositionCard, LoadingCard } from './UtilityCards'

// Interface for transformed position data
interface TransformedPosition {
  tokenId: string
  tableRow: {
    tokenInfo: React.ReactElement
    liquidity: React.ReactElement
    earnings: React.ReactElement
    apr: React.ReactElement
    priceRange: React.ReactElement
    actions: React.ReactElement
    protocol: Protocol
    tokenId: bigint
  }
  liquidityUSD: number
  totalApr: number
  aprData: AprData
}

interface InfinityCLPositionsTableProps {
  poolInfo: InfinityCLPoolInfo
}

// Helper function to transform position data for table - NO HOOKS ALLOWED
const transformInfinityCLPositionToTableRow = (
  position: InfinityCLPositionDetail,
  poolInfo: InfinityCLPoolInfo,
  pool: any,
  price0Usd: number | undefined,
  price1Usd: number | undefined,
  aprData: AprData,
  t: (key: string) => string,
  flipCurrentPrice?: boolean,
) => {
  // Calculate position amounts
  const { tickLower, tickUpper, liquidity } = position

  const amount0 = pool
    ? CurrencyAmount.fromRawAmount(
        pool.token0,
        PositionMath.getToken0Amount(pool.tickCurrent, tickLower, tickUpper, pool.sqrtRatioX96, liquidity),
      )
    : undefined
  const amount1 = pool
    ? CurrencyAmount.fromRawAmount(
        pool.token1,
        PositionMath.getToken1Amount(pool.tickCurrent, tickLower, tickUpper, pool.sqrtRatioX96, liquidity),
      )
    : undefined

  const liquidityUSD =
    amount0 && amount1 && price0Usd && price1Usd
      ? new BN(amount0.toExact()).times(price0Usd).plus(new BN(amount1.toExact()).times(price1Usd)).toNumber()
      : 0

  // TickLimits using utility function
  const ticksLimit = calculateTickLimits(position.tickSpacing)

  // Get tick at limit status using utility function
  const isTickAtLimit = getTickAtLimitStatus(position.tickLower, position.tickUpper, ticksLimit)

  // Position status using utility functions
  const outOfRange = isTickBasedPositionOutOfRange(pool, position.tickLower, position.tickUpper)
  const removed = isTickBasedPositionRemoved(position.liquidity)

  // Use utility function for price range calculation
  const priceRangeData = calculateTickBasedPriceRange(
    position.tickLower,
    position.tickUpper,
    poolInfo.token0,
    poolInfo.token1,
    pool,
    isTickAtLimit,
    flipCurrentPrice,
  )

  const tokenInfo = (
    <FlexGap flexDirection="column" gap="4px">
      <FlexGap alignItems="center" gap="8px">
        <Text bold fontSize="16px">
          {poolInfo.token0?.symbol} / {poolInfo.token1?.symbol}{' '}
          <Text as="span" color="textSubtle">
            #{position.tokenId.toString()}
          </Text>
        </Text>
        {position.isStaked && !removed && !outOfRange && (
          <Tag variant="primary60" scale="sm" px="6px">
            {t('Farming')}
          </Tag>
        )}
        {removed && (
          <Tag variant="tertiary" scale="sm" px="6px">
            {t('Closed')}
          </Tag>
        )}
      </FlexGap>
    </FlexGap>
  )

  const liquidityDisplay = (
    <Flex flexDirection="column" alignItems="flex-start">
      <Tooltips
        content={
          <FlexGap flexDirection="column" alignItems="flex-start" gap="8px">
            <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
              <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                <FlexGap alignItems="center" gap="8px">
                  <CurrencyLogo currency={poolInfo.token0} size="16px" mb="-3px" />
                  <Text fontSize="14px" bold>
                    {poolInfo.token0?.symbol}
                  </Text>
                </FlexGap>
                <Text fontSize="14px" bold>
                  {amount0?.toSignificant(6)}
                </Text>
              </FlexGap>
              <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                {amount0 && price0Usd
                  ? formatDollarAmount(new BN(amount0.toExact()).times(price0Usd).toNumber())
                  : '$0.00'}
              </Text>
            </FlexGap>
            <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
              <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                <FlexGap alignItems="center" gap="8px">
                  <CurrencyLogo currency={poolInfo.token1} size="16px" mb="-3px" />
                  <Text fontSize="14px" bold>
                    {poolInfo.token1?.symbol}
                  </Text>
                </FlexGap>
                <Text fontSize="14px" bold>
                  {amount1?.toSignificant(6)}
                </Text>
              </FlexGap>
              <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                {amount1 && price1Usd
                  ? formatDollarAmount(new BN(amount1.toExact()).times(price1Usd).toNumber())
                  : '$0.00'}
              </Text>
            </FlexGap>
          </FlexGap>
        }
      >
        <Text bold fontSize="16px" style={{ cursor: 'default' }}>
          {formatDollarAmount(liquidityUSD)}
        </Text>
      </Tooltips>
    </Flex>
  )

  const earnings = (
    <Flex flexDirection="column" alignItems="flex-start" style={{ cursor: 'default' }}>
      <Text bold fontSize="16px">
        <InfinityCLEarningsCell
          tokenId={position.tokenId}
          chainId={poolInfo.chainId}
          poolId={poolInfo.poolId}
          currency0={poolInfo.token0}
          currency1={poolInfo.token1}
          tickLower={position.tickLower}
          tickUpper={position.tickUpper}
          positionClosed={removed}
        />
      </Text>
    </Flex>
  )

  const totalApr = calculateTotalApr(convertAprDataToNumbers(aprData))
  const aprDisplay = (
    <Flex flexDirection="column" alignItems="flex-start" style={{ cursor: 'default' }}>
      <Tooltips
        content={
          <AprTooltipContent
            combinedApr={totalApr}
            lpFeeApr={Number(aprData.lpApr)}
            cakeApr={aprData.cakeApr ? { value: Number(aprData.cakeApr.value) } : undefined}
            merklApr={Number(aprData.merklApr)}
          />
        }
      >
        <Text bold fontSize="16px" color={totalApr > 0 ? 'success' : 'text'}>
          {displayApr(totalApr)}
        </Text>
      </Tooltips>
    </Flex>
  )

  const priceRange = (
    <PriceRangeDisplay
      minPrice={priceRangeData.minPriceFormatted}
      maxPrice={priceRangeData.maxPriceFormatted}
      minPercentage={priceRangeData.minPercentage}
      maxPercentage={priceRangeData.maxPercentage}
      rangePosition={priceRangeData.rangePosition}
      outOfRange={outOfRange}
      removed={removed}
      currentPrice={priceRangeData.currentPrice || pool?.token0Price?.toSignificant(18)}
      showPercentages={priceRangeData.showPercentages}
    />
  )

  const actions = (
    <FlexGap gap="8px" alignItems="center" justifyContent="flex-end">
      <ActionButton
        as="a"
        href={$path({
          route: '/liquidity/position/[[...positionId]]',
          routeParams: {
            positionId: [Protocol.InfinityCLAMM, Number(position.tokenId), 'decrease'],
          },
          // @ts-ignore
          searchParams: {
            chain: CHAIN_QUERY_NAME[poolInfo.chainId],
            [PERSIST_CHAIN_KEY]: '1',
          },
        })}
        disabled={removed}
        isIcon
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <MinusIcon />
      </ActionButton>
      <ActionButton
        as="a"
        href={$path({
          route: '/liquidity/position/[[...positionId]]',
          routeParams: {
            positionId: [Protocol.InfinityCLAMM, Number(position.tokenId), 'increase'],
          },
          // @ts-ignore
          searchParams: {
            chain: CHAIN_QUERY_NAME[poolInfo.chainId],
            [PERSIST_CHAIN_KEY]: '1',
          },
        })}
        disabled={removed}
        isIcon
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <AddIcon />
      </ActionButton>
    </FlexGap>
  )

  return {
    tokenId: position.tokenId.toString(),
    tableRow: {
      tokenInfo,
      liquidity: liquidityDisplay,
      earnings,
      apr: aprDisplay,
      priceRange,
      actions,
      // Add raw data for onRowClick handler
      protocol: Protocol.InfinityCLAMM,
      tokenId: position.tokenId,
    },
    liquidityUSD,
    totalApr,
    aprData,
  }
}

// Individual position row component that calls the APR hook
const InfinityCLPositionRow: React.FC<{
  position: InfinityCLPositionDetail
  poolInfo: InfinityCLPoolInfo
  pool: any
  price0Usd: number | undefined
  price1Usd: number | undefined
  flipCurrentPrice: boolean
  onRowDataReady: (data: TransformedPosition) => void
}> = ({ position, poolInfo, pool, price0Usd, price1Usd, flipCurrentPrice, onRowDataReady }) => {
  const { t } = useTranslation()

  // Individual APR hook call for each position
  const aprData = useInfinityCLPositionApr(poolInfo, position)

  // Use utility function to convert APR data
  const convertedAprData = useMemo(() => convertAprDataToNumbers(aprData), [aprData])

  // Transform the data with the fetched APR
  const transformedData = useMemo(() => {
    return transformInfinityCLPositionToTableRow(
      position,
      poolInfo,
      pool,
      price0Usd,
      price1Usd,
      convertedAprData,
      t,
      flipCurrentPrice,
    )
  }, [position, poolInfo, pool, price0Usd, price1Usd, convertedAprData, t, flipCurrentPrice])

  // Pass data back to parent whenever it changes
  useEffect(() => {
    onRowDataReady(transformedData)
  }, [transformedData, onRowDataReady])

  return null // This component doesn't render anything
}

export const InfinityCLPositionsTable: React.FC<InfinityCLPositionsTableProps> = ({ poolInfo }) => {
  const { account } = useAccountActiveChain()
  const chainId = useChainIdByQuery()

  const [flipCurrentPrice] = useFlipCurrentPrice()

  const [, pool] = usePoolById<'CL'>(poolInfo.poolId as `0x${string}`, chainId)
  const { data: price0Usd } = useCurrencyUsdPrice(poolInfo.token0, {
    enabled: !!poolInfo.token0,
  })
  const { data: price1Usd } = useCurrencyUsdPrice(poolInfo.token1, {
    enabled: !!poolInfo.token1,
  })

  const [filter, setFilter] = useState(PositionFilter.All)
  const [transformedPositions, setTransformedPositions] = useState<TransformedPosition[]>([])

  // Get position data from hooks
  const { data: positionsInPool, isLoading } = useAccountPositionDetailByPool<Protocol.InfinityCLAMM>(
    chainId,
    account,
    poolInfo,
  )

  // Get all infinity positions for the harvest modal
  const { data: allInfinityPositions } = useInfinityPositionsData()

  // Handle data from individual position rows
  const handleRowDataReady = useCallback((data: TransformedPosition) => {
    setTransformedPositions((prev) => {
      const existing = prev.find((p) => p.tokenId === data.tokenId)
      if (existing) {
        return prev.map((p) => (p.tokenId === data.tokenId ? data : p))
      }
      return [...prev, data]
    })
  }, [])

  // Smart update of transformed positions - only reset when structure changes, not data updates
  useEffect(() => {
    setTransformedPositions((prev) => {
      if (!positionsInPool) return prev

      // Create position ID set for current positions
      const currentPositionIds = new Set(positionsInPool.map((p) => p.tokenId.toString()))

      // Remove transformed positions that no longer exist
      const filteredPrev = prev.filter((tp) => currentPositionIds.has(tp.tokenId))

      // If the filtered array has the same length as current positions, structure hasn't changed
      if (filteredPrev.length === positionsInPool.length) {
        return filteredPrev
      }

      // Structure changed, return filtered array and let individual rows populate new entries
      return filteredPrev
    })
  }, [positionsInPool])

  // Create individual position row components that fetch APR data
  const positionDataFetchComponents = useMemo(() => {
    if (!positionsInPool) return []

    return positionsInPool.map((position) => (
      <InfinityCLPositionRow
        key={position.tokenId.toString()}
        position={position}
        poolInfo={poolInfo}
        pool={pool}
        price0Usd={price0Usd}
        price1Usd={price1Usd}
        flipCurrentPrice={flipCurrentPrice}
        onRowDataReady={handleRowDataReady}
      />
    ))
  }, [positionsInPool, poolInfo, pool, price0Usd, price1Usd, flipCurrentPrice, handleRowDataReady])

  const filteredPositions = useMemo(() => {
    if (!transformedPositions) return []

    // Helper function to determine position status priority for sorting
    const getPositionStatusPriority = (position: TransformedPosition): number => {
      const { totalApr, liquidityUSD } = position
      const hasLiquidity = liquidityUSD > 0

      if (hasLiquidity && totalApr > 0) return 1 // Active
      if (hasLiquidity && totalApr === 0) return 2 // Inactive
      if (!hasLiquidity) return 3 // Closed
      return 4 // Fallback
    }

    return transformedPositions
      .toSorted((positionA, positionB) => {
        // First sort by position status (Active, Inactive, Closed)
        const aPriority = getPositionStatusPriority(positionA)
        const bPriority = getPositionStatusPriority(positionB)

        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }

        // Then sort by liquidity within each status group (highest first)
        const aLiquidity = positionA.liquidityUSD
        const bLiquidity = positionB.liquidityUSD
        return bLiquidity > aLiquidity ? 1 : -1
      })
      .filter((position) => {
        const { totalApr, liquidityUSD } = position
        const hasLiquidity = liquidityUSD > 0

        switch (filter) {
          case PositionFilter.Active:
            return hasLiquidity && totalApr > 0
          case PositionFilter.Inactive:
            return hasLiquidity && totalApr === 0
          case PositionFilter.Closed:
            return !hasLiquidity
          default:
            return true
        }
      })
  }, [transformedPositions, filter])

  const {
    data: { rewardsUSD },
  } = useUnclaimedFarmRewardsUSDByPoolId({
    poolId: poolInfo.poolId,
    chainId: poolInfo.chainId,
    address: account,
    timestamp: dayjs().startOf('hour').unix(),
  })

  // APR Calculation
  const [numerator, denominator] = useMemo(() => {
    return transformedPositions.reduce(
      (sum, pos) => {
        const { numerator, denominator } = convertAprDataToNumbers(pos.aprData)
        if (numerator.isZero()) {
          return sum
        }
        return [sum[0].plus(numerator), sum[1].plus(denominator)]
      },
      [BIG_ZERO, BIG_ZERO],
    )
  }, [transformedPositions])

  const totalAprValue = useMemo(() => {
    return denominator.isZero() ? 0 : numerator.div(denominator).toNumber()
  }, [numerator, denominator])

  const positionList = useMemo(() => allInfinityPositions || [], [allInfinityPositions])

  const tableRows = useMemo(() => filteredPositions?.map((position) => position.tableRow) || [], [filteredPositions])

  const totalLiquidityUSD = useMemo(() => {
    return filteredPositions?.reduce((sum, pos) => sum + (pos.liquidityUSD || 0), 0) || 0
  }, [filteredPositions])

  // Show loading state
  if (isLoading) {
    return <LoadingCard />
  }

  // Show empty state when no positions exist
  if (!positionsInPool || positionsInPool.length === 0) {
    return <EmptyPositionCard />
  }

  return (
    <>
      <PositionsTable
        poolInfo={poolInfo}
        totalLiquidityUSD={totalLiquidityUSD}
        totalEarnings={formatPoolDetailFiatNumber(rewardsUSD)}
        totalApr={totalAprValue}
        data={tableRows}
        showInactiveOnly={filter === PositionFilter.Inactive}
        toggleInactiveOnly={() =>
          setFilter(filter === PositionFilter.Inactive ? PositionFilter.All : PositionFilter.Inactive)
        }
        harvestAllButton={
          <InfinityPositionActions positionList={positionList} showPositionFees={false} chainId={poolInfo.chainId} />
        }
        // On row click, navigate to the position detail page
        onRowClick={(position) => {
          router.push(
            $path({
              route: '/liquidity/position/[[...positionId]]',
              routeParams: { positionId: [position.protocol, new BN(position.tokenId).toNumber()] },
              // @ts-ignore
              searchParams: {
                chain: CHAIN_QUERY_NAME[poolInfo.chainId],
                [PERSIST_CHAIN_KEY]: '1',
              },
            }),
          )
        }}
      />

      {/* handles APR fetching for each position */}
      {positionDataFetchComponents}
    </>
  )
}
