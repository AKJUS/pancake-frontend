import { useSetAtom } from 'jotai'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import {
  aggregatorOverrideAtom,
  createAggregatorOverrideState,
  getAggregatorOverrideQueryAction,
} from 'state/featureFlags/aggregatorOverrideAtom'
import { posthogFlagsAtom } from 'state/featureFlags/posthogFlagsAtom'
import { useAccount } from 'wagmi'
import { useWalletRuntime } from 'wallet/hook/useWalletEnv'

import {
  buildPostHogBaseProperties,
  capturePostHogEvent,
  identifyPostHogUser,
  initPostHog,
  isPostHogConfigured,
  onPostHogFeatureFlags,
  resetPostHogUser,
} from 'utils/posthog'

export const usePostHog = () => {
  const router = useRouter()
  const { address, chainId, connector, status } = useAccount()
  const runtime = useWalletRuntime()
  const setFlags = useSetAtom(posthogFlagsAtom)
  const setAggregatorOverride = useSetAtom(aggregatorOverrideAtom)
  const hasTrackedInitialPageView = useRef(false)
  const lastConnectedState = useRef<{
    address?: string
    chainId?: number
    connectorName?: string
  } | null>(null)

  // Keep app-level analytics in one place so pageviews and wallet identity stay in sync.
  useEffect(() => {
    if (!isPostHogConfigured()) {
      return undefined
    }

    let unsubscribe: (() => void) | null = null
    initPostHog()
      .then(() => {
        unsubscribe = onPostHogFeatureFlags((flags) => {
          const next: Record<string, boolean> = {}
          for (const flag of flags) {
            next[flag] = true
          }
          if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') {
            console.log('[PostHog] Feature flags received:', flags, 'mapped:', next)
          }
          setFlags(next)
        })
      })
      .catch(() => {})

    return () => {
      unsubscribe?.()
    }
  }, [setFlags])

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    const action = getAggregatorOverrideQueryAction(router.query.agg_override)
    if (action === 'enable') {
      setAggregatorOverride(createAggregatorOverrideState())
      return
    }

    if (action === 'clear') {
      setAggregatorOverride(null)
    }
  }, [router.isReady, router.query.agg_override, setAggregatorOverride])

  useEffect(() => {
    if (!isPostHogConfigured() || !router.isReady || hasTrackedInitialPageView.current) {
      return
    }

    hasTrackedInitialPageView.current = true
    initPostHog()
      .then(() => {
        capturePostHogEvent('$pageview', buildPostHogBaseProperties({ account: address, chainId, runtime }))
      })
      .catch(() => {})
  }, [address, chainId, router.isReady, runtime])

  useEffect(() => {
    if (!isPostHogConfigured()) {
      return undefined
    }

    const handleRouteChange = (url: string) => {
      const [pathname, search = ''] = url.split('?')
      capturePostHogEvent(
        '$pageview',
        buildPostHogBaseProperties({
          account: address,
          chainId,
          runtime,
          pathname,
          fullPath: search ? `${pathname}?${search}` : pathname,
        }),
      )
    }

    router.events.on('routeChangeComplete', handleRouteChange)

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [address, chainId, router.events, runtime])

  useEffect(() => {
    if (!isPostHogConfigured()) {
      return
    }

    if (status === 'connected' && address) {
      const connectorName = connector?.name ?? null
      const properties = buildPostHogBaseProperties({
        account: address,
        chainId,
        runtime,
        connectorName,
      })

      identifyPostHogUser(address, properties)

      const previous = lastConnectedState.current
      if (previous?.address !== address) {
        capturePostHogEvent('wallet_connected', properties)
      }

      lastConnectedState.current = {
        address,
        chainId: chainId ?? undefined,
        connectorName: connectorName ?? undefined,
      }
    } else if (status === 'disconnected' && lastConnectedState.current?.address) {
      const previous = lastConnectedState.current
      capturePostHogEvent(
        'wallet_disconnected',
        buildPostHogBaseProperties({
          account: previous.address,
          chainId: previous.chainId,
          runtime,
          connectorName: previous.connectorName,
        }),
      )
      resetPostHogUser()
      lastConnectedState.current = null
    }
  }, [address, chainId, connector?.name, runtime, status])
}
