import { WalletIds } from '@pancakeswap/ui-wallets/src/config/walletIds'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildPostHogBaseProperties,
  getPostHogErrorProperties,
  getPostHogEventSampleRate,
  getPostHogSampleRate,
  shouldCapturePostHogEvent,
} from './posthog'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildPostHogBaseProperties', () => {
  it('omits account by default while keeping shared runtime fields', () => {
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

  it('includes account when identity is explicitly enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_IDENTIFY_ENABLED', 'true')

    expect(
      buildPostHogBaseProperties({
        account: '0xabc',
        host: 'pancakeswap.finance',
        pathname: '/swap',
      }),
    ).toMatchObject({
      account: '0xabc',
      wallet_connected: true,
      host: 'pancakeswap.finance',
      pathname: '/swap',
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

describe('PostHog sampling', () => {
  it('defaults to a 10% sample rate for non-core events', () => {
    expect(getPostHogSampleRate()).toBe(0.1)
    expect(getPostHogEventSampleRate('$pageview')).toBe(0.1)
  })

  it('uses full fidelity for core success events', () => {
    expect(getPostHogEventSampleRate('swap_succeeded')).toBe(1)
    expect(getPostHogEventSampleRate('liquidity_add_succeeded')).toBe(1)
    expect(shouldCapturePostHogEvent('swap_succeeded', 0.99)).toBe(true)
  })

  it('disables noisy lifecycle events by default', () => {
    expect(getPostHogEventSampleRate('wallet_connected')).toBe(0)
    expect(getPostHogEventSampleRate('liquidity_add_failed')).toBe(0)
    expect(shouldCapturePostHogEvent('wallet_connected', 0)).toBe(false)
  })

  it('allows overriding the default sample rate with env', () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_SAMPLE_RATE', '0.25')

    expect(getPostHogSampleRate()).toBe(0.25)
    expect(getPostHogEventSampleRate('$pageview')).toBe(0.25)
    expect(shouldCapturePostHogEvent('$pageview', 0.2)).toBe(true)
    expect(shouldCapturePostHogEvent('$pageview', 0.3)).toBe(false)
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
