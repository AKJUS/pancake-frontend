import { describe, expect, it } from 'vitest'
import { RWA, RWATokensByFamily } from './index'

const tokensByFamily: RWATokensByFamily = {
  ondo: [{ chainId: 56, address: '0x1111111111111111111111111111111111111111', symbol: 'USDY' }],
  xstocks: [{ chainId: 56, address: '0x2222222222222222222222222222222222222222', symbol: 'COINX' }],
}

describe('RWA', () => {
  it('resolves token families from the static registry', () => {
    expect(RWA.getFamilyByToken(56, '0x1111111111111111111111111111111111111111', tokensByFamily)?.type).toBe('ondo')
    expect(RWA.getFamilyByToken(56, '0x2222222222222222222222222222222222222222', tokensByFamily)?.type).toBe('xstocks')
    expect(RWA.getFamilyByToken(56, '0x3333333333333333333333333333333333333333', tokensByFamily)).toBeUndefined()
  })

  it('marks Ondo and xStocks trades as x-only routing', () => {
    expect(
      RWA.requiresXRouting(
        { chainId: 56, address: '0x1111111111111111111111111111111111111111' },
        { chainId: 56, address: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa' },
        tokensByFamily,
      ),
    ).toBe(true)

    expect(
      RWA.requiresXRouting(
        { chainId: 56, address: '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa' },
        { chainId: 56, address: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' },
        tokensByFamily,
      ),
    ).toBe(false)
  })

  it('exposes family-specific selection policies', () => {
    expect(
      RWA.getSelectionPolicy(
        { chainId: 56, address: '0x1111111111111111111111111111111111111111' },
        undefined,
        tokensByFamily,
      )?.type,
    ).toBe('fixed-counterparties')

    expect(
      RWA.getSelectionPolicy(
        { chainId: 56, address: '0x2222222222222222222222222222222222222222' },
        undefined,
        tokensByFamily,
      )?.type,
    ).toBe('free')
  })
})
