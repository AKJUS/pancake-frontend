import type { AggregatorQuoteData } from '@pancakeswap/aggregator-sdk'
import { OrderType } from '@pancakeswap/price-api-sdk'
import type { ClassicOrder } from '@pancakeswap/price-api-sdk'
import type { InterfaceOrder } from 'views/Swap/utils'

/**
 * Returns the raw aggregator `quoteData` stashed on the order by
 * `bestAggregatorQuoteAtom`, or `undefined` for non-aggregator orders.
 *
 * Classification is bound to the identity of the selected order — not to
 * a shared query hash. Two orders with the same `trade.quoteQueryHash`
 * (e.g. an aggregator winner and a legacy winner for the same query)
 * are distinct objects with independent classifications.
 */
export function getAggregatorQuoteData(
  order: InterfaceOrder | ClassicOrder | undefined | null,
): AggregatorQuoteData | undefined {
  if (!order || order.type !== OrderType.PCS_CLASSIC) return undefined
  return (order as ClassicOrder).aggregatorQuoteData as AggregatorQuoteData | undefined
}

export function isAggregatorOrder(order: InterfaceOrder | ClassicOrder | undefined | null): boolean {
  return getAggregatorQuoteData(order) !== undefined
}
