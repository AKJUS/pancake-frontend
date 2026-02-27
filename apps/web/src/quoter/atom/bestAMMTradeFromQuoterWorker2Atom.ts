import { ChainId, NonEVMChainId } from '@pancakeswap/chains'
import { OrderType } from '@pancakeswap/price-api-sdk'
import { BATCH_MULTICALL_CONFIGS, InfinityRouter, SmartRouter } from '@pancakeswap/smart-router'
import { TradeType } from '@pancakeswap/swap-sdk-core'
import { currencyUSDPriceAtom } from 'hooks/useCurrencyUsdPrice'
import { nativeCurrencyAtom } from 'hooks/useNativeCurrency'
import { atomFamily } from 'jotai/utils'
import { createViemPublicClientGetter } from 'utils/viem'

import { getBestSolanaTrade } from '@pancakeswap/solana-router-sdk'
import { withTimeout } from '@pancakeswap/utils/withTimeout'
import { QUOTE_TIMEOUT } from 'quoter/consts'
import { quoteTraceAtom } from 'quoter/perf/quoteTracker'
import { createPoolQuery } from 'quoter/utils/createQuoteQuery'
import { globalWorkerAtom } from 'hooks/useWorker'
import { filterPools } from 'quoter/utils/filterPoolsV3'
import { gasPriceWeiAtom } from 'quoter/utils/gasPriceAtom'
import { getAllowedPoolTypes } from 'quoter/utils/getAllowedPoolTypes'
import { isEqualQuoteQuery } from 'quoter/utils/PoolHashHelper'
import { fetchCandidatePoolsLite } from 'quoter/utils/poolQueries'
import { InterfaceOrder } from 'views/Swap/utils'
import { accountActiveChainAtom } from 'wallet/atoms/accountStateAtoms'
import { CreateQuoteProviderParams, QuoteQuery } from '../quoter.types'
import { atomWithLoadable } from './atomWithLoadable'

export const bestAMMTradeFromQuoterWorker2Atom = atomFamily((option: QuoteQuery) => {
  const { amount, currency, tradeType, maxSplits, gasLimit } = option
  return atomWithLoadable(async (get) => {
    if (!amount || !amount.currency || !currency) {
      return undefined
    }
    const { account } = get(accountActiveChainAtom)
    const perf = get(quoteTraceAtom(option))
    const quoteProvider = createQuoteProvider2({
      gasLimit,
    })
    const worker = await get(globalWorkerAtom)

    if (!worker) {
      throw new Error('Quote worker not initialized')
    }
    const { chainId } = currency
    const controller = new AbortController()

    // todo:@Philip here just a mock example
    const isSolanaChain = currency.chainId === NonEVMChainId.SOLANA

    if (isSolanaChain) {
      const query = withTimeout(
        async () => {
          const result = await getBestSolanaTrade({
            inputCurrency: amount.currency as any,
            outputCurrency: currency as any,
            tradeType: tradeType || TradeType.EXACT_INPUT,
            amount: amount as any,
            slippageBps: 50, // Default 0.5% slippage
            account,
            signal: controller.signal,
          })

          return result
        },
        {
          ms: QUOTE_TIMEOUT[chainId],
          abort: () => {
            controller?.abort()
          },
        },
      )

      try {
        return await query()
      } catch (_e) {
        controller?.abort()
      }
    }

    const query = withTimeout(
      async () => {
        perf.tracker.track('start')

        const { poolQuery, poolOptions } = createPoolQuery(option, controller)
        const candidatePools = await fetchCandidatePoolsLite(poolQuery, poolOptions)
        perf.tracker.track('pool_success')

        const filtered = filterPools(candidatePools)

        const quoteCurrencyUsdPrice = await get(currencyUSDPriceAtom(currency))
        const nativeCurrency = get(nativeCurrencyAtom(currency.chainId))
        const nativeCurrencyUsdPrice = await get(currencyUSDPriceAtom(nativeCurrency))

        const gasPriceWei = await get(gasPriceWeiAtom(currency?.chainId))
        const quoterConfig = (quoteProvider as ReturnType<typeof SmartRouter.createQuoteProvider>)?.getConfig?.()
        const result = await worker.getBestTrade({
          chainId: currency.chainId,
          currency: SmartRouter.Transformer.serializeCurrency(currency),
          tradeType: tradeType || TradeType.EXACT_INPUT,
          amount: {
            currency: SmartRouter.Transformer.serializeCurrency(amount.currency),
            value: amount.quotient.toString(),
          },
          gasPriceWei: typeof gasPriceWei !== 'function' ? gasPriceWei?.toString() : undefined,
          maxHops: option.maxHops,
          maxSplits,
          poolTypes: getAllowedPoolTypes(option),
          candidatePools: filtered.map(SmartRouter.Transformer.serializePool),
          onChainQuoterGasLimit: quoterConfig?.gasLimit?.toString(),
          quoteCurrencyUsdPrice,
          nativeCurrencyUsdPrice,
          signal: controller.signal,
        })

        const parsed = SmartRouter.Transformer.parseTrade(currency.chainId, result as any) as any as
          | InfinityRouter.InfinityTradeWithoutGraph<TradeType>
          | undefined
        if (parsed) {
          parsed.quoteQueryHash = option.hash
        }
        const order = {
          type: OrderType.PCS_CLASSIC,
          trade: parsed,
        } as InterfaceOrder
        perf.tracker.success(order)
        return order
      },
      {
        ms: QUOTE_TIMEOUT[chainId],
        abort: () => {
          controller?.abort()
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

function createQuoteProvider2({ gasLimit, signal }: CreateQuoteProviderParams) {
  const onChainProvider = createViemPublicClientGetter({ transportSignal: signal })
  return SmartRouter.createQuoteProvider({
    onChainProvider,
    gasLimit,
    multicallConfigs: {
      ...BATCH_MULTICALL_CONFIGS,
      [ChainId.BSC]: {
        ...BATCH_MULTICALL_CONFIGS[ChainId.BSC],
        defaultConfig: {
          gasLimitPerCall: 1_000_000,
        },
      },
    },
  })
}
