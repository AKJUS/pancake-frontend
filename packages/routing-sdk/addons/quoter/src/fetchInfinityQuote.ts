import { ChainId } from '@pancakeswap/chains'
import { InfinityBinPool, InfinityCLPool, InfinityStablePool } from '@pancakeswap/routing-sdk-addon-infinity'
import { getCurrencyAddress, getMatchedCurrency } from '@pancakeswap/swap-sdk-core'
import type { AbiStateMutability, ContractFunctionParameters } from 'viem'
import { binQuoterAbi } from './abis/IBinQuoter'
import { clQuoterAbi } from './abis/ICLQuoter'
import { infinityMixedRouteQuoterAbi } from './abis/IInfinityMixedRouteQuoter'
import { INFI_BIN_QUOTER_ADDRESSES, INFI_CL_QUOTER_ADDRESSES, INFI_MIXED_QUOTER_ADDRESSES } from './constants'
import type { QuoteRoute, SupportedPool } from './types'
import { encodeInfinityMixedRouteActions } from './utils/encodeInfinityMixedRouteActions'
import { encodeInfinityMixedRouteCurrencyPath } from './utils/encodeInfinityMixedRouteCurrencyPath'
import { encodeInfinityMixedRouteParams } from './utils/encodeInfinityMixedRouteParams'
import { encodeInfinityRouteToPath } from './utils/encodeInfinityRouteToPath'

export function buildInfinityMixedQuoteCall<P extends SupportedPool = SupportedPool>(route: QuoteRoute<P>) {
  const { amount } = route
  const {
    currency: { chainId },
  } = amount
  return {
    address: (INFI_MIXED_QUOTER_ADDRESSES as any)[chainId as ChainId],
    abi: infinityMixedRouteQuoterAbi,
    functionName: 'quoteMixedExactInput',
    args: [
      encodeInfinityMixedRouteCurrencyPath(route),
      encodeInfinityMixedRouteActions(route),
      encodeInfinityMixedRouteParams(route),
      route.amount.quotient,
    ],
  } satisfies ContractFunctionParameters<typeof infinityMixedRouteQuoterAbi, AbiStateMutability, 'quoteMixedExactInput'>
}

export function buildInfinityCLQuoteCall<P extends InfinityCLPool = InfinityCLPool>(route: QuoteRoute<P>) {
  const { path, amount } = route
  const {
    currency: { chainId },
  } = amount
  const isExactOut = path[path.length - 1].wrapped.equals(amount.currency.wrapped)

  const firstPool = route.pools[isExactOut ? route.pools.length - 1 : 0]
  const baseCurrency = getMatchedCurrency(route.amount.currency, firstPool.getTradingPairs()[0])
  if (!baseCurrency) {
    throw new Error('ROUTING_SDK_ADDON_INFINITY_CL_QUOTER_CALL_INPUTS: INVALID_POOL')
  }
  const exactCurrency = getCurrencyAddress(baseCurrency)

  return {
    address: (INFI_CL_QUOTER_ADDRESSES as any)[chainId as ChainId],
    abi: clQuoterAbi,
    functionName: isExactOut ? 'quoteExactOutput' : 'quoteExactInput',
    args: [
      {
        exactCurrency,
        path: encodeInfinityRouteToPath(route, isExactOut),
        exactAmount: `0x${route.amount.quotient.toString(16)}`,
      },
    ],
  } as const
}

export function buildInfinityBinQuoteCall<P extends InfinityBinPool = InfinityBinPool>(route: QuoteRoute<P>) {
  const { path, amount } = route
  const {
    currency: { chainId },
  } = amount
  const isExactOut = path[path.length - 1].wrapped.equals(amount.currency.wrapped)

  const firstPool = route.pools[isExactOut ? route.pools.length - 1 : 0]
  const baseCurrency = getMatchedCurrency(route.amount.currency, firstPool.getTradingPairs()[0])
  if (!baseCurrency) {
    throw new Error('ROUTING_SDK_ADDON_INFINITY_BIN_QUOTER_CALL_INPUTS: INVALID_POOL')
  }
  const exactCurrency = getCurrencyAddress(baseCurrency)

  return {
    address: (INFI_BIN_QUOTER_ADDRESSES as any)[chainId as ChainId],
    abi: binQuoterAbi,
    functionName: isExactOut ? 'quoteExactOutput' : 'quoteExactInput',
    args: [
      {
        exactCurrency,
        path: encodeInfinityRouteToPath(route, isExactOut),
        exactAmount: `0x${route.amount.quotient.toString(16)}`,
      },
    ],
  } as const
}
