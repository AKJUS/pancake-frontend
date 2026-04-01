import { getIsMobile, isInBinance } from '@binance/w3w-utils'
import { EvmConnectorNames } from '@pancakeswap/ui-wallets/src/config/connectorNames'
import { WalletIds } from '@pancakeswap/ui-wallets/src/config/walletIds'
import safeGetWindow from '@pancakeswap/utils/safeGetWindow'
import { getTrustWalletProvider } from '@pancakeswap/wagmi/connectors/trustWallet'
import { CAKEPAD_HOST, PANCAKESWAP_HOST, normalizeHost } from 'utils/domainMiniAppMeta'
import { getBitgetEvmProvider, getPhantomEvmProvider } from './evmInjectedProviders'

export type WalletRuntimeEnv = 'desktop_browser' | 'mobile_browser' | 'wallet_app' | 'unknown'

export type WalletAppHostDetection = {
  isWalletApp: boolean
  host: WalletIds
}

export type WalletRuntimeInfo = {
  env: WalletRuntimeEnv
  wallet: WalletIds
}

export type WalletRuntimeState = WalletRuntimeInfo & {
  hostDetection: WalletAppHostDetection
  connectorId: string | null
  selectedWalletId: WalletIds | null
}

export const DEFAULT_WALLET_APP_HOST_DETECTION: WalletAppHostDetection = {
  isWalletApp: false,
  host: WalletIds.Unknown,
}

export const DEFAULT_WALLET_RUNTIME_STATE: WalletRuntimeState = {
  env: 'unknown',
  wallet: WalletIds.Unknown,
  hostDetection: DEFAULT_WALLET_APP_HOST_DETECTION,
  connectorId: null,
  selectedWalletId: null,
}

const detectBaseMiniAppHost = ({ host, isInMiniApp }: { host?: string | string[]; isInMiniApp: boolean }) => {
  if (!isInMiniApp) return false

  const normalizedHost = normalizeHost(host)
  return normalizedHost === CAKEPAD_HOST || normalizedHost === PANCAKESWAP_HOST
}

const detectMetaMaskWalletHost = (ua: string) => /MetaMaskMobile/i.test(ua)
const detectTrustWalletHost = (ua: string) => /Trust Wallet/i.test(ua)
const detectCoinbaseWalletHost = (ua: string) => /CoinbaseWallet/i.test(ua)
const detectOkxWalletHost = (ua: string) => /OKX/i.test(ua)

const getUserAgent = (userAgent?: string) => {
  if (userAgent) return userAgent
  if (typeof navigator !== 'undefined') return navigator.userAgent
  return ''
}

const detectInjectedWalletByProvider = (): WalletIds | null => {
  const window = safeGetWindow()

  if (window?.okxwallet) {
    return WalletIds.Okx
  }

  if (window?.ethereum?.isBinance || (window as any)?.binancew3w) {
    return WalletIds.BinanceW3W
  }

  if (window?.ethereum?.isMetaMask && !window?.ethereum?.isBinance) {
    return WalletIds.Metamask
  }

  if (getTrustWalletProvider()) {
    return WalletIds.Trust
  }

  if (window?.ethereum?.isCoinbaseWallet) {
    return WalletIds.Coinbase
  }

  if (getPhantomEvmProvider()) {
    return WalletIds.Phantom
  }

  if (getBitgetEvmProvider()) {
    return WalletIds.BitGet
  }

  return null
}

export const detectWalletAppHost = ({
  host,
  isInMiniApp,
  userAgent,
}: {
  host?: string | string[]
  isInMiniApp: boolean
  userAgent?: string
}): WalletAppHostDetection => {
  if (detectBaseMiniAppHost({ host, isInMiniApp })) {
    return { isWalletApp: true, host: WalletIds.BaseApp }
  }

  if (typeof window === 'undefined') {
    return DEFAULT_WALLET_APP_HOST_DETECTION
  }

  const ua = getUserAgent(userAgent)

  if (isInBinance()) {
    return { isWalletApp: true, host: WalletIds.BinanceW3W }
  }

  if (detectMetaMaskWalletHost(ua)) {
    return { isWalletApp: true, host: WalletIds.Metamask }
  }

  if (detectTrustWalletHost(ua)) {
    return { isWalletApp: true, host: WalletIds.Trust }
  }

  if (detectCoinbaseWalletHost(ua)) {
    return { isWalletApp: true, host: WalletIds.Coinbase }
  }

  if (detectOkxWalletHost(ua) && getIsMobile()) {
    return { isWalletApp: true, host: WalletIds.Okx }
  }

  return DEFAULT_WALLET_APP_HOST_DETECTION
}

export const detectWalletRuntimeEnv = ({
  hostDetection,
  userAgent,
}: {
  hostDetection: WalletAppHostDetection
  userAgent?: string
}): WalletRuntimeEnv => {
  if (hostDetection.isWalletApp) {
    return 'wallet_app'
  }

  const ua = getUserAgent(userAgent)
  const isMobile = (typeof window !== 'undefined' && getIsMobile()) || /Android|iPhone|iPad|iPod|Mobile/i.test(ua)

  if (isMobile) {
    return 'mobile_browser'
  }

  if (ua) {
    return 'desktop_browser'
  }

  return 'unknown'
}

export const resolveWalletId = ({
  env,
  hostDetection,
  connectorId,
  selectedWalletId,
}: {
  env: WalletRuntimeEnv
  hostDetection: WalletAppHostDetection
  connectorId?: string | null
  selectedWalletId?: WalletIds | null
}): WalletIds => {
  if (env === 'wallet_app' && hostDetection.host !== WalletIds.Unknown) {
    return hostDetection.host
  }

  if (selectedWalletId && selectedWalletId !== WalletIds.Unknown) {
    return selectedWalletId
  }

  switch (connectorId) {
    case EvmConnectorNames.MetaMask:
      return WalletIds.Metamask
    case EvmConnectorNames.BinanceW3W:
      return WalletIds.BinanceW3W
    case EvmConnectorNames.WalletConnect:
    case EvmConnectorNames.WalletConnectV1:
      return WalletIds.Walletconnect
    case EvmConnectorNames.WalletLink:
      return WalletIds.Coinbase
    case EvmConnectorNames.Phantom:
      return WalletIds.Phantom
    case EvmConnectorNames.Bitget:
      return WalletIds.BitGet
    case EvmConnectorNames.TrustWallet:
      return WalletIds.Trust
    case EvmConnectorNames.SafePal:
      return WalletIds.SafePal
    case EvmConnectorNames.Injected:
      return detectInjectedWalletByProvider() ?? WalletIds.Injected
    default:
      return detectInjectedWalletByProvider() ?? WalletIds.Unknown
  }
}

export const buildWalletRuntimeState = ({
  host,
  isInMiniApp,
  connectorId,
  selectedWalletId,
  userAgent,
}: {
  host?: string | string[]
  isInMiniApp: boolean
  connectorId?: string | null
  selectedWalletId?: WalletIds | null
  userAgent?: string
}): WalletRuntimeState => {
  const hostDetection = detectWalletAppHost({ host, isInMiniApp, userAgent })
  const env = detectWalletRuntimeEnv({ hostDetection, userAgent })
  const wallet = resolveWalletId({ env, hostDetection, connectorId, selectedWalletId })

  return {
    env,
    wallet,
    hostDetection,
    connectorId: connectorId ?? null,
    selectedWalletId: selectedWalletId ?? null,
  }
}

export { detectBaseMiniAppHost }
