import { ChainId } from '@pancakeswap/chains'
import { useRouter } from 'next/router'
import IfoHistoryCard from './components/IfoHistoryCard'
import { IfoV2Provider } from './contexts/IfoV2Provider'
import { CAKEPAD_BASE_URL } from './config/routes'
import { useIfoConfigs } from './hooks/useIfoConfigs'

const HistoryIfos: React.FC = () => {
  const router = useRouter()
  const { data: ifoConfigs } = useIfoConfigs()

  if (!ifoConfigs) {
    return null
  }

  const isCakepadBaseRoute = router.pathname.startsWith(CAKEPAD_BASE_URL)
  const filteredIfoConfigs = isCakepadBaseRoute ? ifoConfigs.filter((ifo) => ifo.chainId === ChainId.BASE) : ifoConfigs
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
