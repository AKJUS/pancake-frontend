import { Currency, Percent, SPLToken, TradeType } from '@pancakeswap/swap-sdk-core'
import { Loadable } from '@pancakeswap/utils/Loadable'
import { TimeoutError } from '@pancakeswap/utils/withTimeout'
import { getIsWrapping } from 'hooks/useWrapCallback'
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { isBetterQuoteTrade } from 'quoter/utils/getBetterQuote'
import { isEqualQuoteQuery } from 'quoter/utils/PoolHashHelper'
import { warningSeverity } from 'utils/exchange'
import { InterfaceOrder, isBridgeOrder, isSVMOrder } from 'views/Swap/utils'
import { OrderType } from '@pancakeswap/price-api-sdk'
import { computeTradePriceBreakdown } from 'views/Swap/V3Swap/utils/exchange'
import { NoValidRouteError, QuoteQuery, SVMQuoteQuery, XTradeError } from '../quoter.types'
import { activeQuoteHashAtom } from './abortControlAtoms'
import { bestSVMOrderAtom } from './bestSVMOrderAtom'
import { placeholderAtom } from './placeholderAtom'
import { routingStrategyAtom, StrategyRoute } from './routingStrategy'
import { handlePlaceholderForPendingResult } from '../utils/placeholderHandler'

function getFailReason(errors: any[]) {
  const someTimeout = errors.find((x) => x instanceof TimeoutError)
  const someXTradeError = errors.find((x) => x instanceof XTradeError)
  if (someTimeout) {
    return someTimeout
  }
  if (someXTradeError) {
    return someXTradeError
  }
  return new NoValidRouteError()
}

export const bestSameChainWithoutPlaceHolderAtom = atomFamily((_option: QuoteQuery) => {
  return atom((get) => {
    function executeRoutes(
      strategies: StrategyRoute[],
      option: QuoteQuery,
    ): {
      quote: Loadable<InterfaceOrder>
      anyShadowFail?: boolean
      anyTimeout?: boolean
      key?: string
    } {
      try {
        const quotes = strategies.map((route) => ({
          result: get(route.query({ ...option, ...route.overrides, routeKey: route.key })),
          isShadow: route.isShadow,
          key: route.key,
        }))

        const anyPending = quotes.some((x) => x.result.isPending())
        const anyFail = quotes.some((x) => x.result.isFail())
        const errors = quotes.filter((x) => x.result.isFail()).map((x) => x.result.error)
        const best = findBestQuote(...quotes.map((x) => x.result))
        const anyShadowFail = quotes.some((x) => x.isShadow && x.result.isFail())
        const anyTimeout = errors.some((x) => x instanceof TimeoutError)

        if (!best) {
          if (anyPending) {
            return {
              quote: Loadable.Pending<InterfaceOrder>(),
              anyShadowFail,
              anyTimeout,
            }
          }
          return {
            quote: anyFail ? Loadable.Fail<InterfaceOrder>(getFailReason(errors)) : Loadable.Nothing<InterfaceOrder>(),
            anyShadowFail,
            anyTimeout,
          }
        }
        const [bestQuote, index] = best
        if (bestQuote) {
          if (!anyPending) {
            // updateStrategy(strategyHash, routes[bestIndex])
            return {
              quote: Loadable.Just<InterfaceOrder>(bestQuote),
              anyShadowFail,
              anyTimeout,
              key: quotes[index].key,
            }
          }
          return {
            quote: Loadable.Pending<InterfaceOrder>(bestQuote),
            anyShadowFail,
            anyTimeout,
          }
        }
        return {
          quote: anyFail ? Loadable.Fail<InterfaceOrder>(getFailReason(errors)) : Loadable.Nothing<InterfaceOrder>(),
          anyShadowFail,
          anyTimeout,
        }
      } catch (ex) {
        return {
          quote: Loadable.Fail<InterfaceOrder>(getFailReason([ex])),
        }
      }
    }

    // No active quote hash means some new quoter has started
    // This quoter query is outdated
    const activeQuoteHash = get(activeQuoteHashAtom)
    if (!activeQuoteHash) {
      return Loadable.Pending<InterfaceOrder>()
    }

    const option: QuoteQuery = { enabled: true, type: 'quoter', tradeType: TradeType.EXACT_INPUT, ..._option }

    try {
      const amountCurrency = option.amount?.currency

      if (
        option.baseCurrency &&
        option.currency &&
        SPLToken.isSPLToken(option.baseCurrency) &&
        SPLToken.isSPLToken(option.currency) &&
        amountCurrency &&
        SPLToken.isSPLToken(amountCurrency)
      ) {
        // NOTE: safe to cast to SVMQuoteQuery since we already check the condition above
        return get(bestSVMOrderAtom(option as unknown as SVMQuoteQuery))
      }

      if (
        !option.currency ||
        !amountCurrency ||
        SPLToken.isSPLToken(amountCurrency) ||
        SPLToken.isSPLToken(option.currency)
      ) {
        return Loadable.Nothing<InterfaceOrder>()
      }

      const isWrapping = getIsWrapping(
        amountCurrency as Currency,
        option.currency as Currency | undefined,
        option.currency?.chainId,
      )
      if (isWrapping || !option.enabled) {
        return Loadable.Nothing<InterfaceOrder>()
      }
      if (!option.baseCurrency || !option.currency) {
        return Loadable.Nothing<InterfaceOrder>()
      }
      if (option.baseCurrency?.equals(option.currency)) {
        return Loadable.Nothing<InterfaceOrder>()
      }
      if (!option.amount?.quotient) {
        return Loadable.Nothing<InterfaceOrder>()
      }

      const strategies = get(routingStrategyAtom(option))
      const p1 = strategies.filter((x) => x.priority === 1)
      const p2 = strategies.filter((x) => x.priority === 2)
      const tests = [p1, p2].filter((x) => x.length > 0)
      for (let i = 0; i < tests.length; i++) {
        const strategy = tests[i]
        if (strategy.length === 0) {
          return Loadable.Fail<InterfaceOrder>(new NoValidRouteError())
        }
        const { quote, anyShadowFail, anyTimeout, key } = executeRoutes(strategy, option)

        if (quote.isJust()) {
          const order = quote.unwrap()

          // NOTE: refactor so it doesn't need to check for bridge order
          if (isBridgeOrder(order) || isSVMOrder(order)) {
            continue
          }

          if (i !== tests.length - 1) {
            const trade = order?.type === OrderType.DUTCH_LIMIT ? order.ammTrade : order?.trade

            // eslint-disable-next-line
            const priceImpactWithoutFee = computeTradePriceBreakdown(trade).priceImpactWithoutFee

            const isHighImpact = warningSeverity(priceImpactWithoutFee) >= 3
            if (isHighImpact) {
              continue
            }
          }
          if (!anyShadowFail) {
            logQuote(key)
            return quote
          }
        }

        if (anyTimeout) {
          return quote
        }
        if (quote.isNothing()) {
          continue
        }
        if (quote.isFail() && i !== tests.length - 1) {
          continue
        }
        if (quote.isJust() && anyShadowFail) {
          continue
        }
        return quote
      }
      return Loadable.Nothing<InterfaceOrder>()
    } catch (ex) {
      // eslint-disable-next-line no-console
      console.error(`[quote] Error getting quote:`, ex)
      return Loadable.Fail<InterfaceOrder>(ex)
    }
  })
}, isEqualQuoteQuery)

function logQuote(key?: string) {
  // eslint-disable-next-line no-console
  console.log(`%c[quote] with ${key}`, 'color: green; font-weight: bold;')
}

export const bestSameChainAtom = atomFamily((_option: QuoteQuery) => {
  return atom((get) => {
    const result = get(bestSameChainWithoutPlaceHolderAtom(_option))

    if (result.isPending()) {
      const placeHolder = get(placeholderAtom(_option.placeholderHash || ''))

      if (placeHolder !== undefined) {
        return handlePlaceholderForPendingResult<InterfaceOrder>({
          result,
          placeholder: placeHolder,
          placeholderHash: _option.placeholderHash,
        })
      }
    }
    return result.setExtra('placeholderHash', _option.placeholderHash!)
  })
}, isEqualQuoteQuery)

function findBestQuote(...args: Loadable<InterfaceOrder>[]): [InterfaceOrder, number] | undefined {
  const fulfilledValues = args.map((x) => x.unwrapOr(undefined))

  let bestOrder: InterfaceOrder | undefined
  let idx = -1
  for (let i = 0; i < fulfilledValues.length; i++) {
    const order = fulfilledValues[i]
    if (!order) {
      continue
    }
    if (!order?.trade) continue
    if (!bestOrder) {
      bestOrder = order
      idx = i
      continue
    }
    if (isBetterQuoteTrade(bestOrder.trade, order.trade)) {
      bestOrder = order
      idx = i
    }
  }
  return bestOrder ? [bestOrder, idx] : undefined
}
