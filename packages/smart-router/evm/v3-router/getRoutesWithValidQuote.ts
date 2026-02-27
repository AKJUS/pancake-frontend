import { BigintIsh, Currency, CurrencyAmount, TradeType } from '@pancakeswap/sdk'
import { AbortControl } from '@pancakeswap/utils/abortControl'
import chunk from '@pancakeswap/utils/chunk'

import { RemoteLogger } from '@pancakeswap/utils/RemoteLogger'
import { getAmountDistribution } from './functions'
import { BaseRoute, GasModel, QuoteProvider, RouteWithoutQuote, RouteWithQuote } from './types'
import { getPoolAddress } from './utils'

type Params = {
  blockNumber?: BigintIsh
  amount: CurrencyAmount<Currency>
  baseRoutes: BaseRoute[]
  distributionPercent: number
  quoteProvider: QuoteProvider
  tradeType: TradeType
  gasModel: GasModel
  quoterOptimization?: boolean
  quoteId?: string
} & AbortControl

export async function getRoutesWithValidQuote({
  amount,
  baseRoutes,
  distributionPercent = 5,
  quoteProvider,
  tradeType,
  blockNumber,
  gasModel,
  quoterOptimization = true,
  signal,
  quoteId,
}: Params): Promise<RouteWithQuote[]> {
  // const distributionPercent = 100
  const logger = RemoteLogger.getLogger(quoteId)
  logger.debug('run getRoutesWithValidQuote')
  const [percents, amounts] = getAmountDistribution(amount, distributionPercent)
  const routesWithoutQuote = amounts.reduce<RouteWithoutQuote[]>(
    (acc, curAmount, i) => [
      ...acc,
      ...baseRoutes.map((r) => ({
        ...r,
        amount: curAmount,
        percent: percents[i],
      })),
    ],
    [],
  )

  logger.debug(`quote calls=${routesWithoutQuote.length}`, 2)
  for (const route of routesWithoutQuote) {
    logger.debug(
      `quote call, ${route.percent}% ${route.pools.map((x) => getPoolAddress(x)).join(',')} ${route.input.symbol} ${
        route.output.symbol
      } ${route.amount.quotient}`,
      3,
    )
  }

  const getRoutesWithQuote =
    tradeType === TradeType.EXACT_INPUT
      ? quoteProvider.getRouteWithQuotesExactIn
      : quoteProvider.getRouteWithQuotesExactOut

  if (!quoterOptimization) {
    return getRoutesWithQuote(routesWithoutQuote, { blockNumber, gasModel, signal, quoteId })
  }

  logger.debug('via quote optimization', 2)
  const requestCallback = typeof window === 'undefined' ? setTimeout : window.requestIdleCallback || window.setTimeout
  logger.debug(`Get quotes from ${routesWithoutQuote.length} routes routesWithoutQuote`, 2)
  // Split into chunks so the calculation won't block the main thread
  const getQuotes = (routes: RouteWithoutQuote[]): Promise<RouteWithQuote[]> =>
    new Promise((resolve, reject) => {
      requestCallback(async () => {
        try {
          const result = await getRoutesWithQuote(routes, { blockNumber, gasModel, signal })
          resolve(result)
        } catch (e) {
          reject(e)
        }
      })
    })
  const chunks = chunk(routesWithoutQuote, 10)
  const result = await Promise.all(chunks.map(getQuotes))
  const quotes = result.reduce<RouteWithQuote[]>((acc, cur) => {
    acc.push(...cur)
    return acc
  }, [])
  logger.debug(`Get quotes success, got, ${quotes.length}`)

  return quotes
}
