import { ChainId, NonEVMChainId, UnifiedChainId } from './chainId'
import { chainNames, chainFullNames } from './chainNames'

export interface Chain {
  id: UnifiedChainId
  name: string
  fullName: string
  isEVM: boolean
  testnet?: boolean
}

export const Chains: Chain[] = [
  { id: ChainId.BSC, name: chainNames[ChainId.BSC], fullName: chainFullNames[ChainId.BSC], isEVM: true },
  { id: ChainId.ETHEREUM, name: chainNames[ChainId.ETHEREUM], fullName: chainFullNames[ChainId.ETHEREUM], isEVM: true },
  {
    id: NonEVMChainId.SOLANA,
    name: chainNames[NonEVMChainId.SOLANA],
    fullName: chainFullNames[NonEVMChainId.SOLANA],
    isEVM: false,
  },
  {
    id: NonEVMChainId.APTOS,
    name: chainNames[NonEVMChainId.APTOS],
    fullName: chainFullNames[NonEVMChainId.APTOS],
    isEVM: false,
  },
  { id: ChainId.BASE, name: chainNames[ChainId.BASE], fullName: chainFullNames[ChainId.BASE], isEVM: true },
  {
    id: ChainId.MONAD_MAINNET,
    name: chainNames[ChainId.MONAD_MAINNET],
    fullName: chainFullNames[ChainId.MONAD_MAINNET],
    isEVM: true,
  },
  {
    id: ChainId.ARBITRUM_ONE,
    name: chainNames[ChainId.ARBITRUM_ONE],
    fullName: chainFullNames[ChainId.ARBITRUM_ONE],
    isEVM: true,
  },
  { id: ChainId.ZKSYNC, name: chainNames[ChainId.ZKSYNC], fullName: chainFullNames[ChainId.ZKSYNC], isEVM: true },
  {
    id: ChainId.ZKSYNC_TESTNET,
    name: chainNames[ChainId.ZKSYNC_TESTNET],
    fullName: chainFullNames[ChainId.ZKSYNC_TESTNET],
    isEVM: true,
    testnet: true,
  },
  { id: ChainId.LINEA, name: chainNames[ChainId.LINEA], fullName: chainFullNames[ChainId.LINEA], isEVM: true },
  { id: ChainId.OPBNB, name: chainNames[ChainId.OPBNB], fullName: chainFullNames[ChainId.OPBNB], isEVM: true },
  {
    id: ChainId.BSC_TESTNET,
    name: chainNames[ChainId.BSC_TESTNET],
    fullName: chainFullNames[ChainId.BSC_TESTNET],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.GOERLI,
    name: chainNames[ChainId.GOERLI],
    fullName: chainFullNames[ChainId.GOERLI],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.SEPOLIA,
    name: chainNames[ChainId.SEPOLIA],
    fullName: chainFullNames[ChainId.SEPOLIA],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.ARBITRUM_GOERLI,
    name: chainNames[ChainId.ARBITRUM_GOERLI],
    fullName: chainFullNames[ChainId.ARBITRUM_GOERLI],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.ARBITRUM_SEPOLIA,
    name: chainNames[ChainId.ARBITRUM_SEPOLIA],
    fullName: chainFullNames[ChainId.ARBITRUM_SEPOLIA],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.LINEA_TESTNET,
    name: chainNames[ChainId.LINEA_TESTNET],
    fullName: chainFullNames[ChainId.LINEA_TESTNET],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.BASE_TESTNET,
    name: chainNames[ChainId.BASE_TESTNET],
    fullName: chainFullNames[ChainId.BASE_TESTNET],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.BASE_SEPOLIA,
    name: chainNames[ChainId.BASE_SEPOLIA],
    fullName: chainFullNames[ChainId.BASE_SEPOLIA],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.OPBNB_TESTNET,
    name: chainNames[ChainId.OPBNB_TESTNET],
    fullName: chainFullNames[ChainId.OPBNB_TESTNET],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.SCROLL_SEPOLIA,
    name: chainNames[ChainId.SCROLL_SEPOLIA],
    fullName: chainFullNames[ChainId.SCROLL_SEPOLIA],
    isEVM: true,
    testnet: true,
  },
  {
    id: ChainId.MONAD_TESTNET,
    name: chainNames[ChainId.MONAD_TESTNET],
    fullName: chainFullNames[ChainId.MONAD_TESTNET],
    isEVM: true,
    testnet: true,
  },
]
