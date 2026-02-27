import { ChainId } from '@pancakeswap/chains'
import { INFINITY_SUPPORTED_CHAINS } from '@pancakeswap/infinity-sdk'
import { PoolQuery, PoolQueryOptions, QuoteQuery, SVMQuoteQuery } from 'quoter/quoter.types'
import { getViemClients, viemClients } from 'utils/viem'
import { isInfinityStableSupported } from '@pancakeswap/infinity-stable-sdk'
import { PoolHashHelper } from './PoolHashHelper'

const PLACE_HOLDER_TIME = 1000 * 120 // 2 minutes

const cache = new Map<string, QuoteQuery>()

const contentVersion = {
  hash: '',
  version: 0,
}
export function createQuoteQuery(query: Omit<QuoteQuery | SVMQuoteQuery, 'hash' | 'createTime'>): QuoteQuery {
  const hash = PoolHashHelper.hashQuoteQuery(query as QuoteQuery)
  const placeholderNonce = Math.floor(Date.now() / PLACE_HOLDER_TIME)
  const placeholderHash = PoolHashHelper.hashPlaceHolderQuoteQuery({
    ...(query as QuoteQuery),
    nonce: placeholderNonce,
  })

  if (contentVersion.hash === placeholderHash && cache.has(hash)) {
    return cache.get(hash) as QuoteQuery
  }

  if (contentVersion.hash !== placeholderHash) {
    contentVersion.version++
    contentVersion.hash = placeholderHash
  }

  const option1 = { ...(query as QuoteQuery), ver: contentVersion.version }
  option1.hash = hash
  option1.createTime = Date.now()
  option1.provider = (({ chainId }: { chainId: ChainId }) => {
    return viemClients[chainId]
  }) as typeof getViemClients
  option1.placeholderHash = placeholderHash
  cache.set(hash, option1)

  return option1
}

export const createPoolQuery = (quoteQuery: QuoteQuery, controller?: AbortController) => {
  const { baseCurrency, currency } = quoteQuery
  const poolQuery: PoolQuery = {
    currencyA: baseCurrency!,
    currencyB: currency!,
    chainId: currency!.chainId,
    blockNumber: quoteQuery.blockNumber,
  }

  const poolOptions: PoolQueryOptions = {
    infinity: quoteQuery.infinitySwap && INFINITY_SUPPORTED_CHAINS.includes(currency!.chainId),
    infinityStable: !!quoteQuery.infinityStableSwap && isInfinityStableSupported(currency!.chainId),
    v2Pools: !!quoteQuery.v2Swap,
    v3Pools: !!quoteQuery.v3Swap,
    stableSwap: !!quoteQuery.stableSwap,
    provider: quoteQuery.provider,
    for: quoteQuery.for,
    gasLimit: quoteQuery.gasLimit,
    signal: controller?.signal,
  }
  return {
    poolQuery,
    poolOptions,
  }
}
