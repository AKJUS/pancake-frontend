import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useWalletRuntime } from 'wallet/hook/useWalletEnv'

import {
  buildPostHogBaseProperties,
  capturePostHogEvent,
  identifyPostHogUser,
  initPostHog,
  isPostHogConfigured,
  resetPostHogUser,
} from 'utils/posthog'

export const usePostHog = () => {
  const router = useRouter()
  const { address, chainId, connector, status } = useAccount()
  const runtime = useWalletRuntime()
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

    initPostHog().catch(() => {})
    return undefined
  }, [])

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
