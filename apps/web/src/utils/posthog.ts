import { WalletIds } from '@pancakeswap/ui-wallets/src/config/walletIds'
import type { WalletRuntimeState } from 'wallet/runtime'

type Primitive = string | number | boolean | null | undefined
export type PostHogProperties = Record<string, Primitive>

type PostHogClient = typeof import('posthog-js').default

let posthogClientPromise: Promise<PostHogClient | null> | null = null
let posthogInitialized = false

const POSTHOG_DEFAULTS_VERSION = '2025-11-30'

const isBrowser = () => typeof window !== 'undefined'

export const isPostHogConfigured = () =>
  Boolean(
    (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_KEY) &&
      process.env.NEXT_PUBLIC_POSTHOG_HOST,
  )

const getPostHogConfig = () => {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_KEY
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

  if (!apiKey || !apiHost) {
    return null
  }

  return { apiKey, apiHost }
}

const getPostHogClient = async (): Promise<PostHogClient | null> => {
  if (!isBrowser()) {
    return null
  }

  const config = getPostHogConfig()
  if (!config) {
    return null
  }

  if (!posthogClientPromise) {
    posthogClientPromise = import('posthog-js').then((module) => module.default)
  }

  return posthogClientPromise
}

const sanitizeProperties = (properties: PostHogProperties = {}) => {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined))
}

export const initPostHog = async () => {
  const config = getPostHogConfig()
  const posthog = await getPostHogClient()

  if (!config || !posthog || posthogInitialized) {
    return false
  }

  posthog.init(config.apiKey, {
    api_host: config.apiHost,
    defaults: POSTHOG_DEFAULTS_VERSION,
    capture_pageview: false,
    autocapture: false,
    debug: process.env.NODE_ENV === 'development',
  })

  posthogInitialized = true
  return true
}

export const capturePostHogEvent = (event: string, properties?: PostHogProperties) => {
  getPostHogClient()
    .then((posthog) => {
      if (!posthog || !posthogInitialized) {
        return
      }

      posthog.capture(event, sanitizeProperties(properties))
    })
    .catch(() => {})
}

export const identifyPostHogUser = (distinctId: string, properties?: PostHogProperties) => {
  getPostHogClient()
    .then((posthog) => {
      if (!posthog || !posthogInitialized) {
        return
      }

      posthog.identify(distinctId, sanitizeProperties(properties))
    })
    .catch(() => {})
}

export const resetPostHogUser = () => {
  getPostHogClient()
    .then((posthog) => {
      if (!posthog || !posthogInitialized) {
        return
      }

      posthog.reset()
    })
    .catch(() => {})
}

export const buildPostHogBaseProperties = ({
  account,
  chainId,
  runtime,
  pathname,
  fullPath,
  host,
  connectorName,
}: {
  account?: string | null
  chainId?: number | null
  runtime?: WalletRuntimeState | null
  pathname?: string | null
  fullPath?: string | null
  host?: string | null
  connectorName?: string | null
} = {}): PostHogProperties => {
  const currentHost = host ?? (isBrowser() ? window.location.host : null)
  const currentPathname = pathname ?? (isBrowser() ? window.location.pathname : null)
  const currentFullPath = fullPath ?? (isBrowser() ? `${window.location.pathname}${window.location.search}` : null)

  return sanitizeProperties({
    account: account ?? null,
    wallet_connected: Boolean(account),
    chain_id: chainId ?? null,
    host: currentHost,
    pathname: currentPathname,
    full_path: currentFullPath,
    wallet_env: runtime?.env ?? null,
    wallet_id: runtime?.wallet ?? WalletIds.Unknown,
    wallet_app_host: runtime?.hostDetection.host ?? WalletIds.Unknown,
    connector_id: runtime?.connectorId ?? null,
    connector_name: connectorName ?? null,
  })
}

export const getPostHogErrorProperties = (error: unknown, fallbackMessage?: string): PostHogProperties => {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message || fallbackMessage || null,
    }
  }

  if (typeof error === 'string') {
    return {
      error_name: 'Error',
      error_message: error || fallbackMessage || null,
    }
  }

  if (error && typeof error === 'object') {
    const maybeError = error as { name?: unknown; message?: unknown }
    return {
      error_name: typeof maybeError.name === 'string' ? maybeError.name : 'Error',
      error_message: typeof maybeError.message === 'string' ? maybeError.message : fallbackMessage || null,
    }
  }

  return {
    error_name: 'Error',
    error_message: fallbackMessage || null,
  }
}
