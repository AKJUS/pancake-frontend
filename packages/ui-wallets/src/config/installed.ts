import { getTrustWalletProvider } from '@pancakeswap/wagmi/connectors/trustWallet'
import safeGetWindow from '@pancakeswap/utils/safeGetWindow'
import { isCyberWallet } from '@cyberlab/cyber-app-sdk'

export const isMetamaskInstalled = () => {
  if (!safeGetWindow()) {
    return false
  }

  try {
    if (window.ethereum?.isMetaMask) {
      // binance wallet doesn't support metamask
      // @ts-ignore
      return !window.ethereum?.isBinance
    }

    // @ts-ignore
    if (window.ethereum?.providers?.some((p) => p.isMetaMask)) {
      return true
    }
  } catch (e) {
    return false
  }

  return false
}

export const isBinanceWeb3WalletInstalled = () => {
  try {
    return Boolean(Boolean(safeGetWindow()?.isBinance) || Boolean(safeGetWindow()?.binancew3w))
  } catch (error) {
    console.error('Error checking Binance Web3 Wallet:', error)
    return false
  }
}

export const isTrustWalletInstalled = () => {
  return !!getTrustWalletProvider()
}

export const isOkxWalletInstalled = () => {
  return Boolean(safeGetWindow()?.okxwallet)
}

export const isOperaWalletInstalled = () => {
  return Boolean(safeGetWindow()?.ethereum?.isOpera)
}

export const isBraveWalletInstalled = () => {
  return Boolean(safeGetWindow()?.ethereum?.isBraveWallet)
}

export const isRabbyWalletInstalled = () => {
  return Boolean(safeGetWindow()?.ethereum?.isRabby)
}

export const isMathWalletInstalled = () => {
  return Boolean(safeGetWindow()?.ethereum?.isMathWallet)
}

export const isTokenPocketInstalled = () => {
  return Boolean(safeGetWindow()?.ethereum?.isTokenPocket) || Boolean(safeGetWindow()?.tokenpocket)
}

export const isTokenPocketApp = () => {
  const w = safeGetWindow() as any
  if (!w) return false
  // The mobile app DApp browser sets a custom UA containing "TokenPocket".
  // The browser extension runs in a normal browser and never modifies the UA.
  return Boolean(w.ethereum?.isTokenPocket) && /TokenPocket/i.test(navigator.userAgent)
}

export const isSafePalInstalled = () => {
  return Boolean(safeGetWindow()?.ethereum?.isSafePal)
}

export const isCoin98Installed = () => {
  return Boolean(safeGetWindow()?.ethereum?.isCoin98) || Boolean(safeGetWindow()?.coin98)
}

export const isCyberWalletInstalled = () => {
  return Boolean(safeGetWindow() && isCyberWallet())
}

export const isPhantomWalletInstalled = () => {
  return Boolean(
    safeGetWindow()?.phantom?.solana?.isPhantom ||
      safeGetWindow()?.phantom?.ethereum?.isPhantom ||
      safeGetWindow()?.ethereum?.isPhantom ||
      // @ts-ignore
      safeGetWindow()?.ethereum?.providers?.some((provider) => provider?.isPhantom),
  )
}

export const isBitgetWalletInstalled = () => {
  return Boolean(
    safeGetWindow()?.bitkeep?.ethereum ||
      safeGetWindow()?.ethereum?.isBitKeep ||
      safeGetWindow()?.ethereum?.isBitgetWallet ||
      // @ts-ignore
      safeGetWindow()?.ethereum?.providers?.some((provider) => provider?.isBitKeep || provider?.isBitgetWallet),
  )
}
