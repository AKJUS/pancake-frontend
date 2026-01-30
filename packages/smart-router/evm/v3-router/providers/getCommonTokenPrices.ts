import { ChainId, getLlamaChainName } from '@pancakeswap/chains'
import { Currency, Token } from '@pancakeswap/sdk'
import { gql } from 'graphql-request'
import { Address, getAddress } from 'viem'

import { withFallback } from '../../utils/withFallback'
import { getCheckAgainstBaseTokens } from '../functions'
import { SubgraphProvider } from '../types'

const tokenPriceQuery = gql`
  query getTokens($pageSize: Int!, $tokenAddrs: [ID!]) {
    tokens(first: $pageSize, where: { id_in: $tokenAddrs }) {
      id
      derivedUSD
    }
  }
`

export type GetCommonTokenPricesParams = {
  currencyA?: Currency
  currencyB?: Currency
}

interface BySubgraphEssentials {
  // V3 subgraph provider
  provider?: SubgraphProvider
}

type ParamsWithFallback = GetCommonTokenPricesParams & {
  v3SubgraphProvider?: SubgraphProvider
}

export type TokenUsdPrice = {
  address: string
  priceUSD: string
}

export type GetTokenPrices<T> = (params: { addresses: string[]; chainId?: ChainId } & T) => Promise<TokenUsdPrice[]>

export type CommonTokenPriceProvider<T> = (
  params: GetCommonTokenPricesParams & T,
) => Promise<Map<Address, number> | null>

export function createCommonTokenPriceProvider<T = any>(
  getTokenPrices: GetTokenPrices<T>,
): CommonTokenPriceProvider<T> {
  return async function getCommonTokenPrices({ currencyA, currencyB, ...rest }: GetCommonTokenPricesParams & T) {
    const baseTokens: Token[] = await getCheckAgainstBaseTokens(currencyA, currencyB)
    if (!baseTokens) {
      return null
    }
    const map = new Map<Address, number>()
    const idToToken: { [key: string]: Currency } = {}
    const addresses = baseTokens.map((t) => {
      const address = getAddress(t.address)
      idToToken[address] = t
      return address
    })
    const tokenPrices = await getTokenPrices({ addresses, chainId: currencyA?.chainId, ...(rest as T) })
    for (const { address, priceUSD } of tokenPrices) {
      const token = idToToken[getAddress(address)]
      if (token) {
        map.set(token.wrapped.address, parseFloat(priceUSD) || 0)
      }
    }

    return map
  }
}

export const getTokenUsdPricesBySubgraph: GetTokenPrices<BySubgraphEssentials> = async ({
  addresses,
  chainId,
  provider,
}) => {
  const client = provider?.({ chainId })
  if (!client) {
    throw new Error('No valid subgraph data provider')
  }
  const { tokens: tokenPrices } = await client.request<{ tokens: { id: string; derivedUSD: string }[] }>(
    tokenPriceQuery,
    {
      pageSize: 1000,
      tokenAddrs: addresses.map((addr) => addr.toLocaleLowerCase()),
    },
  )
  return tokenPrices.map(({ id, derivedUSD }) => ({
    address: id,
    priceUSD: derivedUSD,
  }))
}

export const getCommonTokenPricesBySubgraph =
  createCommonTokenPriceProvider<BySubgraphEssentials>(getTokenUsdPricesBySubgraph)

function withCache<T extends BySubgraphEssentials>(
  fetchPrices: (params: { addresses: string[]; chainId: ChainId }) => Promise<TokenUsdPrice[]>,
  options?: { requireLlamaChain?: boolean },
): GetTokenPrices<T> {
  const cache = new Map<string, TokenUsdPrice>()
  const { requireLlamaChain = false } = options || {}

  return async ({ addresses, chainId }) => {
    if (!chainId) {
      return []
    }

    // For Llama API, throw error if chain is not supported (to trigger fallback)
    if (requireLlamaChain && !getLlamaChainName(chainId)) {
      throw new Error(`Chain ${chainId} is not supported by Llama API`)
    }

    const [cachedResults, addressesToFetch] = addresses.reduce<[TokenUsdPrice[], string[]]>(
      ([cachedAddrs, newAddrs], address) => {
        const cached = cache.get(address)
        if (!cached) {
          newAddrs.push(address)
        } else {
          cachedAddrs.push(cached)
        }
        return [cachedAddrs, newAddrs]
      },
      [[], []],
    )

    if (!addressesToFetch.length) {
      return cachedResults
    }

    const freshResults = await fetchPrices({ addresses: addressesToFetch, chainId })

    for (const result of freshResults) {
      cache.set(getAddress(result.address), result)
    }

    return [...cachedResults, ...freshResults]
  }
}

type TokenPriceFetcherFactoryOptions = {
  endpoint: string
}

const createGetTokenPriceFromLlma = ({ endpoint }: TokenPriceFetcherFactoryOptions) => {
  return async ({ addresses, chainId }: { addresses: string[]; chainId: ChainId }): Promise<TokenUsdPrice[]> => {
    const list = addresses.map((address) => `${getLlamaChainName(chainId)}:${address.toLocaleLowerCase()}`).join(',')
    const result: { coins?: { [key: string]: { price: string } } } = await fetch(`${endpoint}/${list}`).then((res) =>
      res.json(),
    )

    const { coins = {} } = result
    return Object.entries(coins).map(([key, value]) => {
      const [, address] = key.split(':')
      return { address, priceUSD: value.price }
    })
  }
}

export const getCommonTokenPricesByLlma = createCommonTokenPriceProvider<BySubgraphEssentials>(
  withCache(
    createGetTokenPriceFromLlma({
      endpoint: 'https://coins.llama.fi/prices/current',
    }),
    { requireLlamaChain: true },
  ),
)

const createGetTokenPriceFromWalletApi = ({ endpoint }: TokenPriceFetcherFactoryOptions) => {
  return async ({ addresses, chainId }: { addresses: string[]; chainId: ChainId }): Promise<TokenUsdPrice[]> => {
    const list = addresses.map((address) => `${chainId}:${address.toLowerCase()}`).join(',')
    const encodedList = encodeURIComponent(list)

    const result: { [key: string]: number } = await fetch(`${endpoint}/list/${encodedList}`).then((res) => res.json())

    return Object.entries(result).map(([key, price]) => {
      const [, address] = key.split(':')
      return { address, priceUSD: String(price) }
    })
  }
}

const WALLET_API_ENDPOINT = process.env.NEXT_PUBLIC_WALLET_API || 'https://wallet-api.pancakeswap.com'
export const getCommonTokenPricesByWalletApi = createCommonTokenPriceProvider<BySubgraphEssentials>(
  withCache(
    createGetTokenPriceFromWalletApi({
      endpoint: `${WALLET_API_ENDPOINT}/v1/prices`,
    }),
  ),
)

export const getCommonTokenPrices = withFallback([
  {
    asyncFn: ({ currencyA, currencyB }: ParamsWithFallback) => getCommonTokenPricesByLlma({ currencyA, currencyB }),
    timeout: 3000,
  },
  {
    asyncFn: ({ currencyA, currencyB }: ParamsWithFallback) =>
      getCommonTokenPricesByWalletApi({ currencyA, currencyB }),
    timeout: 3000,
  },
  {
    asyncFn: ({ currencyA, currencyB, v3SubgraphProvider }: ParamsWithFallback) =>
      getCommonTokenPricesBySubgraph({ currencyA, currencyB, provider: v3SubgraphProvider }),
  },
])
