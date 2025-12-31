import { LegacyWalletConfig, LegacyWalletIds } from '@pancakeswap/ui-wallets'
import { isMobile } from 'react-device-detect'

export enum ConnectorNames {
  Petra = 'petra',
  Martian = 'martian',
  Pontem = 'pontem',
  Fewcha = 'fewcha',
  Blocto = 'blocto',
  TrustWallet = 'trustWallet',
  SafePal = 'safePal',
  Rise = 'rise',
  Msafe = 'msafe',
}

export const wallets: LegacyWalletConfig<ConnectorNames>[] = [
  {
    id: LegacyWalletIds.Petra,
    title: 'Petra',
    icon: '/images/wallets/petra.png',
    get installed() {
      return typeof window !== 'undefined' && Boolean(window.aptos) && (isMobile ? !(window.trustwallet as any) : true)
    },
    connectorId: ConnectorNames.Petra,
    downloadLink: {
      desktop: 'https://petra.app/',
    },
  },
  {
    id: LegacyWalletIds.Martian,
    title: 'Martian',
    icon: '/images/wallets/martian.png',
    get installed() {
      return typeof window !== 'undefined' && Boolean(window.martian)
    },
    connectorId: ConnectorNames.Martian,
    downloadLink: {
      desktop: 'https://martianwallet.xyz/',
    },
  },
  {
    id: LegacyWalletIds.Pontem,
    title: 'Pontem',
    icon: '/images/wallets/pontem.png',
    get installed() {
      return typeof window !== 'undefined' && Boolean(window.pontem)
    },
    connectorId: ConnectorNames.Pontem,
    downloadLink: {
      desktop: 'https://chrome.google.com/webstore/detail/pontem-aptos-wallet/phkbamefinggmakgklpkljjmgibohnba',
    },
  },
  {
    id: LegacyWalletIds.Trust,
    title: 'Trust Wallet',
    icon: 'https://pancakeswap.finance/images/wallets/trust.png',
    get installed() {
      return (
        typeof window !== 'undefined' &&
        Boolean(window.aptos) &&
        (Boolean((window.aptos as any)?.isTrust) ||
          Boolean((window.aptos as any)?.isTrustWallet) ||
          (isMobile && Boolean(window.trustwallet as any)))
      )
    },
    deepLink: 'https://link.trustwallet.com/open_url?coin_id=637&url=https://aptos.pancakeswap.finance/',
    connectorId: ConnectorNames.TrustWallet,
  },
  {
    id: LegacyWalletIds.SafePal,
    title: 'SafePal',
    icon: 'https://pancakeswap.finance/images/wallets/safepal.png',
    get installed() {
      return typeof window !== 'undefined' && Boolean(window.safePal) && Boolean((window.safePal as any)?.sfpPlatform)
    },
    connectorId: ConnectorNames.SafePal,
    downloadLink: {
      desktop: 'https://chrome.google.com/webstore/detail/safepal-extension-wallet/lgmpcpglpngdoalbgeoldeajfclnhafa',
    },
  },
  {
    id: LegacyWalletIds.Msafe,
    title: 'Msafe',
    icon: '/images/wallets/msafe.png',
    get installed() {
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined' &&
        typeof window?.parent !== 'undefined' &&
        window?.parent.window !== window
      )
    },
    isNotExtension: true,
    downloadLink: {
      desktop: {
        text: 'Go to MSafe',
        url: 'https://aptos.m-safe.io/store/pancake',
      },
    },
    connectorId: ConnectorNames.Msafe,
  },
]

export const TOP_WALLET_MAP: LegacyWalletConfig<ConnectorNames>[] = [LegacyWalletIds.Pontem, LegacyWalletIds.Petra]
  .map((id) => wallets.find((w) => w.id === id))
  .filter((w): w is LegacyWalletConfig<ConnectorNames> => Boolean(w))
