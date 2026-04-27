import { fetchQuotes, Quote } from '@pancakeswap/routing-sdk-addon-quoter'
import { Currency, CurrencyAmount, Fraction, TradeType } from '@pancakeswap/swap-sdk-core'
import { InfinityRouter, PoolType, RouteType } from '@pancakeswap/smart-router'

import { toRoutingSDKTrade } from 'utils/convertTrade'
import { getViemClients } from 'utils/viem'

type Trade = InfinityRouter.InfinityTradeWithoutGraph<TradeType>

type OnChainQuoteCheck = {
  quotes: (Quote | undefined)[]
  indexesOfRoutesToVerify: number[]
  isExactIn: boolean
  quoteCurrency: Currency
}

function hasRequiredInfinityMetadata(pool: any): boolean {
  if (!pool) return false

  if (pool.type === PoolType.InfinityCL || pool.type === PoolType.InfinityStable) {
    return Number.isFinite(pool.tickSpacing) && typeof pool.poolManager === 'string' && pool.poolManager.length > 0
  }

  if (pool.type === PoolType.InfinityBIN) {
    return Number.isFinite(pool.binStep) && typeof pool.poolManager === 'string' && pool.poolManager.length > 0
  }

  return true
}

function isRouteVerifiable(route: Trade['routes'][number]): boolean {
  return route.pools.every(hasRequiredInfinityMetadata)
}

// Returns `null` when there's nothing to verify (pure V2/stable exactOut).
async function runOnChainQuoteCheck(trade: Trade): Promise<OnChainQuoteCheck | null> {
  const isExactIn = trade.tradeType === TradeType.EXACT_INPUT
  const quoteCurrency = isExactIn ? trade.outputAmount.currency : trade.inputAmount.currency
  const indexesOfRoutesToVerify = isExactIn
    ? trade.routes.reduce<number[]>((acc, route, index) => (isRouteVerifiable(route) ? [...acc, index] : acc), [])
    : trade.routes.reduce<number[]>(
        (acc, r, index) =>
          r.type !== RouteType.V2 && r.type !== RouteType.STABLE && isRouteVerifiable(r) ? [...acc, index] : acc,
        [],
      )
  if (!indexesOfRoutesToVerify.length) {
    return null
  }

  const sdkTrade = toRoutingSDKTrade(trade)
  const quoteRoutes = sdkTrade.routes
    .filter((_, index) => indexesOfRoutesToVerify.includes(index))
    .map((r) => ({
      ...r,
      amount: isExactIn ? r.inputAmount : r.outputAmount,
    }))
  const quotes = await fetchQuotes({
    routes: quoteRoutes,
    client: getViemClients({ chainId: trade.inputAmount.currency.chainId }),
  })
  if (quotes.some((q) => q === undefined)) {
    throw new Error('Fail to validate')
  }
  return { quotes, indexesOfRoutesToVerify, isExactIn, quoteCurrency }
}

// Validation only — throws if any route can't be quoted on-chain. Use when the
// caller trusts the trade amounts (e.g. aggregator BE).
export async function validateTradeOnChain(trade?: Trade): Promise<void> {
  if (!trade) throw new Error(`Invalid trade ${trade} to verify`)
  await runOnChainQuoteCheck(trade)
}

// Validation + revision — returns a new trade with amounts/gas replaced by the
// on-chain quote results. Use when the FE's recomputation is the source of truth.
export async function getVerifiedTrade(trade?: Trade): Promise<Trade> {
  if (!trade) throw new Error(`Invalid trade ${trade} to verify`)
  const check = await runOnChainQuoteCheck(trade)
  if (!check) return trade
  const { quotes, indexesOfRoutesToVerify, isExactIn, quoteCurrency } = check

  const getQuotePosition = (routeIndex: number) => indexesOfRoutesToVerify.findIndex((i) => i === routeIndex)
  const { quote, gasUseEstimate } = trade.routes.reduce<NonNullable<Quote>>(
    (total, r, index) => {
      const position = getQuotePosition(index)
      const q =
        position !== -1
          ? quotes[position]
          : { quote: isExactIn ? r.outputAmount : r.inputAmount, gasUseEstimate: r.gasUseEstimate }
      return {
        quote: total.quote.add(CurrencyAmount.fromRawAmount(quoteCurrency, q!.quote.quotient)),
        gasUseEstimate: total.gasUseEstimate + q!.gasUseEstimate,
      }
    },
    {
      quote: CurrencyAmount.fromRawAmount(quoteCurrency, 0n),
      gasUseEstimate: 0n,
    },
  )
  return {
    ...trade,
    routes: trade.routes.map((r, index) => {
      const quotePosition = getQuotePosition(index)
      const verifiedQuote = quotePosition !== -1 ? quotes[quotePosition]! : undefined
      return {
        ...r,
        inputAmount: isExactIn || !verifiedQuote ? r.inputAmount : verifiedQuote.quote,
        outputAmount: isExactIn && verifiedQuote ? verifiedQuote.quote : r.outputAmount,
        ...(verifiedQuote ? reviseGasUseEstimate(trade.tradeType, r, verifiedQuote.gasUseEstimate) : {}),
      }
    }),
    inputAmount: isExactIn ? trade.inputAmount : quote,
    outputAmount: isExactIn ? quote : trade.outputAmount,
    ...reviseGasUseEstimate(trade.tradeType, trade, gasUseEstimate),
  }
}

type GasUseEstimate = Pick<
  Trade,
  | 'gasUseEstimate'
  | 'inputAmountWithGasAdjusted'
  | 'outputAmountWithGasAdjusted'
  | 'gasUseEstimateBase'
  | 'gasUseEstimateQuote'
>

function reviseGasUseEstimate(
  tradeType: TradeType,
  estimate: GasUseEstimate,
  actualGasUseEstimate: bigint,
): GasUseEstimate {
  const isExactIn = tradeType === TradeType.EXACT_INPUT
  const factor = new Fraction(actualGasUseEstimate, estimate.gasUseEstimate)
  const gasUseEstimateBase =
    factor.denominator > 0n
      ? estimate.gasUseEstimateBase.multiply(factor)
      : CurrencyAmount.fromRawAmount(estimate.gasUseEstimateQuote.currency, 0n)
  const gasUseEstimateQuote =
    factor.denominator > 0n
      ? estimate.gasUseEstimateQuote.multiply(factor)
      : CurrencyAmount.fromRawAmount(estimate.gasUseEstimateQuote.currency, 0n)
  const inputAmountWithGasAdjusted = isExactIn
    ? estimate.inputAmountWithGasAdjusted
    : estimate.inputAmountWithGasAdjusted.subtract(estimate.gasUseEstimateQuote).add(gasUseEstimateQuote)
  const outputAmountWithGasAdjusted = isExactIn
    ? estimate.outputAmountWithGasAdjusted.add(estimate.gasUseEstimateQuote).subtract(gasUseEstimateQuote)
    : estimate.outputAmountWithGasAdjusted

  return {
    gasUseEstimateBase,
    gasUseEstimateQuote,
    inputAmountWithGasAdjusted,
    outputAmountWithGasAdjusted,
    gasUseEstimate: actualGasUseEstimate,
  }
}
