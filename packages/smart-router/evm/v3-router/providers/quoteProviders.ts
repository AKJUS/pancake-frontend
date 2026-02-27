import { ChainId } from '@pancakeswap/chains'
import { RemoteLogger } from '@pancakeswap/utils/RemoteLogger'
import { INFI_SUPPORTED_CHAINS } from '../../constants/infinity'
import { QuoteProvider, QuoterConfig, QuoterOptions, RouteType, RouteWithQuote, RouteWithoutQuote } from '../types'
import { isInfinityBinPool, isInfinityClPool, isInfinityStablePool, isV3Pool } from '../utils'
import { createOffChainQuoteProvider } from './offChainQuoteProvider'
import {
  createInfinityBinOnChainQuoteProvider,
  createInfinityClOnChainQuoteProvider,
  createMixedRouteOnChainQuoteProvider,
  createMixedRouteOnChainQuoteProviderV2,
  createV3OnChainQuoteProvider,
} from './onChainQuoteProvider'

// For evm
export function createQuoteProvider(config: QuoterConfig): QuoteProvider<QuoterConfig> {
  const { onChainProvider, multicallConfigs, gasLimit, account } = config
  const offChainQuoteProvider = createOffChainQuoteProvider()
  const mixedRouteOnChainQuoteProviderV1 = createMixedRouteOnChainQuoteProvider({
    onChainProvider,
    multicallConfigs,
    gasLimit,
    account,
  })
  const mixedRouteOnChainQuoteProviderV2 = createMixedRouteOnChainQuoteProviderV2({
    onChainProvider,
    multicallConfigs,
    gasLimit,
    account,
  })
  const v3OnChainQuoteProvider = createV3OnChainQuoteProvider({ onChainProvider, multicallConfigs, gasLimit, account })
  const infinityClOnChainQuoteProvider = createInfinityClOnChainQuoteProvider({
    onChainProvider,
    multicallConfigs,
    gasLimit,
    account,
  })
  const infinityBinOnChainQuoteProvider = createInfinityBinOnChainQuoteProvider({
    onChainProvider,
    multicallConfigs,
    gasLimit,
    account,
  })

  const createGetRouteWithQuotes = (isExactIn = true) => {
    const getOffChainQuotes = isExactIn
      ? offChainQuoteProvider.getRouteWithQuotesExactIn
      : offChainQuoteProvider.getRouteWithQuotesExactOut
    const getV3Quotes = isExactIn
      ? v3OnChainQuoteProvider.getRouteWithQuotesExactIn
      : v3OnChainQuoteProvider.getRouteWithQuotesExactOut
    const getInfinityClQuotes = isExactIn
      ? infinityClOnChainQuoteProvider.getRouteWithQuotesExactIn
      : infinityClOnChainQuoteProvider.getRouteWithQuotesExactOut
    const getInfinityBinQuotes = isExactIn
      ? infinityBinOnChainQuoteProvider.getRouteWithQuotesExactIn
      : infinityBinOnChainQuoteProvider.getRouteWithQuotesExactOut
    const createMixedRouteQuoteFetcher = (chainId: ChainId) => {
      const mixedRouteOnChainQuoteProvider = INFI_SUPPORTED_CHAINS.includes(chainId as any)
        ? mixedRouteOnChainQuoteProviderV2
        : mixedRouteOnChainQuoteProviderV1
      return isExactIn
        ? mixedRouteOnChainQuoteProvider.getRouteWithQuotesExactIn
        : mixedRouteOnChainQuoteProvider.getRouteWithQuotesExactOut
    }

    return async function getRoutesWithQuotes(
      routes: RouteWithoutQuote[],
      { blockNumber, gasModel, signal, quoteId }: QuoterOptions,
    ): Promise<RouteWithQuote[]> {
      const { chainId } = routes[0]?.input || {}
      const getMixedRouteQuotes = createMixedRouteQuoteFetcher(chainId)

      const infinityClRoutes: RouteWithoutQuote[] = []
      const infinityBinRoutes: RouteWithoutQuote[] = []
      const v3SingleHopRoutes: RouteWithoutQuote[] = []
      const v3MultihopRoutes: RouteWithoutQuote[] = []
      const mixedRoutesHaveV3Pool: RouteWithoutQuote[] = []
      const routesCanQuoteOffChain: RouteWithoutQuote[] = []
      for (const route of routes) {
        if (route.type === RouteType.V2 || route.type === RouteType.STABLE) {
          routesCanQuoteOffChain.push(route)
          continue
        }
        if (route.type === RouteType.V3) {
          if (route.pools.length === 1) {
            v3SingleHopRoutes.push(route)
            continue
          }
          v3MultihopRoutes.push(route)
          continue
        }

        if (route.type === RouteType.InfinityStable) {
          if (isExactIn) {
            mixedRoutesHaveV3Pool.push(route)
            continue
          }
          // no support for exact out
          continue
        }
        if (route.type === RouteType.InfinityCL) {
          if (isExactIn) {
            mixedRoutesHaveV3Pool.push(route)
            continue
          }

          infinityClRoutes.push(route)
          continue
        }
        if (route.type === RouteType.InfinityBIN) {
          if (isExactIn) {
            mixedRoutesHaveV3Pool.push(route)
            continue
          }
          infinityBinRoutes.push(route)
          continue
        }
        const { pools } = route
        if (
          pools.some(
            (pool) => isV3Pool(pool) || isInfinityClPool(pool) || isInfinityBinPool(pool) || isInfinityStablePool(pool),
          )
        ) {
          mixedRoutesHaveV3Pool.push(route)
          continue
        }
        routesCanQuoteOffChain.push(route)
      }

      logQuoters(
        quoteId,
        routesCanQuoteOffChain,
        mixedRoutesHaveV3Pool,
        v3SingleHopRoutes,
        v3MultihopRoutes,
        infinityClRoutes,
        infinityBinRoutes,
      )

      const results = await Promise.allSettled([
        getOffChainQuotes(routesCanQuoteOffChain, { blockNumber, gasModel, signal, quoteId }),
        getMixedRouteQuotes(mixedRoutesHaveV3Pool, { blockNumber, gasModel, retry: { retries: 0 }, signal, quoteId }),
        getV3Quotes(v3SingleHopRoutes, { blockNumber, gasModel, signal, quoteId }),
        getV3Quotes(v3MultihopRoutes, { blockNumber, gasModel, retry: { retries: 1 }, signal, quoteId }),
        getInfinityClQuotes(infinityClRoutes, { blockNumber, gasModel, signal, quoteId }),
        getInfinityBinQuotes(infinityBinRoutes, { blockNumber, gasModel, signal, quoteId }),
      ])

      if (results.every((result) => result.status === 'rejected')) {
        throw new Error(results.map((result) => (result as PromiseRejectedResult).reason).join(','))
      }
      return results
        .filter((result): result is PromiseFulfilledResult<RouteWithQuote[]> => result.status === 'fulfilled')
        .reduce<RouteWithQuote[]>((acc, cur) => [...acc, ...cur.value], [])
    }
  }

  return {
    getRouteWithQuotesExactIn: createGetRouteWithQuotes(true),
    getRouteWithQuotesExactOut: createGetRouteWithQuotes(false),
    getConfig: () => config,
  }
}

function logQuoters(
  quoteId: string | undefined,
  routesCanQuoteOffChain: RouteWithoutQuote[],
  mixedRoutesHaveV3Pool: RouteWithoutQuote[],
  v3SingleHopRoutes: RouteWithoutQuote[],
  v3MultihopRoutes: RouteWithoutQuote[],
  infinityClRoutes: RouteWithoutQuote[],
  infinityBinRoutes: RouteWithoutQuote[],
) {
  const logger = RemoteLogger.getLogger(quoteId)

  if (routesCanQuoteOffChain.length) {
    logger.debug(`try getOffChainQuotes=${routesCanQuoteOffChain.length}`, 2)
  }
  if (mixedRoutesHaveV3Pool.length) {
    logger.debug(`try getMixedRouteQuotes=${mixedRoutesHaveV3Pool.length}`, 2)
  }
  if (v3SingleHopRoutes.length) {
    logger.debug(`try getV3Quotes=${v3SingleHopRoutes.length}`, 2)
  }
  if (v3MultihopRoutes.length) {
    logger.debug(`try getV3Quotes=${v3MultihopRoutes.length}`, 2)
  }
  if (infinityClRoutes.length) {
    logger.debug(`try getInfinityClQuotes=${infinityClRoutes.length}`, 2)
  }
  if (infinityBinRoutes.length) {
    logger.debug(`try getInfinityBinQuotes=${infinityBinRoutes.length}`, 2)
  }
}
