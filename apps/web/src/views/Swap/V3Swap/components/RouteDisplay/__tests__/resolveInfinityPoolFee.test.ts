import { describe, expect, it, vi } from 'vitest'
import { resolveInfinityPoolFee } from '../resolveInfinityPoolFee'

// Mock @pancakeswap/infinity-sdk — only the pieces resolveInfinityPoolFee uses
vi.mock('@pancakeswap/infinity-sdk', () => ({
  parseProtocolFeesToNumbers: (raw?: number) => {
    if (raw === undefined) return undefined
    // Mirrors the real helper: lower 12 bits = fee0, upper 12 bits = fee1
    return [raw & 0xfff, (raw >> 12) & 0xfff]
  },
  findHook: (_hooks: string, _chainId: number) => undefined,
  HOOK_CATEGORY: { DynamicFees: 'DynamicFees', BrevisDiscount: 'BrevisDiscount', PrimusDiscount: 'PrimusDiscount' },
}))

const EMPTY_DISCOUNT: Record<string, { discountFee: number; originalFee: number }> = {}

describe('resolveInfinityPoolFee', () => {
  describe('on-chain pools (with protocolFee)', () => {
    it('adds protocolFee to pool.fee when no hook discount', () => {
      const pool = { fee: 3000, protocolFee: 100, hooks: '0x0000000000000000000000000000000000000000' }
      const result = resolveInfinityPoolFee(pool, EMPTY_DISCOUNT, 1)

      // protocolFee parsed: 100 & 0xFFF = 100
      expect(result.fee).toBe(3000 + 100)
      expect(result.discountFee).toBe(3000 + 100)
    })

    it('uses hook discount when available', () => {
      const hookAddr = '0xabc'
      const pool = { fee: 3000, protocolFee: 50, hooks: hookAddr }
      const discount = { [hookAddr]: { discountFee: 500, originalFee: 2500 } }

      const result = resolveInfinityPoolFee(pool, discount, 1)

      // protocolFee parsed: 50 & 0xFFF = 50
      expect(result.fee).toBe(2500 + 50) // originalFee + protocolFee
      expect(result.discountFee).toBe(500 + 50) // discountFee + protocolFee
    })

    it('handles protocolFee of 0', () => {
      const pool = { fee: 1000, protocolFee: 0 }
      const result = resolveInfinityPoolFee(pool, EMPTY_DISCOUNT, 1)

      expect(result.fee).toBe(1000)
      expect(result.discountFee).toBe(1000)
    })
  })
})
