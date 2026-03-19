import { useRouter } from 'next/router'
import { Suspense, useEffect, useState } from 'react'
import { HomeV2 } from 'views/HomeV2'
import { withCakepadBaseChainQuery } from 'views/Cakepad/config/routes'

const CAKEPAD_HOST = 'cakepad.pancakeswap.finance'
const CAKEPAD_ROUTE = '/cakepad'

const IndexPage = () => {
  const router = useRouter()
  const [shouldRenderHome, setShouldRenderHome] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.location.hostname !== CAKEPAD_HOST
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (window.location.hostname !== CAKEPAD_HOST) return undefined

    setShouldRenderHome(false)

    let cancelled = false

    const redirect = async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        const isInMiniApp = await sdk.isInMiniApp()

        if (!cancelled) {
          router.replace(withCakepadBaseChainQuery(CAKEPAD_ROUTE, isInMiniApp))
        }
      } catch {
        if (!cancelled) {
          router.replace(withCakepadBaseChainQuery(CAKEPAD_ROUTE, true))
        }
      }
    }

    redirect()

    return () => {
      cancelled = true
    }
  }, [router])

  if (!shouldRenderHome) {
    return null
  }

  return (
    <Suspense>
      <HomeV2 />
    </Suspense>
  )
}

IndexPage.chains = []
IndexPage.isShowV4IconButton = true

export default IndexPage
