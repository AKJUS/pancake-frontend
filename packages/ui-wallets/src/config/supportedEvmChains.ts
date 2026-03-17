import { ChainId, isEvm } from '@pancakeswap/chains'
import { WalletAdaptedNetwork } from '../types'

type EvmChainAwareWallet = {
  networks: Array<WalletAdaptedNetwork>
  supportedEvmChainIds?: number[]
}

export const PHANTOM_SUPPORTED_EVM_CHAIN_IDS = [ChainId.ETHEREUM, ChainId.BASE, ChainId.MONAD_MAINNET] as const

export const isPhantomEvmChainSupported = (chainId?: number) => {
  return Boolean(
    chainId && PHANTOM_SUPPORTED_EVM_CHAIN_IDS.includes(chainId as (typeof PHANTOM_SUPPORTED_EVM_CHAIN_IDS)[number]),
  )
}

export const getAvailableWalletNetworks = (wallet: EvmChainAwareWallet, chainId?: number) => {
  return wallet.networks.filter((network) => {
    if (network !== WalletAdaptedNetwork.EVM) {
      return true
    }

    if (!chainId || !isEvm(chainId) || !wallet.supportedEvmChainIds?.length) {
      return true
    }

    return wallet.supportedEvmChainIds.includes(chainId)
  })
}
