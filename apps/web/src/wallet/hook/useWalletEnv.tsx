import { WalletIds } from '@pancakeswap/ui-wallets/src/config/walletIds'
import { selectedWalletAtom } from '@pancakeswap/ui-wallets/src/state/atom'
import { useAtomValue, useSetAtom } from 'jotai'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { walletRuntimeAtom } from 'wallet/atoms/runtimeAtom'
import { buildWalletRuntimeState, DEFAULT_WALLET_RUNTIME_STATE, WalletRuntimeState } from 'wallet/runtime'

type WalletRuntimeContextValue = WalletRuntimeState

const WalletEnvContext = createContext<WalletRuntimeContextValue | null>(null)

const useFarcasterMiniAppSignal = () => {
  const [isInMiniApp, setIsInMiniApp] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (isInMiniApp !== null) return undefined

    let cancelled = false

    const init = async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')

        try {
          sdk.actions.ready()
        } catch (error) {
          console.warn('[wallet] Base miniapp ready() failed', error)
        }
        const nextIsInMiniApp = await sdk.isInMiniApp()
        if (!cancelled) {
          setIsInMiniApp(nextIsInMiniApp)
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[wallet] Base miniapp env check failed', error)
          setIsInMiniApp(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [isInMiniApp])

  return isInMiniApp
}

export const WalletEnvProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const isInMiniApp = useFarcasterMiniAppSignal()
  const { connector } = useAccount()
  const selectedWallet = useAtomValue(selectedWalletAtom)
  const setWalletRuntime = useSetAtom(walletRuntimeAtom)

  const runtime = useMemo(() => {
    if (isInMiniApp === null) {
      return DEFAULT_WALLET_RUNTIME_STATE
    }

    return buildWalletRuntimeState({
      host: typeof window === 'undefined' ? undefined : window.location.host,
      isInMiniApp,
      connectorId: connector?.id ?? null,
      selectedWalletId: (selectedWallet?.id as WalletIds | undefined) ?? null,
    })
  }, [isInMiniApp, connector?.id, selectedWallet?.id])

  useEffect(() => {
    if (isInMiniApp !== null) {
      setWalletRuntime(runtime)
    }
  }, [runtime, setWalletRuntime, isInMiniApp])

  if (isInMiniApp === null) {
    return null
  }

  return <WalletEnvContext.Provider value={runtime}>{children}</WalletEnvContext.Provider>
}

export const useWalletRuntime = () => {
  const runtime = useContext(WalletEnvContext)

  if (runtime === null) {
    throw new Error('useWalletRuntime must be used within WalletEnvProvider')
  }

  return runtime
}
