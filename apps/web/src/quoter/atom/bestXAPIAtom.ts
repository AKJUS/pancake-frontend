import { getRequestBody, parseQuoteResponse } from '@pancakeswap/price-api-sdk'
import { TradeType, getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import type { Currency } from '@pancakeswap/swap-sdk-core'
import { withTimeout } from '@pancakeswap/utils/withTimeout'
import { QUOTING_API } from 'config/constants/endpoints'
import { atomFamily } from 'jotai/utils'
import { X_API_TIMEOUT } from 'quoter/consts'
import { quoteTraceAtom } from 'quoter/perf/quoteTracker'
import { QuoteQuery, XTradeError } from 'quoter/quoter.types'
import { gasPriceWeiAtom } from 'quoter/utils/gasPriceAtom'
import { getAllowedPoolTypesX } from 'quoter/utils/getAllowedPoolTypes'
import { isEqualQuoteQuery } from 'quoter/utils/PoolHashHelper'
import { basisPointsToPercent } from 'utils/exchange'
import { InterfaceOrder } from 'views/Swap/utils'
import { atomWithLoadable } from './atomWithLoadable'
import { getRwaTokenStatus, rwaTokenListAtom } from './rwaTokenAtoms'

const PCSX_AUTO_SLIPPAGE_BPS = 10 // 0.1%

export const bestXApiAtom = atomFamily((option: QuoteQuery) => {
  return atomWithLoadable(async (get) => {
    const { xEnabled, enabled, slippage, address, isAutoSlippage } = option
    if (!xEnabled || !enabled) {
      return undefined
    }

    const { amount, currency, tradeType = TradeType.EXACT_INPUT, maxHops, maxSplits } = option

    if (!amount || !amount.currency || !currency || !slippage) {
      throw new Error('Invalid amount or currency')
    }

    const currencies = [option.baseCurrency, currency].filter(Boolean) as Currency[]
    const rwaTokens = get(rwaTokenListAtom)
    const seen = new Set<string>()
    const statuses = await Promise.all(
      currencies.map(async (curr) => {
        const address = getCurrencyAddress(curr)?.toLowerCase()
        if (!address) {
          return undefined
        }
        const key = `${curr.chainId}:${address}`
        if (seen.has(key)) {
          return undefined
        }
        seen.add(key)
        return getRwaTokenStatus(rwaTokens, curr.chainId, address)
      }),
    )

    const upcomingStatus = statuses.find((s) => s?.status === 'upcoming')
    if (upcomingStatus) {
      throw new XTradeError('RWA token is paused', upcomingStatus.code)
    }
    const controller = new AbortController()
    const perf = get(quoteTraceAtom(option))
    perf.tracker.track('start')

    const query = withTimeout(
      async () => {
        const poolTypes = getAllowedPoolTypesX(option)
        const gasPriceWei = await get(gasPriceWeiAtom(currency.chainId))

        const body = getRequestBody({
          amount,
          quoteCurrency: currency,
          tradeType: tradeType || TradeType.EXACT_INPUT,
          slippage: basisPointsToPercent(isAutoSlippage ? PCSX_AUTO_SLIPPAGE_BPS : slippage),
          amm: { maxHops, maxSplits, poolTypes, gasPriceWei },
          x: {
            useSyntheticQuotes: true,
            swapper: address,
          },
        })

        const serverRes = await fetch(`${QUOTING_API}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        const serializedRes = await serverRes.json()

        const isExactIn = tradeType === TradeType.EXACT_INPUT
        const result = parseQuoteResponse(serializedRes, {
          chainId: currency.chainId,
          currencyIn: isExactIn ? amount.currency : currency,
          currencyOut: isExactIn ? currency : amount.currency,
          tradeType,
        })

        result.trade.quoteQueryHash = option.hash
        perf.tracker.success(result)
        return result as InterfaceOrder
      },
      {
        ms: X_API_TIMEOUT,
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
