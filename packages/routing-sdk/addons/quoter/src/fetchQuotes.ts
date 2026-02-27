import { CurrencyAmount } from '@pancakeswap/swap-sdk-core'

import { buildInfinityBinQuoteCall, buildInfinityCLQuoteCall, buildInfinityMixedQuoteCall } from './fetchInfinityQuote'
import { buildMixedRouteQuoteCall } from './fetchMixedRouteQuote'
import { buildV3QuoteCall } from './fetchV3Quote'
import { FetchQuotes, SupportedPool } from './types'
import { isInfinityBinRoute, isInfinityCLRoute, isInfinityMixedRoute, isInfinityStableRoute, isV3Route } from './utils'

export const fetchQuotes: FetchQuotes<SupportedPool> = async ({ routes, client }) => {
  const [route] = routes
  const { amount, path } = route
  const isExactOut = path[path.length - 1].wrapped.equals(amount.currency.wrapped)
  const calls = routes.map((r) => {
    if (isV3Route(r)) {
      return buildV3QuoteCall(r)
    }
    if (isInfinityCLRoute(r)) {
      return isExactOut ? buildInfinityCLQuoteCall(r) : buildInfinityMixedQuoteCall(r)
    }
    if (isInfinityBinRoute(r)) {
      return isExactOut ? buildInfinityBinQuoteCall(r) : buildInfinityMixedQuoteCall(r)
    }

    // NOTE: InfinityStable used mixed route quoter because it doesn't support exact out similar to MixedQuote
    if (isInfinityStableRoute(r) || isInfinityMixedRoute(r)) {
      return buildInfinityMixedQuoteCall(r)
    }
    return buildMixedRouteQuoteCall(r)
  })
  const results = await client.multicall({
    contracts: calls,
  })

  return results.map((result, i) => {
    if (result.status === 'failure') {
      console.warn('[routing-sdk][QUOTER]: fail to get quote', result.error)
      console.warn('failed route & call ', routes[i], calls[i])
      return undefined
    }
    const { path: currentPath } = routes[i]
    const outCurrency = isExactOut ? currentPath[0] : currentPath[currentPath.length - 1]
    if (result.result.length === 2) {
      const [quote, gasUseEstimate] = result.result
      return {
        quote: CurrencyAmount.fromRawAmount(outCurrency, quote),
        gasUseEstimate,
      }
    }
    const [quote, , , gasUseEstimate] = result.result
    return {
      quote: CurrencyAmount.fromRawAmount(outCurrency, quote),
      gasUseEstimate,
    }
  })
}
