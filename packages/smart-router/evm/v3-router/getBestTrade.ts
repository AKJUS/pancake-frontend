import { ChainId } from '@pancakeswap/chains'
import { BigintIsh, Currency, CurrencyAmount, TradeType, ZERO } from '@pancakeswap/sdk'

import { RemoteLogger } from '@pancakeswap/utils/RemoteLogger'
import { ROUTE_CONFIG_BY_CHAIN } from './constants'
import { getBestRouteCombinationByQuotes } from './functions'
import { computeAllRoutesNew } from './functions/computeAllRoutesNew'
import { createGasModel } from './gasModel'
import { getRoutesWithValidQuote } from './getRoutesWithValidQuote'
import { BestRoutes, RouteConfig, RouteType, SmartRouterTrade, TradeConfig } from './types'
import { logPools, logRoutes } from './utils/remoteLogs'

export async function getBestTrade(
  amount: CurrencyAmount<Currency>,
  currency: Currency,
  tradeType: TradeType,
  config: TradeConfig,
): Promise<SmartRouterTrade<TradeType> | null> {
  const logger = RemoteLogger.getLogger(config.quoteId)
  logger.debug(
    `[SmartRouter] getBestTrade ${config.quoteId}, [${TradeType[tradeType]}] input=${amount.toExact()} ${
      currency.symbol
    } maxSplits=${config.maxSplits} maxHops=${config.maxHops}`,
  )
  try {
    const { blockNumber: blockNumberFromConfig } = config
    const blockNumber: BigintIsh | undefined =
      typeof blockNumberFromConfig === 'function' ? await blockNumberFromConfig() : blockNumberFromConfig
    const bestRoutes = await getBestRoutes(
      amount,
      currency,
      tradeType,
      {
        ...config,
        blockNumber,
      },
      config.quoteId,
    )
    if (!bestRoutes || bestRoutes.outputAmount.equalTo(ZERO)) {
      logger.debug('No valid route found')
      throw new Error('Cannot find a valid swap route')
    }

    const { routes, gasEstimateInUSD, gasEstimate, inputAmount, outputAmount } = bestRoutes
    // TODO restrict trade type to exact input if routes include one of the old
    // stable swap pools, which only allow to swap with exact input
    const trade = {
      tradeType,
      routes,
      gasEstimate,
      gasEstimateInUSD,
      inputAmount,
      outputAmount,
      blockNumber,
    }
    logger.debug(`find trade`)
    return trade
  } catch (ex) {
    logger.debug(`Error in getBestTrade ${ex}`)
    throw ex
  } finally {
    logger.flush()
  }
}

async function getBestRoutes(
  amount: CurrencyAmount<Currency>,
  currency: Currency,
  tradeType: TradeType,
  routeConfig: RouteConfig,
  quoteId?: string,
): Promise<BestRoutes | null> {
  const { chainId } = currency
  const {
    maxHops = 3,
    maxSplits = 4,
    distributionPercent: _distributionPercent = 5,
    poolProvider,
    quoteProvider,
    blockNumber,
    gasPriceWei,
    allowedPoolTypes,
    quoterOptimization,
    quoteCurrencyUsdPrice,
    nativeCurrencyUsdPrice,
    signal,
  } = {
    ...routeConfig,
    ...(ROUTE_CONFIG_BY_CHAIN[chainId as ChainId] || {}),
  }
  const distributionPercent = maxSplits ? _distributionPercent : 100
  const logger = RemoteLogger.getLogger(quoteId)
  const isExactIn = tradeType === TradeType.EXACT_INPUT
  const inputCurrency = isExactIn ? amount.currency : currency
  const outputCurrency = isExactIn ? currency : amount.currency

  const candidatePools = await poolProvider?.getCandidatePools({
    currencyA: amount.currency,
    currencyB: currency,
    blockNumber,
    protocols: allowedPoolTypes,
    signal,
  })

  logger.debug(
    `Candidate pools: ${candidatePools.length}, maxSplits=${maxSplits}, maxHops=${maxHops}, distributionPercent=${distributionPercent}`,
  )
  logPools(quoteId, candidatePools, 2)

  let baseRoutes = computeAllRoutesNew(inputCurrency, outputCurrency, candidatePools, maxHops, quoteId)

  // Do not support mix route on exact output
  if (tradeType === TradeType.EXACT_OUTPUT) {
    baseRoutes = baseRoutes.filter(({ type }) => type !== RouteType.MIXED)
  }
  logger.debug(`Discovered ${baseRoutes.length} Base routes, maxShow = 10`)
  logRoutes(quoteId, baseRoutes.slice(0, 10), 2)

  const gasModel = await createGasModel({
    gasPriceWei,
    poolProvider,
    quoteCurrency: currency,
    blockNumber,
    quoteCurrencyUsdPrice,
    nativeCurrencyUsdPrice,
  })

  const routesWithValidQuote = await getRoutesWithValidQuote({
    amount,
    baseRoutes,
    distributionPercent,
    quoteProvider,
    tradeType,
    blockNumber,
    gasModel,
    quoterOptimization,
    quoteId,
    signal,
  })

  logger.debug(`valid route=${routesWithValidQuote.length}, maxShow=100`)

  return getBestRouteCombinationByQuotes(amount, currency, routesWithValidQuote, tradeType, { maxSplits }, quoteId)
}
