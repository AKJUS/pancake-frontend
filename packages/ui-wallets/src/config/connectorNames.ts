import { WalletName } from '@solana/wallet-adapter-base'
import { ExodusWalletName } from '@solana/wallet-adapter-exodus'
import { GlowWalletName } from '@solana/wallet-adapter-glow'
import {
  Coin98WalletName,
  CoinbaseWalletName,
  MathWalletName,
  PhantomWalletName,
  SafePalWalletName,
  SolflareWalletName,
  TrustWalletName,
  TokenPocketWalletName,
  WalletConnectWalletName,
} from '@solana/wallet-adapter-wallets'

export enum EvmConnectorNames {
  MetaMask = 'metaMask',
  Injected = 'injected',
  WalletConnect = 'walletConnect',
  WalletConnectV1 = 'walletConnectLegacy',
  BinanceW3W = 'BinanceW3WSDK',
  Blocto = 'blocto',
  WalletLink = 'coinbaseWalletSDK',
  TrustWallet = 'trust',
  CyberWallet = 'cyberWallet',
  SafePal = 'SafePal',
}

// official supported solana wallets,
// others will be added by wallet standard auto discover
export const SolanaWalletNames = {
  Phantom: PhantomWalletName,
  MetaMask: 'MetaMask' as WalletName<'MetaMask'>,
  Okx: 'OKX Wallet' as WalletName<'OKX Wallet'>,
  BinanceW3W: 'Binance Wallet' as WalletName<'Binance Wallet'>,
  Trust: TrustWalletName,
  TokenPocket: TokenPocketWalletName,
  Coin98: Coin98WalletName,
  SafePal: SafePalWalletName,
  WalletConnect: WalletConnectWalletName,
  Coinbase: CoinbaseWalletName,
  Math: MathWalletName,
  Solflare: SolflareWalletName,
  // Slope: SlopeWalletName,
  Glow: GlowWalletName,
  // Bitget: BitgetWalletName, // @NOTICE: BitgetWalletName is wrong
  Bitget: 'Bitget Wallet' as WalletName<'Bitget Wallet'>,
  Exodus: ExodusWalletName,
  Backpack: 'Backpack' as WalletName<'Backpack'>,
  SquadsX: 'SquadsX' as WalletName<'SquadsX'>,
} as const

export type SolanaConnectorNames = {
  [key in keyof typeof SolanaWalletNames]: WalletName<key>
}
