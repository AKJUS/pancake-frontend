import { describe, it, expect } from 'vitest'
import isPancakeLpToken from './isPancakeLpToken'

describe('isPancakeLpToken', () => {
  it('matches canonical LP symbols case-insensitively', () => {
    expect(isPancakeLpToken({ symbol: 'Cake-LP' })).toBe(true)
    expect(isPancakeLpToken({ symbol: 'cake-lp' })).toBe(true)
    expect(isPancakeLpToken({ symbol: 'CAKE-LP' })).toBe(true)
    expect(isPancakeLpToken({ symbol: 'Stable-LP' })).toBe(true)
    expect(isPancakeLpToken({ symbol: 'stable-lp' })).toBe(true)
  })

  it('matches canonical Pancake LP token names', () => {
    expect(isPancakeLpToken({ name: 'Pancake LPs' })).toBe(true)
    expect(isPancakeLpToken({ name: 'Pancake LP' })).toBe(true)
    expect(isPancakeLpToken({ name: 'Pancake StableSwap LPs' })).toBe(true)
    expect(isPancakeLpToken({ name: 'pancake stableswap lps' })).toBe(true)
  })

  it('rejects non-Pancake LP tokens', () => {
    expect(isPancakeLpToken({ symbol: 'UNI-V2', name: 'Uniswap V2' })).toBe(false)
    expect(isPancakeLpToken({ symbol: 'SLP', name: 'SushiSwap LP Token' })).toBe(false)
    expect(isPancakeLpToken({ symbol: 'CAKE', name: 'PancakeSwap Token' })).toBe(false)
  })

  it('rejects unrelated tokens that contain "LP" as a substring', () => {
    expect(isPancakeLpToken({ symbol: 'HELP', name: 'Helpful Token' })).toBe(false)
    expect(isPancakeLpToken({ name: 'Pancakehelp' })).toBe(false)
    expect(isPancakeLpToken({ name: 'LP Token' })).toBe(false)
  })

  it('handles missing / nullish fields', () => {
    expect(isPancakeLpToken({})).toBe(false)
    expect(isPancakeLpToken({ symbol: null, name: null })).toBe(false)
    expect(isPancakeLpToken({ symbol: undefined, name: undefined })).toBe(false)
    expect(isPancakeLpToken({ symbol: '' })).toBe(false)
  })
})
