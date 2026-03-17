import { isCyberWallet } from '@cyberlab/cyber-app-sdk'
import { ChainId } from '@pancakeswap/chains'
import { LegacyWalletConfig, LegacyWalletIds, PHANTOM_SUPPORTED_EVM_CHAIN_IDS } from '@pancakeswap/ui-wallets'
import { WalletFilledIcon } from '@pancakeswap/uikit'
import safeGetWindow from '@pancakeswap/utils/safeGetWindow'
import { getTrustWalletProvider } from '@pancakeswap/wagmi/connectors/trustWallet'
import type { ExtendEthereum } from 'global'
import { chains, createWagmiConfig, walletConnectNoQrCodeConnector } from 'utils/wagmi'
import { Config } from 'wagmi'
import { ConnectMutateAsync } from 'wagmi/query'
import { ASSET_CDN } from './constants/endpoints'

export enum ConnectorNames {
  MetaMask = 'metaMask',
  Injected = 'injected',
  Phantom = 'phantom',
  Bitget = 'bitget',
  WalletConnect = 'walletConnect',
  WalletConnectV1 = 'walletConnectLegacy',
  // BSC = 'bsc',
  BinanceW3W = 'BinanceW3WSDK',
  Blocto = 'blocto',
  WalletLink = 'coinbaseWalletSDK',
  // Ledger = 'ledger',
  TrustWallet = 'trust',
  CyberWallet = 'cyberWallet',
}

export const createQrCode =
  <config extends Config = Config, context = unknown>(chainId: number, connect: ConnectMutateAsync<config, context>) =>
  async (connectedCb?: () => void) => {
    const wagmiConfig = createWagmiConfig()
    const injectedConnector = wagmiConfig.connectors.find((connector) => connector.id === ConnectorNames.Injected)
    if (!injectedConnector) {
      return ''
    }
    // HACK: utilizing event emitter from injected connector to notify wagmi of the connect events
    const connector = {
      ...walletConnectNoQrCodeConnector({
        chains,
        emitter: injectedConnector?.emitter,
      }),
      emitter: injectedConnector.emitter,
      uid: injectedConnector.uid,
    }
    const provider = await connector.getProvider()

    return new Promise<string>((resolve) => {
      provider.on('display_uri', (uri) => {
        resolve(uri)
      })
      if (connectedCb) {
        provider.on('connect', connectedCb)
      }
      connect({ connector, chainId })
    })
  }

const isMetamaskInstalled = () => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    if (window.ethereum?.isMetaMask) {
      // binance wallet doesn't support metamask
      // @ts-ignore
      return !window.ethereum?.isBinance
    }

    if (Array.isArray(window.ethereum?.providers)) {
      return window.ethereum?.providers.some((provider) => {
        try {
          return Boolean(provider.isMetaMask)
        } catch (e) {
          return false
        }
      })
    }
  } catch (e) {
    return false
  }

  return false
}

const PHANTOM_ICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiB2aWV3Qm94PSIwIDAgMTA4IDEwOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00Ni41MjY3IDY5LjkyMjlDNDIuMDA1NCA3Ni44NTA5IDM0LjQyOTIgODUuNjE4MiAyNC4zNDggODUuNjE4MkMxOS41ODI0IDg1LjYxODIgMTUgODMuNjU2MyAxNSA3NS4xMzQyQzE1IDUzLjQzMDUgNDQuNjMyNiAxOS44MzI3IDcyLjEyNjggMTkuODMyN0M4Ny43NjggMTkuODMyNyA5NCAzMC42ODQ2IDk0IDQzLjAwNzlDOTQgNTguODI1OCA4My43MzU1IDc2LjkxMjIgNzMuNTMyMSA3Ni45MTIyQzcwLjI5MzkgNzYuOTEyMiA2OC43MDUzIDc1LjEzNDIgNjguNzA1MyA3Mi4zMTRDNjguNzA1MyA3MS41NzgzIDY4LjgyNzUgNzAuNzgxMiA2OS4wNzE5IDY5LjkyMjlDNjUuNTg5MyA3NS44Njk5IDU4Ljg2ODUgODEuMzg3OCA1Mi41NzU0IDgxLjM4NzhDNDcuOTkzIDgxLjM4NzggNDUuNjcxMyA3OC41MDYzIDQ1LjY3MTMgNzQuNDU5OEM0NS42NzEzIDcyLjk4ODQgNDUuOTc2OCA3MS40NTU2IDQ2LjUyNjcgNjkuOTIyOVpNODMuNjc2MSA0Mi41Nzk0QzgzLjY3NjEgNDYuMTcwNCA4MS41NTc1IDQ3Ljk2NTggNzkuMTg3NSA0Ny45NjU4Qzc2Ljc4MTYgNDcuOTY1OCA3NC42OTg5IDQ2LjE3MDQgNzQuNjk4OSA0Mi41Nzk0Qzc0LjY5ODkgMzguOTg4NSA3Ni43ODE2IDM3LjE5MzEgNzkuMTg3NSAzNy4xOTMxQzgxLjU1NzUgMzcuMTkzMSA4My42NzYxIDM4Ljk4ODUgODMuNjc2MSA0Mi41Nzk0Wk03MC4yMTAzIDQyLjU3OTVDNzAuMjEwMyA0Ni4xNzA0IDY4LjA5MTYgNDcuOTY1OCA2NS43MjE2IDQ3Ljk2NThDNjMuMzE1NyA0Ny45NjU4IDYxLjIzMyA0Ni4xNzA0IDYxLjIzMyA0Mi41Nzk1QzYxLjIzMyAzOC45ODg1IDYzLjMxNTcgMzcuMTkzMSA2NS43MjE2IDM3LjE5MzFDNjguMDkxNiAzNy4xOTMxIDcwLjIxMDMgMzguOTg4NSA3MC4yMTAzIDQyLjU3OTVaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg=='

const isPhantomEvmInstalled = () => {
  try {
    return Boolean(
      safeGetWindow()?.phantom?.ethereum?.isPhantom ||
        safeGetWindow()?.ethereum?.isPhantom ||
        (safeGetWindow()?.ethereum as ExtendEthereum | undefined)?.providers?.some((provider) => provider?.isPhantom),
    )
  } catch (error) {
    console.error('Error checking Phantom Wallet:', error)
    return false
  }
}

const isBitgetWalletInstalled = () => {
  try {
    return Boolean(
      safeGetWindow()?.bitkeep?.ethereum ||
        safeGetWindow()?.ethereum?.isBitKeep ||
        safeGetWindow()?.ethereum?.isBitgetWallet ||
        (safeGetWindow()?.ethereum as ExtendEthereum | undefined)?.providers?.some(
          (provider) => provider?.isBitKeep || provider?.isBitgetWallet,
        ),
    )
  } catch (error) {
    console.error('Error checking Bitget Wallet:', error)
    return false
  }
}

function isBinanceWeb3WalletInstalled() {
  try {
    return (
      Boolean((safeGetWindow() as ExtendEthereum)?.isBinance) ||
      Boolean((safeGetWindow() as ExtendEthereum)?.binancew3w)
    )
  } catch (error) {
    console.error('Error checking Binance Web3 Wallet:', error)
    return false
  }
}

export const TOP_WALLET_MAP: { [chainId: number]: LegacyWalletIds[] } = {
  [ChainId.BSC]: [LegacyWalletIds.Metamask, LegacyWalletIds.Trust, LegacyWalletIds.Okx, LegacyWalletIds.BinanceW3W],
  [ChainId.BASE]: [LegacyWalletIds.Metamask, LegacyWalletIds.Trust, LegacyWalletIds.Okx],
  [ChainId.ARBITRUM_ONE]: [LegacyWalletIds.Metamask, LegacyWalletIds.Trust, LegacyWalletIds.Okx],
  [ChainId.ETHEREUM]: [LegacyWalletIds.Metamask, LegacyWalletIds.Trust, LegacyWalletIds.Okx],
  [ChainId.ZKSYNC]: [LegacyWalletIds.Metamask, LegacyWalletIds.Trust, LegacyWalletIds.Okx],
  [ChainId.LINEA]: [LegacyWalletIds.Metamask, LegacyWalletIds.Trust, LegacyWalletIds.Okx],
  [ChainId.OPBNB]: [LegacyWalletIds.Metamask, LegacyWalletIds.Trust, LegacyWalletIds.Okx, LegacyWalletIds.BinanceW3W],
  [ChainId.MONAD_MAINNET]: [LegacyWalletIds.Metamask, LegacyWalletIds.Okx, LegacyWalletIds.Walletconnect],
}

export const walletsConfig = <config extends Config = Config, context = unknown>({
  chainId,
  connect,
}: {
  chainId: number
  connect: ConnectMutateAsync<config, context>
}): LegacyWalletConfig<ConnectorNames>[] => {
  const qrCode = createQrCode(chainId, connect)
  return [
    {
      id: LegacyWalletIds.Metamask,
      title: 'Metamask',
      icon: `${ASSET_CDN}/web/wallets/metamask.png`,
      get installed() {
        return isMetamaskInstalled()
        // && metaMaskConnector.ready
      },
      connectorId: ConnectorNames.Injected,
      deepLink: 'https://metamask.app.link/dapp/pancakeswap.finance/',
      qrCode,
      downloadLink: 'https://metamask.app.link/dapp/pancakeswap.finance/',
      MEVSupported: true,
    },
    {
      id: LegacyWalletIds.Trust,
      title: 'Trust Wallet',
      icon: `${ASSET_CDN}/web/wallets/trust.png`,
      connectorId: ConnectorNames.TrustWallet,
      get installed() {
        return !!getTrustWalletProvider()
      },
      deepLink: 'https://link.trustwallet.com/open_url?coin_id=20000714&url=https://pancakeswap.finance/',
      downloadLink: 'https://trustwallet.com/browser-extension',
      guide: {
        desktop: 'https://trustwallet.com/browser-extension',
        mobile: 'https://trustwallet.com/',
      },
      qrCode,
      MEVSupported: true,
    },
    {
      id: LegacyWalletIds.Okx,
      title: 'OKX Wallet',
      icon: `${ASSET_CDN}/web/wallets/okx-wallet.png`,
      connectorId: ConnectorNames.Injected,
      get installed() {
        return Boolean(safeGetWindow()?.okxwallet)
      },
      downloadLink: 'https://www.okx.com/download',
      deepLink:
        'https://www.okx.com/download?deeplink=okx%3A%2F%2Fwallet%2Fdapp%2Furl%3FdappUrl%3Dhttps%253A%252F%252Fpancakeswap.finance',
      guide: {
        desktop: 'https://www.okx.com/web3',
        mobile: 'https://www.okx.com/web3',
      },
      qrCode,
    },
    {
      id: LegacyWalletIds.BinanceW3W,
      title: 'Binance Wallet',
      icon: `${ASSET_CDN}/web/wallets/binance-w3w.png`,
      connectorId: ConnectorNames.BinanceW3W,
      get installed() {
        if (isBinanceWeb3WalletInstalled()) {
          return true
        }
        // still showing the SDK if not installed
        return undefined
      },
      MEVSupported: true,
    },
    {
      id: LegacyWalletIds.Coinbase,
      title: 'Coinbase Wallet',
      icon: `${ASSET_CDN}/web/wallets/coinbase.png`,
      connectorId: ConnectorNames.WalletLink,
    },
    {
      id: LegacyWalletIds.Walletconnect,
      title: 'WalletConnect',
      icon: `${ASSET_CDN}/web/wallets/walletconnect.png`,
      connectorId: ConnectorNames.WalletConnect,
    },
    {
      id: LegacyWalletIds.Opera,
      title: 'Opera Wallet',
      icon: `${ASSET_CDN}/web/wallets/opera.png`,
      connectorId: ConnectorNames.Injected,
      get installed() {
        return Boolean(safeGetWindow()?.ethereum?.isOpera)
      },
      downloadLink: 'https://www.opera.com/crypto/next',
    },
    {
      id: LegacyWalletIds.Brave,
      title: 'Brave Wallet',
      icon: `${ASSET_CDN}/web/wallets/brave.png`,
      connectorId: ConnectorNames.Injected,
      get installed() {
        return Boolean(safeGetWindow()?.ethereum?.isBraveWallet)
      },
      downloadLink: 'https://brave.com/wallet/',
    },
    {
      id: LegacyWalletIds.Rabby,
      title: 'Rabby Wallet',
      icon: `${ASSET_CDN}/web/wallets/rabby.png`,
      get installed() {
        return Boolean(safeGetWindow()?.ethereum?.isRabby)
      },
      connectorId: ConnectorNames.Injected,
      guide: {
        desktop: 'https://rabby.io/',
      },
      downloadLink: {
        desktop: 'https://rabby.io/',
      },
      qrCode,
      MEVSupported: true,
    },
    {
      id: LegacyWalletIds.Phantom,
      title: 'Phantom',
      icon: PHANTOM_ICON,
      connectorId: ConnectorNames.Phantom,
      supportedEvmChainIds: [...PHANTOM_SUPPORTED_EVM_CHAIN_IDS],
      get installed() {
        return isPhantomEvmInstalled()
      },
      downloadLink: 'https://phantom.com/',
      guide: {
        desktop: 'https://phantom.com/',
        mobile: 'https://phantom.com/',
      },
      qrCode,
    },
    {
      id: LegacyWalletIds.BitGet,
      title: 'Bitget Wallet',
      icon: `${ASSET_CDN}/web/wallets/bitget.png`,
      connectorId: ConnectorNames.Bitget,
      get installed() {
        return isBitgetWalletInstalled()
      },
      downloadLink: 'https://web3.bitget.com/',
      guide: {
        desktop: 'https://web3.bitget.com/',
        mobile: 'https://web3.bitget.com/',
      },
      qrCode,
    },
    {
      id: LegacyWalletIds.Math,
      title: 'MathWallet',
      icon: `${ASSET_CDN}/web/wallets/mathwallet.png`,
      connectorId: ConnectorNames.Injected,
      get installed() {
        return Boolean(safeGetWindow()?.ethereum?.isMathWallet)
      },
      qrCode,
    },
    {
      id: LegacyWalletIds.Tokenpocket,
      title: 'TokenPocket',
      icon: `${ASSET_CDN}/web/wallets/tokenpocket.png`,
      connectorId: ConnectorNames.Injected,
      get installed() {
        return Boolean(safeGetWindow()?.ethereum?.isTokenPocket) || Boolean(safeGetWindow()?.tokenpocket)
      },
      qrCode,
    },
    {
      id: LegacyWalletIds.SafePal,
      title: 'SafePal',
      icon: `${ASSET_CDN}/web/wallets/safepal.png`,
      connectorId: ConnectorNames.Injected,
      get installed() {
        return Boolean((safeGetWindow()?.ethereum as ExtendEthereum)?.isSafePal)
      },
      downloadLink: 'https://safepal.com/en/extension',
      qrCode,
    },
    {
      id: LegacyWalletIds.Coin98,
      title: 'Coin98',
      icon: `${ASSET_CDN}/web/wallets/coin98.png`,
      connectorId: ConnectorNames.Injected,
      get installed() {
        return Boolean((safeGetWindow()?.ethereum as ExtendEthereum)?.isCoin98) || Boolean(safeGetWindow()?.coin98)
      },
      qrCode,
    },
    // Sunset: https://x.com/BloctoApp/status/1920025815976444378
    // {
    //   id: LegacyWalletIds.Blocto,
    //   title: 'Blocto',
    //   icon: `${ASSET_CDN}/web/wallets/blocto.png`,
    //   connectorId: ConnectorNames.Blocto,
    //   get installed() {
    //     try {
    //       return (safeGetWindow()?.ethereum as ExtendEthereum)?.isBlocto ? true : undefined // undefined to show SDK
    //     } catch (error) {
    //       console.error('Error checking Blocto installation:', error)
    //       return undefined
    //     }
    //   },
    // },
    {
      id: LegacyWalletIds.Cyberwallet,
      title: 'CyberWallet',
      icon: `${ASSET_CDN}/web/wallets/cyberwallet.png`,
      connectorId: ConnectorNames.CyberWallet,
      get installed() {
        return Boolean(safeGetWindow() && isCyberWallet())
      },
      isNotExtension: true,
      guide: {
        desktop: 'https://docs.cyber.co/sdk/cyber-account#supported-chains',
      },
    },
    // {
    //   id: 'ledger',
    //   title: 'Ledger',
    //   icon: `${ASSET_CDN}/web/wallets/ledger.png`,
    //   connectorId: ConnectorNames.Ledger,
    // },
  ]
}

export const createWallets = <config extends Config = Config, context = unknown>(
  chainId: number,
  connect: ConnectMutateAsync<config, context>,
) => {
  const config = walletsConfig({ chainId, connect })
  const ethereum = safeGetWindow()?.ethereum
  const hasInjected = !!ethereum
  const injectedMeta = ethereum ? Object.keys(ethereum).filter((i) => i.match(/^is\w+/)) : []
  const injectedIsMetamask = injectedMeta.length === 1 && ethereum?.isMetaMask
  const injectedIsTrust = ethereum?.isTrust
  const currentInjectedWithinConfig =
    injectedIsMetamask ||
    injectedIsTrust ||
    config.some(
      (c) =>
        c.installed &&
        [ConnectorNames.Injected, ConnectorNames.Phantom, ConnectorNames.Bitget].includes(
          c.connectorId as ConnectorNames,
        ),
    )

  return !hasInjected || currentInjectedWithinConfig
    ? config
    : [
        ...config,
        // add injected icon if none of injected type wallets installed
        {
          id: LegacyWalletIds.Injected,
          title: 'Injected',
          icon: WalletFilledIcon,
          connectorId: ConnectorNames.Injected,
          installed: typeof window !== 'undefined' && Boolean(window.ethereum),
        },
      ]
}

const docLangCodeMapping: Record<string, string> = {
  it: 'italian',
  ja: 'japanese',
  fr: 'french',
  vi: 'vietnamese',
  id: 'indonesian',
  'zh-cn': 'chinese',
  'pt-br': 'portuguese-brazilian',
}

export const getDocLink = (code: string) =>
  docLangCodeMapping[code]
    ? `https://docs.pancakeswap.finance/v/${docLangCodeMapping[code]}/get-started/wallet-guide`
    : `https://docs.pancakeswap.finance/get-started/wallet-guide`

export const mevDocLink = 'https://docs.pancakeswap.finance/trading-tools/pancakeswap-mev-guard'
