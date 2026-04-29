// used to construct the list of all pairs we consider by default in the frontend

import { PublicKey } from '@solana/web3.js'

// default allowed slippage, in bips
export const INITIAL_ALLOWED_SLIPPAGE = 50
// 20 minutes, denominated in seconds
export const DEFAULT_DEADLINE_FROM_NOW = 60 * 20
export const L2_DEADLINE_FROM_NOW = 60 * 5

export const FAST_INTERVAL = 10000
export const SLOW_INTERVAL = 60000

export const NOT_ON_SALE_SELLER = '0x0000000000000000000000000000000000000000'
export const NO_PROXY_CONTRACT = '0x0000000000000000000000000000000000000000'

export const PREDICTION_TOOLTIP_DISMISS_KEY = 'prediction-switcher-dismiss-tooltip'

// Gelato uses this address to define a native currency in all chains
export const GELATO_NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const EXCHANGE_HELP_URLS = 'https://docs.pancakeswap.finance/help'

export const QUERY_SETTINGS_IMMUTABLE = {
  refetchOnReconnect: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
}

export const QUERY_SETTINGS_WITHOUT_INTERVAL_REFETCH = {
  retry: 3,
  retryDelay: 3000,
}

export const PERSIST_CHAIN_KEY = 'persistChain'

export const ADDRESS_BALANCE_QUERY_KEY = 'addressBalances'

export const NATIVE_BALANCE_QUERY_KEY = 'nativeBalance'

export const LS_CB1 = 'cb1-state'

export const PANCAKE_CLMM_PROGRAM_ID = new PublicKey('HpNfyc2Saw7RKkQd8nEL4khUcuPhQ7WwY1B2qjx8jxFq')
