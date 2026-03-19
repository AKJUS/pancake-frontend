import dynamic from 'next/dynamic'
import { NextPageWithLayout } from 'utils/page.types'
import PastIfo from 'views/Ifos/PastIfo'
import { PageMeta } from 'components/Layout/Page'
import { useIfoConfigs } from 'views/Cakepad/hooks/useIfoConfigs'
import { IFO_SUPPORT_CHAINS } from 'config/cakepad.config'
import { useRouter } from 'next/router'
import { ChainId } from '@pancakeswap/chains'
import { useCheckAndSwitchChain } from 'hooks/useCheckAndSwitchChain'
import BaseMiniAppProvider from 'components/BaseMiniAppProvider'
import { useIsBaseMiniApp } from 'hooks/useIsBaseMiniApp'
import { isCakepadBaseExperience } from 'views/Cakepad/config/routes'

const View = () => {
  useIfoConfigs()
  const router = useRouter()
  const isBaseExperience = isCakepadBaseExperience({ pathname: router.pathname, chain: router.query.chain })
  useCheckAndSwitchChain(isBaseExperience ? ChainId.BASE : undefined)

  const content = isBaseExperience ? <BaseHistoryContent /> : <DefaultHistoryContent />

  return isBaseExperience ? <BaseMiniAppProvider>{content}</BaseMiniAppProvider> : content
}

const DefaultHistoryContent = () => (
  <>
    <PageMeta />
    <PastIfo isV2 />
  </>
)

const BaseHistoryContent = () => {
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

PastIfoPage.chains = [...IFO_SUPPORT_CHAINS]

export default PastIfoPage
