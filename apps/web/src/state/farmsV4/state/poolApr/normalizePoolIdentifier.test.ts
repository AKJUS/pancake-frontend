import { describe, expect, it } from 'vitest'
import { buildPoolAprKey, normalizePoolAprKey } from './normalizePoolIdentifier'

describe('pool apr key normalization', () => {
  it('lowercases EVM addresses when building keys', () => {
    expect(buildPoolAprKey(143, '0x63e48B725540A3Db24ACF6682a29f877808C53F2')).toBe(
      '143:0x63e48b725540a3db24acf6682a29f877808c53f2',
    )
  })

  it('normalizes mixed-case keys for atom lookups', () => {
    expect(normalizePoolAprKey('8453:0x1234AbCd00000000000000000000000000000000')).toBe(
      '8453:0x1234abcd00000000000000000000000000000000',
    )
  })
})
