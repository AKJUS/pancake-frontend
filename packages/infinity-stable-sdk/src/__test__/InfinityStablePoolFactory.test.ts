import { describe, it, expect } from 'vitest'
import { InfinityStablePoolFactory } from '../InfinityStablePoolFactory'
import { INFINITY_STABLE_POOL_FEE_DENOMINATOR } from '../constants'

const expectedSwapFee = (swapFeePercent: number) => {
  const clampedSwapFee = Math.max(0, Math.min(1, swapFeePercent))
  return BigInt(Math.floor((clampedSwapFee / 100) * INFINITY_STABLE_POOL_FEE_DENOMINATOR))
}

describe('InfinityStablePoolFactory.parsePoolFormParams', () => {
  describe('empty / no-op inputs', () => {
    it('should return empty object when called with no params', () => {
      expect(InfinityStablePoolFactory.parsePoolFormParams({})).toEqual({})
    })

    it('should return empty object when swapFee is an empty string', () => {
      expect(InfinityStablePoolFactory.parsePoolFormParams({ swapFee: '' })).toEqual({})
    })

    it('should ignore advanced params when isAdvancedEnabled is false', () => {
      const result = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: false,
        amplificationParam: '1000',
        offpegFeeMultiplier: '10',
        movingAverageTime: '600',
      })
      expect(result).toEqual({})
    })

    it('should ignore advanced params when isAdvancedEnabled is omitted', () => {
      const result = InfinityStablePoolFactory.parsePoolFormParams({
        amplificationParam: '1000',
        offpegFeeMultiplier: '10',
        movingAverageTime: '600',
      })
      expect(result).toEqual({})
    })
  })

  describe('swapFee conversion', () => {
    it('should convert 0.01% swap fee correctly', () => {
      // Uses denominator 1e10 with percentage input and floor rounding.
      const { fee } = InfinityStablePoolFactory.parsePoolFormParams({ swapFee: '0.01' })
      expect(fee).toBe(expectedSwapFee(0.01))
    })

    it('should convert 0.1% swap fee correctly', () => {
      const { fee } = InfinityStablePoolFactory.parsePoolFormParams({ swapFee: '0.1' })
      expect(fee).toBe(expectedSwapFee(0.1))
    })

    it('should convert 0.03% swap fee correctly', () => {
      const { fee } = InfinityStablePoolFactory.parsePoolFormParams({ swapFee: '0.03' })
      expect(fee).toBe(expectedSwapFee(0.03))
    })

    it('should convert 1% swap fee correctly', () => {
      const { fee } = InfinityStablePoolFactory.parsePoolFormParams({ swapFee: '1' })
      expect(fee).toBe(expectedSwapFee(1))
    })

    it('should clamp swap fee above 1 down to 1', () => {
      const { fee } = InfinityStablePoolFactory.parsePoolFormParams({ swapFee: '999' })
      expect(fee).toBe(expectedSwapFee(999))
    })

    it('should clamp negative swap fee up to 0', () => {
      // -0.5 -> clamped to 0 -> 0
      const { fee } = InfinityStablePoolFactory.parsePoolFormParams({ swapFee: '-0.5' })
      expect(fee).toBe(0n)
    })
  })

  describe('amplificationParam conversion', () => {
    it('should parse a plain integer string', () => {
      const { A } = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        amplificationParam: '1000',
      })
      expect(A).toBe(1000n)
    })

    it('should strip commas from formatted numbers', () => {
      const { A } = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        amplificationParam: '1,000',
      })
      expect(A).toBe(1000n)
    })

    it('should handle large values with multiple comma groups', () => {
      const { A } = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        amplificationParam: '10,000',
      })
      expect(A).toBe(10000n)
    })

    it('should not set A when amplificationParam is an empty string', () => {
      const result = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        amplificationParam: '',
      })
      expect(result.A).toBeUndefined()
    })
  })

  describe('offpegFeeMultiplier conversion', () => {
    it('should convert integer multiplier correctly', () => {
      // 10 -> floor(10 * 1e10) = 100000000000
      const { offpegFeeMultiplier } = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        offpegFeeMultiplier: '10',
      })
      expect(offpegFeeMultiplier).toBe(100000000000n)
    })

    it('should convert fractional multiplier correctly', () => {
      // 5.5 -> floor(5.5 * 1e10) = 55000000000
      const { offpegFeeMultiplier } = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        offpegFeeMultiplier: '5.5',
      })
      expect(offpegFeeMultiplier).toBe(55000000000n)
    })

    it('should not set offpegFeeMultiplier when value is an empty string', () => {
      const result = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        offpegFeeMultiplier: '',
      })
      expect(result.offpegFeeMultiplier).toBeUndefined()
    })
  })

  describe('movingAverageTime conversion', () => {
    it('should convert 600 seconds to maExpTime correctly', () => {
      // floor(600 / ln(2)) = floor(865.96) = 865
      const { maExpTime } = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        movingAverageTime: '600',
      })
      expect(maExpTime).toBe(865n)
    })

    it('should convert 1200 seconds to maExpTime correctly', () => {
      // floor(1200 / ln(2)) = floor(1731.93) = 1731
      const { maExpTime } = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        movingAverageTime: '1200',
      })
      expect(maExpTime).toBe(1731n)
    })

    it('should not set maExpTime when movingAverageTime is an empty string', () => {
      const result = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        movingAverageTime: '',
      })
      expect(result.maExpTime).toBeUndefined()
    })
  })

  describe('combined params', () => {
    it('should parse all fields together when advanced mode is enabled', () => {
      const result = InfinityStablePoolFactory.parsePoolFormParams({
        swapFee: '0.01',
        isAdvancedEnabled: true,
        amplificationParam: '1,000',
        offpegFeeMultiplier: '10',
        movingAverageTime: '600',
      })

      expect(result.fee).toBe(1000000n)
      expect(result.A).toBe(1000n)
      expect(result.offpegFeeMultiplier).toBe(100000000000n)
      expect(result.maExpTime).toBe(865n)
    })

    it('should only return fee when advanced mode is disabled even with other fields set', () => {
      const result = InfinityStablePoolFactory.parsePoolFormParams({
        swapFee: '0.1',
        isAdvancedEnabled: false,
        amplificationParam: '500',
        offpegFeeMultiplier: '20',
        movingAverageTime: '300',
      })

      expect(result.fee).toBe(10000000n)
      expect(result.A).toBeUndefined()
      expect(result.offpegFeeMultiplier).toBeUndefined()
      expect(result.maExpTime).toBeUndefined()
    })

    it('should handle partial advanced params (only some fields provided)', () => {
      const result = InfinityStablePoolFactory.parsePoolFormParams({
        isAdvancedEnabled: true,
        amplificationParam: '2000',
      })

      expect(result.A).toBe(2000n)
      expect(result.fee).toBeUndefined()
      expect(result.offpegFeeMultiplier).toBeUndefined()
      expect(result.maExpTime).toBeUndefined()
    })
  })
})
