import { ChainId } from '@pancakeswap/chains'
import type { InfinityRouter, SmartRouter, SmartRouterTrade } from '@pancakeswap/smart-router'
import type {
  Currency,
  CurrencyAmount,
  TradeType,
  UnifiedCurrency,
  UnifiedCurrencyAmount,
} from '@pancakeswap/swap-sdk-core'
import type { AbortControl } from '@pancakeswap/utils/abortControl'
import type { getViemClients } from 'utils/viem'
import { Address } from 'viem/accounts'
import { InterfaceOrder } from 'views/Swap/utils'

export type CreateQuoteProviderParams = {
  gasLimit?: bigint
} & AbortControl

export type GetBestTradeParams = Parameters<typeof SmartRouter.getBestTrade>

export type InfinityGetBestTradeReturnType = Omit<
  Exclude<Awaited<ReturnType<typeof InfinityRouter.getBestTrade>>, undefined>,
  'graph'
>

export class BridgeTradeError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'BridgeTradeError'
  }
}

export class NoValidRouteError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'NoValidRouteError'
  }
}

export type XTradeErrorCode = 'MARKET_CLOSED' | 'MARKET_PAUSED' | 'ASSET_PAUSED'

export class XTradeError extends Error {
  public readonly code?: XTradeErrorCode

  constructor(message?: string, code?: XTradeErrorCode) {
    super(message)
    this.name = 'XTradeError'
    this.code = code
  }
}

export type UseBetterQuoteOptions = {
  factorGasCost?: false
}

export interface Options {
  amount?: CurrencyAmount<Currency>
  baseCurrency?: Currency | null
  currency?: Currency | null
  tradeType?: TradeType
  maxHops?: number
  maxSplits?: number
  v2Swap?: boolean
  v3Swap?: boolean
  infinitySwap: boolean
  stableSwap?: boolean
  enabled?: boolean
  autoRevalidate?: boolean
  trackPerf?: boolean
  retry?: number | boolean
  hash: string
}

export interface PoolQuery {
  currencyA: Currency
  currencyB: Currency
  blockNumber: number
  chainId: ChainId
}
export interface PoolQueryOptions {
  infinity: boolean
  v2Pools: boolean
  v3Pools: boolean
  stableSwap: boolean
  signal?: AbortSignal
  provider?: typeof getViemClients
  for?: string
  gasLimit?: bigint
}
// interface PoolsHookParams {
//   // Used for caching
//   key?: string
//   blockNumber?: number
//   enabled?: boolean
//   gasLimit?: bigint
// }

export type QuoteQuery = Options & {
  type?: 'offchain' | 'quoter' | 'auto' | 'api'
  speedQuoteEnabled: boolean
  xEnabled: boolean
  slippage?: number
  isAutoSlippage?: boolean
  address?: Address
  blockNumber: number
  destinationBlockNumber?: number
  gasLimitDestinationChain?: bigint
  provider?: typeof getViemClients
  nonce?: number
  placeholderHash?: string
  for?: string
  createTime: number
  routeKey?: string
  gasLimit?: bigint
  ver: number
}

export interface SVMQuoteQuery extends Omit<QuoteQuery, 'amount' | 'baseCurrency' | 'currency'> {
  amount: UnifiedCurrencyAmount<UnifiedCurrency> | undefined
  baseCurrency: UnifiedCurrency | null
  currency: UnifiedCurrency | null
}

export interface StrategyQuery {
  baseCurrency?: Currency
  quoteCurrency?: Currency
  chainId?: ChainId
  v2Swap?: boolean
  v3Swap?: boolean
  infinitySwap: boolean
  maxHops?: number
  maxSplits?: number
}

export type QuoteResult = {
  trade: SmartRouterTrade<TradeType>
  isLoading?: boolean
  error?: any
}

export interface QuoteResultForUI {
  bestOrder?: InterfaceOrder
  tradeLoaded: boolean
  tradeError: Error | undefined
  refreshDisabled: boolean
  refreshOrder: () => void
  refreshTrade: () => void
  pauseQuoting: () => void
  resumeQuoting: () => void
}
