import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { NextPageWithLayout } from 'utils/page.types'
import PastIfo from 'views/Ifos/PastIfo'
import { PageMeta } from 'components/Layout/Page'
import { useIfoConfigs } from 'views/Cakepad/hooks/useIfoConfigs'
import { ChainId } from '@pancakeswap/chains'
import { useCheckAndSwitchChain } from 'hooks/useCheckAndSwitchChain'
import BaseMiniAppProvider from 'components/BaseMiniAppProvider'
import { useIsBaseMiniApp } from 'hooks/useIsBaseMiniApp'

const View = () => {
  useIfoConfigs()
  useCheckAndSwitchChain(ChainId.BASE)

  return (
    <BaseMiniAppProvider>
      <HistoryContent />
    </BaseMiniAppProvider>
  )
}

const HistoryContent = () => {
  const isInMiniApp = useIsBaseMiniApp()

  return (
    <>
      <PageMeta />
      <PastIfo isV2 hideInactiveIfo={isInMiniApp === true} />
    </>
  )
}
const PastIfoPage = dynamic(() => Promise.resolve(View), {
  ssr: false,
}) as NextPageWithLayout

PastIfoPage.chains = [ChainId.BASE]

export default PastIfoPage
