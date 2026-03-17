import type { WindowProvider } from 'wagmi/window'

export interface ExtendEthereum extends WindowProvider {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  isSafePal?: true
  isCoin98?: true
  isBlocto?: true
  isMathWallet?: true
  isTrustWallet?: true
  isBlocto?: true
  isBinance?: true
  binancew3w?: unknown
  isCoinbaseWallet?: true
  isTrust?: true
  isTokenPocket?: true
  isMetaMask?: true
  providers?: ExtendEthereum[]
  isOpera?: true
  isBraveWallet?: true
  isRabby?: true
  isPhantom?: true
  isBitKeep?: true
  isBitgetWallet?: true
}

declare global {
  interface Window {
    okxwallet?: WindowProvider
    coin98?: true
    mercuryoWidget?: any
    binancew3w?: {
      pcs?: any
    }
    ethereum?: ExtendEthereum
    isBinance?: boolean
    bitkeep?: {
      ethereum?: ExtendEthereum
    }
    binancew3w?: {
      pcs: {
        sign: (params: { binanceChainId: string; contractAddress: string; address: string }) => Promise<SignResponse>
      }
      [key: string]: any
    }
    BinanceChain?: {
      bnbSign?: (address: string, message: string) => Promise<{ publicKey: string; signature: string }>
      switchNetwork?: (networkId: string) => Promise<string>
    } & Ethereum
    tokenpocket?: any

    phantom?: any
  }

  namespace JSX {
    interface IntrinsicElements {
      'usdv-widget': any
    }
  }
}

export {}
