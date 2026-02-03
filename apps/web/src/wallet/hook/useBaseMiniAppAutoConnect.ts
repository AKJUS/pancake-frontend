import { sdk } from '@farcaster/miniapp-sdk'
import { useEffect, useRef } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { farcasterMiniAppConnector } from 'utils/wagmi'

export const useBaseMiniAppAutoConnect = () => {
  const { address, connector, isConnected } = useAccount()
  const { connectAsync, isPending } = useConnect()
  const checkedRef = useRef(false)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (checkedRef.current || inFlightRef.current) return undefined
    if (!window.location.pathname.startsWith('/cakepad-base')) {
      checkedRef.current = true
      return undefined
    }
    if (address || connector || isConnected) {
      checkedRef.current = true
      return undefined
    }
    if (isPending) return undefined

    let cancelled = false
    inFlightRef.current = true

    const init = async () => {
      try {
        try {
          sdk.actions.ready()
        } catch (error) {
          console.warn('[wallet] Base miniapp ready() failed', error)
        }
        await new Promise((resolve) => setTimeout(resolve, 100))

        const checkIsInMiniApp = async (attemptsLeft: number): Promise<boolean> => {
          const result = await sdk.isInMiniApp()
          if (cancelled || result || attemptsLeft <= 1) {
            return result
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
          return checkIsInMiniApp(attemptsLeft - 1)
        }

        const isInMiniApp = await checkIsInMiniApp(3)
        if (cancelled) return
        if (!isInMiniApp) {
          checkedRef.current = true
          return
        }

        const tryConnect = async (attemptsLeft: number): Promise<void> => {
          try {
            await new Promise((resolve) => setTimeout(resolve, 100))
            await connectAsync({ connector: farcasterMiniAppConnector })
          } catch (error) {
            if (cancelled || attemptsLeft <= 1) {
              throw error
            }
            await new Promise((resolve) => setTimeout(resolve, 100))
            await tryConnect(attemptsLeft - 1)
          }
        }

        await tryConnect(3)
        checkedRef.current = true
      } catch (error) {
        if (!cancelled) {
          checkedRef.current = true
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
  }, [address, connector, connectAsync, isConnected, isPending])
}
