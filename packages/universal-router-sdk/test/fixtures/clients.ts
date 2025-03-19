import { ChainId } from '@pancakeswap/chains'
import { PublicClient, createPublicClient, http, Chain, Client, WalletClient, createWalletClient, fallback } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { CHAINS } from './constants/chains'

const account = mnemonicToAccount('test test test test test test test test test test test junk')

const PUBLIC_NODES: Record<string, string[]> = {
  [ChainId.BSC]: [
    'https://bsc.publicnode.com',
    'https://binance.llamarpc.com',
    'https://bsc-dataseed1.defibit.io',
    'https://bsc-dataseed1.binance.org',
  ],
  [ChainId.ARBITRUM_ONE]: ['https://arbitrum-one.publicnode.com', 'https://arbitrum.llamarpc.com'],
  [ChainId.ETHEREUM]: ['https://ethereum.publicnode.com', 'https://eth.llamarpc.com'],
}

const createClients = <TClient extends Client>(chains: Chain[]) => {
  return (type: 'Wallet' | 'Public'): Record<ChainId, TClient> => {
    return chains.reduce((prev, cur) => {
      const node = PUBLIC_NODES[cur.id]
      const clientConfig = { chain: cur, transport: node ? fallback(node.map((rpc: string) => http(rpc))) : http() }
      const client =
        type === 'Wallet' ? createWalletClient({ ...clientConfig, account }) : createPublicClient(clientConfig)
      return {
        ...prev,
        [cur.id]: client,
      }
    }, {} as Record<ChainId, TClient>)
  }
}

const publicClients = createClients<PublicClient>(CHAINS)('Public')
const walletClients = createClients<WalletClient>(CHAINS)('Wallet')

export const getPublicClient = ({ chainId }: { chainId?: ChainId }) => {
  return publicClients[chainId!]
}

export type Provider = ({ chainId }: { chainId?: ChainId }) => PublicClient

export const getWalletClient = ({ chainId }: { chainId?: ChainId }) => {
  return walletClients[chainId!]
}
