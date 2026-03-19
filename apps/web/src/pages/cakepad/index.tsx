import { NextPageWithLayout } from 'utils/page.types'
import IfoLayout from 'views/Cakepad/components/IfoLayout'
import Hero from 'views/Cakepad/components/Hero'
import dynamic from 'next/dynamic'
import IFO from 'views/Cakepad/ifo'
import { PageMeta } from 'components/Layout/Page'
import { useIfoConfigs } from 'views/Cakepad/hooks/useIfoConfigs'
import { IFO_SUPPORT_CHAINS } from 'config/cakepad.config'
import { IfoV2Provider } from 'views/Cakepad/contexts/IfoV2Provider'
import { useRouter } from 'next/router'
import { ChainId } from '@pancakeswap/chains'
import { useCheckAndSwitchChain } from 'hooks/useCheckAndSwitchChain'
import BaseMiniAppProvider from 'components/BaseMiniAppProvider'
import NoIfoState from 'views/Cakepad/components/NoIfoState'
import { isCakepadBaseExperience } from 'views/Cakepad/config/routes'

const View = () => {
  const router = useRouter()
  const isBaseExperience = isCakepadBaseExperience({ pathname: router.pathname, chain: router.query.chain })
  const baseChainId = isBaseExperience ? ChainId.BASE : undefined
  const { data: ifoConfigs, isLoading } = useIfoConfigs({ chainId: baseChainId })

  useCheckAndSwitchChain(baseChainId)

  const showEmptyState = isBaseExperience && !isLoading && (!ifoConfigs || ifoConfigs.length === 0)

  const content = (
    <>
      <PageMeta />
      {showEmptyState ? (
        <>
          <Hero chainId={ChainId.BASE} />
          <NoIfoState />
        </>
      ) : (
        <IfoV2Provider>
          <Hero chainId={isBaseExperience ? ChainId.BASE : undefined} />
          <IFO />
        </IfoV2Provider>
      )}
    </>
  )

  return isBaseExperience ? <BaseMiniAppProvider>{content}</BaseMiniAppProvider> : content
}

const CurrentIfoPage: NextPageWithLayout = dynamic(() => Promise.resolve(View), {
  ssr: false,
})

CurrentIfoPage.chains = IFO_SUPPORT_CHAINS
CurrentIfoPage.Layout = IfoLayout

export default CurrentIfoPage
