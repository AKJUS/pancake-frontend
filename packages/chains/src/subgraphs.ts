import { ChainId } from './chainId'

type SubgraphParams = {
  noderealApiKey?: string
  theGraphApiKey?: string
}

const publicSubgraphParams = {}

export const V3_SUBGRAPHS = getV3Subgraphs(publicSubgraphParams)

export const V2_SUBGRAPHS = getV2Subgraphs(publicSubgraphParams)

export const BLOCKS_SUBGRAPHS = getBlocksSubgraphs(publicSubgraphParams)

export const STABLESWAP_SUBGRAPHS = getStableSwapSubgraphs(publicSubgraphParams)

export function filterSubgraphs<T extends Record<string | number, string | null | undefined>>(
  subgraphs: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const isProduction = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview'
  if (!isProduction) return subgraphs as any

  return Object.fromEntries(
    Object.entries(subgraphs)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, typeof value === 'string' && value.includes('undefined') ? null : value]),
  ) as any
}

export function getStableSwapSubgraphs({ theGraphApiKey }: Pick<SubgraphParams, 'theGraphApiKey'> = {}) {
  return filterSubgraphs({
    [ChainId.BSC]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/C5EuiZwWkCge7edveeMcvDmdr7jjc1zG4vgn8uucLdfz`,
    [ChainId.ARBITRUM_ONE]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/y7G5NUSq5ngsLH2jBGQajjxuLgW1bcqWiBqKmBk3MWM`,
    [ChainId.MONAD_MAINNET]: null,
  } as const)
}

export function getV3Subgraphs({ noderealApiKey, theGraphApiKey }: SubgraphParams) {
  return filterSubgraphs({
    [ChainId.ETHEREUM]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/CJYGNhb7RvnhfBDjqpRnD3oxgyhibzc7fkAMa38YV3oS`,
    [ChainId.GOERLI]: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-goerli',
    [ChainId.BSC]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/Hv1GncLY5docZoGtXjo4kwbTvxm3MAhVZqBZE4sUT9eZ`,
    [ChainId.BSC_TESTNET]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/7xd5KmL3FbzRYbmAM9SSe4wdrsJV71pJQhCBqzU7y8Qi`,
    [ChainId.ARBITRUM_ONE]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/251MHFNN1rwjErXD2efWMpNS73SANZN8Ua192zw6iXve`,
    [ChainId.ARBITRUM_GOERLI]: 'https://api.thegraph.com/subgraphs/name/chef-jojo/exhange-v3-arb-goerli',
    [ChainId.ZKSYNC]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/3dKr3tYxTuwiRLkU9vPj3MvZeUmeuGgWURbFC72ZBpYY`,
    [ChainId.ZKSYNC_TESTNET]: 'https://api.studio.thegraph.com/query/45376/exchange-v3-zksync-testnet/version/latest',
    [ChainId.LINEA]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/6gCTVX98K3A9Hf9zjvgEKwjz7rtD4C1V173RYEdbeMFX`,
    [ChainId.LINEA_TESTNET]:
      'https://thegraph.goerli.zkevm.consensys.net/subgraphs/name/pancakeswap/exchange-v3-linea-goerli',
    [ChainId.BASE]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/5YYKGBcRkJs6tmDfB3RpHdbK2R5KBACHQebXVgbUcYQp`,
    [ChainId.BASE_TESTNET]: 'https://api.studio.thegraph.com/query/45376/exchange-v3-base-testnet/version/latest',
    [ChainId.OPBNB]: `https://open-platform-ap.nodereal.io/${noderealApiKey}/opbnb-mainnet-graph-query/subgraphs/name/pancakeswap/exchange-v3`,
    [ChainId.OPBNB_TESTNET]: null,
    [ChainId.SCROLL_SEPOLIA]: 'https://api.studio.thegraph.com/query/45376/exchange-v3-scroll-sepolia/version/latest',
    [ChainId.SEPOLIA]: null,
    [ChainId.ARBITRUM_SEPOLIA]: null,
    [ChainId.BASE_SEPOLIA]: null,
    [ChainId.MONAD_MAINNET]: null,
    [ChainId.MONAD_TESTNET]: null,
  } as const satisfies Record<ChainId, string | null>)
}

export function getV2Subgraphs({ noderealApiKey, theGraphApiKey }: SubgraphParams) {
  return filterSubgraphs({
    [ChainId.BSC]: null,
    [ChainId.ETHEREUM]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/9opY17WnEPD4REcC43yHycQthSeUMQE26wyoeMjZTLEx`,
    [ChainId.ZKSYNC_TESTNET]: 'https://api.studio.thegraph.com/query/45376/exchange-v2-zksync-testnet/version/latest',
    [ChainId.ZKSYNC]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/6dU6WwEz22YacyzbTbSa3CECCmaD8G7oQ8aw6MYd5VKU`,
    [ChainId.LINEA_TESTNET]: 'https://thegraph.goerli.zkevm.consensys.net/subgraphs/name/pancakeswap/exhange-eth/',
    [ChainId.ARBITRUM_ONE]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/EsL7geTRcA3LaLLM9EcMFzYbUgnvf8RixoEEGErrodB3`,
    [ChainId.LINEA]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/Eti2Z5zVEdARnuUzjCbv4qcimTLysAizsqH3s6cBfPjB`,
    [ChainId.BASE]: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/2NjL7L4CmQaGJSacM43ofmH6ARf6gJoBeBaJtz9eWAQ9`,
    [ChainId.OPBNB]: `https://open-platform-ap.nodereal.io/${noderealApiKey}/opbnb-mainnet-graph-query/subgraphs/name/pancakeswap/exchange-v2`,
    [ChainId.MONAD_MAINNET]: null,
  })
}

export function getBlocksSubgraphs({ noderealApiKey }: SubgraphParams) {
  return filterSubgraphs({
    [ChainId.BSC]: 'https://api.thegraph.com/subgraphs/name/pancakeswap/blocks',
    [ChainId.ETHEREUM]: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
    [ChainId.ZKSYNC]: 'https://api.studio.thegraph.com/query/45376/blocks-zksync/version/latest',
    [ChainId.ARBITRUM_ONE]: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-one-blocks',
    [ChainId.LINEA]: 'https://api.studio.thegraph.com/query/45376/blocks-linea/version/latest',
    [ChainId.BASE]: 'https://api.studio.thegraph.com/query/48211/base-blocks/version/latest',
    [ChainId.OPBNB]: `https://open-platform-ap.nodereal.io/${noderealApiKey}/opbnb-mainnet-graph-query/subgraphs/name/pancakeswap/blocks`,
    [ChainId.MONAD_MAINNET]: null,
  } as const)
}
