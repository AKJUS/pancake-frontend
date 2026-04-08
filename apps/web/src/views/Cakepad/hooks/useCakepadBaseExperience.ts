import { useRouter } from 'next/router'
import { useWalletRuntime } from 'wallet/hook/useWalletEnv'
import { isCakepadBaseExperience } from '../config/routes'

export const useCakepadBaseExperience = () => {
  const router = useRouter()
  const { env, wallet } = useWalletRuntime()

  return isCakepadBaseExperience({
    pathname: router.pathname,
    chain: router.query.chain,
    host: typeof window === 'undefined' ? undefined : window.location.host,
    env,
    wallet,
  })
}
