import { ChainId } from './chainId'

export const AVERAGE_CHAIN_BLOCK_TIMES: Record<ChainId, number> = {
  [ChainId.BSC]: 0.45,
  [ChainId.BSC_TESTNET]: 0.45,
  [ChainId.OPBNB]: 0.5,
  [ChainId.OPBNB_TESTNET]: 0.5,
  [ChainId.ETHEREUM]: 12,
  [ChainId.GOERLI]: 3,
  [ChainId.ZKSYNC]: 2,
  [ChainId.ZKSYNC_TESTNET]: 2,
  [ChainId.ARBITRUM_ONE]: 0.25,
  [ChainId.ARBITRUM_GOERLI]: 0.25,
  [ChainId.SCROLL_SEPOLIA]: 1,
  [ChainId.LINEA]: 2,
  [ChainId.LINEA_TESTNET]: 2,
  [ChainId.BASE]: 2,
  [ChainId.BASE_TESTNET]: 2,
  [ChainId.ARBITRUM_SEPOLIA]: 0,
  [ChainId.BASE_SEPOLIA]: 0,
  [ChainId.SEPOLIA]: 0,
  [ChainId.MONAD_MAINNET]: 1,
  [ChainId.MONAD_TESTNET]: 1,
}
