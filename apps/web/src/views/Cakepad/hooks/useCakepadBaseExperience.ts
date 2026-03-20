import { useRouter } from 'next/router'
import { WalletEnv, useWalletEnv } from 'wallet/hook/useWalletEnv'
import { isCakepadBaseExperience, isCakepadRoute } from '../config/routes'

export const useCakepadBaseExperience = () => {
  const router = useRouter()
  const walletEnv = useWalletEnv()
  const isRouteBasedBaseExperience = isCakepadBaseExperience({ pathname: router.pathname, chain: router.query.chain })

  return isRouteBasedBaseExperience || (isCakepadRoute(router.pathname) && walletEnv === WalletEnv.BaseMiniApp)
}
