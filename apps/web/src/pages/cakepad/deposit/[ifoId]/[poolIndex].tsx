import { useRouter } from 'next/router'
import { NextPageWithLayout } from 'utils/page.types'
import IfoLayout from 'views/Cakepad/components/IfoLayout'
import { IfoV2Provider } from 'views/Cakepad/contexts/IfoV2Provider'
import Hero from 'views/Cakepad/components/Hero'
import IfoContainer from 'views/Cakepad/components/IfoContainer'
import useIfo from 'views/Cakepad/hooks/useIfo'
import { IfoDeposit } from 'views/Cakepad/components/IfoDeposit'
import { IFO_SUPPORT_CHAINS } from 'config/cakepad.config'
import { useCheckAndSwitchChain } from 'hooks/useCheckAndSwitchChain'
import { ChainId } from '@pancakeswap/chains'
import BaseMiniAppProvider from 'components/BaseMiniAppProvider'
import { useCakepadBaseExperience } from 'views/Cakepad/hooks/useCakepadBaseExperience'

const IfoDepositPageContent: React.FC<{ pid: number; isBaseExperience: boolean }> = ({ pid, isBaseExperience }) => {
  const { config } = useIfo()
  useCheckAndSwitchChain(isBaseExperience ? ChainId.BASE : config?.chainId)

  const steps = <></>
  return (
    <>
      <Hero chainId={isBaseExperience ? ChainId.BASE : undefined} />
      <IfoContainer ifoSteps={steps} ifoSection={<IfoDeposit pid={pid} />} ifoFaqs={config?.faqs} />
    </>
  )
}

const IfoDepositPage: NextPageWithLayout = () => {
  const router = useRouter()
  const { query } = router
  const { ifoId, poolIndex } = query
  const isBaseExperience = useCakepadBaseExperience()

  if (typeof ifoId !== 'string' || typeof poolIndex !== 'string') {
    return null
  }

  const content = (
    <IfoV2Provider id={ifoId}>
      <IfoDepositPageContent pid={Number(poolIndex)} isBaseExperience={isBaseExperience} />
    </IfoV2Provider>
  )

  return isBaseExperience ? <BaseMiniAppProvider>{content}</BaseMiniAppProvider> : content
}

IfoDepositPage.chains = IFO_SUPPORT_CHAINS
IfoDepositPage.Layout = IfoLayout

export default IfoDepositPage
