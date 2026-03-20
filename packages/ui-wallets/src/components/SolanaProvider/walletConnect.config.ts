import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletConnectWalletAdapterConfig } from '@solana/wallet-adapter-wallets'

export const walletConnectConfig: WalletConnectWalletAdapterConfig = {
  network: WalletAdapterNetwork.Mainnet,
  options: {
    projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PJ_ID,
    customStoragePrefix: 'sol_cake_',
    metadata: {
      name: 'PancakeSwap',
      description: 'Trade, earn, and own crypto on the all-in-one multichain DEX',
      url: 'https://pancakeswap.finance/swap?chain=sol',
      icons: ['https://pancakeswap.finance/favicon.ico'],
    },
  },
}
