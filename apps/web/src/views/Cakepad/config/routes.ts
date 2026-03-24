import { WalletEnv } from 'wallet/hook/useWalletEnv'

export const CAKEPAD_URL = '/cakepad'
export const CAKEPAD_DEPOSIT_URL = `${CAKEPAD_URL}/deposit`
export const CAKEPAD_HISTORY_URL = `${CAKEPAD_URL}/history`
export const CAKEPAD_BASE_CHAIN_QUERY = 'base'
export const CAKEPAD_HOST = 'cakepad.pancakeswap.finance'

const normalizeChainQuery = (chain?: string | string[]) => (Array.isArray(chain) ? chain[0] : chain)?.toLowerCase()
const normalizeHost = (host?: string | string[]) => (Array.isArray(host) ? host[0] : host)?.split(':')[0]?.toLowerCase()

export const withCakepadBaseChainQuery = (path: string, isBaseExperience: boolean) =>
  isBaseExperience ? `${path}?chain=${CAKEPAD_BASE_CHAIN_QUERY}` : path

export const isCakepadHost = (host?: string | string[]) => normalizeHost(host) === CAKEPAD_HOST

export const isCakepadRoute = ({ pathname, host }: { pathname?: string; host?: string | string[] }) =>
  Boolean((pathname?.startsWith(CAKEPAD_URL) ?? false) || isCakepadHost(host))

export const isCakepadBaseExperience = ({
  pathname,
  chain,
  walletEnv,
}: {
  pathname?: string
  chain?: string | string[]
  walletEnv?: WalletEnv | null
}) =>
  Boolean(
    ((pathname?.startsWith(CAKEPAD_URL) ?? false) && normalizeChainQuery(chain) === CAKEPAD_BASE_CHAIN_QUERY) ||
      walletEnv === WalletEnv.BaseCakepadMiniApp,
  )
