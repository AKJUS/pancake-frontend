import { TickUtils, TokenInfo, MAX_TICK, MIN_TICK } from '@pancakeswap/solana-core-sdk'
import { Percent, Price } from '@pancakeswap/swap-sdk-core'
import { convertRawTokenInfoIntoSPLToken } from 'config/solana-list'
import { useMemo } from 'react'
import { SolanaV3Pool } from 'state/pools/solana'
import BigNumber from 'bignumber.js'
import { calculateSolanaTickLimits, getTickAtLimitStatus } from 'views/PoolDetail/utils'
import { Bound } from '@pancakeswap/widgets-internal'
import { formatPercentage } from 'views/PoolDetail/utils/formatting'

export type PriceRangeProps = {
  tickLower: number
  tickUpper: number
  baseIn: boolean
  poolInfo?: SolanaV3Pool
  /** Optional: poolId and pair symbols (e.g. "ETH/CAKE") for [RangeDebug] logs */
  debugMeta?: { poolId?: string; pairSymbols?: string }
}

export interface PriceRangeData {
  minPriceFormatted: string
  maxPriceFormatted: string
  minPercentage: string
  maxPercentage: string
  rangePosition: number
  showPercentages: boolean
  currentPrice?: string
  // Raw numeric values for validation (avoid parsing formatted strings)
  minPrice?: number
  maxPrice?: number
  currentPriceValue?: number
}

/**
 * Safely converts tick to price using Solana SDK with maximum precision
 * Used in Solana price range calculations
 */
const getTickPrice = (
  tick: number,
  poolInfo: SolanaV3Pool,
  baseIn: boolean,
  debugMeta?: { poolId?: string; pairSymbols?: string },
): number => {
  try {
    // Use TickUtils constants for bounds checking
    if (tick >= MAX_TICK) {
      return Infinity
    }
    if (tick <= MIN_TICK) {
      return 0
    }

    // Use the Solana SDK's getTickPrice function for accurate calculation
    const tickPrice = TickUtils.getTickPrice({
      poolInfo,
      tick,
      baseIn,
    })

    const priceValue = parseFloat(tickPrice.price.toFixed(18))
    return priceValue
  } catch (error) {
    console.error('Error calculating tick price:', error)
    const basePrice = 1.0001 ** tick
    const fallbackPrice = baseIn ? basePrice : 1 / basePrice
    return fallbackPrice
  }
}

export const usePriceRange = ({ tickLower, tickUpper, baseIn, poolInfo }: PriceRangeProps) => {
  const currency0 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo?.mintA as TokenInfo), [poolInfo?.mintA])
  const currency1 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo?.mintB as TokenInfo), [poolInfo?.mintB])
  const tickAtLimit = useMemo(() => {
    const tickLimits = calculateSolanaTickLimits(poolInfo?.config.tickSpacing)
    return getTickAtLimitStatus(tickLower, tickUpper, tickLimits)
  }, [poolInfo?.config.tickSpacing, tickLower, tickUpper])
  const currentPrice = useMemo(() => {
    if (!currency0 || !currency1 || !poolInfo) {
      return undefined
    }
    const price = Price.fromDecimal(currency0, currency1, new BigNumber(poolInfo.price.toString()).toFixed())
    return baseIn ? price : price?.invert()
  }, [currency0, currency1, poolInfo, baseIn])
  const [priceUpper, priceLower] = useMemo(() => {
    if (!currency0 || !currency1 || !poolInfo) {
      return [undefined, undefined]
    }
    const [upper, lower] = [
      TickUtils.getTickPrice({
        poolInfo,
        tick: tickUpper,
        baseIn,
      }),
      TickUtils.getTickPrice({
        poolInfo,
        tick: tickLower,
        baseIn,
      }),
    ]

    return [
      Price.fromDecimal(currency0, currency1, new BigNumber(upper.price.toString()).toFixed()),
      Price.fromDecimal(currency0, currency1, new BigNumber(lower.price.toString()).toFixed()),
    ]
  }, [poolInfo, tickUpper, tickLower, currency0, currency1, baseIn, tickAtLimit])

  const priceUpperDiffPercent = useMemo(() => {
    if (!priceUpper || !currentPrice || currentPrice.equalTo(0)) {
      return undefined
    }
    const upperAtLimit = baseIn ? tickAtLimit[Bound.UPPER] : tickAtLimit[Bound.LOWER]
    if (upperAtLimit) {
      return new Percent(1, 1)
    }
    const diff = priceUpper.subtract(currentPrice).divide(currentPrice)
    return new Percent(diff.numerator, diff.denominator)
  }, [priceUpper, currentPrice, tickAtLimit, baseIn])

  const priceLowerDiffPercent = useMemo(() => {
    if (!priceLower || !currentPrice) {
      return undefined
    }
    const diff = priceLower.subtract(currentPrice).divide(currentPrice)
    return new Percent(diff.numerator, diff.denominator)
  }, [priceLower, currentPrice])

  return {
    currentPrice,
    priceUpper,
    priceLower,
    priceUpperDiffPercent,
    priceLowerDiffPercent,
  }
}

/**
 * Hook for calculating detailed price range data for Solana V3 positions
 * Based on calculateTickBasedPriceRange from priceRange.ts
 */
export const usePriceRangeData = ({
  tickLower,
  tickUpper,
  baseIn,
  poolInfo,
  debugMeta,
}: PriceRangeProps): PriceRangeData => {
  const currency0 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo?.mintA as TokenInfo), [poolInfo?.mintA])
  const currency1 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo?.mintB as TokenInfo), [poolInfo?.mintB])

  const tickAtLimit = useMemo(() => {
    const tickLimits = calculateSolanaTickLimits(poolInfo?.config.tickSpacing)
    const limitStatus = getTickAtLimitStatus(tickLower, tickUpper, tickLimits)
    return limitStatus
  }, [poolInfo?.config.tickSpacing, tickLower, tickUpper])

  return useMemo(() => {
    let minPriceFormatted = '-'
    let maxPriceFormatted = '-'
    let minPercentage = ''
    let maxPercentage = ''
    let rangePosition = 50
    let showPercentages = false
    let currentPriceString: string | undefined

    if (!poolInfo || !currency0 || !currency1) {
      return {
        minPriceFormatted,
        maxPriceFormatted,
        minPercentage,
        maxPercentage,
        rangePosition,
        showPercentages,
        currentPrice: currentPriceString,
      }
    }

    // When baseIn is false (flipped), we need to swap the tick order because inverting prices reverses the range
    const actualTickLower = baseIn ? tickLower : tickUpper
    const actualTickUpper = baseIn ? tickUpper : tickLower
    const actualIsTickAtLimit = baseIn
      ? tickAtLimit
      : {
          [Bound.LOWER]: tickAtLimit[Bound.UPPER],
          [Bound.UPPER]: tickAtLimit[Bound.LOWER],
        }

    // Calculate prices using tick-to-price conversion with flip support
    const minPrice = getTickPrice(actualTickLower, poolInfo, baseIn)
    const maxPrice = getTickPrice(actualTickUpper, poolInfo, baseIn)

    // Format prices with special handling for tick limits
    if (actualIsTickAtLimit[Bound.LOWER]) {
      minPriceFormatted = '0'
    } else {
      const minPriceStr = minPrice.toString()
      minPriceFormatted = minPriceStr || '-'
    }

    if (actualIsTickAtLimit[Bound.UPPER]) {
      maxPriceFormatted = '∞'
    } else {
      const maxPriceStr = maxPrice.toString()
      maxPriceFormatted = maxPriceStr || '-'
    }

    // Always calculate current price if poolInfo.price exists (regardless of tick limits)
    if (poolInfo.price) {
      try {
        // Use the current price from pool, applying baseIn logic like in usePriceRange
        let currentPrice = parseFloat(poolInfo.price.toString())

        if (!baseIn) {
          // When baseIn is false, we need to invert the price
          currentPrice = 1 / currentPrice
        }

        if (currentPrice > 0 && Number.isFinite(currentPrice)) {
          currentPriceString = currentPrice.toFixed(18)
        }
      } catch (error) {
        // If price calculation fails, continue silently
        console.warn('Current price calculation error:', error)
      }
    }

    // Handle full range positions
    if (actualIsTickAtLimit[Bound.LOWER] && actualIsTickAtLimit[Bound.UPPER]) {
      rangePosition = 50
      showPercentages = true
      minPercentage = '0%'
      maxPercentage = '100%'
      minPriceFormatted = '0'
      maxPriceFormatted = '∞'
    } else if (currentPriceString && actualTickLower > MIN_TICK && actualTickUpper < MAX_TICK) {
      // Calculate percentages only if prices are not at limits and we have a valid current price
      try {
        const currentPrice = parseFloat(currentPriceString)

        if (
          currentPrice > 0 &&
          maxPrice > minPrice &&
          Number.isFinite(minPrice) &&
          Number.isFinite(maxPrice) &&
          Number.isFinite(currentPrice)
        ) {
          const minPercent = ((minPrice - currentPrice) / currentPrice) * 100
          const maxPercent = ((maxPrice - currentPrice) / currentPrice) * 100

          if (
            // Only show percentages if they're reasonable finite values
            Number.isFinite(minPercent) &&
            Number.isFinite(maxPercent) &&
            Math.abs(minPercent) < 10000 &&
            Math.abs(maxPercent) < 10000
          ) {
            minPercentage = formatPercentage(minPercent)
            maxPercentage = formatPercentage(maxPercent)
            rangePosition = Math.max(0, Math.min(100, ((currentPrice - minPrice) / (maxPrice - minPrice)) * 100))
            showPercentages = true
          }
        }
      } catch (error) {
        // If any calculation fails, just show the price range without percentages
        console.warn('Price percentage calculation error:', error)
      }
    }

    const result = {
      minPriceFormatted,
      maxPriceFormatted,
      minPercentage,
      maxPercentage,
      rangePosition,
      showPercentages,
      currentPrice: currentPriceString,
      // Raw numeric values for validation
      minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
      currentPriceValue:
        currentPriceString && Number.isFinite(parseFloat(currentPriceString))
          ? parseFloat(currentPriceString)
          : undefined,
    }

    return result
  }, [tickLower, tickUpper, baseIn, poolInfo, currency0, currency1, tickAtLimit])
}
