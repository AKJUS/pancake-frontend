import { ChainId } from '@pancakeswap/chains'
import { STABLE_SUPPORTED_CHAIN_IDS } from '@pancakeswap/stable-swap-sdk'
import { BIT_QUERY, STABLESWAP_SUBGRAPHS_URLS, V3_BSC_INFO_CLIENT, V3_SUBGRAPH_URLS } from 'config/constants/endpoints'
import { GraphQLClient } from 'graphql-request'
import { V2_SUBGRAPH_URLS } from '../config/constants/endpoints'

const createClient = (url: string | undefined | null): GraphQLClient | undefined =>
  url ? new GraphQLClient(url) : undefined

export const infoClient = createClient(V2_SUBGRAPH_URLS[ChainId.BSC])

export const v3Clients = {
  [ChainId.ETHEREUM]: createClient(V3_SUBGRAPH_URLS[ChainId.ETHEREUM]),
  [ChainId.GOERLI]: createClient(V3_SUBGRAPH_URLS[ChainId.GOERLI]),
  [ChainId.BSC]: createClient(V3_SUBGRAPH_URLS[ChainId.BSC]),
  [ChainId.BSC_TESTNET]: createClient(V3_SUBGRAPH_URLS[ChainId.BSC_TESTNET]),
  [ChainId.ARBITRUM_ONE]: createClient(V3_SUBGRAPH_URLS[ChainId.ARBITRUM_ONE]),
  [ChainId.ARBITRUM_GOERLI]: createClient(V3_SUBGRAPH_URLS[ChainId.ARBITRUM_GOERLI]),
  [ChainId.ZKSYNC]: createClient(V3_SUBGRAPH_URLS[ChainId.ZKSYNC]),
  [ChainId.ZKSYNC_TESTNET]: createClient(V3_SUBGRAPH_URLS[ChainId.ZKSYNC_TESTNET]),
  [ChainId.LINEA]: createClient(V3_SUBGRAPH_URLS[ChainId.LINEA]),
  [ChainId.LINEA_TESTNET]: createClient(V3_SUBGRAPH_URLS[ChainId.LINEA_TESTNET]),
  [ChainId.BASE]: createClient(V3_SUBGRAPH_URLS[ChainId.BASE]),
  [ChainId.BASE_TESTNET]: createClient(V3_SUBGRAPH_URLS[ChainId.BASE_TESTNET]),
  [ChainId.SCROLL_SEPOLIA]: createClient(V3_SUBGRAPH_URLS[ChainId.SCROLL_SEPOLIA]),
  [ChainId.OPBNB]: createClient(V3_SUBGRAPH_URLS[ChainId.OPBNB]),
}

export const v3InfoClients = {
  ...v3Clients,
  [ChainId.BSC]: createClient(V3_BSC_INFO_CLIENT),
}

export const v2Clients = {
  [ChainId.ETHEREUM]: createClient(V2_SUBGRAPH_URLS[ChainId.ETHEREUM]),
  [ChainId.BSC]: createClient(V2_SUBGRAPH_URLS[ChainId.BSC]),
  [ChainId.ZKSYNC]: createClient(V2_SUBGRAPH_URLS[ChainId.ZKSYNC]),
  [ChainId.LINEA]: createClient(V2_SUBGRAPH_URLS[ChainId.LINEA]),
  [ChainId.BASE]: createClient(V2_SUBGRAPH_URLS[ChainId.BASE]),
  [ChainId.ARBITRUM_ONE]: createClient(V2_SUBGRAPH_URLS[ChainId.ARBITRUM_ONE]),
  [ChainId.OPBNB]: createClient(V2_SUBGRAPH_URLS[ChainId.OPBNB]),
}

export const infoStableSwapClients: Partial<
  Record<(typeof STABLE_SUPPORTED_CHAIN_IDS)[number], GraphQLClient | undefined>
> = {
  [ChainId.BSC]: createClient(STABLESWAP_SUBGRAPHS_URLS[ChainId.BSC]),
  [ChainId.ARBITRUM_ONE]: createClient(STABLESWAP_SUBGRAPHS_URLS[ChainId.ARBITRUM_ONE]),
  [ChainId.ETHEREUM]: createClient(STABLESWAP_SUBGRAPHS_URLS[ChainId.ETHEREUM]),
  [ChainId.BSC_TESTNET]: createClient(STABLESWAP_SUBGRAPHS_URLS[ChainId.BSC_TESTNET]),
}

export const bitQueryServerClient = new GraphQLClient(BIT_QUERY, {
  headers: {
    'X-API-KEY': process.env.BIT_QUERY_HEADER || '',
  },
  fetch: (url, options) => {
    return fetch(url, {
      ...options,
      signal: AbortSignal.timeout(5000),
    })
  },
})
