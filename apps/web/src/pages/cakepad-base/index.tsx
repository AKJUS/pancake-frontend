import { NextPageWithLayout } from 'utils/page.types'
import IfoLayout from 'views/Cakepad/components/IfoLayout'
import Hero from 'views/Cakepad/components/Hero'
import dynamic from 'next/dynamic'
import IFO from 'views/Cakepad/ifo'
import { PageMeta } from 'components/Layout/Page'
import { useIfoConfigs } from 'views/Cakepad/hooks/useIfoConfigs'
import { IfoV2Provider } from 'views/Cakepad/contexts/IfoV2Provider'
import { ChainId } from '@pancakeswap/chains'
import { useCheckAndSwitchChain } from 'hooks/useCheckAndSwitchChain'
import BaseMiniAppProvider from 'components/BaseMiniAppProvider'
import NoIfoState from 'views/Cakepad/components/NoIfoState'

const View = () => {
  const { data: ifoConfigs, isLoading } = useIfoConfigs()
  useCheckAndSwitchChain(ChainId.BASE)

  const baseIfoConfigs = ifoConfigs?.filter((ifo) => ifo.chainId === ChainId.BASE)
  const showEmptyState = !isLoading && (!baseIfoConfigs || baseIfoConfigs.length === 0)

  return (
    <BaseMiniAppProvider>
      <PageMeta />
      <Hero chainId={ChainId.BASE} />
      {showEmptyState ? (
        <NoIfoState />
      ) : (
        <IfoV2Provider>
          <IFO />
        </IfoV2Provider>
      )}
    </BaseMiniAppProvider>
  )
}

const CurrentIfoPage: NextPageWithLayout = dynamic(() => Promise.resolve(View), {
  ssr: false,
})

CurrentIfoPage.chains = [ChainId.BASE]
CurrentIfoPage.Layout = IfoLayout

export default CurrentIfoPage
