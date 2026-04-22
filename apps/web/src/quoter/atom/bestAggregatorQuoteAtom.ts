import { TradeType } from '@pancakeswap/swap-sdk-core'
import { AggregatorService } from '@pancakeswap/aggregator-sdk'
import { withTimeout } from '@pancakeswap/utils/withTimeout'
import { isAllowedAggregatorRouter } from 'config/constants/aggregatorRouters'
import { AGGREGATOR_API_BASE_URL, AGGREGATOR_API_KEY } from 'config/constants/endpoints'
import { atomFamily } from 'jotai/utils'
import { QUOTE_TIMEOUT } from 'quoter/consts'
import { quoteTraceAtom } from 'quoter/perf/quoteTracker'
import type { QuoteQuery } from 'quoter/quoter.types'
import { validateTradeOnChain } from 'quoter/utils/getVerifiedTrade'
import { safeGetAddress } from 'utils/safeGetAddress'
import { zeroAddress } from 'viem'
import type { ClassicOrder } from '@pancakeswap/price-api-sdk'
import { atomWithLoadable } from './atomWithLoadable'

if (!AGGREGATOR_API_BASE_URL) {
  console.warn('[aggregator] NEXT_PUBLIC_AGGREGATOR_API is not set — aggregator quotes will fail')
}

export const aggregatorService = new AggregatorService(AGGREGATOR_API_BASE_URL ?? '', AGGREGATOR_API_KEY)

function isEqualAggregatorQuoteQuery(a: QuoteQuery, b: QuoteQuery) {
  return a.hash === b.hash
}

// Map FE pool-type toggles to the aggregator API's protocol param.
// Returns undefined when all protocols are on (API default) so the param is omitted.
export function buildAggregatorProtocol(option: QuoteQuery): string | undefined {
  const protocols: string[] = []
  if (option.v2Swap) protocols.push('v2')
  if (option.v3Swap) protocols.push('v3')
  if (option.infinitySwap) {
    // infinitySwap covers both InfinityCL and InfinityBIN pool types
    protocols.push('infinityCl')
    protocols.push('infinityBin')
  }
  if (option.stableSwap) protocols.push('stableswap')
  const ALL_PROTOCOLS = ['v2', 'v3', 'infinityCl', 'infinityBin', 'stableswap']
  if (protocols.length === 0 || protocols.length === ALL_PROTOCOLS.length) return undefined
  return protocols.join(',')
}

export const bestAggregatorQuoteAtom = atomFamily((option: QuoteQuery) => {
  const { amount, currency, tradeType } = option
  return atomWithLoadable(async (get) => {
    if (!amount || !amount.currency || !currency) {
      return undefined
    }

    const controller = new AbortController()
    const perf = get(quoteTraceAtom(option))
    perf.tracker.track('start')
    const { chainId } = currency

    const query = withTimeout(
      async () => {
        const tt = tradeType || TradeType.EXACT_INPUT

        // Aggregator is exactIn-only — skip API call for exactOut and let the strategy layers fall back to legacy quoters
        if (tt === TradeType.EXACT_OUTPUT) return undefined

        const inputCur = amount.currency
        const outputCur = currency

        const tokenIn = inputCur.isNative ? zeroAddress : safeGetAddress(inputCur.wrapped.address)
        const tokenOut = outputCur.isNative ? zeroAddress : safeGetAddress(outputCur.wrapped.address)
        if (!tokenIn || !tokenOut) {
          throw new Error('Invalid token pair for aggregator')
        }

        const protocol = buildAggregatorProtocol(option)
        const quoteResult = await aggregatorService.getQuote(
          {
            chainId,
            tokenIn,
            tokenOut,
            amount: amount.quotient.toString(),
            tradeType: tt,
            ...(protocol !== undefined ? { protocol } : {}),
          },
          controller.signal,
          { input: inputCur, output: outputCur },
        )

        if (!quoteResult) {
          throw new Error('No valid trade from aggregator')
        }

        if (!isAllowedAggregatorRouter(chainId, quoteResult.quoteData.aggregatorAddress)) {
          throw new Error(`Aggregator returned non-allowlisted router for chain ${chainId}`)
        }

        const result: ClassicOrder = {
          ...quoteResult.order,
          aggregatorQuoteData: quoteResult.quoteData,
        }

        // Validate-only: BE amounts are authoritative, we don't overwrite them
        // with the FE's recomputation. On failure, fall back to legacy quoters.
        await validateTradeOnChain(result.trade)

        result.trade.quoteQueryHash = option.hash

        perf.tracker.success(result)
        return result
      },
      {
        ms: QUOTE_TIMEOUT[chainId as keyof typeof QUOTE_TIMEOUT] ?? 12_000,
        abort: () => {
          controller?.abort()
        },
      },
    )

    return query()
      .catch((ex) => {
        perf.tracker.fail(ex)
        controller?.abort()
        throw ex
      })
      .finally(() => {
        perf.tracker.report()
      })
  })
}, isEqualAggregatorQuoteQuery)
