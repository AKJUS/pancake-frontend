import { ChainId, NonEVMChainId, chainNames } from '@pancakeswap/chains'
import memoize from '@pancakeswap/utils/memoize'
import {
  Chain,
  arbitrum,
  arbitrumGoerli,
  arbitrumSepolia,
  base,
  baseGoerli,
  baseSepolia,
  bscTestnet,
  bsc as bsc_,
  goerli,
  linea,
  lineaTestnet,
  mainnet,
  monadTestnet,
  opBNB,
  opBNBTestnet,
  scrollSepolia,
  sepolia,
  zksync,
} from 'wagmi/chains'

export const CHAIN_QUERY_NAME = chainNames

const CHAIN_QUERY_NAME_TO_ID = Object.entries(CHAIN_QUERY_NAME).reduce((acc, [chainId, chainName]) => {
  return {
    [chainName.toLowerCase()]: chainId as unknown as ChainId,
    ...acc,
  }
}, {} as Record<string, ChainId>)

export const getChainId = memoize((chainName: string) => {
  if (!chainName) return undefined
  return CHAIN_QUERY_NAME_TO_ID[chainName.toLowerCase()] ? +CHAIN_QUERY_NAME_TO_ID[chainName.toLowerCase()] : undefined
})

const bsc = {
  ...bsc_,
  rpcUrls: {
    ...bsc_.rpcUrls,
    public: {
      ...bsc_.rpcUrls,
      http: ['https://bsc-dataseed.bnbchain.org/'],
    },
    default: {
      ...bsc_.rpcUrls.default,
      http: ['https://bsc-dataseed.bnbchain.org/'],
    },
  },
} satisfies Chain

const MONAD_RPC_URLS = [
  'https://rpc.monad.xyz',
  'https://rpc1.monad.xyz',
  'https://rpc3.monad.xyz',
  'https://rpc-mainnet.monadinfra.com',
  process.env.NEXT_PUBLIC_MONAD_RPC,
  process.env.NEXT_PUBLIC_MONAD_BACKUP_RPC,
].filter(Boolean) as [string, ...string[]]

const monad: Chain = {
  id: ChainId.MONAD_MAINNET,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: MONAD_RPC_URLS },
    public: { http: MONAD_RPC_URLS },
  },
  blockExplorers: {
    default: {
      name: 'MonadVision',
      url: 'https://monadvision.com',
    },
  },
  contracts: {
    multicall3: {
      address: '0x8553AA1615549A86882151784b329B017aA7c832',
    },
  },
  testnet: false,
}

/**
 * Controls some L2 specific behavior, e.g. slippage tolerance, special UI behavior.
 * The expectation is that all of these networks have immediate transaction confirmation.
 */
export const L2_CHAIN_IDS: ChainId[] = [
  ChainId.ARBITRUM_ONE,
  ChainId.ARBITRUM_GOERLI,
  ChainId.ZKSYNC,
  ChainId.ZKSYNC_TESTNET,
  ChainId.LINEA_TESTNET,
  ChainId.LINEA,
  ChainId.BASE,
  ChainId.BASE_TESTNET,
  ChainId.OPBNB,
  ChainId.OPBNB_TESTNET,
  ChainId.ARBITRUM_SEPOLIA,
  ChainId.BASE_SEPOLIA,
  ChainId.MONAD_MAINNET,
]

export const CHAINS: [Chain, ...Chain[]] = [
  bsc,
  bscTestnet,
  mainnet,
  goerli,
  sepolia,
  {
    ...zksync,
    blockExplorers: zksync.blockExplorers?.native
      ? {
          ...zksync.blockExplorers,
          default: zksync.blockExplorers.native,
        }
      : zksync.blockExplorers,
  },
  arbitrum,
  arbitrumGoerli,
  arbitrumSepolia,
  linea,
  lineaTestnet,
  base,
  baseGoerli,
  baseSepolia,
  opBNB,
  opBNBTestnet,
  scrollSepolia,
  monad,
  monadTestnet,
]

// Minimal Solana chain descriptor for explorer and non‑EVM utilities
export const SOLANA_CHAIN = {
  id: NonEVMChainId.SOLANA,
  blockExplorers: {
    default: { name: 'Solscan', url: 'https://solscan.io' },
  },
} as const
