/* eslint-disable @typescript-eslint/no-unused-vars */
import { Currency, getCurrencyAddress, sortCurrencies } from '@pancakeswap/swap-sdk-core'
import { keccak256, stringify } from 'viem/utils'
import { PoolQuery, QuoteQuery, StrategyQuery } from '../quoter.types'

export class PoolHashHelper {
  static hashCurrenciesWithSort(a?: Currency, b?: Currency) {
    const list: Currency[] = []
    if (a) {
      list.push(a)
    }
    if (b && !isEqualCurrency(a, b)) {
      list.push(b)
    }

    const isCrossChain = a?.chainId !== b?.chainId

    // For cross-chain quotes, we don't sort the currencies
    const sorted = isCrossChain ? list : sortCurrencies(list)
    const str = sorted.map((currency) => `${getCurrencyAddress(currency)}_${currency.chainId}`).join(',')
    const hash = keccak256(`0x${str}`)
    return hash
  }

  static hashCurrencies(a?: Currency, b?: Currency) {
    const list: Currency[] = []
    if (a) {
      list.push(a)
    }
    if (b && !isEqualCurrency(a, b)) {
      list.push(b)
    }
    const str = list.map((currency) => `${getCurrencyAddress(currency)}_${currency.chainId}`).join(',')
    const hash = keccak256(`0x${str}`)
    return hash
  }

  static hashPoolQuery = (query: PoolQuery) => {
    const { currencyA, currencyB, blockNumber, ...rest } = query
    try {
      const hash = PoolHashHelper.hashCurrenciesWithSort(currencyA, currencyB)
      const hashRest = keccak256(`0x${stringify(rest)}`)
      return keccak256(`${hash}-$${hashRest}`)
    } catch (ex) {
      console.error(ex, 'error: with query', query)
      throw ex
    }
  }

  static hashQuoteQuery = (query: QuoteQuery) => {
    const {
      // exclude these fields from hash
      slippage,
      blockNumber,
      gasLimit,
      provider,
      createTime,
      destinationBlockNumber,
      gasLimitDestinationChain,
      hash,
      placeholderHash,
      routeKey,
      // end exclude these fields from hash
      amount,
      currency,
      ...rest
    } = query
    const chainId = query.baseCurrency?.chainId
    // NOTE: Support for cross-chain quotes
    const destinationChainId = query.currency?.chainId
    const restHash = keccak256(`0x${stringify(rest)}:${chainId}:${destinationChainId}`)
    const hashCurrencies = PoolHashHelper.hashCurrencies(amount?.currency, currency || undefined)
    const prts = [amount?.toExact(), hashCurrencies, restHash]
    return keccak256(`0x${prts.join(':')}`)
  }

  static hashPlaceHolderQuoteQuery = (query: Omit<QuoteQuery, 'hash' | 'createTime'>) => {
    const { amount, currency, nonce, infinitySwap, infinityStableSwap, v2Swap, v3Swap, stableSwap } = query
    const chainId = query.baseCurrency?.chainId
    // NOTE: Support for cross-chain quotes
    const destinationChainId = query.currency?.chainId
    const rest = { nonce, infinitySwap, infinityStableSwap, v2Swap, v3Swap, stableSwap }
    const restHash = keccak256(`0x${stringify(rest)}:${chainId}:${destinationChainId}`)
    const hashCurrencies = PoolHashHelper.hashCurrencies(amount?.currency, currency || undefined)
    const prts = [amount?.toExact(), hashCurrencies, restHash]
    return keccak256(`0x${prts.join(':')}`)
  }

  static hashStrategyQuery = (query: StrategyQuery) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { baseCurrency, quoteCurrency, ...rest } = query
    const hashCurrencies = PoolHashHelper.hashCurrencies(baseCurrency, quoteCurrency)
    const restHash = keccak256(`0x${stringify(rest)}`)
    return keccak256(`${hashCurrencies}-$${restHash}`)
  }
}

export const isEqualCurrency = (a: Currency | undefined, b: Currency | undefined) => {
  if (a === b) {
    return true
  }
  if (!a || !b) {
    return false
  }
  return getCurrencyAddress(a) === getCurrencyAddress(b) && a.chainId === b.chainId
}

export const isEqualQuoteQuery = (a: { hash: string }, b: { hash: string }) => {
  return a.hash === b.hash
}

export const isEqualPoolQuery = (a: PoolQuery, b: PoolQuery) => {
  return PoolHashHelper.hashPoolQuery(a) === PoolHashHelper.hashPoolQuery(b)
}
