import { createContext, useContext, useEffect, useState } from 'react'
import { CAKEPAD_HOST, PANCAKESWAP_HOST, normalizeHost } from 'utils/domainMiniAppMeta'

export enum WalletEnv {
  BasePcsMiniApp = 'basepcsminiapp',
  BaseCakepadMiniApp = 'basecakepadminiapp',
  Other = 'other',
}

const WalletEnvContext = createContext<WalletEnv | null>(null)

export const getWalletEnv = ({ host, isInMiniApp }: { host?: string | string[]; isInMiniApp: boolean }): WalletEnv => {
  if (!isInMiniApp) {
    return WalletEnv.Other
  }

  const normalizedHost = normalizeHost(host)

  if (normalizedHost === CAKEPAD_HOST) {
    return WalletEnv.BaseCakepadMiniApp
  }

  if (normalizedHost === PANCAKESWAP_HOST) {
    return WalletEnv.BasePcsMiniApp
  }

  return WalletEnv.Other
}

export const isBaseMiniAppWalletEnv = (walletEnv: WalletEnv | null) =>
  walletEnv === WalletEnv.BasePcsMiniApp || walletEnv === WalletEnv.BaseCakepadMiniApp

const useWalletEnvDetect = () => {
  const [walletEnv, setWalletEnv] = useState<WalletEnv | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (walletEnv !== null) return undefined

    let cancelled = false

    const init = async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')

        try {
          sdk.actions.ready()
        } catch (error) {
          console.warn('[wallet] Base miniapp ready() failed', error)
        }
        const isInMiniApp = await sdk.isInMiniApp()
        if (!cancelled) {
          setWalletEnv(
            getWalletEnv({
              host: window.location.host,
              isInMiniApp,
            }),
          )
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[wallet] Base miniapp env check failed', error)
          setWalletEnv(WalletEnv.Other)
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [walletEnv])

  return walletEnv
}

export const WalletEnvProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const walletEnv = useWalletEnvDetect()

  if (walletEnv === null) {
    return null
  }

  return <WalletEnvContext.Provider value={walletEnv}>{children}</WalletEnvContext.Provider>
}

export const useWalletEnv = () => {
  const walletEnv = useContext(WalletEnvContext)

  if (walletEnv === null) {
    throw new Error('useWalletEnv must be used within WalletEnvProvider')
  }

  return walletEnv
}
