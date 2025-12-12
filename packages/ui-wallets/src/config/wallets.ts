import { Wallet as SolanaWalletAdapter } from '@solana/wallet-adapter-react'
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base'
import safeGetWindow from '@pancakeswap/utils/safeGetWindow'
import { ChainId } from '@pancakeswap/chains'
import { WalletAdaptedNetwork, WalletConfigV3 } from '../types'
import { WalletIds } from './walletIds'
import { EvmConnectorNames, SolanaWalletNames, SolanaConnectorNames } from './connectorNames'
import {
  isBinanceWeb3WalletInstalled,
  isBraveWalletInstalled,
  isCoin98Installed,
  isMathWalletInstalled,
  isMetamaskInstalled,
  isOkxWalletInstalled,
  isOperaWalletInstalled,
  isRabbyWalletInstalled,
  isSafePalInstalled,
  isTokenPocketInstalled,
  isTrustWalletInstalled,
} from './installed'
import { ASSET_CDN } from './url'
import { WalletFilterValue } from '../state/hooks'

// Wrapper that keeps getter but makes it safe
export function wrapInstalledSafe<T extends { id: any; installed?: boolean }>(walletConfig: T): T {
  if (!walletConfig) return walletConfig
  const descriptor = Object.getOwnPropertyDescriptor(walletConfig, 'installed')

  if (descriptor && typeof descriptor.get === 'function') {
    const originalInstalledGetter = descriptor.get

    Object.defineProperty(walletConfig, 'installed', {
      get() {
        try {
          return originalInstalledGetter.call(this)
        } catch (error) {
          console.error(`Error in installed getter for wallet ${walletConfig.id || 'unknown'}:`, error)
          return false
        }
      },
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
    })
  }

  return walletConfig
}

function getBinanceConnectorId() {
  const globalWindow = safeGetWindow()

  if (!globalWindow) return EvmConnectorNames.BinanceW3W

  // use Binance App
  if (globalWindow.isBinance) return EvmConnectorNames.Injected

  // use Binance Web3 Wallet Extension
  if (globalWindow.binancew3w) return EvmConnectorNames.BinanceW3W

  return EvmConnectorNames.BinanceW3W
}

export const getWalletsConfig = ({
  walletFilter,
  createEvmQrCode,
  solanaWalletAdapters,
}: {
  walletFilter: WalletFilterValue
  createEvmQrCode?: () => () => Promise<string>
  solanaWalletAdapters: SolanaWalletAdapter[]
}): WalletConfigV3[] => {
  const qrCode = createEvmQrCode ? createEvmQrCode() : undefined
  const isSolanaWalletInstalled = (walletName: WalletName) => {
    if (!solanaWalletAdapters || solanaWalletAdapters.length === 0) return false
    return solanaWalletAdapters.some(
      (wallet) => wallet.adapter.name === walletName && wallet.readyState === WalletReadyState.Installed,
    )
  }
  const wallets = [
    {
      id: WalletIds.Metamask,
      title: 'Metamask',
      icon: `${ASSET_CDN}/web/wallets/metamask.png`,
      networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      get installed() {
        return isMetamaskInstalled()
      },
      connectorId: EvmConnectorNames.Injected,
      solanaAdapterName: SolanaWalletNames.MetaMask,
      deepLink: 'https://metamask.app.link/dapp/pancakeswap.finance/',
      qrCode,
      downloadLink: 'https://metamask.app.link/dapp/pancakeswap.finance/',
      MEVSupported: true,
    },
    {
      id: WalletIds.Trust,
      title: 'Trust Wallet',
      icon: `${ASSET_CDN}/web/wallets/trust.png`,
      connectorId: EvmConnectorNames.Injected,
      solanaAdapterName: SolanaWalletNames.Trust,
      networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      get installed() {
        return isTrustWalletInstalled()
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
      id: WalletIds.Okx,
      title: 'OKX Wallet',
      icon: `${ASSET_CDN}/web/wallets/okx-wallet.png`,
      connectorId: EvmConnectorNames.Injected,
      solanaAdapterName: SolanaWalletNames.Okx,
      networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      get installed() {
        return isOkxWalletInstalled()
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
      id: WalletIds.BinanceW3W,
      title: 'Binance Wallet',
      icon: `${ASSET_CDN}/web/wallets/binance-w3w.png`,
      connectorId: EvmConnectorNames.BinanceW3W,
      solanaAdapterName: SolanaWalletNames.BinanceW3W,
      networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      get installed() {
        return isBinanceWeb3WalletInstalled()
      },
      evmCanInitWithoutInstall: true,
      solanaCanInitWithoutInstall: false,
      MEVSupported: true,
    },
    {
      id: WalletIds.Coinbase,
      title: 'Coinbase Wallet',
      icon: `${ASSET_CDN}/web/wallets/coinbase.png`,
      connectorId: EvmConnectorNames.WalletLink,
      solanaAdapterName: SolanaWalletNames.Coinbase,
      networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      get installed() {
        return isSolanaWalletInstalled(SolanaWalletNames.Coinbase)
      },
      evmCanInitWithoutInstall: true,
      solanaCanInitWithoutInstall: false,
      downloadLink: 'https://www.coinbase.com/wallet/downloads',
    },
    {
      id: WalletIds.Walletconnect,
      title: 'WalletConnect',
      icon: `${ASSET_CDN}/web/wallets/walletconnect.png`,
      connectorId: EvmConnectorNames.WalletConnect,
      // solanaAdapterName: SolanaWalletNames.WalletConnect,
      // networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      networks: [WalletAdaptedNetwork.EVM],
      // solanaCanInitWithoutInstall: true,
      evmCanInitWithoutInstall: true,
    },
    {
      id: WalletIds.Opera,
      title: 'Opera Wallet',
      icon: `${ASSET_CDN}/web/wallets/opera.png`,
      connectorId: EvmConnectorNames.Injected,
      networks: [WalletAdaptedNetwork.EVM],
      get installed() {
        return isOperaWalletInstalled()
      },
      downloadLink: 'https://www.opera.com/crypto/next',
    },
    {
      id: WalletIds.Brave,
      title: 'Brave Wallet',
      icon: `${ASSET_CDN}/web/wallets/brave.png`,
      connectorId: EvmConnectorNames.Injected,
      networks: [WalletAdaptedNetwork.EVM],
      get installed() {
        return isBraveWalletInstalled()
      },
      downloadLink: 'https://brave.com/wallet/',
    },
    {
      id: WalletIds.Rabby,
      title: 'Rabby Wallet',
      icon: `${ASSET_CDN}/web/wallets/rabby.png`,
      connectorId: EvmConnectorNames.Injected,
      networks: [WalletAdaptedNetwork.EVM],
      get installed() {
        return isRabbyWalletInstalled()
      },
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
      id: WalletIds.Math,
      title: 'MathWallet',
      icon: `${ASSET_CDN}/web/wallets/mathwallet.png`,
      connectorId: EvmConnectorNames.Injected,
      networks: [WalletAdaptedNetwork.EVM],
      get installed() {
        return isMathWalletInstalled()
      },
      qrCode,
    },
    {
      id: WalletIds.Tokenpocket,
      title: 'TokenPocket',
      icon: `${ASSET_CDN}/web/wallets/tokenpocket.png`,
      connectorId: EvmConnectorNames.Injected,
      solanaAdapterName: SolanaWalletNames.TokenPocket,
      networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      get installed() {
        return isTokenPocketInstalled()
      },
      qrCode,
      downloadLink: 'https://tokenpocket.pro',
    },
    {
      id: WalletIds.SafePal,
      title: 'SafePal',
      icon: `${ASSET_CDN}/web/wallets/safepal.png`,
      connectorId: EvmConnectorNames.Injected,
      solanaAdapterName: SolanaWalletNames.SafePal,
      networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      get installed() {
        return isSafePalInstalled()
      },
      downloadLink: 'https://safepal.com/en/extension',
      qrCode,
    },
    {
      id: WalletIds.Coin98,
      title: 'Coin98',
      icon: `${ASSET_CDN}/web/wallets/coin98.png`,
      connectorId: EvmConnectorNames.Injected,
      solanaAdapterName: SolanaWalletNames.Coin98,
      networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
      get installed() {
        return isCoin98Installed()
      },
      qrCode,
    },
    // {
    //   id: WalletIds.Cyberwallet,
    //   title: 'CyberWallet',
    //   icon: `${ASSET_CDN}/web/wallets/cyberwallet.png`,
    //   connectorId: EvmConnectorNames.Injected,
    //   networks: [WalletAdaptedNetwork.EVM],
    //   get installed() {
    //     return isCyberWalletInstalled()
    //   },
    //   isNotExtension: true,
    // },

    {
      id: WalletIds.Phantom,
      title: 'Phantom',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiB2aWV3Qm94PSIwIDAgMTA4IDEwOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00Ni41MjY3IDY5LjkyMjlDNDIuMDA1NCA3Ni44NTA5IDM0LjQyOTIgODUuNjE4MiAyNC4zNDggODUuNjE4MkMxOS41ODI0IDg1LjYxODIgMTUgODMuNjU2MyAxNSA3NS4xMzQyQzE1IDUzLjQzMDUgNDQuNjMyNiAxOS44MzI3IDcyLjEyNjggMTkuODMyN0M4Ny43NjggMTkuODMyNyA5NCAzMC42ODQ2IDk0IDQzLjAwNzlDOTQgNTguODI1OCA4My43MzU1IDc2LjkxMjIgNzMuNTMyMSA3Ni45MTIyQzcwLjI5MzkgNzYuOTEyMiA2OC43MDUzIDc1LjEzNDIgNjguNzA1MyA3Mi4zMTRDNjguNzA1MyA3MS41NzgzIDY4LjgyNzUgNzAuNzgxMiA2OS4wNzE5IDY5LjkyMjlDNjUuNTg5MyA3NS44Njk5IDU4Ljg2ODUgODEuMzg3OCA1Mi41NzU0IDgxLjM4NzhDNDcuOTkzIDgxLjM4NzggNDUuNjcxMyA3OC41MDYzIDQ1LjY3MTMgNzQuNDU5OEM0NS42NzEzIDcyLjk4ODQgNDUuOTc2OCA3MS40NTU2IDQ2LjUyNjcgNjkuOTIyOVpNODMuNjc2MSA0Mi41Nzk0QzgzLjY3NjEgNDYuMTcwNCA4MS41NTc1IDQ3Ljk2NTggNzkuMTg3NSA0Ny45NjU4Qzc2Ljc4MTYgNDcuOTY1OCA3NC42OTg5IDQ2LjE3MDQgNzQuNjk4OSA0Mi41Nzk0Qzc0LjY5ODkgMzguOTg4NSA3Ni43ODE2IDM3LjE5MzEgNzkuMTg3NSAzNy4xOTMxQzgxLjU1NzUgMzcuMTkzMSA4My42NzYxIDM4Ljk4ODUgODMuNjc2MSA0Mi41Nzk0Wk03MC4yMTAzIDQyLjU3OTVDNzAuMjEwMyA0Ni4xNzA0IDY4LjA5MTYgNDcuOTY1OCA2NS43MjE2IDQ3Ljk2NThDNjMuMzE1NyA0Ny45NjU4IDYxLjIzMyA0Ni4xNzA0IDYxLjIzMyA0Mi41Nzk1QzYxLjIzMyAzOC45ODg1IDYzLjMxNTcgMzcuMTkzMSA2NS43MjE2IDM3LjE5MzFDNjguMDkxNiAzNy4xOTMxIDcwLjIxMDMgMzguOTg4NSA3MC4yMTAzIDQyLjU3OTVaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg==',
      connectorId: SolanaWalletNames.Phantom,
      solanaAdapterName: SolanaWalletNames.Phantom,
      networks: [WalletAdaptedNetwork.Solana],
      get installed() {
        return isSolanaWalletInstalled(SolanaWalletNames.Phantom)
      },
      downloadLink: 'https://phantom.com/',
    },

    {
      id: WalletIds.Solflare,
      title: 'Solflare',
      icon: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJTIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MCA1MCI+PGRlZnM+PHN0eWxlPi5jbHMtMXtmaWxsOiMwMjA1MGE7c3Ryb2tlOiNmZmVmNDY7c3Ryb2tlLW1pdGVybGltaXQ6MTA7c3Ryb2tlLXdpZHRoOi41cHg7fS5jbHMtMntmaWxsOiNmZmVmNDY7fTwvc3R5bGU+PC9kZWZzPjxyZWN0IGNsYXNzPSJjbHMtMiIgeD0iMCIgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiByeD0iMTIiIHJ5PSIxMiIvPjxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTI0LjIzLDI2LjQybDIuNDYtMi4zOCw0LjU5LDEuNWMzLjAxLDEsNC41MSwyLjg0LDQuNTEsNS40MywwLDEuOTYtLjc1LDMuMjYtMi4yNSw0LjkzbC0uNDYuNS4xNy0xLjE3Yy42Ny00LjI2LS41OC02LjA5LTQuNzItNy40M2wtNC4zLTEuMzhoMFpNMTguMDUsMTEuODVsMTIuNTIsNC4xNy0yLjcxLDIuNTktNi41MS0yLjE3Yy0yLjI1LS43NS0zLjAxLTEuOTYtMy4zLTQuNTF2LS4wOGgwWk0xNy4zLDMzLjA2bDIuODQtMi43MSw1LjM0LDEuNzVjMi44LjkyLDMuNzYsMi4xMywzLjQ2LDUuMThsLTExLjY1LTQuMjJoMFpNMTMuNzEsMjAuOTVjMC0uNzkuNDItMS41NCwxLjEzLTIuMTcuNzUsMS4wOSwyLjA1LDIuMDUsNC4wOSwyLjcxbDQuNDIsMS40Ni0yLjQ2LDIuMzgtNC4zNC0xLjQyYy0yLS42Ny0yLjg0LTEuNjctMi44NC0yLjk2TTI2LjgyLDQyLjg3YzkuMTgtNi4wOSwxNC4xMS0xMC4yMywxNC4xMS0xNS4zMiwwLTMuMzgtMi01LjI2LTYuNDMtNi43MmwtMy4zNC0xLjEzLDkuMTQtOC43Ny0xLjg0LTEuOTYtMi43MSwyLjM4LTEyLjgxLTQuMjJjLTMuOTcsMS4yOS04Ljk3LDUuMDktOC45Nyw4Ljg5LDAsLjQyLjA0LjgzLjE3LDEuMjktMy4zLDEuODgtNC42MywzLjYzLTQuNjMsNS44LDAsMi4wNSwxLjA5LDQuMDksNC41NSw1LjIybDIuNzUuOTItOS41Miw5LjE0LDEuODQsMS45NiwyLjk2LTIuNzEsMTQuNzMsNS4yMmgwWiIvPjwvc3ZnPg==',
      connectorId: SolanaWalletNames.Solflare,
      solanaAdapterName: SolanaWalletNames.Solflare,
      networks: [WalletAdaptedNetwork.Solana],
      get installed() {
        return isSolanaWalletInstalled(SolanaWalletNames.Solflare) || Boolean((safeGetWindow() as any)?.solflare)
      },
      downloadLink: 'https://solflare.com',
    },

    // {
    //   id: WalletIds.Slope,
    //   title: 'Slope',
    //   icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iNjQiIGZpbGw9IiM2RTY2RkEiLz4KPHBhdGggZD0iTTI3Ljk0NzUgNTIuMTU5Nkw1MS45ODI2IDI4LjA1NzJMNzIuNjA5OCA3LjY1Mzg5QzczLjg3MzQgNi40MDQwMSA3Ni4wMTc4IDcuMjk5MSA3Ni4wMTc4IDkuMDc2NDJMNzYuMDE4NyA1Mi4xNTlMNTEuOTgzNiA3Ni4xMjY4TDI3Ljk0NzUgNTIuMTU5NloiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8zNzk1XzI1NTQzKSIvPgo8cGF0aCBkPSJNMTAwLjA1MyA3NS45OTNMNzYuMDE4IDUxLjk1OEw1MS45ODI5IDc1Ljk5MzFMNTEuOTgyOSAxMTguOTI0QzUxLjk4MjkgMTIwLjcwMyA1NC4xMzEyIDEyMS41OTcgNTUuMzkzNyAxMjAuMzQzTDEwMC4wNTMgNzUuOTkzWiIgZmlsbD0idXJsKCNwYWludDFfbGluZWFyXzM3OTVfMjU1NDMpIi8+CjxwYXRoIGQ9Ik0yNy45NDcgNTIuMTYwMUg0NC42ODM5QzQ4LjcxNDcgNTIuMTYwMSA1MS45ODIyIDU1LjQyNzYgNTEuOTgyMiA1OS40NTgzVjc2LjEyNjlIMzUuMjQ1M0MzMS4yMTQ2IDc2LjEyNjkgMjcuOTQ3IDcyLjg1OTQgMjcuOTQ3IDY4LjgyODdWNTIuMTYwMVoiIGZpbGw9IiNGMUYwRkYiLz4KPHBhdGggZD0iTTc2LjAxNzggNTIuMTYwMUg5Mi43NTQ3Qzk2Ljc4NTUgNTIuMTYwMSAxMDAuMDUzIDU1LjQyNzYgMTAwLjA1MyA1OS40NTgzVjc2LjEyNjlIODMuMzE2MUM3OS4yODU0IDc2LjEyNjkgNzYuMDE3OCA3Mi44NTk0IDc2LjAxNzggNjguODI4N1Y1Mi4xNjAxWiIgZmlsbD0iI0YxRjBGRiIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzM3OTVfMjU1NDMiIHgxPSI1MS45ODMxIiB5MT0iNy4wNzE1NSIgeDI9IjUxLjk4MzEiIHkyPSI3Ni4xMjY4IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNBOEFERkYiLz4KPHN0b3Agb2Zmc2V0PSIwLjY0ODU1NiIgc3RvcC1jb2xvcj0id2hpdGUiLz4KPC9saW5lYXJHcmFkaWVudD4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDFfbGluZWFyXzM3OTVfMjU1NDMiIHgxPSI3Ni4wMTgiIHkxPSI1MS45NTgiIHgyPSI3Ni4wMTgiIHkyPSIxMjAuOTI4IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIG9mZnNldD0iMC4yNjA3ODQiIHN0b3AtY29sb3I9IiNCNkJBRkYiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRTRFMkZGIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==',
    //   connectorId: SolanaWalletNames.Slope,
    //   solanaAdapterName: SolanaWalletNames.Slope,
    //   networks: [WalletAdaptedNetwork.Solana],
    //   get installed() {
    //     return isSolanaWalletInstalled(SolanaWalletNames.Slope)
    //   },
    //   downloadLink: 'https://slope.finance/',
    // },
    {
      id: WalletIds.Glow,
      title: 'Glow',
      icon: 'data:image/png;base64,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',
      connectorId: SolanaWalletNames.Glow,
      solanaAdapterName: SolanaWalletNames.Glow,
      networks: [WalletAdaptedNetwork.Solana],
      get installed() {
        return isSolanaWalletInstalled(SolanaWalletNames.Glow)
      },
      downloadLink: 'https://glow.app',
    },
    {
      id: WalletIds.BitGet,
      title: 'BitGet',
      icon: 'data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIHdpZHRoPSIyNTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjxmaWx0ZXIgaWQ9ImEiIGNvbG9yLWludGVycG9sYXRpb24tZmlsdGVycz0ic1JHQiIgZmlsdGVyVW5pdHM9InVzZXJTcGFjZU9uVXNlIiBoZWlnaHQ9IjQ1MS40MzEiIHdpZHRoPSI1NjkuNTU4IiB4PSItOTAuMjQxMSIgeT0iLTY5LjczNjkiPjxmZUZsb29kIGZsb29kLW9wYWNpdHk9IjAiIHJlc3VsdD0iQmFja2dyb3VuZEltYWdlRml4Ii8+PGZlQmxlbmQgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0iQmFja2dyb3VuZEltYWdlRml4IiBtb2RlPSJub3JtYWwiIHJlc3VsdD0ic2hhcGUiLz48ZmVHYXVzc2lhbkJsdXIgcmVzdWx0PSJlZmZlY3QxX2ZvcmVncm91bmRCbHVyXzIwMzVfMTEwNiIgc3RkRGV2aWF0aW9uPSI0OS4yMzA4Ii8+PC9maWx0ZXI+PGZpbHRlciBpZD0iYiIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIiBmaWx0ZXJVbml0cz0idXNlclNwYWNlT25Vc2UiIGhlaWdodD0iMzcxLjUwNyIgd2lkdGg9IjM1MS41OTYiIHg9Ii0xNjAuNTExIiB5PSItMTY1Ljk4NyI+PGZlRmxvb2QgZmxvb2Qtb3BhY2l0eT0iMCIgcmVzdWx0PSJCYWNrZ3JvdW5kSW1hZ2VGaXgiLz48ZmVCbGVuZCBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJCYWNrZ3JvdW5kSW1hZ2VGaXgiIG1vZGU9Im5vcm1hbCIgcmVzdWx0PSJzaGFwZSIvPjxmZUdhdXNzaWFuQmx1ciByZXN1bHQ9ImVmZmVjdDFfZm9yZWdyb3VuZEJsdXJfMjAzNV8xMTA2IiBzdGREZXZpYXRpb249IjQ5LjIzMDgiLz48L2ZpbHRlcj48ZmlsdGVyIGlkPSJjIiBjb2xvci1pbnRlcnBvbGF0aW9uLWZpbHRlcnM9InNSR0IiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgaGVpZ2h0PSI0MjQuNDUyIiB3aWR0aD0iNDQ0Ljg1MSIgeD0iLTI0MS4wNzgiIHk9IjY3LjY0MiI+PGZlRmxvb2QgZmxvb2Qtb3BhY2l0eT0iMCIgcmVzdWx0PSJCYWNrZ3JvdW5kSW1hZ2VGaXgiLz48ZmVCbGVuZCBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJCYWNrZ3JvdW5kSW1hZ2VGaXgiIG1vZGU9Im5vcm1hbCIgcmVzdWx0PSJzaGFwZSIvPjxmZUdhdXNzaWFuQmx1ciByZXN1bHQ9ImVmZmVjdDFfZm9yZWdyb3VuZEJsdXJfMjAzNV8xMTA2IiBzdGREZXZpYXRpb249IjQ5LjIzMDgiLz48L2ZpbHRlcj48ZmlsdGVyIGlkPSJkIiBjb2xvci1pbnRlcnBvbGF0aW9uLWZpbHRlcnM9InNSR0IiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgaGVpZ2h0PSIzODUuMTA1IiB3aWR0aD0iNDMwLjE5MSIgeD0iLTIwLjM5NjgiIHk9Ii0yNDIuNzU4Ij48ZmVGbG9vZCBmbG9vZC1vcGFjaXR5PSIwIiByZXN1bHQ9IkJhY2tncm91bmRJbWFnZUZpeCIvPjxmZUJsZW5kIGluPSJTb3VyY2VHcmFwaGljIiBpbjI9IkJhY2tncm91bmRJbWFnZUZpeCIgbW9kZT0ibm9ybWFsIiByZXN1bHQ9InNoYXBlIi8+PGZlR2F1c3NpYW5CbHVyIHJlc3VsdD0iZWZmZWN0MV9mb3JlZ3JvdW5kQmx1cl8yMDM1XzExMDYiIHN0ZERldmlhdGlvbj0iNDkuMjMwOCIvPjwvZmlsdGVyPjxjbGlwUGF0aCBpZD0iZSI+PHBhdGggZD0ibTAgMGgyNTZ2MjU2aC0yNTZ6Ii8+PC9jbGlwUGF0aD48ZyBjbGlwLXBhdGg9InVybCgjZSkiPjxwYXRoIGQ9Im0wIDBoMjU2djI1NmgtMjU2eiIgZmlsbD0iIzU0ZmZmNSIvPjxnIGZpbHRlcj0idXJsKCNhKSI+PHBhdGggZD0ibTEzLjQ4MDYgMTk4LjYwNWMtNDIuODA4MiAxMjAuNDM4IDE4Ni4xODA0IDg2LjQyMiAzMDYuMDI2NCA1NC4zNTkgMTIyLjY1OC00MC43MDUgMzcuODc5LTIyMC4xMzcxLTUwLjA5Mi0yMjQuMTA4Mi04Ny45NzItMy45NzExIDEwLjkwNyA4Mi45NjgyLTYzLjgyIDEwNy44MDAyLTc0LjcyNyAyNC44MzEtMTM4LjYwNDMtODguNTk3Ny0xOTIuMTE0NCA2MS45NDl6IiBmaWxsPSIjZmZmIi8+PC9nPjxnIGZpbHRlcj0idXJsKCNiKSI+PHBhdGggZD0ibTg1LjUxMTgtNDUuODIyNWMtMjIuNDU1Ni02MS4zNTM1LTEwMi40MzA3IDIxLjgyNzItMTM5LjYxMTMgNzEuMDg2OC0zNS40NjU3IDUzLjU4MzYgNTcuMTA4ODcgOTkuODg3NyA5My40MjAzIDc0Ljc3MjcgMzYuMzExNS0yNS4xMTQzLTMxLjU0NjMyLTMwLjAwMDctOS45NS02Mi42NTg1IDIxLjU5NjMtMzIuNjU3NzQgODQuMjEwMi02LjUwOSA1Ni4xNDEtODMuMjAxeiIgZmlsbD0iIzAwZmZmMCIgZmlsbC1vcGFjaXR5PSIuNjciLz48L2c+PGcgZmlsdGVyPSJ1cmwoI2MpIj48cGF0aCBkPSJtOTYuNDc5NiAyMjUuNDI0Yy0zMC42Mjk0LTEwMy4wNjEtMTYyLjU2MTQtNDguNzg3LTIyNC42OTg2LTguNzY3LTU5Ljc3MSA0Ny4zODUgODIuMTQ3OSAxODMuNjkxIDE0MS4wOTE1IDE3Ni43MTkgNTguOTQzNi02Ljk3My00Ny4yODQzLTY2LjMxMS0xMC44ODU0OC05NS4yMDYgMzYuMzk4NzgtMjguODk0IDEzMi43Nzg5OCA1Ni4wNzkgOTQuNDkyNTgtNzIuNzQ2eiIgZmlsbD0iIzlkODFmZiIvPjwvZz48ZyBmaWx0ZXI9InVybCgjZCkiPjxwYXRoIGQ9Im0yODIuMTItMTA3LjM1M2MtNjYuMDczLTc4LjY3OC0xNjAuNjU3LTEzLjYxNy0xOTkuNjkwNCAyOC43NDgzLTM0LjE1NTcgNDcuOTYwMSAxNDEuODQ1NCAxMzUuODM1OSAxOTAuNjkxNCAxMjAuNzc2MSA0OC44NDctMTUuMDU5OS02Ni42MDktNDYuMjIxNzgtNDUuODI0LTc1LjQ1OTMgMjAuNzg1LTI5LjIzNzYgMTM3LjQxNSAyNC4yODIyNCA1NC44MjMtNzQuMDY1MXoiIGZpbGw9IiM0ZDk0ZmYiLz48L2c+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJtOTMuMTg5IDE1Mi44MzZoNDMuNDg1bC00OS40NjU0LTQ5Ljc4NSA1MC4xMDE0LTQ5Ljc4NDcgMTMuNjQ1LTEzLjI2NjNoLTQ1LjEzNmwtNTcuNDgzMSA1Ny43NzczYy0yLjkwMSAyLjkxMTctMi44ODYxIDcuNjI0Ny4wMjk3IDEwLjUyMTd6bTI2LjE0MS00OS42NjhoLS4zMzVsLjMzMS0uMDA0em0wIDAgNDkuNDYxIDQ5Ljc4MS01MC4xMDEgNDkuNzg1LTEzLjY0NSAxMy4yNjZoNDUuMTM1bDU3LjQ4NC01Ny43NzRjMi45MDEtMi45MTIgMi44ODYtNy42MjQtLjAzLTEwLjUyMWwtNDQuODIzLTQ0LjUzN3oiIGZpbGw9IiMwMDAiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvZz48L3N2Zz4=',
      connectorId: SolanaWalletNames.Bitget,
      solanaAdapterName: SolanaWalletNames.Bitget,
      networks: [WalletAdaptedNetwork.Solana],
      get installed() {
        return isSolanaWalletInstalled(SolanaWalletNames.Bitget)
      },
      downloadLink: 'https://web3.bitget.com',
    },
    {
      id: WalletIds.Exodus,
      title: 'Exodus',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIyIiBoZWlnaHQ9IjEyNCIgdmlld0JveD0iMCAwIDEyMiAxMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxtYXNrIGlkPSJtYXNrMF8zMF8xMTAiIHN0eWxlPSJtYXNrLXR5cGU6YWxwaGEiIG1hc2tVbml0cz0idXNlclNwYWNlT25Vc2UiIHg9IjAiIHk9IjAiIHdpZHRoPSIxMjIiIGhlaWdodD0iMTI0Ij4KPHBhdGggZD0iTTEyMS43ODcgMzQuODMzMUw2OS4zODc2IDAuNDc2NTYyVjE5LjY4NTVMMTAzLjAwMiA0MS41Mjg4TDk5LjA0NzQgNTQuMDQySDY5LjM4NzZWNjkuOTU4SDk5LjA0NzRMMTAzLjAwMiA4Mi40NzEyTDY5LjM4NzYgMTA0LjMxNFYxMjMuNTIzTDEyMS43ODcgODkuMjc2N0wxMTMuMjE4IDYyLjA1NDlMMTIxLjc4NyAzNC44MzMxWiIgZmlsbD0iIzFEMUQxQiIvPgo8cGF0aCBkPSJNMjMuNzk5MyA2OS45NThINTMuMzQ5M1Y1NC4wNDJIMjMuNjg5NEwxOS44NDQ2IDQxLjUyODhMNTMuMzQ5MyAxOS42ODU1VjAuNDc2NTYyTDAuOTUwMTk1IDM0LjgzMzFMOS41MTg2IDYyLjA1NDlMMC45NTAxOTUgODkuMjc2N0w1My40NTkxIDEyMy41MjNWMTA0LjMxNEwxOS44NDQ2IDgyLjQ3MTJMMjMuNzk5MyA2OS45NThaIiBmaWxsPSIjMUQxRDFCIi8+CjwvbWFzaz4KPGcgbWFzaz0idXJsKCNtYXNrMF8zMF8xMTApIj4KPHBhdGggZD0iTTEyMS43ODcgMzQuODMzMUw2OS4zODc2IDAuNDc2NTYyVjE5LjY4NTVMMTAzLjAwMiA0MS41Mjg4TDk5LjA0NzQgNTQuMDQySDY5LjM4NzZWNjkuOTU4SDk5LjA0NzRMMTAzLjAwMiA4Mi40NzEyTDY5LjM4NzYgMTA0LjMxNFYxMjMuNTIzTDEyMS43ODcgODkuMjc2N0wxMTMuMjE4IDYyLjA1NDlMMTIxLjc4NyAzNC44MzMxWiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTIzLjc5OTMgNjkuOTU4SDUzLjM0OTNWNTQuMDQySDIzLjY4OTRMMTkuODQ0NiA0MS41Mjg4TDUzLjM0OTMgMTkuNjg1NVYwLjQ3NjU2MkwwLjk1MDE5NSAzNC44MzMxTDkuNTE4NiA2Mi4wNTQ5TDAuOTUwMTk1IDg5LjI3NjdMNTMuNDU5MSAxMjMuNTIzVjEwNC4zMTRMMTkuODQ0NiA4Mi40NzEyTDIzLjc5OTMgNjkuOTU4WiIgZmlsbD0id2hpdGUiLz4KPHJlY3QgeD0iMS4xMDYzMiIgeT0iMC40NzY1NjIiIHdpZHRoPSIxMzMuNzQ0IiBoZWlnaHQ9IjEzNi4wODUiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcl8zMF8xMTApIi8+CjxlbGxpcHNlIGN4PSI4LjQzMTc2IiBjeT0iMjcuNDYwMiIgcng9IjExNy42MzkiIHJ5PSIxMjcuNTQ1IiB0cmFuc2Zvcm09InJvdGF0ZSgtMzMuOTMwMyA4LjQzMTc2IDI3LjQ2MDIpIiBmaWxsPSJ1cmwoI3BhaW50MV9yYWRpYWxfMzBfMTEwKSIvPgo8L2c+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMzBfMTEwIiB4MT0iMTA1LjA4NCIgeTE9IjEzMi41OTQiIHgyPSI2OS44NDM5IiB5Mj0iLTEyLjI3NjUiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzBCNDZGOSIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNCQkZCRTAiLz4KPC9saW5lYXJHcmFkaWVudD4KPHJhZGlhbEdyYWRpZW50IGlkPSJwYWludDFfcmFkaWFsXzMwXzExMCIgY3g9IjAiIGN5PSIwIiByPSIxIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgZ3JhZGllbnRUcmFuc2Zvcm09InRyYW5zbGF0ZSg4LjQzMTc1IDI3LjQ2MDIpIHJvdGF0ZSg3Mi4yNTU3KSBzY2FsZSg5Ni40OTc5IDkwLjQ1NDMpIj4KPHN0b3Agb2Zmc2V0PSIwLjExOTc5MiIgc3RvcC1jb2xvcj0iIzg5NTJGRiIgc3RvcC1vcGFjaXR5PSIwLjg3Ii8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0RBQkRGRiIgc3RvcC1vcGFjaXR5PSIwIi8+CjwvcmFkaWFsR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==',
      connectorId: SolanaWalletNames.Exodus,
      solanaAdapterName: SolanaWalletNames.Exodus,
      networks: [WalletAdaptedNetwork.Solana],
      get installed() {
        return isSolanaWalletInstalled(SolanaWalletNames.Exodus)
      },
      downloadLink: 'https://www.exodus.com/browser-extension',
    },
    {
      id: WalletIds.Backpack,
      title: 'Backpack',
      icon: 'https://backpack.app/favicon.ico',
      connectorId: SolanaWalletNames.Backpack,
      solanaAdapterName: SolanaWalletNames.Backpack,
      networks: [WalletAdaptedNetwork.Solana],
      get installed() {
        return isSolanaWalletInstalled(SolanaWalletNames.Backpack) || Boolean((safeGetWindow() as any)?.backpack)
      },
      downloadLink: 'https://backpack.app/',
    },
    {
      id: WalletIds.SquadsX,
      title: 'SquadsX',
      icon: 'data:image/png;base64,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',
      connectorId: SolanaWalletNames.SquadsX,
      solanaAdapterName: SolanaWalletNames.SquadsX,
      networks: [WalletAdaptedNetwork.Solana],

      get installed() {
        return isSolanaWalletInstalled(SolanaWalletNames.SquadsX)
      },

      downloadLink: 'https://chromewebstore.google.com/detail/squadsx/jhmfofkpljgmilikdmkglcmekjnlekda',
    },
  ].map(wrapInstalledSafe) as WalletConfigV3[]

  if (walletFilter === WalletFilterValue.SolanaOnly) {
    return wallets.filter((wallet) =>
      wallet.networks.includes(WalletAdaptedNetwork.Solana),
    ) as WalletConfigV3<SolanaConnectorNames>[]
  }

  if (walletFilter === WalletFilterValue.EVMOnly) {
    return wallets.filter((wallet) =>
      wallet.networks.includes(WalletAdaptedNetwork.EVM),
    ) as WalletConfigV3<SolanaConnectorNames>[]
  }

  return wallets as WalletConfigV3[]
}

export const TOP_WALLETS_ID_CONFIG = {
  MultiChain: [WalletIds.Metamask, WalletIds.Trust, WalletIds.BinanceW3W, WalletIds.Okx],
  Evm: [WalletIds.Metamask, WalletIds.Trust, WalletIds.BinanceW3W, WalletIds.Okx],
  Solana: [WalletIds.Phantom, WalletIds.BinanceW3W, WalletIds.Solflare, WalletIds.Backpack],
}

// Chain-specific top wallets configuration
export const CHAIN_TOP_WALLETS_CONFIG: { [chainId: number]: WalletIds[] } = {
  [ChainId.MONAD_MAINNET]: [WalletIds.Metamask, WalletIds.Okx, WalletIds.Walletconnect],
}

export const getTopWalletsConfig = (
  wallets: WalletConfigV3[],
  walletFilter: WalletFilterValue,
  chainId?: number,
): WalletConfigV3[] => {
  // Check for chain-specific config first
  if (chainId && CHAIN_TOP_WALLETS_CONFIG[chainId]) {
    return CHAIN_TOP_WALLETS_CONFIG[chainId]
      .map((id) => wallets.find((wallet) => wallet.id === id))
      .filter(Boolean) as WalletConfigV3[]
  }

  if (walletFilter === WalletFilterValue.SolanaOnly) {
    return TOP_WALLETS_ID_CONFIG.Solana.map((id) => wallets.find((wallet) => wallet.id === id)).filter(
      Boolean,
    ) as WalletConfigV3<SolanaConnectorNames>[]
  }

  if (walletFilter === WalletFilterValue.EVMOnly) {
    return TOP_WALLETS_ID_CONFIG.Evm.map((id) => wallets.find((wallet) => wallet.id === id)).filter(
      Boolean,
    ) as WalletConfigV3<EvmConnectorNames>[]
  }

  return TOP_WALLETS_ID_CONFIG.MultiChain.map((id) => wallets.find((wallet) => wallet.id === id)).filter(
    Boolean,
  ) as WalletConfigV3[]
}
