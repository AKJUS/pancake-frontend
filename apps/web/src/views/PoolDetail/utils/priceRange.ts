import { getCurrencyPriceFromId } from '@pancakeswap/infinity-sdk'
import { FeeAmount, nearestUsableTick, TICK_SPACINGS, TickMath, tickToPrice } from '@pancakeswap/v3-sdk'
import { Bound } from '@pancakeswap/widgets-internal'
import { MAX_TICK, MIN_TICK, SqrtPriceMath as SolanaSqrtPriceMath, TickUtils } from '@pancakeswap/solana-core-sdk'
import { formatPercentage, formatPriceRange } from './formatting'

/**
 * Safely converts tick to price using V3 SDK with maximum precision
 * Used in InfinityCL and V3 position tables
 */
export const getTickPrice = (tick: number, token0: any, token1: any, isFlipped?: boolean): number => {
  try {
    // Use TickMath constants for bounds checking
    if (tick >= TickMath.MAX_TICK) return Infinity
    if (tick <= TickMath.MIN_TICK) return 0

    // Use the V3 SDK's tickToPrice function for accurate calculation
    if (token0 && token1) {
      // Always calculate the base price as token0/token1
      const price = tickToPrice(token0, token1, tick)
      const priceValue = parseFloat(price.toFixed(18))

      // When flipped, invert the price to get token1/token0
      return isFlipped ? 1 / priceValue : priceValue
    }

    // Fallback
    const basePrice = 1.0001 ** tick
    return isFlipped ? 1 / basePrice : basePrice
  } catch (error) {
    console.error('Error calculating tick price:', error)
    const basePrice = 1.0001 ** tick
    return isFlipped ? 1 / basePrice : basePrice
  }
}

/**
 * Calculates tick limits for full range detection
 * Used in InfinityCL and V3 position tables
 */
export const calculateTickLimits = (
  tickSpacing: number | undefined,
): {
  [bound in Bound]: number | undefined
} => {
  return {
    [Bound.LOWER]: tickSpacing ? nearestUsableTick(TickMath.MIN_TICK, tickSpacing) : undefined,
    [Bound.UPPER]: tickSpacing ? nearestUsableTick(TickMath.MAX_TICK, tickSpacing) : undefined,
  }
}

export const calculateSolanaTickLimits = (
  tickSpacing: number | undefined,
): {
  [bound in Bound]: number | undefined
} => {
  return {
    [Bound.LOWER]: tickSpacing ? TickUtils.nearestUsableTick(MIN_TICK, tickSpacing) : undefined,
    [Bound.UPPER]: tickSpacing ? TickUtils.nearestUsableTick(MAX_TICK, tickSpacing) : undefined,
  }
}

/**
 * Solana: safely converts tick to price using Solana Core SDK with maximum precision
 */
export const getSolanaTickPrice = (tick: number, token0: any, token1: any, isFlipped?: boolean): number => {
  try {
    if (tick >= MAX_TICK) return Infinity
    if (tick <= MIN_TICK) return 0

    if (token0 && token1) {
      const sqrt = SolanaSqrtPriceMath.getSqrtPriceX64FromTick(tick)
      const priceDecimal = SolanaSqrtPriceMath.sqrtPriceX64ToPrice(sqrt, token0?.decimals ?? 0, token1?.decimals ?? 0)
      const priceValue = parseFloat(priceDecimal.toString())
      return isFlipped ? 1 / priceValue : priceValue
    }

    const basePrice = 1.0001 ** tick
    return isFlipped ? 1 / basePrice : basePrice
  } catch (error) {
    console.error('Error calculating Solana tick price:', error)
    const basePrice = 1.0001 ** tick
    return isFlipped ? 1 / basePrice : basePrice
  }
}

/**
 * Solana: Calculates price range data for tick-based positions
 * Aligns with calculateTickBasedPriceRange but uses Solana tick/price logic and limits
 */
export const calculateSolanaTickBasedPriceRange = (
  tickLower: number,
  tickUpper: number,
  token0: any,
  token1: any,
  isTickAtLimit: { [bound in Bound]: boolean },
  isFlipped?: boolean,
  currentPrice?: number,
): PriceRangeData => {
  let minPriceFormatted = '-'
  let maxPriceFormatted = '-'
  let minPercentage = ''
  let maxPercentage = ''
  let rangePosition = 50
  let showPercentages = false
  let currentPriceString: string | undefined

  // Swap ticks in flipped mode to maintain range order
  const actualTickLower = isFlipped ? tickUpper : tickLower
  const actualTickUpper = isFlipped ? tickLower : tickUpper
  const actualIsTickAtLimit = isFlipped
    ? { [Bound.LOWER]: isTickAtLimit[Bound.UPPER], [Bound.UPPER]: isTickAtLimit[Bound.LOWER] }
    : isTickAtLimit

  // Calculate min/max prices at ticks
  const minPrice = getSolanaTickPrice(actualTickLower, token0, token1, isFlipped)
  const maxPrice = getSolanaTickPrice(actualTickUpper, token0, token1, isFlipped)

  // Format with special handling at limits
  const minPriceIsAtLimit = actualIsTickAtLimit[Bound.LOWER]
  const maxPriceIsAtLimit = actualIsTickAtLimit[Bound.UPPER]
  const minPriceIsValid = Number.isFinite(minPrice) && minPrice > 0
  const maxPriceIsValid = Number.isFinite(maxPrice) && maxPrice > 0

  // Format each price independently (like develop branch)
  // This ensures valid prices are always formatted, even when one is at limit
  if (minPriceIsAtLimit) {
    minPriceFormatted = '0'
  } else if (!minPriceIsValid) {
    minPriceFormatted = '-'
  } else {
    minPriceFormatted = minPrice.toString()
  }

  if (maxPriceIsAtLimit) {
    maxPriceFormatted = '∞'
  } else if (!maxPriceIsValid) {
    maxPriceFormatted = '-'
  } else {
    maxPriceFormatted = maxPrice.toString()
  }

  // Use smart formatting for valid price ranges when BOTH are valid
  if (!minPriceIsAtLimit && !maxPriceIsAtLimit && minPriceIsValid && maxPriceIsValid) {
    const formatted = formatPriceRange(minPrice, maxPrice)
    minPriceFormatted = formatted.minFormatted
    maxPriceFormatted = formatted.maxFormatted
  }

  // Handle full range
  if (actualIsTickAtLimit[Bound.LOWER] && actualIsTickAtLimit[Bound.UPPER]) {
    rangePosition = 50
    showPercentages = true
    minPercentage = '0%'
    maxPercentage = '100%'
    minPriceFormatted = '0'
    maxPriceFormatted = '∞'
  } else if (
    minPriceIsValid &&
    maxPriceIsValid &&
    currentPrice !== undefined &&
    actualTickLower > MIN_TICK &&
    actualTickUpper < MAX_TICK
  ) {
    try {
      const cp = Number(currentPrice)
      if (
        cp > 0 &&
        maxPrice > minPrice &&
        Number.isFinite(minPrice) &&
        Number.isFinite(maxPrice) &&
        Number.isFinite(cp)
      ) {
        const minPercent = ((minPrice - cp) / cp) * 100
        const maxPercent = ((maxPrice - cp) / cp) * 100

        if (
          Number.isFinite(minPercent) &&
          Number.isFinite(maxPercent) &&
          Math.abs(minPercent) < 10000 &&
          Math.abs(maxPercent) < 10000
        ) {
          minPercentage = formatPercentage(minPercent)
          maxPercentage = formatPercentage(maxPercent)
          rangePosition = Math.max(0, Math.min(100, ((cp - minPrice) / (maxPrice - minPrice)) * 100))
          showPercentages = true
          currentPriceString = cp.toFixed(18)
        }
      }
    } catch (error) {
      console.warn('Solana price calculation error:', error)
    }
  }

  return {
    minPriceFormatted,
    maxPriceFormatted,
    minPercentage,
    maxPercentage,
    rangePosition,
    showPercentages,
    currentPrice: currentPriceString,
    // Raw numeric values for validation and calculations
    minPrice: minPriceIsValid ? minPrice : undefined,
    maxPrice: maxPriceIsValid ? maxPrice : undefined,
    currentPriceValue: currentPrice !== undefined && Number.isFinite(currentPrice) ? currentPrice : undefined,
  }
}

/**
 * Determines if ticks are at their limits (for full range detection)
 * Used in InfinityCL and V3 position tables
 */
export const getTickAtLimitStatus = (
  tickLower: number,
  tickUpper: number,
  ticksLimit: { [bound in Bound]: number | undefined },
): { [bound in Bound]: boolean } => {
  return {
    [Bound.LOWER]: tickLower && ticksLimit.LOWER ? tickLower <= ticksLimit.LOWER : false,
    [Bound.UPPER]: tickUpper && ticksLimit.UPPER ? tickUpper >= ticksLimit.UPPER : false,
  }
}

/**
 * Gets tick spacing from pool or fee tier
 * Used in V3 position table
 */
export const getTickSpacing = (pool: any, feeTier?: FeeAmount): number | undefined => {
  return pool?.tickSpacing ?? (feeTier ? TICK_SPACINGS[feeTier] : undefined)
}

/**
 * Common interface for price range calculation result
 */
export interface PriceRangeData {
  minPriceFormatted: string
  maxPriceFormatted: string
  minPercentage: string
  maxPercentage: string
  rangePosition: number
  showPercentages: boolean
  currentPrice?: string // Add current price to the interface
  // Raw numeric values for calculations (e.g., price inversion)
  minPrice?: number
  maxPrice?: number
  currentPriceValue?: number
}

/**
 * Calculates price range data for tick-based positions (InfinityCL, V3)
 * Common logic extracted from InfinityCL and V3 position tables
 */
export const calculateTickBasedPriceRange = (
  tickLower: number,
  tickUpper: number,
  token0: any,
  token1: any,
  pool: any,
  isTickAtLimit: { [bound in Bound]?: boolean | undefined },
  isFlipped?: boolean,
): PriceRangeData => {
  let minPriceFormatted = '-'
  let maxPriceFormatted = '-'
  let minPercentage = ''
  let maxPercentage = ''
  let rangePosition = 50
  let showPercentages = false
  let currentPriceString: string | undefined

  // When flipped, we need to swap the tick order because inverting prices reverses the range
  const actualTickLower = isFlipped ? tickUpper : tickLower
  const actualTickUpper = isFlipped ? tickLower : tickUpper
  const actualIsTickAtLimit = isFlipped
    ? {
        [Bound.LOWER]: isTickAtLimit[Bound.UPPER],
        [Bound.UPPER]: isTickAtLimit[Bound.LOWER],
      }
    : isTickAtLimit

  // Calculate prices using tick-to-price conversion with flip support
  let minPrice = getTickPrice(actualTickLower, token0, token1, isFlipped)
  let maxPrice = getTickPrice(actualTickUpper, token0, token1, isFlipped)

  // CRITICAL FIX: If prices are inverted, swap them
  // This can happen when native tokens cause incorrect currency ordering
  if (
    typeof minPrice === 'number' &&
    typeof maxPrice === 'number' &&
    Number.isFinite(minPrice) &&
    Number.isFinite(maxPrice) &&
    minPrice > maxPrice
  ) {
    const temp = minPrice
    minPrice = maxPrice
    maxPrice = temp
  }

  // Format prices with special handling for tick limits
  // Check for special cases first
  const minPriceIsAtLimit = actualIsTickAtLimit.LOWER
  const maxPriceIsAtLimit = actualIsTickAtLimit.UPPER
  const minPriceIsInvalid = typeof minPrice !== 'number' || !Number.isFinite(minPrice) || Number.isNaN(minPrice)
  const maxPriceIsInvalid = typeof maxPrice !== 'number' || !Number.isFinite(maxPrice) || Number.isNaN(maxPrice)

  // Format each price independently (like develop branch)
  // This ensures valid prices are always formatted, even when one is at limit
  if (minPriceIsAtLimit) {
    minPriceFormatted = '0'
  } else if (minPriceIsInvalid) {
    minPriceFormatted = '-'
  } else {
    minPriceFormatted = minPrice.toString()
  }

  if (maxPriceIsAtLimit) {
    maxPriceFormatted = '∞'
  } else if (maxPriceIsInvalid) {
    maxPriceFormatted = '-'
  } else {
    maxPriceFormatted = maxPrice.toString()
  }

  // Use smart formatting for valid price ranges when BOTH are valid
  if (!minPriceIsAtLimit && !maxPriceIsAtLimit && !minPriceIsInvalid && !maxPriceIsInvalid) {
    const formatted = formatPriceRange(minPrice, maxPrice)
    minPriceFormatted = formatted.minFormatted
    maxPriceFormatted = formatted.maxFormatted
  }

  // Handle full range positions
  if (actualIsTickAtLimit.LOWER && actualIsTickAtLimit.UPPER) {
    rangePosition = 50
    showPercentages = true
    minPercentage = '0%'
    maxPercentage = '100%'
    minPriceFormatted = '0'
    maxPriceFormatted = '∞'
  } else if (
    !minPriceIsInvalid &&
    !maxPriceIsInvalid &&
    pool?.token0Price &&
    actualTickLower > TickMath.MIN_TICK &&
    actualTickUpper < TickMath.MAX_TICK
  ) {
    // Calculate percentages only if prices are valid, not at limits, and pool exists
    try {
      // Use the correct current price based on flip state
      // token0Price: token1/token0, token1Price: token0/token1
      let basePrice
      if (isFlipped) {
        // Use token1Price if available, otherwise invert token0Price
        basePrice = pool.token1Price || pool.token0Price?.invert?.()
      } else {
        basePrice = pool.token0Price
      }

      if (!basePrice) {
        console.warn('No base price available for range calculation')
        // Extract raw prices based on formatted strings
        let rawMinPrice: number | undefined
        let rawMaxPrice: number | undefined

        if (minPriceFormatted === '0') {
          rawMinPrice = 0
        } else if (minPriceFormatted !== '-' && Number.isFinite(minPrice) && !Number.isNaN(minPrice)) {
          rawMinPrice = minPrice
        }

        if (maxPriceFormatted === '∞') {
          rawMaxPrice = undefined
        } else if (maxPriceFormatted !== '-' && Number.isFinite(maxPrice) && !Number.isNaN(maxPrice)) {
          rawMaxPrice = maxPrice
        }

        return {
          minPriceFormatted,
          maxPriceFormatted,
          minPercentage,
          maxPercentage,
          rangePosition,
          showPercentages,
          currentPrice: currentPriceString,
          minPrice: rawMinPrice,
          maxPrice: rawMaxPrice,
          currentPriceValue: undefined,
        }
      }

      // Use higher precision (18 significant digits) to avoid precision loss for small numbers
      // basePrice may be an SDK Price object (has .toFixed) or a plain numeric string (from poolInfo)
      const currentPriceHighPrecision =
        typeof basePrice?.toFixed === 'function' ? basePrice.toFixed(18) : String(basePrice)
      const currentPrice = parseFloat(currentPriceHighPrecision)
      currentPriceString = currentPriceHighPrecision

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
      console.warn('Price calculation error:', error)
    }
  }

  // Store raw numeric values for calculations (avoid parsing formatted strings later)
  // Handle special cases based on formatted string to avoid NaN
  let rawMinPrice: number | undefined
  let rawMaxPrice: number | undefined

  // Extract minPrice
  if (minPriceFormatted === '0') {
    rawMinPrice = 0
  } else if (minPriceFormatted !== '-' && Number.isFinite(minPrice) && !Number.isNaN(minPrice)) {
    rawMinPrice = minPrice
  }

  // Extract maxPrice
  if (maxPriceFormatted === '∞') {
    rawMaxPrice = undefined // Can't invert infinity
  } else if (maxPriceFormatted !== '-' && Number.isFinite(maxPrice) && !Number.isNaN(maxPrice)) {
    rawMaxPrice = maxPrice
  }

  const rawCurrentPrice =
    currentPriceString && Number.isFinite(parseFloat(currentPriceString)) ? parseFloat(currentPriceString) : undefined

  return {
    minPriceFormatted,
    maxPriceFormatted,
    minPercentage,
    maxPercentage,
    rangePosition,
    showPercentages,
    currentPrice: currentPriceString,
    minPrice: rawMinPrice,
    maxPrice: rawMaxPrice,
    currentPriceValue: rawCurrentPrice,
  }
}

/**
 * Calculates price range data for bin-based positions (InfinityBin)
 * Extracted from InfinityBin position table
 */
export const calculateBinBasedPriceRange = (
  minBinId: number | null,
  maxBinId: number | null,
  binStep: number,
  activeId: number | undefined,
  token0: any,
  token1: any,
  isFlipped?: boolean,
): PriceRangeData => {
  let minPriceFormatted = '-'
  let maxPriceFormatted = '-'
  let minPercentage = ''
  let maxPercentage = ''
  let rangePosition = 50
  let showPercentages = false
  let currentPrice: any

  // Declare raw values at function scope
  let rawMinPrice: number | undefined
  let rawMaxPrice: number | undefined

  if (
    minBinId !== null &&
    minBinId !== undefined &&
    maxBinId !== null &&
    maxBinId !== undefined &&
    binStep &&
    token0 &&
    token1
  ) {
    // Calculate base prices normally (token0/token1)
    const minPriceBase = getCurrencyPriceFromId(minBinId, binStep, token0, token1)
    const maxPriceBase = getCurrencyPriceFromId(maxBinId, binStep, token0, token1)
    const currentPriceBase =
      activeId !== null && activeId !== undefined
        ? getCurrencyPriceFromId(activeId, binStep, token0, token1)
        : undefined

    // When flipped, invert prices and swap min/max
    let minPrice
    let maxPrice
    if (isFlipped) {
      minPrice = maxPriceBase ? maxPriceBase.invert() : undefined
      maxPrice = minPriceBase ? minPriceBase.invert() : undefined
      currentPrice = currentPriceBase ? currentPriceBase.invert() : undefined
    } else {
      minPrice = minPriceBase
      maxPrice = maxPriceBase
      currentPrice = currentPriceBase
    }

    if (minPrice && maxPrice) {
      // Check for extreme values and format accordingly - use higher precision for small numbers
      let minPriceFloat = parseFloat(minPrice.toFixed(18))
      let maxPriceFloat = parseFloat(maxPrice.toFixed(18))

      // CRITICAL FIX: If prices are inverted, swap them
      // This can happen when native tokens cause incorrect currency ordering
      if (minPriceFloat > maxPriceFloat && Number.isFinite(minPriceFloat) && Number.isFinite(maxPriceFloat)) {
        const temp = minPriceFloat
        minPriceFloat = maxPriceFloat
        maxPriceFloat = temp
      }

      // Store raw values before any formatting
      rawMinPrice = Number.isFinite(minPriceFloat) && !Number.isNaN(minPriceFloat) ? minPriceFloat : undefined
      rawMaxPrice = Number.isFinite(maxPriceFloat) && !Number.isNaN(maxPriceFloat) ? maxPriceFloat : undefined

      // Check for special cases
      const minIsZeroOrInvalid = minPriceFloat === 0 || !Number.isFinite(minPriceFloat) || Number.isNaN(minPriceFloat)
      const maxIsInfinityOrInvalid =
        maxPriceFloat === Infinity || !Number.isFinite(maxPriceFloat) || Number.isNaN(maxPriceFloat)

      // Format each price independently (like develop branch)
      // This ensures valid prices are always formatted, even when one is at limit
      // Use the swapped float values for formatting to maintain consistency
      if (minIsZeroOrInvalid) {
        minPriceFormatted = '0'
      } else {
        minPriceFormatted = minPriceFloat.toFixed(18)
      }

      if (maxIsInfinityOrInvalid) {
        maxPriceFormatted = '∞'
      } else {
        maxPriceFormatted = maxPriceFloat.toFixed(18)
      }

      // Use smart formatting for valid price ranges when BOTH are valid
      if (!minIsZeroOrInvalid && !maxIsInfinityOrInvalid) {
        const formatted = formatPriceRange(minPriceFloat, maxPriceFloat)
        minPriceFormatted = formatted.minFormatted
        maxPriceFormatted = formatted.maxFormatted
      }

      // Calculate percentages if we have current price, position is not removed, and prices are valid
      if (currentPrice && !minIsZeroOrInvalid && !maxIsInfinityOrInvalid) {
        try {
          // Use higher precision (18 significant digits) to avoid precision loss for small numbers
          const currentPriceFloat = parseFloat(currentPrice.toFixed(18))

          if (
            currentPriceFloat > 0 &&
            maxPriceFloat > minPriceFloat &&
            Number.isFinite(minPriceFloat) &&
            Number.isFinite(maxPriceFloat) &&
            Number.isFinite(currentPriceFloat)
          ) {
            const minPercent = ((minPriceFloat - currentPriceFloat) / currentPriceFloat) * 100
            const maxPercent = ((maxPriceFloat - currentPriceFloat) / currentPriceFloat) * 100

            if (
              Number.isFinite(minPercent) &&
              Number.isFinite(maxPercent) &&
              Math.abs(minPercent) < 10000 &&
              Math.abs(maxPercent) < 10000
            ) {
              minPercentage = formatPercentage(minPercent)
              maxPercentage = formatPercentage(maxPercent)
              rangePosition = Math.max(
                0,
                Math.min(100, ((currentPriceFloat - minPriceFloat) / (maxPriceFloat - minPriceFloat)) * 100),
              )
              showPercentages = true
            }
          }
        } catch (error) {
          console.warn('Price calculation error:', error)
        }
      }
    }
  }

  // Get current price as raw numeric value
  const rawCurrentPrice =
    currentPrice && Number.isFinite(parseFloat(currentPrice.toFixed(18)))
      ? parseFloat(currentPrice.toFixed(18))
      : undefined

  const currentPriceFormatted = currentPrice?.toFixed(18)

  return {
    minPriceFormatted,
    maxPriceFormatted,
    minPercentage,
    maxPercentage,
    rangePosition,
    showPercentages,
    currentPrice: currentPriceFormatted,
    minPrice: rawMinPrice,
    maxPrice: rawMaxPrice,
    currentPriceValue: rawCurrentPrice,
  }
}
