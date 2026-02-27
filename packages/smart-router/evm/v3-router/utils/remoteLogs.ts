import { Pair } from '@pancakeswap/sdk'
import { RemoteLogger } from '@pancakeswap/utils/RemoteLogger'
import { BaseRoute, Pool, PoolType, RouteType, RouteWithQuote } from '../types'

export const logPools = (quoteId: string | undefined, pools: Pool[], indent = 1) => {
  const logger = RemoteLogger.getLogger(quoteId)
  for (const pool of pools) {
    logger.debug(poolInfoStr(pool), indent)
  }
}

export const poolInfoStr = (pool: Pool): string => {
  switch (pool.type) {
    case PoolType.V3:
      return `[V3] id=${pool.address}, ${pool.token0.symbol}/${pool.token1.symbol}`
    case PoolType.V2: {
      const id = Pair.getAddress(pool.reserve0.currency.wrapped, pool.reserve1.currency.wrapped)
      return `[V2] id=${id}, ${pool.reserve0.currency.symbol}/${pool.reserve1.currency.symbol}`
    }
    case PoolType.STABLE:
      return `[Stable] id=${pool.address}, ${pool.balances[0].currency.symbol}/${pool.balances[1].currency.symbol}`
    case PoolType.InfinityBIN:
      return `[InfinityBIN] id=${pool.id}, ${pool.currency0.symbol}/${pool.currency1.symbol}`
    case PoolType.InfinityCL:
      return `[InfinityCL] id=${pool.id}, ${pool.currency0.symbol}/${pool.currency1.symbol}`
    case PoolType.InfinityStable:
      return `[InfinityStable] id=${pool.id}, ${pool.currency0.symbol}/${pool.currency1.symbol}`
    default:
      throw new Error('[poolInfoStr]: Unknown pool type')
  }
}

export const logRoutes = (quoteId: string | undefined, routes: BaseRoute[], indent = 1) => {
  for (const [i, route] of Object.entries(routes)) {
    const logger = RemoteLogger.getLogger(quoteId)
    const { type, pools, input, output } = route
    logger.debug(`- #${i} ${RouteType[type]}, pools=${pools.length}, ${input.symbol}/${output.symbol}`, indent)
    logPools(quoteId, pools, indent + 1)
  }
}

export const logRoutesWithQuote = (quoteId: string | undefined, _routes: RouteWithQuote[], indent = 1) => {
  const routes = _routes.slice()
  routes.sort((a, b) => a.percent - b.percent)
  for (const [i, route] of Object.entries(routes)) {
    const logger = RemoteLogger.getLogger(quoteId)
    const percent = route.percent.toFixed(2)
    const amt = route.amount
    const { type, pools, input, output, quote, quoteAdjustedForGas } = route

    logger.debug(
      `- #${i} [${percent}%] ${RouteType[type]}, pools=${pools.length}, ${input.symbol}/${output.symbol}`,
      indent,
    )
    logger.debug(
      `quote: amount:${amt.toExact()} ${amt.currency.symbol} quote:${quoteAdjustedForGas.toExact()} ${
        quoteAdjustedForGas.currency.symbol
      }`,
      indent + 1,
    )

    logPools(quoteId, pools, indent + 1)
  }
}
