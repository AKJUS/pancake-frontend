import { ChainId, isSolana } from '@pancakeswap/chains'
import {
  OrderType,
  type BridgeOrder,
  type ClassicOrder,
  type PriceOrder,
  type SVMOrder,
  type XOrder,
} from '@pancakeswap/price-api-sdk'
import { UnifiedCurrencyAmount, type Currency, type TradeType } from '@pancakeswap/swap-sdk-core'
import { CAKE, STABLE_COIN, USDC, USDT } from '@pancakeswap/tokens'
import { BridgeOrderFee, computeBridgeOrderFee } from './Bridge/utils'
import { computeTradePriceBreakdown, SVMTradePriceBreakdown, TradePriceBreakdown } from './V3Swap/utils/exchange'

export const TWAP_LIMIT_SUPPORTED_CHAINS = [ChainId.BSC, ChainId.ARBITRUM_ONE, ChainId.BASE, ChainId.LINEA]

export const isTwapSupported = (chainId?: ChainId) => {
  return !chainId ? false : TWAP_LIMIT_SUPPORTED_CHAINS.includes(chainId)
}

export const isLimitSupported = (chainId?: ChainId) => {
  return !chainId ? false : TWAP_LIMIT_SUPPORTED_CHAINS.includes(chainId)
}

export const isSolanaBridge = (order: InterfaceOrder | undefined | null): order is BridgeOrder =>
  order?.type === OrderType.PCS_BRIDGE &&
  (isSolana(order.trade.inputAmount.currency.chainId) || isSolana(order.trade.outputAmount.currency.chainId))

export const isXOrder = (order: InterfaceOrder | undefined | null): order is XOrder =>
  order?.type === OrderType.DUTCH_LIMIT

export const isClassicOrder = (order: InterfaceOrder | undefined | null): order is ClassicOrder =>
  order?.type === OrderType.PCS_CLASSIC

export const isBridgeOrder = (order: InterfaceOrder | undefined | null): order is BridgeOrder =>
  order?.type === OrderType.PCS_BRIDGE

export const isSVMOrder = (order: InterfaceOrder | undefined | null): order is SVMOrder =>
  order?.type === OrderType.PCS_SVM

// create EVMInterfaceOrder which omit SVMOrder
export type EVMInterfaceOrder<
  input extends Currency = Currency,
  output extends Currency = Currency,
  tradeType extends TradeType = TradeType,
> = Exclude<PriceOrder<input, output, tradeType>, SVMOrder>

export type InterfaceOrder<
  input extends Currency = Currency,
  output extends Currency = Currency,
  tradeType extends TradeType = TradeType,
> = PriceOrder<input, output, tradeType>

// Type to support commands property
export type BridgeOrderWithCommands = BridgeOrder & {
  commands?: EVMInterfaceOrder[]
  noSlippageCommands?: EVMInterfaceOrder[]
}

export function getDefaultToken(chainId: number): string | undefined {
  return CAKE[chainId]?.address ?? STABLE_COIN[chainId]?.address ?? USDC[chainId]?.address ?? USDT[chainId]?.address
}

function computeSvmOrderFee(order: SVMOrder): SVMTradePriceBreakdown {
  return {
    priceImpactWithoutFee: order.trade.priceImpactPct,
    // NOTE: lpFeeAmount will be computed in different place
    lpFeeAmount: UnifiedCurrencyAmount.fromRawAmount(order.trade.inputAmount.currency, 0),
  }
}

export function getPriceBreakdown(
  order?: PriceOrder,
): TradePriceBreakdown | SVMTradePriceBreakdown | BridgeOrderFee | BridgeOrderFee[] {
  if (isSVMOrder(order)) {
    return computeSvmOrderFee(order)
  }

  if (isBridgeOrder(order)) {
    return computeBridgeOrderFee(order)
  }

  return computeTradePriceBreakdown(isXOrder(order) ? order.ammTrade : order?.trade)
}
