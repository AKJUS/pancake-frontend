export const CAKEPAD_URL = '/cakepad'
export const CAKEPAD_DEPOSIT_URL = `${CAKEPAD_URL}/deposit`
export const CAKEPAD_HISTORY_URL = `${CAKEPAD_URL}/history`
export const CAKEPAD_BASE_CHAIN_QUERY = 'base'

const normalizeChainQuery = (chain?: string | string[]) => (Array.isArray(chain) ? chain[0] : chain)?.toLowerCase()

export const isCakepadBaseExperience = ({ pathname, chain }: { pathname?: string; chain?: string | string[] }) =>
  Boolean((pathname?.startsWith(CAKEPAD_URL) ?? false) && normalizeChainQuery(chain) === CAKEPAD_BASE_CHAIN_QUERY)

export const withCakepadBaseChainQuery = (path: string, isBaseExperience: boolean) =>
  isBaseExperience ? `${path}?chain=${CAKEPAD_BASE_CHAIN_QUERY}` : path
