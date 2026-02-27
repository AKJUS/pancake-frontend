import { Currency, TradeType } from '@pancakeswap/sdk'
import { MSG_SENDER, Pool, PoolType, Route, RouteType, SmartRouter, SmartRouterTrade } from '@pancakeswap/smart-router'
import invariant from 'tiny-invariant'
import { getInputCurrency } from '../../utils/poolHelpers.tmp'
import { PancakeSwapOptions, SwapSection, SwapTradeContext } from '../types'

export const parseSwapTradeContext = (
  trade: Omit<SmartRouterTrade<TradeType>, 'gasEstimate'>,
  options: PancakeSwapOptions,
): SwapTradeContext => {
  const context: SwapTradeContext = {
    trade,
    options,
    routes: [],
    mustCustody: Boolean(options.fee || options.flatFee),
    user: options.recipient || MSG_SENDER,
    returnChanges: null,
    takeOverWrapSweep: null,
    mergedWrapBeforeTrade: null,
    reusedActionPlaner: null,
  }

  // Divide the routes into sections based on the pool type
  // Same pool type sections can be aggregated into a single swap
  for (let k = 0; k < trade.routes.length; k++) {
    const route = trade.routes[k]
    const sections = partition(route)

    const amountIn = SmartRouter.maximumAmountIn(trade, options.slippageTolerance, route.inputAmount)
    const amountOut = SmartRouter.minimumAmountOut(trade, options.slippageTolerance, route.outputAmount)

    const routeContext = {
      sections: [] as SwapSection[],
      maximumAmountIn: amountIn,
      minimumAmountOut: amountOut,
    }

    let inputCurrency = trade.inputAmount.currency

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]

      invariant(section.length, 'EMPTY_SECTION')

      const type = poolTypeToRouteType(section[0].type)

      invariant(
        type === RouteType.V2 ||
          type === RouteType.V3 ||
          type === RouteType.InfinityBIN ||
          type === RouteType.InfinityCL ||
          type === RouteType.STABLE,
        'INVALID_ROUTE_TYPE',
      )

      const isFirstSection = i === 0
      const isLastSection = i === sections.length - 1

      const poolIn = getInputCurrency(section[0], inputCurrency)
      const poolOut = SmartRouter.getOutputOfPools(section, poolIn)
      const output = isLastSection ? trade.outputAmount.currency : poolOut

      const newRoute = SmartRouter.buildBaseRoute([...section], poolIn, poolOut)

      const swap: SwapSection = {
        type,
        poolIn,
        poolOut,
        isFirstSection,
        isLastSection,
        nextSection: null,
        prevSection: null,
        wrapInput: inputCurrency.isNative && !poolIn.isNative,
        unwrapInput: !inputCurrency.isNative && poolIn.isNative,
        wrapOutput: !output.isNative && poolOut.isNative,
        unwrapOutput: output.isNative && !poolOut.isNative,
        payerIsUser: false,
        pools: section,
        route: newRoute,
        isInfinity:
          section[0].type === PoolType.InfinityBIN ||
          section[0].type === PoolType.InfinityCL ||
          section[0].type === PoolType.InfinityStable,
      }
      swap.payerIsUser = context.options.payerIsUser
        ? swap.isFirstSection && !(swap.wrapInput || swap.unwrapInput)
        : false
      inputCurrency = poolOut

      routeContext.sections.push(swap)
    }

    context.routes.push(routeContext)
  }

  // Next Sections
  for (let i = 0; i < context.routes.length; i++) {
    const route = context.routes[i]
    for (let j = 0; j < route.sections.length; j++) {
      if (j < route.sections.length - 1) {
        route.sections[j].nextSection = route.sections[j + 1]
      }
      if (j > 0) {
        route.sections[j].prevSection = route.sections[j - 1]
      }
    }
  }

  // merge wrap/unwrap in first sections
  const firstSections = context.routes.map((route) => route.sections[0])
  const shouldMergeWrap = firstSections.every((section) => section.wrapInput)
  const shouldMergeUnrap = firstSections.every((section) => section.unwrapInput)
  if (shouldMergeWrap || shouldMergeUnrap) {
    context.mergedWrapBeforeTrade = {
      wrap: shouldMergeWrap,
    }
  }

  return context
}

function poolTypeToRouteType(poolType: PoolType): RouteType {
  switch (poolType) {
    case PoolType.V2:
      return RouteType.V2
    case PoolType.V3:
      return RouteType.V3
    case PoolType.STABLE:
      return RouteType.STABLE
    case PoolType.InfinityBIN:
      return RouteType.InfinityBIN
    case PoolType.InfinityCL:
    case PoolType.InfinityStable:
      return RouteType.InfinityCL
    default:
      throw new Error('Invalid pool type')
  }
}

function partition(route: Route): Pool[][] {
  const sections: Pool[][] = []
  let currentSection: Pool[] = []

  function isSameType(a: Pool, b: Pool): boolean {
    return a.type === b.type
  }

  function noNeedWrap(a: Currency, b: Currency): boolean {
    return (a.isNative && b.isNative) || (!a.isNative && !b.isNative)
  }

  let inputCurrency = route.inputAmount.currency
  for (const pool of route.pools) {
    const outputCurrency = SmartRouter.getOutputCurrency(pool, inputCurrency)
    const lastPool = currentSection[currentSection.length - 1]
    const poolIn = getInputCurrency(pool, inputCurrency)

    if (!lastPool || (isSameType(lastPool, pool) && noNeedWrap(inputCurrency, poolIn))) {
      currentSection.push(pool)
    } else {
      sections.push(currentSection)
      currentSection = [pool]
    }
    inputCurrency = outputCurrency
  }

  if (currentSection.length > 0) {
    sections.push(currentSection)
  }

  return sections
}
