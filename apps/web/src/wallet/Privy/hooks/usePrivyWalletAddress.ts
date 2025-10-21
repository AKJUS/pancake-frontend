import { usePrivy } from '@privy-io/react-auth'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useEffect, useState } from 'react'
import { Address } from 'viem'
import { useAccount, useConnectors } from 'wagmi'
import { useEmbeddedSmartAccountConnectorV2 } from './usePrivySmartAccountConnector'

/**
 * Unified hook for managing Privy wallet address display
 * Prevents flickering between embedded wallet and smart wallet addresses
 */
export const usePrivyWalletAddress = () => {
  const { address: wagmiAddress, connector } = useAccount()
  const { client: smartWalletClient } = useSmartWallets()
  const { ready, authenticated, user, logout } = usePrivy()
  const connectors = useConnectors()
  const { isSmartWalletReady, isSettingUp, shouldUseAAWallet, hasSetupFailed } = useEmbeddedSmartAccountConnectorV2()

  const [finalAddress, setFinalAddress] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [addressType, setAddressType] = useState<'embedded' | 'smart' | null>(null)
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null)
  // Track loading time to prevent infinite loading
  useEffect(() => {
    if (isLoading && !loadingStartTime) {
      setLoadingStartTime(Date.now())
    } else if (!isLoading && loadingStartTime) {
      setLoadingStartTime(null)
    }
  }, [isLoading, loadingStartTime])

  // Global timeout to prevent infinite loading (10 seconds)
  useEffect(() => {
    if (loadingStartTime) {
      const timeoutId = setTimeout(() => {
        const loadingDuration = (Date.now() - loadingStartTime) / 1000
        console.error(`[PrivyWalletAddress] ⚠️ Loading timeout after ${loadingDuration.toFixed(2)} seconds!`)
        console.error('[PrivyWalletAddress] Forcing error state to prevent infinite loading')

        // Force stop loading and show error state
        setLoadingStartTime(null)
        setFinalAddress(undefined)
        setAddressType(null)
        setIsLoading(false)
        // Force logout if an embedded wallet is injected
        if (authenticated) {
          logout()
        }
      }, 10000) // 10 seconds global timeout

      return () => clearTimeout(timeoutId)
    }
    return undefined
  }, [loadingStartTime, logout, authenticated])

  useEffect(() => {
    // HIGHEST PRIORITY: If we have AA wallet connected with address, show it immediately
    if (connector?.id === 'io.privy.smart_wallet' && wagmiAddress) {
      setFinalAddress(wagmiAddress)
      setAddressType('smart')
      setIsLoading(false) // Force stop loading
      return // Exit early, don't check anything else
    }

    // If Privy is not ready or user is not authenticated, keep loading state
    if (!ready || !authenticated) {
      setFinalAddress(undefined)
      setAddressType(null)
      setIsLoading(true)
      return
    }

    // If AA wallet is disabled via URL param, use embedded wallet directly
    if (!shouldUseAAWallet) {
      if (user?.wallet && wagmiAddress) {
        setFinalAddress(wagmiAddress)
        setAddressType('embedded')
        setIsLoading(false)
      } else if (user?.wallet) {
        // Has wallet but address not ready yet
        setIsLoading(true)
      } else {
        // No wallet
        setFinalAddress(undefined)
        setAddressType(null)
        setIsLoading(false)
      }
      return
    }

    // If smart wallet connector is being set up, wait for completion
    if (isSettingUp) {
      setIsLoading(true)
      return
    }

    // If smart wallet is not ready yet, wait
    if (!isSmartWalletReady) {
      setIsLoading(true)
      return
    }

    // Only use smart wallet - no fallback to embedded wallet
    const smartAccountConnector = connectors.find((c) => c.id === 'io.privy.smart_wallet')

    if (smartAccountConnector) {
      // Smart wallet exists but not yet connected (we already handled the connected case above)
      // Keep waiting for connection
      console.warn('[PrivyWalletAddress] ⚠️ Smart wallet exists but not connected, waiting...', {
        connectorId: connector?.id,
        hasAddress: !!wagmiAddress,
      })
      setIsLoading(true)
    } else if (user?.wallet) {
      // User has wallet but no smart wallet connector available
      // Keep loading state to force smart wallet setup
      console.warn('[PrivyWalletAddress] ⚠️ User has wallet but no smart wallet connector, waiting for setup...')
      setIsLoading(true)
    } else {
      // No wallet at all
      setFinalAddress(undefined)
      setAddressType(null)
      setIsLoading(false)
    }
  }, [
    ready,
    authenticated,
    user,
    smartWalletClient,
    wagmiAddress,
    connector,
    connectors,
    isSmartWalletReady,
    isSettingUp,
    shouldUseAAWallet,
  ])

  return {
    address: finalAddress as Address | undefined,
    isLoading,
    addressType,
    // Additional status information
    hasSmartWallet: !!smartWalletClient,
    isSmartWalletReady,
    isSettingUp,
    hasSetupFailed,
  }
}
