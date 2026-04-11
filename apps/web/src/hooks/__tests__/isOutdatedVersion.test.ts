import { describe, it, expect } from 'vitest'
import { isOutdatedVersion } from '../useMetamaskVersionWarning'

describe('isOutdatedVersion', () => {
  it('returns true when current version is lower than minimum', () => {
    expect(isOutdatedVersion('1.2.3', '1.2.2')).toBe(true)
    expect(isOutdatedVersion('1.2.3', '1.1.9')).toBe(true)
    expect(isOutdatedVersion('2.0.0', '1.9.9')).toBe(true)
  })

  it('returns false when current version is equal to minimum', () => {
    expect(isOutdatedVersion('1.2.3', '1.2.3')).toBe(false)
  })

  it('returns false when current version is higher than minimum', () => {
    expect(isOutdatedVersion('1.2.3', '1.2.4')).toBe(false)
    expect(isOutdatedVersion('1.2.3', '1.3.0')).toBe(false)
    expect(isOutdatedVersion('1.2.3', '2.0.0')).toBe(false)
  })

  it('handles versions with missing parts', () => {
    expect(isOutdatedVersion('1.2.0', '1.2')).toBe(false)
    expect(isOutdatedVersion('1.2', '1.1')).toBe(true)
    expect(isOutdatedVersion('1.0', '1')).toBe(false)
  })

  it('returns false when current version is invalid', () => {
    expect(isOutdatedVersion('1.2.3', 'abc')).toBe(false)
    expect(isOutdatedVersion('1.2.3', '1.2.x')).toBe(false)
  })

  it('returns false when current version is null or undefined', () => {
    expect(isOutdatedVersion('1.2.3', null)).toBe(false)
    expect(isOutdatedVersion('1.2.3', undefined)).toBe(false)
  })
})
