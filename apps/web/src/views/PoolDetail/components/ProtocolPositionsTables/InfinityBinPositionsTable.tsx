import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { AddIcon, Flex, FlexGap, MinusIcon, Tag, Text } from '@pancakeswap/uikit'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { displayApr } from '@pancakeswap/utils/displayApr'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import dayjs from 'dayjs'
import { useUnclaimedFarmRewardsUSDByPoolId } from 'hooks/infinity/useFarmReward'
import { usePoolById } from 'hooks/infinity/usePool'
import { usePoolKeyByPoolId } from 'hooks/infinity/usePoolKeyByPoolId'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'

import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { $path } from 'next-typesafe-url'
import router from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccountPositionDetailByPool } from 'state/farmsV4/hooks'
import { InfinityBinPositionDetail, POSITION_STATUS } from 'state/farmsV4/state/accountPositions/type'
import { InfinityBinPoolInfo } from 'state/farmsV4/state/type'
import { useChainIdByQuery } from 'state/info/hooks'
import { Tooltips } from 'components/Tooltips'
import { useFlipCurrentPrice } from 'views/PoolDetail/state/flipCurrentPrice'
import {
  AprData,
  calculateBinBasedPriceRange,
  calculateTotalApr,
  convertAprDataToNumbers,
  formatPoolDetailFiatNumber,
  getBinPositionStatus,
} from 'views/PoolDetail/utils'
import { AprTooltipContent } from 'views/universalFarms/components/PoolAprButtonV3/AprTooltipContent'
import { InfinityPositionActions } from 'views/universalFarms/components/PositionActions/InfinityPositionActions'
import { useInfinityPositionsData } from 'views/universalFarms/hooks/useInfinityPositions'
import { useInfinityBinPositionApr } from 'views/universalFarms/hooks/usePositionAPR'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { useAccount } from 'wagmi'
import { ActionButton } from '../styles'
import { InfinityBinEarningsCell } from './PoolEarningsCells'
import { PositionsTable } from './PositionsTable'
import { PriceRangeDisplay } from './PriceRangeDisplay'
import { PositionFilter } from './types'
import { EmptyPositionCard, LoadingCard } from './UtilityCards'

interface TransformedBinPosition {
  positionId: string
  tableRow: {
    tokenInfo: React.ReactElement
    liquidity: React.ReactElement
    earnings: React.ReactElement
    apr: React.ReactElement
    priceRange: React.ReactElement
    actions: React.ReactElement
    protocol: Protocol
    poolId: string
  }
  liquidityUSD: number
  totalApr: number
  aprData: AprData
  hasLiquidity?: boolean
}

interface InfinityBinPositionsTableProps {
  poolInfo: InfinityBinPoolInfo
}

// Helper function to transform position data for table - NO HOOKS ALLOWED
const transformInfinityBinPositionToTableRow = (
  position: InfinityBinPositionDetail,
  poolInfo: InfinityBinPoolInfo,
  pool: any,
  aprData: AprData,
  amount0: CurrencyAmount<any> | undefined,
  amount1: CurrencyAmount<any> | undefined,
  price0Usd: number | undefined,
  price1Usd: number | undefined,
  t: (key: string) => string,
  flipCurrentPrice: boolean,
) => {
  // Calculate actual price range from bin IDs for LBAMM using utility function
  const { removed, outOfRange } = getBinPositionStatus(position.status as POSITION_STATUS)

  const hasLiquidity = amount0?.greaterThan('0') || amount1?.greaterThan('0')

  const tokenInfo = (
    <FlexGap flexDirection="column" gap="4px">
      <FlexGap alignItems="center" gap="8px">
        <Text bold fontSize="16px">
          {poolInfo.token0?.symbol} / {poolInfo.token1?.symbol}
        </Text>
        {position.isStaked && !removed && !outOfRange && (
          <Tag variant="primary60" scale="sm">
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

  const liquidityUSD = new BN(amount0?.toExact() ?? 0)
    .times(price0Usd ?? 0)
    .plus(new BN(amount1?.toExact() ?? 0).times(price1Usd ?? 0))
    .toNumber()

  const liquidity = (
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
        <InfinityBinEarningsCell chainId={poolInfo.chainId} poolId={poolInfo.poolId} />
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

  // Use utility function for price range calculation
  const priceRangeData = calculateBinBasedPriceRange(
    position.minBinId,
    position.maxBinId,
    pool?.binStep,
    pool?.activeId,
    poolInfo.token0,
    poolInfo.token1,
    flipCurrentPrice,
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
            positionId: [Protocol.InfinityBIN, position.poolId.toString(), 'decrease'],
          },
          // @ts-ignore
          searchParams: {
            chain: CHAIN_QUERY_NAME[poolInfo.chainId],
            [PERSIST_CHAIN_KEY]: '1',
          },
        })}
        disabled={(position.status as POSITION_STATUS) === POSITION_STATUS.CLOSED}
        isIcon
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <MinusIcon />
      </ActionButton>
      <ActionButton
        as="a"
        href={$path({
          route: '/liquidity/add/[[...poolId]]',
          routeParams: {
            poolId: [poolInfo.chainId, 'infinity', poolInfo.poolId.toString()],
          },
          // @ts-ignore
          searchParams: {
            chain: CHAIN_QUERY_NAME[poolInfo.chainId],
            [PERSIST_CHAIN_KEY]: '1',
          },
        })}
        disabled={(position.status as POSITION_STATUS) === POSITION_STATUS.CLOSED}
        isIcon
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <AddIcon />
      </ActionButton>
    </FlexGap>
  )

  return {
    positionId: `${position.chainId}-${position.poolId}`,
    tableRow: {
      tokenInfo,
      liquidity,
      earnings,
      apr: aprDisplay,
      priceRange,
      actions,
      protocol: Protocol.InfinityBIN,
      poolId: position.poolId,
    },
    liquidityUSD,
    totalApr,
    hasLiquidity,
    aprData,
  }
}

const InfinityBinPositionRow: React.FC<{
  position: InfinityBinPositionDetail
  poolInfo: InfinityBinPoolInfo
  pool: any
  onRowDataReady: (data: TransformedBinPosition) => void
  flipCurrentPrice: boolean
}> = ({ position, poolInfo, pool, onRowDataReady, flipCurrentPrice }) => {
  const { t } = useTranslation()

  const aprData = useInfinityBinPositionApr(poolInfo, position)

  const amount0 = useMemo(
    () =>
      position?.reserveX && pool?.token0 ? CurrencyAmount.fromRawAmount(pool.token0, position.reserveX) : undefined,
    [position?.reserveX, pool?.token0],
  )
  const amount1 = useMemo(
    () =>
      position?.reserveY && pool?.token1 ? CurrencyAmount.fromRawAmount(pool.token1, position.reserveY) : undefined,
    [position?.reserveY, pool?.token1],
  )

  const { data: price0Usd } = useCurrencyUsdPrice(pool?.token0 ?? undefined, {
    enabled: Boolean(pool?.token0 && amount0?.greaterThan('0')),
  })
  const { data: price1Usd } = useCurrencyUsdPrice(pool?.token1 ?? undefined, {
    enabled: Boolean(pool?.token1 && amount1?.greaterThan('0')),
  })

  const convertedAprData = useMemo(() => convertAprDataToNumbers(aprData), [aprData])

  const transformedData = useMemo(() => {
    return transformInfinityBinPositionToTableRow(
      position,
      poolInfo,
      pool,
      convertedAprData,
      amount0,
      amount1,
      price0Usd,
      price1Usd,
      t,
      flipCurrentPrice,
    )
  }, [position, poolInfo, pool, convertedAprData, amount0, amount1, t, price0Usd, price1Usd, flipCurrentPrice])

  useEffect(() => {
    onRowDataReady(transformedData)
  }, [transformedData, onRowDataReady])

  return null // This component doesn't render anything
}

export const InfinityBinPositionsTable: React.FC<InfinityBinPositionsTableProps> = ({ poolInfo }) => {
  const { address: account } = useAccount()
  const chainId = useChainIdByQuery()

  const [flipCurrentPrice] = useFlipCurrentPrice()

  const [, pool] = usePoolById<'Bin'>(poolInfo.poolId as `0x${string}`, chainId)
  const { data: poolKey } = usePoolKeyByPoolId(poolInfo.poolId, chainId)

  const [filter, setFilter] = useState(PositionFilter.All)
  const [transformedPositions, setTransformedPositions] = useState<TransformedBinPosition[]>([])

  const { data: infinityBinData, isLoading } = useAccountPositionDetailByPool<Protocol.InfinityBIN>(
    chainId,
    account,
    poolInfo,
  )

  const { data: allInfinityPositions } = useInfinityPositionsData()

  const {
    data: { rewardsAmount, rewardsUSD },
    isLoading: isLoadingRewards,
  } = useUnclaimedFarmRewardsUSDByPoolId({
    poolId: poolInfo.poolId,
    chainId: poolInfo.chainId,
    address: account,
    timestamp: dayjs().startOf('hour').unix(),
  })

  // Create default position if there are unclaimed rewards but no position data
  const defaultPosition = useMemo((): InfinityBinPositionDetail => {
    return {
      status: POSITION_STATUS.CLOSED,
      chainId: poolInfo.chainId,
      protocol: poolInfo.protocol,
      poolKey,
      poolId: poolInfo.poolId,
      activeId: pool?.activeId ?? 0,
      reserveX: 0n,
      reserveY: 0n,
      maxBinId: null,
      minBinId: null,
      reserveOfBins: [],
      liquidity: 0n,
      activeLiquidity: 0n,
      poolActiveLiquidity: 0n,
    }
  }, [pool, poolKey, poolInfo])

  const positions = useMemo((): InfinityBinPositionDetail[] => {
    const positionData = infinityBinData || []

    // If there are rewards but no position, show the default position
    if (!isLoading && !isLoadingRewards && !positionData.length && rewardsAmount?.greaterThan('0')) {
      return [defaultPosition]
    }

    return positionData
  }, [infinityBinData, isLoading, isLoadingRewards, defaultPosition, rewardsAmount])

  const handleRowDataReady = useCallback((data: TransformedBinPosition) => {
    setTransformedPositions((prev) => {
      const existing = prev.find((p) => p.positionId === data.positionId)
      if (existing) {
        return prev.map((p) => (p.positionId === data.positionId ? data : p))
      }
      return [...prev, data]
    })
  }, [])

  // Smart update of transformed positions - only reset when structure changes, not data updates
  useEffect(() => {
    setTransformedPositions((prev) => {
      // Create position ID set for current positions
      const currentPositionIds = new Set(positions.map((p) => `${p.chainId}-${p.poolId}`))

      // Remove transformed positions that no longer exist
      const filteredPrev = prev.filter((tp) => currentPositionIds.has(tp.positionId))

      // If the filtered array has the same length as current positions, structure hasn't changed
      if (filteredPrev.length === positions.length) {
        return filteredPrev
      }

      // Structure changed, return filtered array and let individual rows populate new entries
      return filteredPrev
    })
  }, [positions])

  const positionRowComponents = useMemo(() => {
    if (!positions.length) return []

    return positions.map((position, index) => (
      <InfinityBinPositionRow
        key={`${position.chainId}-${position.poolId}-${index}`}
        position={position}
        poolInfo={poolInfo}
        pool={pool}
        onRowDataReady={handleRowDataReady}
        flipCurrentPrice={flipCurrentPrice}
      />
    ))
  }, [positions, poolInfo, pool, handleRowDataReady, flipCurrentPrice])

  const filteredPositions = useMemo(() => {
    if (!transformedPositions.length) return []

    // Helper function to determine position status priority for sorting
    const getPositionStatusPriority = (position: TransformedBinPosition): number => {
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

  if (isLoading) {
    return <LoadingCard />
  }

  if (!infinityBinData?.length && (!rewardsAmount || !rewardsAmount.greaterThan('0'))) {
    return <EmptyPositionCard />
  }

  return (
    <>
      {/* Hidden components that handle APR fetching for each position */}
      {positionRowComponents}

      {/* The actual table component */}
      <PositionsTable
        poolInfo={poolInfo}
        totalLiquidityUSD={totalLiquidityUSD}
        totalApr={totalAprValue}
        totalEarnings={formatPoolDetailFiatNumber(rewardsUSD)}
        data={tableRows}
        showInactiveOnly={filter === PositionFilter.Inactive}
        toggleInactiveOnly={() =>
          setFilter(filter === PositionFilter.Inactive ? PositionFilter.All : PositionFilter.Inactive)
        }
        harvestAllButton={
          <InfinityPositionActions positionList={positionList} showPositionFees={false} chainId={poolInfo.chainId} />
        }
        onRowClick={(position) => {
          router.push(
            $path({
              route: '/liquidity/position/[[...positionId]]',
              routeParams: { positionId: [position.protocol, position.poolId] },
              // @ts-ignore
              searchParams: {
                chain: CHAIN_QUERY_NAME[poolInfo.chainId],
                [PERSIST_CHAIN_KEY]: '1',
              },
            }),
          )
        }}
      />
    </>
  )
}
