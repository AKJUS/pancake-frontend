import { ChainId } from '@pancakeswap/chains'
import { useRouter } from 'next/router'
import IfoHistoryCard from './components/IfoHistoryCard'
import { IfoV2Provider } from './contexts/IfoV2Provider'
import { isCakepadBaseExperience } from './config/routes'
import { useIfoConfigs } from './hooks/useIfoConfigs'

const HistoryIfos: React.FC = () => {
  const router = useRouter()
  const isCakepadBaseRoute = isCakepadBaseExperience({ pathname: router.pathname, chain: router.query.chain })
  const { data: filteredIfoConfigs } = useIfoConfigs({ chainId: isCakepadBaseRoute ? ChainId.BASE : undefined })

  if (!filteredIfoConfigs) {
    return null
  }

  if (!filteredIfoConfigs.length) {
    return null
  }

  return (
    <>
      {filteredIfoConfigs.map((ifo) => (
        <IfoV2Provider id={ifo.id} key={ifo.id}>
          <IfoHistoryCard />
        </IfoV2Provider>
      ))}
    </>
  )
}

export default HistoryIfos
