import { useSetAtom, useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { baseMiniAppAutoConnectRetryAtom, baseMiniAppAutoConnectStatusAtom } from 'state/wallet/atom'
import { useAccount, useConnect } from 'wagmi'
import { farcasterMiniAppConnector } from 'utils/wagmi'
import { WalletEnv, useWalletEnv } from './useWalletEnv'

const CONNECT_DELAY_MS = 500
const CONNECT_ATTEMPTS = 5

export const useBaseMiniAppAutoConnect = () => {
  const { address, connector, isConnected } = useAccount()
  const { connectAsync, isPending } = useConnect()
  const retryCount = useAtomValue(baseMiniAppAutoConnectRetryAtom)
  const setStatus = useSetAtom(baseMiniAppAutoConnectStatusAtom)
  const walletEnv = useWalletEnv()
  const checkedRef = useRef(false)
  const inFlightRef = useRef(false)

  useEffect(() => {
    checkedRef.current = false
    inFlightRef.current = false
  }, [retryCount])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (checkedRef.current || inFlightRef.current) return undefined
    if (address || connector || isConnected) {
      checkedRef.current = true
      setStatus('connected')
      return undefined
    }
    if (isPending) return undefined
    if (walletEnv === WalletEnv.Other) {
      checkedRef.current = true
      setStatus('idle')
      return undefined
    }

    let cancelled = false
    inFlightRef.current = true
    setStatus('connecting')

    const init = async () => {
      try {
        const tryConnect = async (attemptsLeft: number): Promise<void> => {
          try {
            await new Promise((resolve) => setTimeout(resolve, CONNECT_DELAY_MS))
            await connectAsync({ connector: farcasterMiniAppConnector })
          } catch (error) {
            if (cancelled || attemptsLeft <= 1) {
              throw error
            }
            await new Promise((resolve) => setTimeout(resolve, CONNECT_DELAY_MS))
            await tryConnect(attemptsLeft - 1)
          }
        }

        await tryConnect(CONNECT_ATTEMPTS)
        checkedRef.current = true
        setStatus('connected')
      } catch (error) {
        if (!cancelled) {
          checkedRef.current = true
          setStatus('failed')
          console.warn('[wallet] Base miniapp auto-connect failed', error)
        }
      } finally {
        inFlightRef.current = false
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [address, connector, connectAsync, isConnected, isPending, retryCount, setStatus, walletEnv])
}
