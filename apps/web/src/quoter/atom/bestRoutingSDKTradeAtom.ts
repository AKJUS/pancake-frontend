import { OrderType } from '@pancakeswap/price-api-sdk'
import { InfinityRouter, SmartRouter } from '@pancakeswap/smart-router'
import { TradeType } from '@pancakeswap/swap-sdk-core'
import { withTimeout } from '@pancakeswap/utils/withTimeout'
import { globalWorkerAtom } from 'hooks/useWorker'
import { atomFamily } from 'jotai/utils'
import { QUOTE_TIMEOUT } from 'quoter/consts'
import { quoteTraceAtom } from 'quoter/perf/quoteTracker'
import { createPoolQuery } from 'quoter/utils/createQuoteQuery'
import { gasPriceWeiAtom } from 'quoter/utils/gasPriceAtom'
import { getVerifiedTrade } from 'quoter/utils/getVerifiedTrade'
import { isEqualQuoteQuery } from 'quoter/utils/PoolHashHelper'
import { fetchCandidatePools } from 'quoter/utils/poolQueries'
import { InterfaceOrder } from 'views/Swap/utils'
import { InfinityGetBestTradeReturnType, QuoteQuery } from '../quoter.types'
import { atomWithLoadable } from './atomWithLoadable'

export const bestRoutingSDKTradeAtom = atomFamily((option: QuoteQuery) => {
  const { amount, currency, tradeType, maxSplits } = option
  return atomWithLoadable(async (get) => {
    if (!amount || !amount.currency || !currency) {
      return undefined
    }

    const worker = await get(globalWorkerAtom)

    if (!worker) {
      throw new Error('Quote worker not initialized')
    }
    const controller = new AbortController()
    const perf = get(quoteTraceAtom(option))
    perf.tracker.track('start')
    const { chainId } = currency

    const query = withTimeout(
      async () => {
        const { poolQuery, poolOptions } = createPoolQuery(option, controller)
        const [candidatePools, gasPriceWei] = await Promise.all([
          fetchCandidatePools(poolQuery, poolOptions),
          get(gasPriceWeiAtom(currency?.chainId)),
        ])

        perf.tracker.track('pool_success')
        const result = await worker.getBestTradeOffchain({
          chainId: currency.chainId,
          currency: SmartRouter.Transformer.serializeCurrency(currency),
          tradeType: tradeType || TradeType.EXACT_INPUT,
          amount: {
            currency: SmartRouter.Transformer.serializeCurrency(amount.currency),
            value: amount.quotient.toString(),
          },
          gasPriceWei: gasPriceWei?.toString() || '',
          maxHops: option.maxHops,
          maxSplits,
          candidatePools: candidatePools.map(SmartRouter.Transformer.serializePool),
          signal: controller.signal,
        })

        const trade = InfinityRouter.Transformer.parseTrade(currency.chainId, result) ?? null
        const verifiedTrade = await getVerifiedTrade(trade)

        if (verifiedTrade) {
          verifiedTrade.quoteQueryHash = option.hash
        }
        const order = {
          type: OrderType.PCS_CLASSIC,
          trade: (verifiedTrade || undefined) as InfinityGetBestTradeReturnType | undefined,
        } as InterfaceOrder
        perf.tracker.success(order)
        return order
      },
      {
        ms: QUOTE_TIMEOUT[chainId],
        abort: () => {
          controller.abort()
        },
      },
    )

    try {
      return await query()
    } catch (ex) {
      perf.tracker.fail(ex)
      controller.abort()
      throw ex
    } finally {
      perf.tracker.report()
    }
  })
}, isEqualQuoteQuery)
