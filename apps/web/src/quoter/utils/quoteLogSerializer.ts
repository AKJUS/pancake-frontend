import { getCurrencyAddress, type Currency, type CurrencyAmount, type TradeType } from '@pancakeswap/swap-sdk-core'
import type { QuoteQuery } from 'quoter/quoter.types'
import { getAggregatorQuoteData, isAggregatorOrder } from 'quoter/utils/aggregatorOrder'
import type { InterfaceOrder } from 'views/Swap/utils'
import { isBridgeOrder, isClassicOrder, isSVMOrder, isXOrder } from 'views/Swap/utils'

type TokenSnapshot = {
  chainId?: number
  symbol?: string
  address?: string
  isNative?: boolean
}

type AmountSnapshot = {
  currency?: TokenSnapshot
  raw?: string
  display?: string
}

type PoolSnapshot = {
  type?: string
  fee?: number | string
  address?: string
}

type RouteSnapshot = {
  percent?: number
  inputAmount?: string
  outputAmount?: string
  path?: TokenSnapshot[]
  pools?: PoolSnapshot[]
}

type QuoteLogClassicOrder = {
  type: 'PCS_CLASSIC'
  isAggregator: boolean
  quoteQueryHash?: string
  tradeType?: TradeType
  inputAmount?: AmountSnapshot
  outputAmount?: AmountSnapshot
  priceImpactBps?: number
  gasUseEstimate?: string
  routeCount: number
  routes: RouteSnapshot[]
  aggregatorQuoteData?: {
    inputAmount?: string
    outputAmount?: string
    aggregatorAddress?: string
    routeCount?: number
  }
}

type QuoteLogBridgeOrder = {
  type: 'PCS_BRIDGE'
  quoteQueryHash?: string
  tradeType?: TradeType
  inputAmount?: AmountSnapshot
  outputAmount?: AmountSnapshot
  routeCount: number
}

type QuoteLogSvmOrder = {
  type: 'PCS_SVM'
  quoteQueryHash?: string
  tradeType?: TradeType
  requestId?: string
  inputAmount?: AmountSnapshot
  outputAmount?: AmountSnapshot
  priceImpactPct?: string
  routeCount: number
}

type QuoteLogDutchLimitOrder = {
  type: 'DUTCH_LIMIT'
  quoteQueryHash?: string
  tradeType?: TradeType
  inputAmount?: AmountSnapshot
  outputAmount?: AmountSnapshot
}

export type QuoteLogOrder = QuoteLogClassicOrder | QuoteLogBridgeOrder | QuoteLogSvmOrder | QuoteLogDutchLimitOrder

export type QuoteSessionCandidateSnapshot = {
  strategy: string
  status: 'success' | 'pending' | 'fail' | 'shadow-fail'
  amount?: string
  diffPercent?: string
  error?: string
  order?: QuoteLogOrder | null
}

export type QuoteSessionLog = {
  event: 'quote.session.completed'
  version: 1
  quoteHash: string
  createdAt: number
  completedAt: number
  totalLatencyMs: number
  selectedStrategy: string
  selectedAmount: string
  tradeType: TradeType
  amount?: string
  inputCurrency?: TokenSnapshot
  outputCurrency?: TokenSnapshot
  strategyCount: number
  successCount: number
  failedCount: number
  pendingCount: number
  allStrategies: QuoteSessionCandidateSnapshot[]
}

function safeString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  return String(value)
}

function formatDisplayAmount(amount?: { toExact?: () => string; toSignificant?: (digits?: number) => string }) {
  if (!amount) return undefined
  try {
    if (typeof amount.toExact === 'function') {
      return amount.toExact()
    }
    if (typeof amount.toSignificant === 'function') {
      return amount.toSignificant(6)
    }
  } catch {
    return undefined
  }
  return undefined
}

function serializeToken(currency?: Currency | null): TokenSnapshot | undefined {
  if (!currency) return undefined
  return {
    chainId: currency.chainId,
    symbol: currency.symbol,
    address: getCurrencyAddress(currency) ?? undefined,
    isNative: currency.isNative,
  }
}

function serializeAmount(amount?: CurrencyAmount<Currency> | null): AmountSnapshot | undefined {
  if (!amount) return undefined
  return {
    currency: serializeToken(amount.currency),
    raw: safeString(amount.quotient),
    display: formatDisplayAmount(amount),
  }
}

function serializePool(pool: any): PoolSnapshot {
  return {
    type: safeString(pool?.type),
    fee: pool?.fee,
    address: safeString(pool?.address),
  }
}

function serializeRoute(route: any): RouteSnapshot {
  return {
    percent: route?.percent,
    inputAmount: safeString(route?.inputAmount?.quotient),
    outputAmount: safeString(route?.outputAmount?.quotient),
    path: Array.isArray(route?.path) ? route.path.map((token: Currency) => serializeToken(token)).filter(Boolean) : [],
    pools: Array.isArray(route?.pools) ? route.pools.map(serializePool) : [],
  }
}

function serializeClassicOrder(order: InterfaceOrder): QuoteLogClassicOrder {
  const trade = order.trade as any
  const aggregatorQuoteData = getAggregatorQuoteData(order)

  return {
    type: 'PCS_CLASSIC',
    isAggregator: isAggregatorOrder(order),
    quoteQueryHash: safeString(trade?.quoteQueryHash),
    tradeType: trade?.tradeType,
    inputAmount: serializeAmount(trade?.inputAmount),
    outputAmount: serializeAmount(trade?.outputAmount),
    priceImpactBps: trade?.priceImpactBps,
    gasUseEstimate: safeString(trade?.gasUseEstimate),
    routeCount: Array.isArray(trade?.routes) ? trade.routes.length : 0,
    routes: Array.isArray(trade?.routes) ? trade.routes.map(serializeRoute) : [],
    aggregatorQuoteData: aggregatorQuoteData
      ? {
          inputAmount: aggregatorQuoteData.inputAmount,
          outputAmount: aggregatorQuoteData.outputAmount,
          aggregatorAddress: aggregatorQuoteData.aggregatorAddress,
          routeCount: aggregatorQuoteData.routes?.length,
        }
      : undefined,
  }
}

function serializeBridgeOrder(order: InterfaceOrder): QuoteLogBridgeOrder {
  const trade = order.trade as any
  return {
    type: 'PCS_BRIDGE',
    quoteQueryHash: safeString(trade?.quoteQueryHash),
    tradeType: trade?.tradeType,
    inputAmount: serializeAmount(trade?.inputAmount),
    outputAmount: serializeAmount(trade?.outputAmount),
    routeCount: Array.isArray(trade?.routes) ? trade.routes.length : 0,
  }
}

function serializeSvmOrder(order: InterfaceOrder): QuoteLogSvmOrder {
  const trade = order.trade as any
  return {
    type: 'PCS_SVM',
    quoteQueryHash: safeString(trade?.quoteQueryHash),
    tradeType: trade?.tradeType,
    requestId: safeString(trade?.requestId),
    inputAmount: serializeAmount(trade?.inputAmount as CurrencyAmount<Currency> | undefined),
    outputAmount: serializeAmount(trade?.outputAmount as CurrencyAmount<Currency> | undefined),
    priceImpactPct: safeString(trade?.priceImpactPct),
    routeCount: Array.isArray(trade?.routes) ? trade.routes.length : 0,
  }
}

function serializeXOrder(order: InterfaceOrder): QuoteLogDutchLimitOrder {
  const trade = order.trade as any
  return {
    type: 'DUTCH_LIMIT',
    quoteQueryHash: safeString(trade?.quoteQueryHash),
    tradeType: trade?.tradeType,
    inputAmount: serializeAmount(trade?.inputAmount),
    outputAmount: serializeAmount(trade?.outputAmount),
  }
}

export function serializeOrder(order?: InterfaceOrder | null): QuoteLogOrder | null {
  if (!order) return null
  if (isClassicOrder(order)) return serializeClassicOrder(order)
  if (isBridgeOrder(order)) return serializeBridgeOrder(order)
  if (isSVMOrder(order)) return serializeSvmOrder(order)
  if (isXOrder(order)) return serializeXOrder(order)
  return null
}

export function serializeQuoteSessionLog(params: {
  option: QuoteQuery
  selectedStrategy: string
  selectedAmount: string
  selectedOrder: InterfaceOrder
  allStrategies: QuoteSessionCandidateSnapshot[]
}): QuoteSessionLog {
  const { option, selectedStrategy, selectedAmount, selectedOrder, allStrategies } = params
  const now = Date.now()

  return {
    event: 'quote.session.completed',
    version: 1,
    quoteHash: option.hash,
    createdAt: option.createTime,
    completedAt: now,
    totalLatencyMs: Math.max(0, now - option.createTime),
    selectedStrategy,
    selectedAmount,
    tradeType: selectedOrder.trade.tradeType,
    amount: safeString(option.amount?.quotient),
    inputCurrency: serializeToken(option.baseCurrency),
    outputCurrency: serializeToken(option.currency),
    strategyCount: allStrategies.length,
    successCount: allStrategies.filter((x) => x.status === 'success').length,
    failedCount: allStrategies.filter((x) => x.status === 'fail' || x.status === 'shadow-fail').length,
    pendingCount: allStrategies.filter((x) => x.status === 'pending').length,
    allStrategies,
  }
}
