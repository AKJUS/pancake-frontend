import { describe, expect, it } from 'vitest'
import { getWalletEnv, WalletEnv } from './useWalletEnv'

describe('getWalletEnv', () => {
  it('returns other outside mini app', () => {
    expect(getWalletEnv({ host: 'pancakeswap.finance', isInMiniApp: false })).toBe(WalletEnv.Other)
  })

  it('returns base pcs mini app on pancakeswap.finance inside mini app', () => {
    expect(getWalletEnv({ host: 'pancakeswap.finance', isInMiniApp: true })).toBe(WalletEnv.BasePcsMiniApp)
  })

  it('returns base cakepad mini app on cakepad host inside mini app', () => {
    expect(getWalletEnv({ host: 'cakepad.pancakeswap.finance', isInMiniApp: true })).toBe(WalletEnv.BaseCakepadMiniApp)
  })

  it('normalizes hosts with ports', () => {
    expect(getWalletEnv({ host: 'cakepad.pancakeswap.finance:3000', isInMiniApp: true })).toBe(
      WalletEnv.BaseCakepadMiniApp,
    )
  })

  it('falls back to other for unsupported hosts even inside mini app', () => {
    expect(getWalletEnv({ host: 'example.com', isInMiniApp: true })).toBe(WalletEnv.Other)
  })
})
