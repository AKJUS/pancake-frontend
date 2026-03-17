import safeGetWindow from '@pancakeswap/utils/safeGetWindow'
import { eip6963Providers } from './WalletProvider'

const findEip6963Provider = ({ names, rdns }: { names?: string[]; rdns?: string[] }) => {
  const normalizedNames = names?.map((value) => value.toLowerCase()) ?? []
  const normalizedRdns = rdns?.map((value) => value.toLowerCase()) ?? []

  return eip6963Providers.find((provider) => {
    const providerName = provider.info.name?.toLowerCase()
    const providerRdns = provider.info.rdns?.toLowerCase()

    if (providerRdns && normalizedRdns.includes(providerRdns)) {
      return true
    }

    return Boolean(providerName && normalizedNames.includes(providerName))
  })?.provider
}

const getInjectedProviders = () => {
  const window = safeGetWindow()
  const providers = window?.ethereum?.providers

  return Array.isArray(providers) ? providers : []
}

export const getPhantomEvmProvider = () => {
  const window = safeGetWindow()

  if (window?.phantom?.ethereum) {
    return window.phantom.ethereum
  }

  if (window?.ethereum?.isPhantom) {
    return window.ethereum
  }

  const injectedProvider = getInjectedProviders().find((provider) => provider?.isPhantom)
  if (injectedProvider) {
    return injectedProvider
  }

  return findEip6963Provider({
    names: ['Phantom'],
    rdns: ['app.phantom'],
  })
}

export const getBitgetEvmProvider = () => {
  const window = safeGetWindow()

  if (window?.bitkeep?.ethereum) {
    return window.bitkeep.ethereum
  }

  if (window?.ethereum?.isBitKeep || window?.ethereum?.isBitgetWallet) {
    return window.ethereum
  }

  const injectedProvider = getInjectedProviders().find((provider) => provider?.isBitKeep || provider?.isBitgetWallet)
  if (injectedProvider) {
    return injectedProvider
  }

  return findEip6963Provider({
    names: ['Bitget Wallet', 'BitKeep Wallet', 'Bitget'],
    rdns: ['com.bitkeep.wallet', 'com.bitget.web3'],
  })
}
