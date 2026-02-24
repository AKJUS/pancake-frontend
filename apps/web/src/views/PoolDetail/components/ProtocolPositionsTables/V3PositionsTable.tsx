import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { AddIcon, Box, Flex, FlexGap, MinusIcon, Tag, Text } from '@pancakeswap/uikit'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { displayApr } from '@pancakeswap/utils/displayApr'
import { formatAmount } from '@pancakeswap/utils/formatInfoNumbers'
import { PositionMath } from '@pancakeswap/v3-sdk'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { BigNumber } from 'bignumber.js'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { usePoolByChainId } from 'hooks/v3/usePools'
import router from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useAccountPositionDetailByPool,
  useExtraV3PositionInfo,
  useV3PoolsLength,
  useV3PoolStatus,
} from 'state/farmsV4/hooks'
import { PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { getPoolMultiplier } from 'state/farmsV4/state/utils'
import { useChainIdByQuery } from 'state/info/hooks'
import { currencyId } from 'utils/currencyId'
import { Tooltips } from 'components/Tooltips'
import { useFarmsV3BatchHarvest } from 'views/Farms/hooks/v3/useFarmV3Actions'
import { useV3Positions } from 'views/PoolDetail/hooks/useV3Positions'
import { useFlipCurrentPrice } from 'views/PoolDetail/state/flipCurrentPrice'
import {
  AprData,
  calculateTickBasedPriceRange,
  calculateTickLimits,
  calculateTotalApr,
  convertAprDataToNumbers,
  formatPercentage,
  formatPoolDetailFiatNumber,
  getTickAtLimitStatus,
  getTickSpacing,
  isTickBasedPositionOutOfRange,
  isTickBasedPositionRemoved,
} from 'views/PoolDetail/utils'
import { PriceRange } from 'views/universalFarms/components'
import { AprTooltipContent } from 'views/universalFarms/components/PoolAprButtonV3/AprTooltipContent'
import { V3PositionActions } from 'views/universalFarms/components/PositionActions/V3PositionActions'
import { V3UnstakeModalContent } from 'views/universalFarms/components/PositionActions/V3UnstakeModalContent'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { useV3CakeEarningsByPool } from 'views/universalFarms/hooks/useCakeEarning'
import { useV3PositionApr } from 'views/universalFarms/hooks/usePositionAPR'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { useAccount } from 'wagmi'
import { getMasterChefV3Address } from 'utils/addressHelpers'
import { ActionButton, PrimaryOutlineButton } from '../styles'
import { V3EarningsCell } from './PoolEarningsCells'
import { PositionsTable } from './PositionsTable'
import { PriceRangeDisplay } from './PriceRangeDisplay'
import { PositionFilter } from './types'
import { EmptyPositionCard, LoadingCard } from './UtilityCards'

// Interface for transformed V3 position data
interface TransformedV3Position {
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
    liquidityUSD: number
    isStaked: boolean
  }
  liquidityUSD: number
  totalApr: number
  aprData: AprData
  isStaked: boolean
}

interface V3PositionsTableProps {
  poolInfo: PoolInfo
}

const V3Actions = ({
  position,
  poolInfo,
  liquidityUSD,
}: {
  position: PositionDetail
  poolInfo: PoolInfo
  liquidityUSD: number
}) => {
  const {
    quote,
    base,
    priceUpper,
    priceLower,
    tickAtLimit,
    removed,
    outOfRange,
    position: positionInfo,
  } = useExtraV3PositionInfo(position)

  const amount0 = positionInfo?.amount0
  const amount1 = positionInfo?.amount1

  const { data: poolsLength } = useV3PoolsLength([poolInfo.chainId])
  const [allocPoint] = useV3PoolStatus(poolInfo)
  const poolMultiplier = getPoolMultiplier(allocPoint)

  const poolLength = useMemo(() => poolsLength?.[poolInfo.chainId], [poolsLength, poolInfo.chainId])
  const pid = useMemo(() => poolInfo?.pid, [poolInfo])
  const isFarmLive = useMemo(
    () => poolMultiplier !== `0X` && (!poolLength || !pid || pid <= poolLength),
    [pid, poolLength, poolMultiplier],
  )

  const desc = useMemo(() => {
    return base && quote ? (
      <Box mt="8px">
        <PriceRange
          base={base}
          quote={quote}
          priceLower={priceLower}
          priceUpper={priceUpper}
          tickAtLimit={tickAtLimit}
        />
      </Box>
    ) : null
  }, [base, quote, priceLower, priceUpper, tickAtLimit])

  return (
    <FlexGap gap="8px" alignItems="center" justifyContent="flex-end">
      {((!isFarmLive && !position.isStaked) || removed) && (
        <>
          <ActionButton
            as="a"
            href={`/remove/${position.tokenId.toString()}?chain=${CHAIN_QUERY_NAME[poolInfo.chainId]}&${[
              PERSIST_CHAIN_KEY,
            ]}=1`}
            disabled={removed}
            isIcon
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <MinusIcon />
          </ActionButton>

          <ActionButton
            as="a"
            href={`/increase/${currencyId(poolInfo.token0.wrapped)}/${currencyId(
              poolInfo.token1.wrapped,
            )}/${poolInfo.feeTier.toString()}/${position.tokenId.toString()}?chain=${
              CHAIN_QUERY_NAME[poolInfo.chainId]
            }&${[PERSIST_CHAIN_KEY]}=1`}
            disabled={removed}
            isIcon
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <AddIcon />
          </ActionButton>
        </>
      )}

      <V3PositionActions
        chainId={poolInfo.chainId}
        isStaked={position.isStaked}
        isFarmLive={isFarmLive}
        removed={removed}
        outOfRange={outOfRange}
        tokenId={position.tokenId}
        detailMode
        modalContent={
          <V3UnstakeModalContent
            chainId={poolInfo.chainId}
            userPosition={position}
            link={`/liquidity/${position.tokenId}?chain=${CHAIN_QUERY_NAME[poolInfo.chainId]}&${[PERSIST_CHAIN_KEY]}=1`}
            pool={poolInfo}
            totalPriceUSD={liquidityUSD}
            desc={desc}
            amount0={amount0}
            amount1={amount1}
            currency0={poolInfo.token0}
            currency1={poolInfo.token1}
            removed={removed}
            outOfRange={outOfRange}
            fee={position.fee}
            feeTierBase={1_000_000}
            protocol={position.protocol}
            isStaked={position.isStaked}
            tokenId={position.tokenId}
            detailMode={false}
          />
        }
      />
    </FlexGap>
  )
}

// Helper function to transform position data for table - NO HOOKS ALLOWED
const transformV3PositionToTableRow = (
  position: PositionDetail,
  poolInfo: PoolInfo,
  positionsData: any[],
  price0Usd: number | undefined,
  price1Usd: number | undefined,
  pool: any,
  aprData: AprData,
  t: (key: string) => string,
  flipCurrentPrice: boolean,
) => {
  const positionData = positionsData?.find((p) => Number(p.tokenId) === Number(position.tokenId))

  let liquidityUSD = 0
  let amount0 = BIG_ZERO
  let amount1 = BIG_ZERO

  // Calculate liquidityUSD using pool and position data
  if (position.liquidity > 0n && pool) {
    try {
      const { tickCurrent } = pool
      const amount0Raw = PositionMath.getToken0Amount(
        tickCurrent,
        position.tickLower,
        position.tickUpper,
        pool.sqrtRatioX96,
        position.liquidity,
      )
      const amount1Raw = PositionMath.getToken1Amount(
        tickCurrent,
        position.tickLower,
        position.tickUpper,
        pool.sqrtRatioX96,
        position.liquidity,
      )

      // Convert from raw amounts to readable amounts
      amount0 = new BigNumber(amount0Raw.toString()).div(10 ** (poolInfo.token0.wrapped?.decimals || 18))
      amount1 = new BigNumber(amount1Raw.toString()).div(10 ** (poolInfo.token1.wrapped?.decimals || 18))

      if (price0Usd && price1Usd) {
        liquidityUSD = amount0.times(price0Usd).plus(amount1.times(price1Usd)).toNumber()
      }
    } catch (error) {
      console.error('Manual liquidity calculation failed:', error)
    }
  }

  const outOfRange = isTickBasedPositionOutOfRange(pool, position.tickLower, position.tickUpper)
  const removed = isTickBasedPositionRemoved(position.liquidity)
  const isStaked = Boolean(position.isStaked)

  // Get tick spacing using utility function
  const tickSpacing = getTickSpacing(pool, poolInfo.feeTier)

  // Calculate tick limits using utility function
  const ticksLimit = calculateTickLimits(tickSpacing)

  // Get tick at limit status using utility function
  const isTickAtLimit = getTickAtLimitStatus(position.tickLower, position.tickUpper, ticksLimit)

  // Use utility function for main price range calculation
  let priceRangeData = calculateTickBasedPriceRange(
    position.tickLower,
    position.tickUpper,
    poolInfo.token0.wrapped,
    poolInfo.token1.wrapped,
    pool,
    isTickAtLimit,
    flipCurrentPrice,
  )

  // V3-specific fallback: Use positionData prices if available and tick-based calculation didn't show percentages
  if (positionData && !priceRangeData.showPercentages) {
    try {
      // Use higher precision (18 significant digits) to avoid precision loss for small numbers
      let positionMinPrice = parseFloat(positionData.token0PriceLower.toFixed(18))
      let positionMaxPrice = parseFloat(positionData.token0PriceUpper.toFixed(18))

      // When flipped, invert prices and swap min/max
      if (flipCurrentPrice) {
        const invertedMin = 1 / positionMaxPrice
        const invertedMax = 1 / positionMinPrice
        positionMinPrice = invertedMin
        positionMaxPrice = invertedMax
      }

      if (Number.isFinite(positionMinPrice) && Number.isFinite(positionMaxPrice)) {
        const updatedMinPriceFormatted = formatAmount(positionMinPrice, { notation: 'standard' }) || '-'
        const updatedMaxPriceFormatted = formatAmount(positionMaxPrice, { notation: 'standard' }) || '-'
        let updatedMinPercentage = ''
        let updatedMaxPercentage = ''
        let updatedRangePosition = 50
        let updatedShowPercentages = false

        // Try percentage calculation with positionData prices
        if (pool?.token0Price && positionMaxPrice > positionMinPrice) {
          // Use the correct current price based on flip state
          let basePrice
          if (flipCurrentPrice) {
            // Use token1Price if available, otherwise invert token0Price
            basePrice = pool.token1Price || pool.token0Price?.invert?.()
          } else {
            basePrice = pool.token0Price
          }

          if (basePrice) {
            // Use higher precision (18 significant digits) for current price calculation
            const currentPrice = parseFloat(basePrice.toFixed(18))

            if (currentPrice > 0 && Number.isFinite(currentPrice)) {
              const minPercent = ((positionMinPrice - currentPrice) / currentPrice) * 100
              const maxPercent = ((positionMaxPrice - currentPrice) / currentPrice) * 100

              if (
                Number.isFinite(minPercent) &&
                Number.isFinite(maxPercent) &&
                Math.abs(minPercent) < 10000 &&
                Math.abs(maxPercent) < 10000
              ) {
                updatedMinPercentage = formatPercentage(minPercent)
                updatedMaxPercentage = formatPercentage(maxPercent)
                updatedRangePosition = Math.max(
                  0,
                  Math.min(100, ((currentPrice - positionMinPrice) / (positionMaxPrice - positionMinPrice)) * 100),
                )
                updatedShowPercentages = true
              }
            }
          }
        }

        // Update priceRangeData with fallback values, preserving the original currentPrice
        priceRangeData = {
          minPriceFormatted: updatedMinPriceFormatted,
          maxPriceFormatted: updatedMaxPriceFormatted,
          minPercentage: updatedMinPercentage,
          maxPercentage: updatedMaxPercentage,
          rangePosition: updatedRangePosition,
          showPercentages: updatedShowPercentages,
          currentPrice: priceRangeData.currentPrice, // Preserve the original calculated current price
        }
      }
    } catch (error) {
      console.warn('Position data price calculation error:', error)
    }
  }

  const tokenInfo = (
    <FlexGap flexDirection="column" gap="4px">
      <FlexGap alignItems="center" gap="8px">
        <Text bold fontSize="16px">
          {poolInfo.token0.wrapped?.symbol} / {poolInfo.token1.wrapped?.symbol}{' '}
          <Text as="span" color="textSubtle">
            #{position.tokenId.toString()}
          </Text>
        </Text>
        {isStaked && !removed && !outOfRange && (
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

  const liquidity = (
    <Flex flexDirection="column" alignItems="flex-start">
      <Tooltips
        content={
          <FlexGap flexDirection="column" alignItems="flex-start" gap="8px">
            <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
              <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                <FlexGap alignItems="center" gap="8px">
                  <CurrencyLogo currency={poolInfo.token0.wrapped} size="16px" mb="-3px" />
                  <Text fontSize="14px" bold>
                    {poolInfo.token0.wrapped?.symbol}
                  </Text>
                </FlexGap>
                <Text fontSize="14px" bold>
                  {formatAmount(amount0.toNumber())}
                </Text>
              </FlexGap>
              <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                {amount0 && price0Usd ? formatDollarAmount(amount0.times(price0Usd).toNumber()) : '$0.00'}
              </Text>
            </FlexGap>
            <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
              <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                <FlexGap alignItems="center" gap="8px">
                  <CurrencyLogo currency={poolInfo.token1.wrapped} size="16px" mb="-3px" />
                  <Text fontSize="14px" bold>
                    {poolInfo.token1.wrapped?.symbol}
                  </Text>
                </FlexGap>
                <Text fontSize="14px" bold>
                  {formatAmount(amount1.toNumber())}
                </Text>
              </FlexGap>
              <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                {amount1 && price1Usd ? formatDollarAmount(amount1.times(price1Usd).toNumber()) : '$0.00'}
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
        <V3EarningsCell
          tokenId={position.tokenId}
          chainId={poolInfo.chainId}
          pool={pool}
          currency0={poolInfo.token0}
          currency1={poolInfo.token1}
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
      currentPrice={priceRangeData.currentPrice || pool?.token0Price?.toFixed(18)}
      showPercentages={priceRangeData.showPercentages}
      minPriceRaw={priceRangeData.minPrice}
      maxPriceRaw={priceRangeData.maxPrice}
      currentPriceRaw={priceRangeData.currentPriceValue}
    />
  )

  const actions = <V3Actions position={position} poolInfo={poolInfo} liquidityUSD={liquidityUSD} />

  return {
    tokenId: position.tokenId.toString(),
    tableRow: {
      tokenInfo,
      liquidity,
      earnings,
      apr: aprDisplay,
      priceRange,
      actions,
      // Add raw data for onRowClick handler
      protocol: position.protocol,
      tokenId: position.tokenId,
      liquidityUSD,
      isStaked,
    },
    totalApr,
    liquidityUSD,
    aprData,
    isStaked,
  }
}

// Individual position row component that calls the APR hook
const V3PositionRow: React.FC<{
  position: PositionDetail
  poolInfo: PoolInfo
  positionsData: any[]
  price0Usd: number | undefined
  price1Usd: number | undefined
  pool: any
  onRowDataReady: (data: TransformedV3Position) => void
  flipCurrentPrice: boolean
}> = ({ position, poolInfo, positionsData, price0Usd, price1Usd, pool, onRowDataReady, flipCurrentPrice }) => {
  const { t } = useTranslation()

  const aprData = useV3PositionApr(poolInfo, position)

  // Use utility function to convert APR data
  const convertedAprData = useMemo(() => convertAprDataToNumbers(aprData), [aprData])

  const transformedData = useMemo(() => {
    return transformV3PositionToTableRow(
      position,
      poolInfo,
      positionsData,
      price0Usd,
      price1Usd,
      pool,
      convertedAprData,
      t,
      flipCurrentPrice,
    )
  }, [position, poolInfo, positionsData, price0Usd, price1Usd, pool, convertedAprData, t, flipCurrentPrice])

  // Pass data back to parent whenever it changes
  useEffect(() => {
    onRowDataReady(transformedData)
  }, [transformedData, onRowDataReady])

  return null // This component doesn't render anything
}

export const V3PositionsTable: React.FC<V3PositionsTableProps> = ({ poolInfo }) => {
  const { t } = useTranslation()
  const { address: account } = useAccount()
  const chainId = useChainIdByQuery()

  // check if masterchef v3 is deployed on this chain
  const masterchefV3Address = getMasterChefV3Address(chainId)
  const isMasterChefV3Available = masterchefV3Address && masterchefV3Address !== '0x'

  const [flipCurrentPrice] = useFlipCurrentPrice()

  const [, pool] = usePoolByChainId(poolInfo.token0.wrapped, poolInfo.token1.wrapped, poolInfo.feeTier)
  const { data: price0Usd } = useCurrencyUsdPrice(poolInfo.token0.wrapped, {
    enabled: !!poolInfo.token0.wrapped,
  })
  const { data: price1Usd } = useCurrencyUsdPrice(poolInfo.token1.wrapped, {
    enabled: !!poolInfo.token1.wrapped,
  })

  const [filter, setFilter] = useState(PositionFilter.All)
  const [transformedPositions, setTransformedPositions] = useState<TransformedV3Position[]>([])

  // Get position data from hooks
  const { data: v3Data, isLoading } = useAccountPositionDetailByPool(chainId, account, poolInfo)

  // Memoize the filtered v3Data to avoid recreating the array on every render
  const filteredV3Data = useMemo(() => {
    return (v3Data as PositionDetail[])?.filter((position) => position.liquidity !== 0n)
  }, [v3Data])

  const positionsData = useV3Positions(
    chainId,
    poolInfo.token0.wrapped.address,
    poolInfo.token1.wrapped.address,
    poolInfo.feeTier,
    filteredV3Data,
  )

  const [loading, setLoading] = useState(false)

  const { earningsBusd, hasEarnings, isLoading: isEarningsLoading } = useV3CakeEarningsByPool(poolInfo)
  const { switchNetworkIfNecessary, isLoading: isSwitchingNetwork } = useCheckShouldSwitchNetwork()

  const { onHarvestAll } = useFarmsV3BatchHarvest()

  const handleHarvestAll = useCallback(async () => {
    if (loading || !onHarvestAll || !v3Data) return

    const shouldSwitch = await switchNetworkIfNecessary(chainId)
    if (shouldSwitch) {
      return
    }
    try {
      setLoading(true)

      const tokenIds = (v3Data as PositionDetail[])?.filter((p) => p.isStaked).map((p) => p.tokenId.toString())

      await onHarvestAll(tokenIds)

      setLoading(false)
    } catch (error) {
      console.error(error)
      setLoading(false)
    }
  }, [loading, setLoading, chainId, switchNetworkIfNecessary, onHarvestAll, v3Data])

  // Handle data from individual position rows
  const handleRowDataReady = useCallback((data: TransformedV3Position) => {
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
      if (!v3Data) return prev

      // Create position ID set for current positions
      const currentPositionIds = new Set((v3Data as PositionDetail[]).map((p) => p.tokenId.toString()))

      // Remove transformed positions that no longer exist
      const filteredPrev = prev.filter((tp) => currentPositionIds.has(tp.tokenId))

      // If the filtered array has the same length as current positions, structure hasn't changed
      if (filteredPrev.length === (v3Data as PositionDetail[]).length) {
        return filteredPrev
      }

      // Structure changed, return filtered array and let individual rows populate new entries
      return filteredPrev
    })
  }, [v3Data])

  // Create individual position row components that fetch APR data
  const positionRowComponents = useMemo(() => {
    if (!v3Data || !positionsData) return []

    return (v3Data as PositionDetail[]).map((position) => (
      <V3PositionRow
        key={position.tokenId.toString()}
        position={position}
        poolInfo={poolInfo}
        positionsData={positionsData}
        price0Usd={price0Usd}
        price1Usd={price1Usd}
        pool={pool}
        onRowDataReady={handleRowDataReady}
        flipCurrentPrice={flipCurrentPrice}
      />
    ))
  }, [v3Data, poolInfo, positionsData, price0Usd, price1Usd, pool, handleRowDataReady, flipCurrentPrice])

  const filteredPositions = useMemo(() => {
    if (!transformedPositions) return []

    // Helper function to determine position status priority for sorting
    const getPositionStatusPriority = (position: TransformedV3Position): number => {
      const { totalApr, liquidityUSD, isStaked } = position
      const hasLiquidity = liquidityUSD > 0

      if (hasLiquidity && totalApr > 0 && isStaked) return 1 // Active with farm
      if (hasLiquidity && totalApr > 0) return 2 // Active without farm
      if (hasLiquidity && totalApr === 0 && isStaked) return 3 // Inactive with farm
      if (hasLiquidity && totalApr === 0) return 4 // Inactive without farm
      if (!hasLiquidity) return 5 // Closed
      return 6 // Fallback
    }

    return transformedPositions
      .toSorted((positionA, positionB) => {
        // First sort by position status (Active with farm, Active without farm, Inactive with farm, Inactive without farm, Closed)
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

  // Show loading state
  if (isLoading) {
    return <LoadingCard />
  }

  // Show empty state when no positions exist
  if (!v3Data || (v3Data as PositionDetail[]).length === 0) {
    return <EmptyPositionCard />
  }

  return (
    <>
      {/* Components that handle APR fetching for each position */}
      {positionRowComponents}

      <PositionsTable
        poolInfo={poolInfo}
        totalLiquidityUSD={filteredPositions.reduce((sum, pos) => sum + pos.liquidityUSD, 0)}
        totalApr={totalAprValue}
        totalEarnings={formatPoolDetailFiatNumber(earningsBusd)}
        data={filteredPositions.map((position) => position.tableRow)}
        showInactiveOnly={filter === PositionFilter.Inactive}
        toggleInactiveOnly={() =>
          setFilter(filter === PositionFilter.Inactive ? PositionFilter.All : PositionFilter.Inactive)
        }
        harvestAllButton={
          <PrimaryOutlineButton
            onClick={handleHarvestAll}
            disabled={loading || isEarningsLoading || isSwitchingNetwork || !isMasterChefV3Available || !hasEarnings}
          >
            {loading ? t('Harvesting...') : t('Harvest All')}
          </PrimaryOutlineButton>
        }
        // On row click, navigate to the position detail page
        onRowClick={(position) => {
          router.push(`/liquidity/${position.tokenId}?chain=${CHAIN_QUERY_NAME[chainId]}&${PERSIST_CHAIN_KEY}=1`)
        }}
      />
    </>
  )
}
