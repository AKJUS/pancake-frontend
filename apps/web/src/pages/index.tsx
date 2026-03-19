import { useRouter } from 'next/router'
import { Suspense, useEffect, useState } from 'react'
import { HomeV2 } from 'views/HomeV2'

const CAKEPAD_HOST = 'cakepad.pancakeswap.finance'
const CAKEPAD_ROUTE = '/cakepad'
const CAKEPAD_BASE_ROUTE = '/cakepad-base'

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
          router.replace(isInMiniApp ? CAKEPAD_BASE_ROUTE : CAKEPAD_ROUTE)
        }
      } catch {
        if (!cancelled) {
          router.replace(CAKEPAD_ROUTE)
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
