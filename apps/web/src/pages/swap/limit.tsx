import dynamic from 'next/dynamic'
import { NextPageWithLayout } from 'utils/page.types'
import Page from 'views/Page'
import SwapLayout from 'views/Swap/SwapLayout'
import { PCSLimitOrdersView } from 'views/PCSLimitOrders'
import { ChainId } from '@pancakeswap/chains'

const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <Page showExternalLink={false} showHelpLink={false} removePadding>
      {children}
    </Page>
  )
}

const View = () => {
  return (
    <SwapLayout>
      <PCSLimitOrdersView />
    </SwapLayout>
  )
}
const LimitPage = dynamic(() => Promise.resolve(View), {
  ssr: false,
}) as NextPageWithLayout

LimitPage.chains = [ChainId.BSC]
LimitPage.forceMultipleNetworkModal = true
LimitPage.screen = true
LimitPage.Layout = Layout

export default LimitPage
