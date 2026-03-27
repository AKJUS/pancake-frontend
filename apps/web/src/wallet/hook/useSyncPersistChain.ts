import { useRouter } from 'next/router'
import { allCasesNameToChainId } from '@pancakeswap/chains'
import { useActiveChainIdRef } from 'hooks/useAccountActiveChain'
import { useEffect, useRef } from 'react'
import { useLastUpdated } from '@pancakeswap/hooks'
import { useSwitchNetworkV2 } from './useSwitchNetworkV2'

let previousInternalPath: string | null = null

export const useSyncPersistChain = () => {
  const router = useRouter()
  const { query } = router
  const chain = (query.chain || '') as string
  const persistChain = query.persistChain ? String(query.persistChain) : null
  const { switchNetwork } = useSwitchNetworkV2()
  const activeChainIdRef = useActiveChainIdRef()
  const targetChainId = chain ? allCasesNameToChainId[chain] : null
  const shouldSync = !!targetChainId && !!persistChain && activeChainIdRef.current !== targetChainId
  const switchingRef = useRef(false)
  const { setLastUpdated } = useLastUpdated()

  useEffect(() => {
    const handleRouteChangeComplete = () => {
      if (!router.query.persistChain) {
        previousInternalPath = router.pathname
      }
    }
    router.events.on('routeChangeComplete', handleRouteChangeComplete)
    return () => router.events.off('routeChangeComplete', handleRouteChangeComplete)
  }, [router])

  if (shouldSync && !switchingRef.current) {
    switchingRef.current = true
    switchNetwork(targetChainId).then((result) => {
      const alreadyOnCorrectChain = activeChainIdRef.current === targetChainId
      if (!result && !alreadyOnCorrectChain) {
        setTimeout(() => {
          if (previousInternalPath) {
            router.replace(previousInternalPath)
          } else {
            router.replace('/')
          }
        }, 0)
      } else {
        setLastUpdated()
      }
      switchingRef.current = false
    })
  }

  return shouldSync
}
