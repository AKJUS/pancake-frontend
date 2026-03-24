import { useRouter } from 'next/router'
import { useWalletEnv } from 'wallet/hook/useWalletEnv'
import { isCakepadBaseExperience } from '../config/routes'

export const useCakepadBaseExperience = () => {
  const router = useRouter()
  const walletEnv = useWalletEnv()

  return isCakepadBaseExperience({
    pathname: router.pathname,
    chain: router.query.chain,
    walletEnv,
  })
}
