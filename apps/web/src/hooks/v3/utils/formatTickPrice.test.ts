import { Price, Token } from '@pancakeswap/sdk'
import { Bound } from 'config/constants/types'

import { formatTickPrice } from './formatTickPrice'

const LOCALE = 'en-US'

// 6-decimal token (e.g. XAUt, USDC)
const TOKEN_6 = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 6, 'XAUt')
// 18-decimal token (e.g. WETH, USDT in EVM scale)
const TOKEN_18 = new Token(1, '0x1b175474E89094C44DA98B954EeDEAC495271d0f', 18, 'WETH')
// Same-decimal pair (both 6)
const TOKEN_6B = new Token(1, '0xabCDEF1234567890ABcDEF1234567890aBCDeF12', 6, 'USDT')

function makePrice(base: Token, quote: Token, humanValue: string): Price<Token, Token> {
  const [whole, frac] = humanValue.split('.')
  const decimals = frac?.length ?? 0
  const withoutDecimals = BigInt((whole ?? '') + (frac ?? ''))
  return new Price(
    base,
    quote,
    BigInt(10 ** decimals) * BigInt(10 ** base.decimals),
    withoutDecimals * BigInt(10 ** quote.decimals),
  )
}

describe('formatTickPrice', () => {
  describe('atLimit boundaries', () => {
    it('returns "0" when LOWER bound is at limit', () => {
      const price = makePrice(TOKEN_6B, TOKEN_6B, '1.5')
      expect(formatTickPrice(price, { [Bound.LOWER]: true }, Bound.LOWER, LOCALE)).toBe('0')
    })

    it('returns "∞" when UPPER bound is at limit', () => {
      const price = makePrice(TOKEN_6B, TOKEN_6B, '1.5')
      expect(formatTickPrice(price, { [Bound.UPPER]: true }, Bound.UPPER, LOCALE)).toBe('∞')
    })

    it('formats normally when atLimit is set for the opposite bound', () => {
      const price = makePrice(TOKEN_6B, TOKEN_6B, '1.5')
      // LOWER atLimit set but checking UPPER — user sees their actual price, not ∞
      expect(formatTickPrice(price, { [Bound.LOWER]: true }, Bound.UPPER, LOCALE)).toBe('1.5')
    })
  })

  describe('undefined price', () => {
    it('returns the placeholder when price is undefined and placeholder is provided', () => {
      expect(formatTickPrice(undefined, {}, Bound.LOWER, LOCALE, '—')).toBe('—')
    })

    it('returns "-" (formatPrice fallback) when price is undefined and no placeholder', () => {
      expect(formatTickPrice(undefined, {}, Bound.LOWER, LOCALE)).toBe('-')
    })
  })

  describe('normal price formatting', () => {
    it('formats a standard price with same-decimal tokens', () => {
      const price = makePrice(TOKEN_6B, TOKEN_6B, '1.234567')
      // User sees 6-significant-figure formatted price in their locale
      expect(formatTickPrice(price, {}, Bound.LOWER, LOCALE)).toBe('1.23457')
    })

    it('formats a very small price as "<0.0001"', () => {
      const price = makePrice(TOKEN_6B, TOKEN_6B, '0.00001')
      const result = formatTickPrice(price, {}, Bound.LOWER, LOCALE)
      expect(result).toBe('<0.0001')
    })
  })

  describe('PAN-11418 regression: mismatched decimals (6 vs 18)', () => {
    // XAUt (6 dec) / WETH (18 dec) — human price ~3576 produces a raw internal
    // fraction of ~3.576e15, which exceeded the old greaterThan(1e15) guard and
    // incorrectly showed "∞" in the V3 confirmation screen.
    it('shows the actual price (~3,576) for XAUt/WETH LOWER bound when not at limit', () => {
      const price = makePrice(TOKEN_6, TOKEN_18, '3576')
      // User should see their set price, not ∞ (old bug: raw fraction ~3.576e15 > 1e15 guard)
      expect(formatTickPrice(price, {}, Bound.LOWER, LOCALE)).toBe('3,576')
    })

    it('shows the actual price (~3,576) for XAUt/WETH UPPER bound when not at limit', () => {
      const price = makePrice(TOKEN_6, TOKEN_18, '3576')
      expect(formatTickPrice(price, {}, Bound.UPPER, LOCALE)).toBe('3,576')
    })

    it('still returns "∞" for UPPER full-range (atLimit) even with mismatched decimals', () => {
      const price = makePrice(TOKEN_6, TOKEN_18, '3576')
      const result = formatTickPrice(price, { [Bound.UPPER]: true }, Bound.UPPER, LOCALE)
      expect(result).toBe('∞')
    })

    it('still returns "0" for LOWER full-range (atLimit) even with mismatched decimals', () => {
      const price = makePrice(TOKEN_6, TOKEN_18, '3576')
      const result = formatTickPrice(price, { [Bound.LOWER]: true }, Bound.LOWER, LOCALE)
      expect(result).toBe('0')
    })
  })
})
