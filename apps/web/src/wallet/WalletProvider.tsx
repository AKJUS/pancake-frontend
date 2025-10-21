import { isInBinance } from '@binance/w3w-utils'
import dynamic from 'next/dynamic'
import { useAtom, useAtomValue } from 'jotai'
import { usePrivy } from '@privy-io/react-auth'
import { atomWithStorage } from 'jotai/utils'
import { useCallback, useEffect, useRef } from 'react'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { rpcUrlAtom } from '@pancakeswap/utils/user'
import { W3WConfigProvider } from './W3WConfigContext'
import { useSyncWagmiState } from './hook/useSyncWagmiState'
import { useWagmiConfig } from './hook/useWagmiConfig'
import { useSyncPersistChain } from './hook/useSyncPersistChain'
import { SolanaWalletStateUpdater } from './SolanaProvider'

interface WalletProviderProps {
  reconnectOnMount?: boolean
  children?: React.ReactNode
}

export interface EIP6963Detail {
  provider: any
  info: {
    name: string
    rdns: string
    uuid: string
    icon: string
  }
}
export const eip6963Providers: EIP6963Detail[] = []

const walletRecoveryRecordsAtom = atomWithStorage<Record<string, number>>('pcs:socialLogin:walletRecoveryRecords', {})

const SolanaProviders = dynamic(() => import('@pancakeswap/ui-wallets').then((m) => m.SolanaProvider), { ssr: false })

const usePrivyProvider = () => {
  const { authenticated, ready, user, createWallet, setWalletRecovery } = usePrivy()
  const [recoveryRecords, setRecoveryRecords] = useAtom(walletRecoveryRecordsAtom)
  const attemptedWalletCreation = useRef(false)

  const handleWalletRecovery = useCallback(() => {
    const smartWalletAddress = user?.smartWallet?.address
    const lastRecoveryForThisWallet = smartWalletAddress ? recoveryRecords[smartWalletAddress] || 0 : 0

    if (authenticated && ready && user?.wallet?.recoveryMethod === 'privy' && user?.smartWallet && smartWalletAddress) {
      const now = Date.now()
      const oneWeek = 7 * 24 * 60 * 60 * 1000
      const timeSinceLastRecovery = now - lastRecoveryForThisWallet
      const shouldTriggerRecovery = timeSinceLastRecovery > oneWeek

      if (shouldTriggerRecovery) {
        setWalletRecovery()

        // Update recovery record for this specific wallet address
        setRecoveryRecords((prev) => ({
          ...prev,
          [smartWalletAddress]: now,
        }))
      }
    }
  }, [ready, user, authenticated, recoveryRecords, setRecoveryRecords, setWalletRecovery])

  useEffect(() => {
    if (ready && authenticated && user?.wallet?.address && user?.smartWallet?.address) {
      handleWalletRecovery()
    }
  }, [ready, authenticated, user?.wallet?.address, user?.smartWallet?.address, handleWalletRecovery])

  useEffect(() => {
    const createWalletWithUserManagedRecovery = async () => {
      if (ready && authenticated && user?.wallet === undefined && attemptedWalletCreation.current === false) {
        attemptedWalletCreation.current = true
        try {
          await createWallet()
        } catch (error) {
          console.error('Failed to create wallet, retriggering auth lifecycle:', error)
          try {
            const keysToRemove = []
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith('privy:')) {
                // @ts-ignore
                keysToRemove.push(key)
              }
            }
            keysToRemove.forEach((key) => {
              localStorage.removeItem(key)
            })

            const { retriggerFirebaseAuth } = await import('wallet/Privy/firebase')
            await retriggerFirebaseAuth()
          } catch (logoutError) {
            console.error('Failed to retrigger auth:', logoutError)
          }
          attemptedWalletCreation.current = false
        }
      }
    }
    createWalletWithUserManagedRecovery()
  }, [ready, user, authenticated, createWallet])
}

export const WalletProvider = (props: WalletProviderProps) => {
  const { children } = props
  const endpoint = useAtomValue(rpcUrlAtom)
  usePrivyProvider()

  const wagmiConfig = useWagmiConfig()

  if (!wagmiConfig) {
    return null // or a loading spinner
  }

  // const needSolanaProvider = SOLANA_SUPPORTED_PATH.includes(router.pathname)

  return (
    <PrivyWagmiProvider reconnectOnMount config={wagmiConfig}>
      <W3WConfigProvider value={isInBinance()}>
        <Sync />
        <SolanaProviders endpoint={endpoint}>
          <SolanaWalletStateUpdater />
          {children}
        </SolanaProviders>
      </W3WConfigProvider>
    </PrivyWagmiProvider>
  )
}

const Sync = () => {
  useSyncWagmiState()
  useSyncPersistChain()
  return null
}
