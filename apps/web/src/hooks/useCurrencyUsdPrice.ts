import { isTestnetChainId } from '@pancakeswap/chains'
import { isSolWSolToken, Currency, getCurrencyAddress, UnifiedCurrency, WSOL } from '@pancakeswap/sdk'
import { useQuery } from '@tanstack/react-query'
import { CHAIN_QUERY_NAME } from 'config/chains'

import { SLOW_INTERVAL } from 'config/constants'
import { atom } from 'jotai'
import { atomFamily, unwrap } from 'jotai/utils'
import { getCurrencyUsdPrice } from '@pancakeswap/price-api-sdk'

type Config = {
  enabled?: boolean
}

export function useCurrencyUsdPrice(currency: UnifiedCurrency | undefined | null, { enabled = true }: Config = {}) {
  return useQuery<number>({
    queryKey: ['currencyPrice', currency?.chainId, currency?.wrapped.address],
    queryFn: async () => {
      if (!currency) {
        throw new Error('No currency provided')
      }
      return getCurrencyUsdPrice({
        ...(isSolWSolToken(currency) ? WSOL : currency),
        chainName: CHAIN_QUERY_NAME[currency.chainId],
      })
    },
    staleTime: SLOW_INTERVAL,
    refetchInterval: SLOW_INTERVAL,
    enabled: Boolean(enabled && currency),
  })
}

export const currencyUSDPriceAtom = atomFamily(
  (currency?: Currency) => {
    return atom(() => {
      if (!currency) {
        throw new Error('No currency provided')
      }
      if (isTestnetChainId(currency?.chainId)) {
        return 0
      }
      return getCurrencyUsdPrice(currency)
    })
  },
  (a, b) => {
    if (a === b) {
      return true
    }
    if (!a || !b) {
      return false
    }
    return getCurrencyAddress(a) === getCurrencyAddress(b)
  },
)
export const currencyUSDPriceUnwrapAtom = atomFamily(
  (currency?: Currency) => {
    return unwrap(
      atom((get) => {
        return get(currencyUSDPriceAtom(currency))
      }),
      (prev) => prev ?? 0,
    )
  },
  (a, b) => {
    if (a === b) {
      return true
    }
    if (!a || !b) {
      return false
    }
    return getCurrencyAddress(a) === getCurrencyAddress(b)
  },
)

export const currenciesUSDPriceAtom = atomFamily(
  (currencies: Currency[]) => {
    return atom(async (get) => {
      return Promise.all(currencies.map((currency) => get(currencyUSDPriceAtom(currency))))
    })
  },
  (a, b) => {
    if (a === b) {
      return true
    }
    if (a.length !== b.length) {
      return false
    }
    return a.every((currency, index) => getCurrencyAddress(currency) === getCurrencyAddress(b[index]))
  },
)
