import { CurrencyAmount, Percent, Price } from '@pancakeswap/swap-sdk-core'
import { getQuoteExactIn, getQuoteExactOut, getSwapOutput } from '@pancakeswap/stable-swap-sdk'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import invariant from 'tiny-invariant'
import { INFINITY_STABLE_POOL_FEE_DENOMINATOR } from '@pancakeswap/infinity-stable-sdk'

import { BASE_SWAP_COST_STABLE_SWAP, COST_PER_EXTRA_HOP_STABLE_SWAP, INFI_STABLE_POOL_TYPE } from './constants'
import type { InfinityStablePool, InfinityStablePoolData } from './types'

export function createInfinityStablePool(params: InfinityStablePoolData): InfinityStablePool {
  let p = { ...params, type: INFI_STABLE_POOL_TYPE }

  const pool: InfinityStablePool = {
    type: INFI_STABLE_POOL_TYPE,
    getReserve: (c) =>
      p.currency0.wrapped.equals(c.wrapped)
        ? p.reserve0 ?? CurrencyAmount.fromRawAmount(p.currency0, 0n)
        : p.reserve1 ?? CurrencyAmount.fromRawAmount(p.currency1, 0n),
    getCurrentPrice: (base, quote) => {
      const { amplifier, stableFee } = p
      const baseIn = tryParseAmount('1', base)
      if (!baseIn) {
        throw new Error(`Cannot parse amount for ${base.symbol}`)
      }
      const reserve0 = p.reserve0 ?? CurrencyAmount.fromRawAmount(p.currency0, 0n)
      const reserve1 = p.reserve1 ?? CurrencyAmount.fromRawAmount(p.currency1, 0n)
      const balances = [reserve0, reserve1]

      const quoteOut = getSwapOutput({
        amplifier: BigInt(amplifier),
        balances,
        fee: new Percent(BigInt(stableFee), INFINITY_STABLE_POOL_FEE_DENOMINATOR),
        outputCurrency: quote,
        amount: baseIn,
      })

      return new Price({
        baseAmount: baseIn,
        quoteAmount: quoteOut,
      })
    },
    getTradingPairs: () => [[p.currency0, p.currency1]],
    getId: () => p.id,
    update: (poolData) => {
      p = { ...p, ...poolData }
    },
    log: () => `Infinity Stable ${p.currency0.symbol} - ${p.currency1.symbol} (${p.stableFee}) - ${p.id}`,

    getPoolData: () => p,

    getQuote: ({ amount, isExactIn, quoteCurrency }) => {
      const { amplifier, stableFee } = p
      const reserve0 = p.reserve0 ?? CurrencyAmount.fromRawAmount(p.currency0, 0n)
      const reserve1 = p.reserve1 ?? CurrencyAmount.fromRawAmount(p.currency1, 0n)
      const balances = [reserve0, reserve1]

      const getQuote = isExactIn ? getQuoteExactIn : getQuoteExactOut
      const [quote, { balances: newBalances }] = getQuote({
        amount,
        balances,
        amplifier: BigInt(amplifier),
        outputCurrency: quoteCurrency,
        fee: new Percent(BigInt(stableFee), INFINITY_STABLE_POOL_FEE_DENOMINATOR),
      })

      // Update reserve0 and reserve1 from the new balances
      const newReserve0 = newBalances.find((b) => b.currency.wrapped.equals(p.currency0.wrapped))
      const newReserve1 = newBalances.find((b) => b.currency.wrapped.equals(p.currency1.wrapped))
      invariant(newReserve0 !== undefined && newReserve1 !== undefined, 'NO_RESERVE_FOUND')

      const newPoolData = { ...p, reserve0: newReserve0, reserve1: newReserve1 }
      return {
        poolAfter: createInfinityStablePool(newPoolData),
        quote,
        pool,
      }
    },

    estimateGasCostForQuote: () => {
      return BASE_SWAP_COST_STABLE_SWAP + COST_PER_EXTRA_HOP_STABLE_SWAP
    },
  }

  return pool
}
