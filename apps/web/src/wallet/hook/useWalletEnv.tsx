import { createContext, useContext, useEffect, useState } from 'react'

export enum WalletEnv {
  BaseMiniApp = 'baseminiapp',
  Other = 'other',
}

const WalletEnvContext = createContext<WalletEnv | null>(null)

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
          setWalletEnv(isInMiniApp ? WalletEnv.BaseMiniApp : WalletEnv.Other)
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
