import { getWagmiConnectorV2 } from '@binance/w3w-wagmi-connector-v2'
import { cyberWalletConnector as createCyberWalletConnector, isCyberWallet } from '@cyberlab/cyber-app-sdk'
import { ChainId, Chains } from '@pancakeswap/chains'
import { blocto } from '@pancakeswap/wagmi/connectors/blocto'
import { EvmConnectorNames } from '@pancakeswap/ui-wallets'
import { CHAINS } from 'config/chains'
import { PUBLIC_NODES } from 'config/nodes'
import memoize from 'lodash/memoize'
import { Transport } from 'viem'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { baseAccount, coinbaseWallet, injected, safe, walletConnect } from 'wagmi/connectors'
import { ASSET_CDN } from 'config/constants/endpoints'
import { getBitgetEvmProvider, getPhantomEvmProvider } from 'wallet/evmInjectedProviders'
import { customMetaMaskConnector } from 'wallet/metamaskConnector'
import { fallbackWithRank } from './fallbackWithRank'
import { CLIENT_CONFIG, publicClient } from './viem'

export const chains = CHAINS

export const injectedConnector = injected({
  shimDisconnect: false,
})

export const baseAccountConnector = baseAccount({
  appName: 'PancakeSwap',
  appLogoUrl: 'https://pancakeswap.com/logo.png',
})

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

const phantomConnector = injected({
  shimDisconnect: false,
  target: {
    provider: () => getPhantomEvmProvider(),
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiB2aWV3Qm94PSIwIDAgMTA4IDEwOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00Ni41MjY3IDY5LjkyMjlDNDIuMDA1NCA3Ni44NTA5IDM0LjQyOTIgODUuNjE4MiAyNC4zNDggODUuNjE4MkMxOS41ODI0IDg1LjYxODIgMTUgODMuNjU2MyAxNSA3NS4xMzQyQzE1IDUzLjQzMDUgNDQuNjMyNiAxOS44MzI3IDcyLjEyNjggMTkuODMyN0M4Ny43NjggMTkuODMyNyA5NCAzMC42ODQ2IDk0IDQzLjAwNzlDOTQgNTguODI1OCA4My43MzU1IDc2LjkxMjIgNzMuNTMyMSA3Ni45MTIyQzcwLjI5MzkgNzYuOTEyMiA2OC43MDUzIDc1LjEzNDIgNjguNzA1MyA3Mi4zMTRDNjguNzA1MyA3MS41NzgzIDY4LjgyNzUgNzAuNzgxMiA2OS4wNzE5IDY5LjkyMjlDNjUuNTg5MyA3NS44Njk5IDU4Ljg2ODUgODEuMzg3OCA1Mi41NzU0IDgxLjM4NzhDNDcuOTkzIDgxLjM4NzggNDUuNjcxMyA3OC41MDYzIDQ1LjY3MTMgNzQuNDU5OEM0NS42NzEzIDcyLjk4ODQgNDUuOTc2OCA3MS40NTU2IDQ2LjUyNjcgNjkuOTIyOVpNODMuNjc2MSA0Mi41Nzk0QzgzLjY3NjEgNDYuMTcwNCA4MS41NTc1IDQ3Ljk2NTggNzkuMTg3NSA0Ny45NjU4Qzc2Ljc4MTYgNDcuOTY1OCA3NC42OTg5IDQ2LjE3MDQgNzQuNjk4OSA0Mi41Nzk0Qzc0LjY5ODkgMzguOTg4NSA3Ni43ODE2IDM3LjE5MzEgNzkuMTg3NSAzNy4xOTMxQzgxLjU1NzUgMzcuMTkzMSA4My42NzYxIDM4Ljk4ODUgODMuNjc2MSA0Mi41Nzk0Wk03MC4yMTAzIDQyLjU3OTVDNzAuMjEwMyA0Ni4xNzA0IDY4LjA5MTYgNDcuOTY1OCA2NS43MjE2IDQ3Ljk2NThDNjMuMzE1NyA0Ny45NjU4IDYxLjIzMyA0Ni4xNzA0IDYxLjIzMyA0Mi41Nzk1QzYxLjIzMyAzOC45ODg1IDYzLjMxNTcgMzcuMTkzMSA2NS43MjE2IDM3LjE5MzFDNjguMDkxNiAzNy4xOTMxIDcwLjIxMDMgMzguOTg4NSA3MC4yMTAzIDQyLjU3OTVaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg==',
    id: 'phantom',
    name: 'Phantom',
  },
})

const bitgetConnector = injected({
  shimDisconnect: false,
  target: {
    provider: () => getBitgetEvmProvider(),
    icon: `${ASSET_CDN}/web/wallets/bitget.png`,
    id: 'bitget',
    name: 'Bitget Wallet',
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
  [EvmConnectorNames.Phantom]: phantomConnector,
  [EvmConnectorNames.Bitget]: bitgetConnector,
  //  [ConnectorNames.Safe]: safe(),
  [EvmConnectorNames.SafePal]: safePalConnector,
  [EvmConnectorNames.WalletLink]: coinbaseConnector,
  [EvmConnectorNames.WalletConnect]: walletConnectConnector,
  [EvmConnectorNames.Blocto]: bloctoConnector,
  [EvmConnectorNames.BinanceW3W]: binanceWeb3WalletConnector(),
  [EvmConnectorNames.CyberWallet]: cyberWalletConnector,
}

export const CONNECTORS = [
  baseAccountConnector,
  customMetaMaskConnector,
  phantomConnector,
  bitgetConnector,
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
