import dynamic from 'next/dynamic'
import { NextPageWithLayout } from 'utils/page.types'
import PastIfo from 'views/Ifos/PastIfo'
import { PageMeta } from 'components/Layout/Page'
import { useIfoConfigs } from 'views/Cakepad/hooks/useIfoConfigs'
import { ChainId } from '@pancakeswap/chains'
import { useCheckAndSwitchChain } from 'hooks/useCheckAndSwitchChain'
import BaseMiniAppProvider from 'components/BaseMiniAppProvider'

const View = () => {
  useIfoConfigs()
  useCheckAndSwitchChain(ChainId.BASE)

  return (
    <BaseMiniAppProvider>
      <PageMeta />
      <PastIfo isV2 />
    </BaseMiniAppProvider>
  )
}
const PastIfoPage = dynamic(() => Promise.resolve(View), {
  ssr: false,
}) as NextPageWithLayout

PastIfoPage.chains = [ChainId.BASE]

export default PastIfoPage
