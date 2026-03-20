import { useRouter } from 'next/router'
import { useWalletEnv } from 'wallet/hook/useWalletEnv'
import { isCakepadBaseExperience } from '../config/routes'

export const useCakepadBaseExperience = () => {
  const router = useRouter()
  const walletEnv = useWalletEnv()
  const host = typeof window === 'undefined' ? undefined : window.location.hostname

  return isCakepadBaseExperience({
    pathname: router.pathname,
    chain: router.query.chain,
    host,
    walletEnv,
  })
}
