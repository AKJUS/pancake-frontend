import { getWagmiConnectorV2 } from '@binance/w3w-wagmi-connector-v2'
import { cyberWalletConnector as createCyberWalletConnector, isCyberWallet } from '@cyberlab/cyber-app-sdk'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import { ChainId, Chains } from '@pancakeswap/chains'
import { blocto } from '@pancakeswap/wagmi/connectors/blocto'
import { EvmConnectorNames } from '@pancakeswap/ui-wallets'
import { CHAINS } from 'config/chains'
import { PUBLIC_NODES } from 'config/nodes'
import memoize from 'lodash/memoize'
import { Transport } from 'viem'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors'
import { customMetaMaskConnector } from 'wallet/metamaskConnector'
import { ASSET_CDN } from 'config/constants/endpoints'
import { fallbackWithRank } from './fallbackWithRank'
import { CLIENT_CONFIG, publicClient } from './viem'

export const chains = CHAINS

export const injectedConnector = injected({
  shimDisconnect: false,
})

export const farcasterMiniAppConnector = farcasterMiniApp()

export const coinbaseConnector = coinbaseWallet({
  appName: 'PancakeSwap',
  appLogoUrl: 'https://pancakeswap.com/logo.png',
})

export const walletConnectConnector = walletConnect({
  // ignore the error in test environment
  // Error: To use QR modal, please install @walletconnect/modal package
  showQrModal: process.env.NODE_ENV !== 'test',
  projectId: 'e542ff314e26ff34de2d4fba98db70bb',
})

export const walletConnectNoQrCodeConnector = walletConnect({
  showQrModal: false,
  projectId: 'e542ff314e26ff34de2d4fba98db70bb',
})

const bloctoConnector = blocto({
  appId: 'e2f2f0cd-3ceb-4dec-b293-bb555f2ed5af',
})

const safePalConnector = injected({
  shimDisconnect: false,
  target: {
    provider: (w) => (w as any).safepalProvider,
    icon: `${ASSET_CDN}/web/wallets/safepal.png`,
    id: 'safepal',
    name: 'SafePal',
  },
})

export const binanceWeb3WalletConnector = getWagmiConnectorV2()

export const noopStorage = {
  getItem: (_key: any) => '',
  setItem: (_key: any, _value: any) => {},
  removeItem: (_key: any) => {},
}

const PUBLIC_MAINNET = 'https://ethereum.publicnode.com'

export const transports = chains.reduce((ts, chain) => {
  let httpStrings: string[] | readonly string[] = []

  if (process.env.NODE_ENV === 'test' && chain.id === mainnet.id) {
    httpStrings = [PUBLIC_MAINNET]
  } else {
    httpStrings = PUBLIC_NODES[chain.id] ? PUBLIC_NODES[chain.id] : []
  }

  if (ts) {
    return {
      ...ts,
      [chain.id]: fallbackWithRank(httpStrings.map((t: any) => http(t))),
    }
  }

  return {
    [chain.id]: fallbackWithRank(httpStrings.map((t: any) => http(t))),
  }
}, {} as Record<number, Transport>)

export const cyberWalletConnector = isCyberWallet()
  ? createCyberWalletConnector({
      name: 'PancakeSwap',
      appId: 'b825cd87-2db3-456d-b108-d61e74d89771',
    })
  : undefined

export const CONNECTOR_MAP = {
  [EvmConnectorNames.Injected]: injectedConnector,
  //  [ConnectorNames.Safe]: safe(),
  [EvmConnectorNames.SafePal]: safePalConnector,
  [EvmConnectorNames.WalletLink]: coinbaseConnector,
  [EvmConnectorNames.WalletConnect]: walletConnectConnector,
  [EvmConnectorNames.Blocto]: bloctoConnector,
  [EvmConnectorNames.BinanceW3W]: binanceWeb3WalletConnector(),
  [EvmConnectorNames.CyberWallet]: cyberWalletConnector,
}

export const CONNECTORS = [
  farcasterMiniAppConnector,
  customMetaMaskConnector,
  injectedConnector,
  safe(),
  coinbaseConnector,
  safePalConnector,
  walletConnectConnector,
  bloctoConnector,
  binanceWeb3WalletConnector(),
  ...(cyberWalletConnector ? [cyberWalletConnector as any] : []),
]

export function createWagmiConfig() {
  return createConfig({
    chains,
    ssr: true,
    syncConnectedChain: true,
    transports,
    ...CLIENT_CONFIG,
    connectors: [...CONNECTORS],
  })
}

export const createW3WWagmiConfig = () => {
  return createConfig({
    chains,
    ssr: true,
    syncConnectedChain: true,
    transports,
    ...CLIENT_CONFIG,

    connectors: [injectedConnector, binanceWeb3WalletConnector()],
  })
}

export const CHAIN_IDS = Chains.map((c) => c.id)
export const EVM_CHAIN_IDS = Chains.filter((c) => c.isEVM).map((c) => c.id) as ChainId[]

export const isChainSupported = memoize((chainId: number) => (CHAIN_IDS as number[]).includes(chainId))
export const isChainTestnet = memoize((chainId: number) => {
  const found = chains.find((c) => c.id === chainId)
  return found ? 'testnet' in found : false
})

export { publicClient }
