import { GraphQLClient } from 'graphql-request'
import { infoStableSwapClients, v2Clients } from 'utils/graphql'

import { ChainId, isTestnetChainId, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { STABLE_SUPPORTED_CHAIN_IDS } from '@pancakeswap/stable-swap-sdk'
import { mapValues } from '@pancakeswap/utils/fns'
import { BSC_TOKEN_WHITELIST, ETH_TOKEN_BLACKLIST, ETH_TOKEN_WHITELIST, TOKEN_BLACKLIST } from 'config/constants/info'
import { arbitrum, base, bsc, bscTestnet, mainnet, opBNB, zksync } from 'wagmi/chains'
import { CHAINS, SOLANA_CHAIN } from 'config/chains'

export type MultiChainName =
  | 'BSC_TESTNET'
  | 'BSC'
  | 'ETH'
  | 'ZKSYNC'
  | 'ARB'
  | 'LINEA'
  | 'BASE'
  | 'OPBNB'
  | 'SOLANA'
  | 'MONAD'
export type MultiChainNameExtend = MultiChainName | 'BSC_TESTNET' | 'LINEA_TESTNET'

export const multiChainShortName: Record<number, string> = {}

export const multiChainQueryMainToken: Record<MultiChainName, string> = {
  BSC_TESTNET: 'BSC_TESTNET',
  BSC: 'BNB',
  ETH: 'ETH',
  ZKSYNC: 'ETH',
  ARB: 'ETH',
  LINEA: 'ETH',
  BASE: 'ETH',
  OPBNB: 'ETH',
  SOLANA: 'SOL',
  MONAD: 'MON',
}

export const multiChainId: Record<MultiChainNameExtend, UnifiedChainId> = {
  BSC: ChainId.BSC,
  ETH: ChainId.ETHEREUM,
  ZKSYNC: ChainId.ZKSYNC,
  ARB: ChainId.ARBITRUM_ONE,
  LINEA: ChainId.LINEA,
  BASE: ChainId.BASE,
  OPBNB: ChainId.OPBNB,
  SOLANA: NonEVMChainId.SOLANA,
  MONAD: ChainId.MONAD_MAINNET,
  BSC_TESTNET: ChainId.BSC_TESTNET,
  LINEA_TESTNET: ChainId.LINEA_TESTNET,
}

export const multiChainName: Record<UnifiedChainId, MultiChainNameExtend> = Object.fromEntries(
  Object.entries(multiChainId).map(([name, id]) => [id, name]),
) as Record<UnifiedChainId, MultiChainNameExtend>

export const multiChainPaths = {
  [ChainId.BSC_TESTNET]: '/bsc-testnet',
  [ChainId.BSC]: '',
  [ChainId.ETHEREUM]: '/eth',
  [ChainId.ZKSYNC]: '/zksync',
  [ChainId.ARBITRUM_ONE]: '/arb',
  [ChainId.LINEA]: '/linea',
  [ChainId.BASE]: '/base',
  [ChainId.OPBNB]: '/opbnb',
  [ChainId.MONAD_MAINNET]: '/monad',
}

export const multiChainQueryStableClient = STABLE_SUPPORTED_CHAIN_IDS.reduce((acc, chainId) => {
  if (isTestnetChainId(chainId)) return acc
  return {
    ...acc,
    [multiChainName[chainId]]: infoStableSwapClients[chainId],
  }
}, {} as Record<MultiChainName, GraphQLClient>)

export const infoChainNameToExplorerChainName = {
  BSC: 'bsc',
  ETH: 'ethereum',
  ZKSYNC: 'zksync',
  ARB: 'arbitrum',
  LINEA: 'linea',
  BASE: 'base',
  OPBNB: 'opbnb',
  MONAD: 'monad',
} as const

export const STABLESWAP_SUBGRAPHS_START_BLOCK = {
  ARB: 169319653,
}

export const multiChainScan: Record<MultiChainNameExtend, string> = {
  BSC_TESTNET: bscTestnet.blockExplorers.default.name,
  BSC: bsc.blockExplorers.default.name,
  ETH: mainnet.blockExplorers.default.name,
  ZKSYNC: zksync.blockExplorers.native?.name || zksync.blockExplorers.default.name,
  ARB: arbitrum.blockExplorers.default.name,
  LINEA: 'LineaScan',
  LINEA_TESTNET: 'LineaScan',
  BASE: base.blockExplorers.default.name,
  OPBNB: opBNB.blockExplorers.default.name,
  SOLANA: SOLANA_CHAIN.blockExplorers.default.name,
  MONAD: CHAINS.find((c) => c.id === ChainId.MONAD_MAINNET)?.blockExplorers?.default.name || '',
}

export const multiChainTokenBlackList: Record<MultiChainName, string[]> = mapValues(
  {
    BSC: TOKEN_BLACKLIST,
    ETH: ETH_TOKEN_BLACKLIST,
    ZKSYNC: ['0x'],
    ARB: ['0x'],
    LINEA: ['0x'],
    BASE: ['0x'],
    OPBNB: ['0x'],
    BSC_TESTNET: ['0x'],
    SOLANA: [],
    MONAD: ['0x'],
  },
  (val) => val.map((address) => address.toLowerCase()),
)

export const multiChainTokenWhiteList: Record<MultiChainName, string[]> = mapValues(
  {
    BSC: BSC_TOKEN_WHITELIST,
    ETH: ETH_TOKEN_WHITELIST,
    ZKSYNC: [],
    ARB: [],
    LINEA: [],
    BASE: [],
    OPBNB: [],
    BSC_TESTNET: [],
    SOLANA: [],
    MONAD: [],
  },
  (val) => val.map((address) => address.toLowerCase()),
)

export const getMultiChainQueryEndPointWithStableSwap = (chainName: MultiChainNameExtend): GraphQLClient => {
  const isStableSwap = checkIsStableSwap()
  if (isStableSwap) return multiChainQueryStableClient[chainName]
  return v2Clients[multiChainId[chainName]]
}

export const subgraphTokenName = {
  [ChainId.BSC]: {
    '0x738d96Caf7096659DB4C1aFbf1E1BDFD281f388C': 'Ankr Staked MATIC',
    '0x14016E85a25aeb13065688cAFB43044C2ef86784': 'True USD Old',
    '0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5': 'Lista USD',
    '0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B': 'Staked Lista BNB',
    '0x346575fC7f07E6994D76199E41D13dC1575322E1': 'dLP',
    '0x85375D3e9c4a39350f1140280a8b0De6890A40e7': 'SIGMA',
  },
}

export const subgraphTokenSymbol = {
  [ChainId.BSC]: {
    '0x14016E85a25aeb13065688cAFB43044C2ef86784': 'TUSDOLD',
    '0x346575fC7f07E6994D76199E41D13dC1575322E1': 'dLP',
    '0x0782b6d8c4551B9760e74c0545a9bCD90bdc41E5': 'lisUSD',
    '0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B': 'slisBNB',
    '0x11727E5b7Fa33FF4D380F3E7E877F19876c25b97': 'mdLP',
    '0xC71B5F631354BE6853eFe9C3Ab6b9590F8302e81': 'ZKJ',
    '0x85375D3e9c4a39350f1140280a8b0De6890A40e7': 'SIGMA',
  },
}

export const checkIsStableSwap = () => window.location.href.includes('stableSwap')
export const checkIsInfinity = () => window.location.pathname.includes('infinity')

export const ChainLinkSupportChains: UnifiedChainId[] = [ChainId.BSC, ChainId.BSC_TESTNET]
