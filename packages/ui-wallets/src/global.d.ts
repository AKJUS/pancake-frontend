interface WindowProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export interface ExtendEthereum extends WindowProvider {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  isSafePal?: true
  isCoin98?: true
  isBlocto?: true
  isMathWallet?: true
  isTrustWallet?: true
  isBlocto?: true
  isBinance?: true
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
    ethereum?: ExtendEthereum
    isBinance?: boolean
    binancew3w?: boolean
    bitkeep?: {
      ethereum?: ExtendEthereum
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
