import { EvmConnectorNames } from '@pancakeswap/ui-wallets/src/config/connectorNames'
import { WalletIds } from '@pancakeswap/ui-wallets/src/config/walletIds'
import { describe, expect, it } from 'vitest'
import { buildWalletRuntimeState, detectBaseMiniAppHost } from './runtime'

describe('buildWalletRuntimeState', () => {
  it('maps base mini app to wallet_app and BaseApp wallet id', () => {
    expect(
      buildWalletRuntimeState({
        host: 'cakepad.pancakeswap.finance',
        isInMiniApp: true,
      }),
    ).toMatchObject({
      env: 'wallet_app',
      wallet: WalletIds.BaseApp,
    })
  })

  it('maps walletconnect connector id to WalletIds.Walletconnect', () => {
    expect(
      buildWalletRuntimeState({
        isInMiniApp: false,
        connectorId: EvmConnectorNames.WalletConnect,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      }),
    ).toMatchObject({
      env: 'desktop_browser',
      wallet: WalletIds.Walletconnect,
    })
  })

  it('prefers selected wallet id when connector is injected', () => {
    expect(
      buildWalletRuntimeState({
        isInMiniApp: false,
        connectorId: EvmConnectorNames.Injected,
        selectedWalletId: WalletIds.Okx,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile',
      }),
    ).toMatchObject({
      env: 'mobile_browser',
      wallet: WalletIds.Okx,
    })
  })

  it('falls back to WalletIds.Unknown when no signal is available', () => {
    expect(
      buildWalletRuntimeState({
        isInMiniApp: false,
        userAgent: 'CustomAgent/1.0',
      }),
    ).toMatchObject({
      env: 'desktop_browser',
      wallet: WalletIds.Unknown,
    })
  })
})

describe('detectBaseMiniAppHost', () => {
  it('detects supported base mini app hosts from raw mini app signals', () => {
    expect(detectBaseMiniAppHost({ host: 'pancakeswap.finance', isInMiniApp: true })).toBe(true)
    expect(detectBaseMiniAppHost({ host: 'cakepad.pancakeswap.finance', isInMiniApp: true })).toBe(true)
    expect(detectBaseMiniAppHost({ host: 'example.com', isInMiniApp: true })).toBe(false)
    expect(detectBaseMiniAppHost({ host: 'pancakeswap.finance', isInMiniApp: false })).toBe(false)
  })
})
