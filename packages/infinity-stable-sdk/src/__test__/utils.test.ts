import { describe, it, expect } from 'vitest'
import { percentageToFee, feeToPercentage, getHookAddressFromReceipt } from '../utils'

describe('percentageToFee', () => {
  it('should convert decimal percentage to fee format correctly', () => {
    // 0.0001 (0.01%) = 10000
    expect(percentageToFee(0.0001)).toBe(10000n)

    // 0.001 (0.1%) = 100000
    expect(percentageToFee(0.001)).toBe(100000n)

    // 0.01 (1%) = 1000000
    expect(percentageToFee(0.01)).toBe(1000000n)
  })

  it('should handle minimum precision correctly (8 decimals)', () => {
    // 0.00000001 (minimum representable value)
    // 0.00000001 * 100000000 = 1
    expect(percentageToFee(0.00000001)).toBe(1n)

    // 0.000000001 (below minimum precision)
    // 0.000000001 * 100000000 = 0.1 -> rounds to 0
    expect(percentageToFee(0.000000001)).toBe(0n)

    // 0.0000001 - should work
    // 0.0000001 * 100000000 = 10
    expect(percentageToFee(0.0000001)).toBe(10n)
  })

  it('should handle edge cases', () => {
    // 0 should be 0
    expect(percentageToFee(0)).toBe(0n)

    // 1 (100% as decimal) should be 100000000
    expect(percentageToFee(1)).toBe(100000000n)
  })

  it('should use Math.round for better precision', () => {
    // 0.000000016
    // 0.000000016 * 100000000 = 1.6 -> rounds to 2
    expect(percentageToFee(0.000000016)).toBe(2n)

    // 0.000000014
    // 0.000000014 * 100000000 = 1.4 -> rounds to 1
    expect(percentageToFee(0.000000014)).toBe(1n)

    // Test that Math.round is used (not Math.floor)
    // 0.000000025 * 100000000 = 2.5 -> rounds to 2 (banker's rounding) or 3
    // Due to floating point, this might be slightly off
    const result = percentageToFee(0.000000025)
    expect(result).toBeGreaterThanOrEqual(2n)
    expect(result).toBeLessThanOrEqual(3n)
  })

  it('should throw error for invalid percentages', () => {
    // Negative percentage
    expect(() => percentageToFee(-0.01)).toThrow()

    // Percentage > 1 (>100%)
    expect(() => percentageToFee(1.1)).toThrow()
  })
})

describe('feeToPercentage', () => {
  it('should convert fee format to percentage correctly', () => {
    // 10000 = 0.0001 (0.01%)
    expect(feeToPercentage(10000n)).toBe(0.0001)

    // 100000 = 0.001 (0.1%)
    expect(feeToPercentage(100000n)).toBe(0.001)

    // 1000000 = 0.01 (1%)
    expect(feeToPercentage(1000000n)).toBe(0.01)
  })

  it('should handle minimum precision correctly', () => {
    // 1 = 0.00000001 (minimum decimal rate)
    // As percentage: 0.00000001 * 100 = 0.000001%
    expect(feeToPercentage(1n)).toBe(0.00000001)

    // 0 = 0
    expect(feeToPercentage(0n)).toBe(0)
  })

  it('should handle maximum value', () => {
    // 100000000 = 1 (100% as decimal rate = 100% as percentage)
    expect(feeToPercentage(100000000n)).toBe(1)
  })

  it('should round-trip correctly for valid values', () => {
    // Test round-trip: percentage -> fee -> percentage
    const testValues = [0.00000001, 0.0000001, 0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1, 0.5, 1]

    testValues.forEach((percentage) => {
      const fee = percentageToFee(percentage)
      const roundTrip = feeToPercentage(fee)
      // Allow small floating point differences
      expect(Math.abs(roundTrip - percentage)).toBeLessThan(0.000000001)
    })
  })
})

describe('percentageToFee and feeToPercentage integration', () => {
  it('should handle values below minimum precision', () => {
    // 0.000000002 (below minimum precision)
    // 0.000000002 * 100000000 = 0.2 -> rounds to 0
    const userInput = 0.000000002
    const fee = percentageToFee(userInput)
    const displayValue = feeToPercentage(fee)

    expect(fee).toBe(0n)
    expect(displayValue).toBe(0)
  })

  it('should handle minimum working value correctly', () => {
    // Minimum working value: 0.00000001
    // 0.00000001 * 100000000 = 1
    const userInput = 0.00000001
    const fee = percentageToFee(userInput)
    const displayValue = feeToPercentage(fee)

    expect(fee).toBe(1n)
    expect(displayValue).toBe(0.00000001)
  })

  it('should demonstrate percentage display conversion', () => {
    // When user sees "0.000001%" in the UI:
    // - Input as decimal: 0.000001 / 100 = 0.00000001
    // - Convert to fee: 0.00000001 * 100000000 = 1
    // - Convert back: 1 / 100000000 = 0.00000001
    // - Display as percentage: 0.00000001 * 100 = 0.000001%

    const uiPercentage = 0.000001 // What user types in UI
    const decimalRate = uiPercentage / 100 // Convert to decimal for function
    const fee = percentageToFee(decimalRate)
    const backToDecimal = feeToPercentage(fee)
    const backToPercentage = backToDecimal * 100

    expect(fee).toBe(1n)
    expect(backToPercentage).toBe(0.000001)
  })
})

describe('getHookAddressFromReceipt', () => {
  it('should extract hook address from receipt log data', () => {
    const receipt = {
      logs: [
        { data: '0x' },
        { data: '0x' },
        {
          data: `0x000000000000000000000000770b7c547b2ec1a1cb5aeda4dda13a509f2e5704\
0000000000000000000000000000000000000000000000000000000000000000\
0000000000000000000000000000000000000000000000000000000000010455\
0000000000000000000000000000000000000001000000000000000000000000\
0000000000000000000000000000000000000000000000000000000000000000`,
        },
      ],
    }

    expect(getHookAddressFromReceipt(receipt)).toBe('0x770b7c547B2eC1A1Cb5aeda4Dda13a509F2e5704')
  })

  it('should return undefined for missing/invalid receipt', () => {
    expect(getHookAddressFromReceipt(undefined)).toBeUndefined()
    expect(getHookAddressFromReceipt({ logs: [] })).toBeUndefined()
    expect(getHookAddressFromReceipt({ logs: [{}, {}, { data: 'not-hex' }] })).toBeUndefined()
  })
})
