import { SvgProps } from '@pancakeswap/uikit'
import { WalletName } from '@solana/wallet-adapter-base'
import { WalletIds as LegacyWalletIds } from './components/LegacyWalletModal/legacyWalletIds'
import { EvmConnectorNames, SolanaConnectorNames } from './config/connectorNames'

type LinkOfTextAndLink = string | { text: string; url: string }

type DeviceLink = {
  desktop?: LinkOfTextAndLink
  mobile?: LinkOfTextAndLink
}

export type LinkOfDevice = string | DeviceLink

export enum WalletAdaptedNetwork {
  EVM = 'evm',
  Solana = 'solana',
}

export enum WalletIds {
  Injected = 'injected',

  // Multi-Chain Wallets (EVM + Solana)
  Metamask = 'metamask',
  Okx = 'okx',
  BinanceW3W = 'BinanceW3W',
  Trust = 'trust',
  Tokenpocket = 'tokenpocket',
  Coin98 = 'coin98',
  SafePal = 'safePal',
  Walletconnect = 'walletconnect',
  Coinbase = 'coinbase',
  Math = 'math',

  // EVM Only Wallets
  Opera = 'opera',
  Brave = 'brave',
  Rabby = 'rabby',
  // Blocto = 'blocto',
  Cyberwallet = 'cyberwallet',
  Petra = 'petra',
  Martian = 'martian',
  Pontem = 'pontem',
  Fewcha = 'fewcha',
  Rise = 'rise',
  Msafe = 'msafe',

  // Solana Only Wallets
  Phantom = 'phantom',
  Solflare = 'solflare',
  Slope = 'slope',
  Glow = 'glow',
  BitGet = 'bitget',
  Exodus = 'exodus',
  Backpack = 'backpack',
}

type WalletConfigBase = {
  title: string
  icon: string | React.FC<React.PropsWithChildren<SvgProps>>

  deepLink?: string
  installed?: boolean
  guide?: LinkOfDevice
  downloadLink?: LinkOfDevice
  mobileOnly?: boolean
  qrCode?: (cb?: () => void) => Promise<string>
  isNotExtension?: boolean
  MEVSupported?: boolean
  supportedEvmChainIds?: number[]
}

export type WalletConfigV2<T = unknown> = WalletConfigBase & {
  id: LegacyWalletIds
  connectorId: T
}

export type WalletConfigV3<T = EvmConnectorNames | SolanaConnectorNames> = WalletConfigBase & {
  id: WalletIds
  networks: Array<WalletAdaptedNetwork>
  connectorId: T
  evmCanInitWithoutInstall?: boolean
  solanaCanInitWithoutInstall?: boolean
  solanaAdapterName?: SolanaConnectorNames | WalletName
}

export type ConnectData = {
  accounts: readonly [string, ...string[]]
  chainId: number | string | undefined
}
