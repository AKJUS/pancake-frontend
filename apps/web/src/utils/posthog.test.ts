import { WalletIds } from '@pancakeswap/ui-wallets/src/config/walletIds'
import { describe, expect, it } from 'vitest'

import { buildPostHogBaseProperties, getPostHogErrorProperties } from './posthog'

describe('buildPostHogBaseProperties', () => {
  it('maps shared runtime fields into analytics properties', () => {
    expect(
      buildPostHogBaseProperties({
        account: '0xabc',
        chainId: 56,
        pathname: '/swap',
        fullPath: '/swap?chain=bsc',
        host: 'pancakeswap.finance',
        connectorName: 'MetaMask',
        runtime: {
          env: 'wallet_app',
          wallet: WalletIds.Metamask,
          hostDetection: {
            isWalletApp: true,
            host: WalletIds.Metamask,
          },
          connectorId: 'metaMask',
          selectedWalletId: WalletIds.Metamask,
        },
      }),
    ).toMatchObject({
      account: '0xabc',
      wallet_connected: true,
      chain_id: 56,
      host: 'pancakeswap.finance',
      pathname: '/swap',
      full_path: '/swap?chain=bsc',
      wallet_env: 'wallet_app',
      wallet_id: WalletIds.Metamask,
      wallet_app_host: WalletIds.Metamask,
      connector_id: 'metaMask',
      connector_name: 'MetaMask',
    })
  })

  it('falls back cleanly when account and runtime are unavailable', () => {
    expect(
      buildPostHogBaseProperties({
        host: 'pancakeswap.finance',
        pathname: '/swap',
      }),
    ).toMatchObject({
      wallet_connected: false,
      host: 'pancakeswap.finance',
      pathname: '/swap',
      wallet_id: WalletIds.Unknown,
      wallet_app_host: WalletIds.Unknown,
    })
  })
})

describe('getPostHogErrorProperties', () => {
  it('extracts stable name and message from Error instances', () => {
    expect(getPostHogErrorProperties(new Error('boom'))).toEqual({
      error_name: 'Error',
      error_message: 'boom',
    })
  })

  it('uses a fallback message for non-error values', () => {
    expect(getPostHogErrorProperties({ code: 4001 }, 'Transaction rejected.')).toEqual({
      error_name: 'Error',
      error_message: 'Transaction rejected.',
    })
  })
})
