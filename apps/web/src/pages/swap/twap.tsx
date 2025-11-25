import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { NextPageWithLayout } from 'utils/page.types'
import { useIsSmartAccount } from 'hooks/useIsSmartAccount'
import Page from 'views/Page'
import SwapLayout from 'views/Swap/SwapLayout'
import TwapAndLimitSwap from 'views/Swap/Twap/TwapSwap'
import { TWAP_LIMIT_SUPPORTED_CHAINS } from 'views/Swap/utils'

const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <Page showExternalLink={false} showHelpLink={false} removePadding>
      {children}
    </Page>
  )
}

// const TwapAndLimitSwap = dynamic(() => import('views/Swap/Twap/TwapSwap'), { ssr: false })

const TwapView = () => {
  const router = useRouter()
  const isSmartAccount = useIsSmartAccount()

  useEffect(() => {
    if (isSmartAccount) {
      router.replace('/swap')
    }
  }, [isSmartAccount, router])

  if (isSmartAccount) {
    return null
  }

  return (
    <SwapLayout>
      <TwapAndLimitSwap />
    </SwapLayout>
  )
}

const TwapPage = dynamic(() => Promise.resolve(TwapView), {
  ssr: false,
}) as NextPageWithLayout

TwapPage.chains = TWAP_LIMIT_SUPPORTED_CHAINS
TwapPage.screen = true
TwapPage.Layout = Layout

export default TwapPage
