import { ChainId, isSolana, NonEVMChainId } from '@pancakeswap/chains'
import { Token } from '@pancakeswap/sdk'
import memoize from 'lodash/memoize'
import { safeGetAddress } from 'utils'

const mapping = {
  [ChainId.BSC]: 'smartchain',
  [ChainId.ETHEREUM]: 'ethereum',
  [ChainId.ZKSYNC]: 'zksync',
  [ChainId.ARBITRUM_ONE]: 'arbitrum',
  [ChainId.LINEA]: 'linea',
  [ChainId.BASE]: 'base',
  [NonEVMChainId.SOLANA]: 'solana',
}

const buildTrustWalletLogoURL = (address?: string, chainId?: number): string | null => {
  if (!address || !chainId || !mapping[chainId]) return null

  const formattedAddress = isSolana(chainId) ? address : safeGetAddress(address)

  if (!formattedAddress) return null

  return `https://assets-cdn.trustwallet.com/blockchains/${mapping[chainId]}/assets/${formattedAddress}/logo.png`
}

const getTokenLogoURL = memoize(
  (token?: Token) => {
    if (!token) return null
    return buildTrustWalletLogoURL(token.address, token.chainId)
  },
  (t) => `${t?.chainId}#${t?.address}`,
)

export const getTokenLogoURLByAddress = memoize(
  (address?: string, chainId?: number) => buildTrustWalletLogoURL(address, chainId),
  (address, chainId) => `${chainId}#${address}`,
)

export default getTokenLogoURL
