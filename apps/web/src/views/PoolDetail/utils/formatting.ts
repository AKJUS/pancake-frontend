import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { BigNumber as BN } from 'bignumber.js'
import { formatNumber } from '@pancakeswap/utils/formatNumber'

export const formatPoolDetailFiatNumber = (value: string | number | BN) => {
  return formatFiatNumber(value, '$').replace(' ', '')
}

/**
 * Formats percentage with bounds checking and proper sign
 * Used across InfinityCL, V3, and Bin position tables
 */
export const formatPercentage = (percentage: number): string => {
  if (Math.abs(percentage) < 0.01) return '0%'
  if (!Number.isFinite(percentage)) return '-%'
  const sign = percentage >= 0 ? '+' : ''
  return `${sign}${percentage.toFixed(1)}%`
}

/**
 * Smart formatter for price ranges that shows decimals only until the numbers differ
 * Used to prevent text overlap in price range displays
 *
 * Features:
 * - Subscript notation for very small numbers (0.00000993522 -> 0.0₅993522)
 * - Minimum 2 decimal places (unless .00)
 * - Thousands separators for large numbers
 *
 * @param min - Minimum price value
 * @param max - Maximum price value
 * @returns Object with formatted min and max prices
 *
 * @example
 * formatPriceRange(1.234567, 1.235890) // { minFormatted: '1.2346', maxFormatted: '1.2359' }
 * formatPriceRange(1.23, 5.67) // { minFormatted: '1.23', maxFormatted: '5.67' }
 * formatPriceRange(0.0001234, 0.0001567) // { minFormatted: '0.00012', maxFormatted: '0.00016' }
 * formatPriceRange(0.00000993522, 0.00001183) // { minFormatted: '0.0₅993522', maxFormatted: '0.0₄1183' }
 */
export const formatPriceRange = (
  min: string | number,
  max: string | number,
): { minFormatted: string; maxFormatted: string } => {
  // Handle edge cases
  const minStr = String(min)
  const maxStr = String(max)

  // Handle special values
  if (minStr === '0' || minStr === '-' || minStr === 'NaN' || !Number.isFinite(Number(min))) {
    return {
      minFormatted: minStr === '0' ? '0' : minStr,
      maxFormatted: maxStr === '∞' || maxStr === 'Infinity' ? '∞' : maxStr,
    }
  }

  if (maxStr === '∞' || maxStr === 'Infinity' || maxStr === '-' || maxStr === 'NaN' || !Number.isFinite(Number(max))) {
    return {
      minFormatted: minStr,
      maxFormatted: maxStr === '∞' || maxStr === 'Infinity' ? '∞' : maxStr,
    }
  }

  let minNum = Number(min)
  let maxNum = Number(max)

  // CRITICAL FIX: If prices are inverted, swap them before formatting
  // This can happen when native tokens cause incorrect currency ordering
  if (Number.isFinite(minNum) && Number.isFinite(maxNum) && minNum > maxNum) {
    const temp = minNum
    minNum = maxNum
    maxNum = temp
  }

  // Convert to fixed-point notation (handle scientific notation)
  const minFixed = new BN(minNum).toFixed(18)
  const maxFixed = new BN(maxNum).toFixed(18)

  // Split into integer and decimal parts
  const [minInt, minDec = ''] = minFixed.split('.')
  const [maxInt, maxDec = ''] = maxFixed.split('.')

  // Constants for formatting
  const MIN_DECIMALS = 2 // Minimum decimals for readability
  const MAX_DECIMALS = 8 // Maximum decimals to prevent excessive precision

  let decimalPlaces = MIN_DECIMALS

  // If integers differ, use standard formatting
  if (minInt !== maxInt) {
    // For different integers, use standard formatting based on magnitude
    const magnitude = Math.abs(minNum)
    if (magnitude < 1) {
      decimalPlaces = 4
    } else {
      // Always use at least 2 decimals for numbers >= 1
      decimalPlaces = 2
    }
  } else {
    // Integers are the same - find first differing decimal position
    const maxLength = Math.max(minDec.length, maxDec.length)
    let differencePosition = -1

    for (let i = 0; i < maxLength; i++) {
      const minDigit = minDec[i] || '0'
      const maxDigit = maxDec[i] || '0'

      if (minDigit !== maxDigit) {
        differencePosition = i
        break
      }
    }

    if (differencePosition >= 0) {
      // Show up to the position where they differ, plus one more digit for clarity
      decimalPlaces = Math.min(differencePosition + 2, MAX_DECIMALS)
    } else {
      // They're the same - use minimum decimals
      decimalPlaces = MIN_DECIMALS
    }

    // Ensure minimum decimals for small numbers
    if (Math.abs(minNum) < 0.01) {
      decimalPlaces = Math.max(decimalPlaces, 4)
    }
  }

  // Helper to format with at least 2 decimals (unless .00)
  // Uses subscript notation for very small numbers (e.g., 0.00000993522 -> 0.0₅993522)
  const formatWithMinDecimals = (num: number, decimals: number): string => {
    // For very small numbers (< 0.001), use subscript notation for leading zeros
    // maximumDecimalTrailingZeroes: 3 means show subscript when there are 4+ leading zeros after decimal
    if (num > 0 && num < 0.001) {
      return formatNumber(num, {
        maxDecimalDisplayDigits: Math.max(6, decimals),
        maximumDecimalTrailingZeroes: 3, // Show subscript for 4+ consecutive zeros (e.g., 0.0₄xxx)
      })
    }

    // For normal numbers, use formatNumber with our decimal settings
    const formatted = formatNumber(num, {
      maxDecimalDisplayDigits: Math.max(2, decimals),
    })

    // Strip .00 if present (but keep other decimals like .50, .10, etc.)
    return formatted.replace(/\.00$/, '')
  }

  const minFormatted = formatWithMinDecimals(minNum, decimalPlaces)
  const maxFormatted = formatWithMinDecimals(maxNum, decimalPlaces)

  return { minFormatted, maxFormatted }
}
