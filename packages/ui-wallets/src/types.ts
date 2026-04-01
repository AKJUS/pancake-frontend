import { SvgProps } from '@pancakeswap/uikit'
import { WalletName } from '@solana/wallet-adapter-base'
import { WalletIds as LegacyWalletIds } from './components/LegacyWalletModal/legacyWalletIds'
import { EvmConnectorNames, SolanaConnectorNames } from './config/connectorNames'
import { WalletIds } from './config/walletIds'

export { WalletIds } from './config/walletIds'

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
