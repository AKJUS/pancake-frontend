import { ChainId } from '@pancakeswap/chains'
import { WalletIds } from '@pancakeswap/ui-wallets'
import { useActiveChainId } from 'hooks/useAccountActiveChain'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { useSetAtom, useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { baseMiniAppAutoConnectRetryAtom, baseMiniAppAutoConnectStatusAtom } from 'state/wallet/atom'
import { useAccount, useConnect } from 'wagmi'
import { baseAccountConnector } from 'utils/wagmi'
import { useWalletRuntime } from './useWalletEnv'

const CONNECT_DELAY_MS = 500
const CONNECT_ATTEMPTS = 5

export const useBaseMiniAppAutoConnect = () => {
  const { address, connector, isConnected } = useAccount()
  const { chainId } = useActiveChainId()
  const { connectAsync, isPending } = useConnect()
  const { switchNetwork, canSwitch, isLoading: isSwitching } = useSwitchNetwork()
  const retryCount = useAtomValue(baseMiniAppAutoConnectRetryAtom)
  const setStatus = useSetAtom(baseMiniAppAutoConnectStatusAtom)
  const { env, wallet } = useWalletRuntime()
  const isBaseMiniApp = env === 'wallet_app' && wallet === WalletIds.BaseApp
  const checkedRef = useRef(false)
  const inFlightRef = useRef(false)
  const switchAttemptedRef = useRef(false)

  useEffect(() => {
    checkedRef.current = false
    inFlightRef.current = false
    switchAttemptedRef.current = false
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
    if (!isBaseMiniApp) {
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
            await connectAsync({ connector: baseAccountConnector })
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
  }, [address, connector, connectAsync, isBaseMiniApp, isConnected, isPending, retryCount, setStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (!isBaseMiniApp) return undefined
    if (!address || !connector || !isConnected) return undefined
    if (chainId === ChainId.BASE) {
      switchAttemptedRef.current = false
      return undefined
    }
    if (!canSwitch || isSwitching || switchAttemptedRef.current) return undefined

    switchAttemptedRef.current = true

    switchNetwork(ChainId.BASE, { from: 'switch' }).catch((error) => {
      switchAttemptedRef.current = false
      console.warn('[wallet] Base miniapp switch-to-base failed', error)
    })

    return undefined
  }, [address, canSwitch, chainId, connector, isBaseMiniApp, isConnected, isSwitching, switchNetwork])
}
