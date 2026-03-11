import { ChainId, NonEVMChainId } from '@pancakeswap/chains'
import { Currency } from '@pancakeswap/sdk'
import { TokenAddressMap } from '@pancakeswap/token-lists'
import { multiChainName, multiChainScan } from 'state/info/constant'
import { bsc } from 'wagmi/chains'
import { CHAINS, SOLANA_CHAIN } from 'config/chains'
import { GAS_MARGIN_BY_CHAIN } from 'config/constants/exchange'
import { getGlobalSolanaExplorer } from 'hooks/useInitSolanaExplorer'

export * from './safeGetAddress'
export { useBlockExploreName, useBlockExploreLink } from '../hooks/useBlockExploreName'

// Extend chain metadata with Solana descriptor from config
const UNIFIED_CHAINS = CHAINS.concat(SOLANA_CHAIN as any)

type ExplorerType = 'transaction' | 'token' | 'address' | 'block' | 'countdown' | 'nft'

const defaultEvmBuilder = (baseUrl: string, data: string | number, type: ExplorerType) => {
  if (!baseUrl) return ''

  const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  switch (type) {
    case 'transaction':
      return `${url}/tx/${data}`
    case 'token':
      return `${url}/token/${data}`
    case 'block':
      return `${url}/block/${data}`
    case 'countdown':
      return `${url}/block/countdown/${data}`
    case 'nft':
      return `${url}/nft/${data}`
    default:
      return `${url}/address/${data}`
  }
}

const solanaBuilder = (baseUrl: string, data: string | number, type: ExplorerType) => {
  if (!baseUrl) return ''

  const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  switch (type) {
    case 'transaction':
      return `${url}/tx/${data}`
    case 'address':
      return `${url}/account/${data}`
    case 'token':
      return `${url}/account/${data}`
    case 'block':
      return `${url}/block/${data}`
    case 'nft':
      return `${url}/nft/${data}`
    case 'countdown':
    default:
      return baseUrl
  }
}

export const getSolExplorerLink = (data: string | number, type: ExplorerType, explorerHost = 'https://solscan.io') => {
  return solanaBuilder(explorerHost, data, type)
}

const EXPLORER_BUILDERS: Partial<
  Record<number, (baseUrl: string, data: string | number, type: ExplorerType) => string>
> = {
  [NonEVMChainId.SOLANA]: solanaBuilder,
}

export function getBlockExploreLink(
  data: string | number | undefined | null,
  type: ExplorerType,
  chainIdOverride?: number,
): string {
  const chainId = chainIdOverride || ChainId.BSC
  const chain = UNIFIED_CHAINS.find((c) => c.id === chainId)
  if (!chain) return bsc.blockExplorers.default.url
  let baseUrl: string
  if (chainId === NonEVMChainId.SOLANA) {
    baseUrl = getGlobalSolanaExplorer().host
  } else {
    baseUrl = (chain as any)?.blockExplorers?.default?.url as string
  }
  if (!data) return baseUrl
  const builder = EXPLORER_BUILDERS[chain.id] || defaultEvmBuilder
  return builder(baseUrl, data, type)
}

export function getBlockExploreName(chainIdOverride?: number): string {
  const chainId = chainIdOverride || ChainId.BSC
  if (chainId === NonEVMChainId.SOLANA) {
    return getGlobalSolanaExplorer().name
  }
  const chain = UNIFIED_CHAINS.find((c) => c.id === chainId)

  return (
    multiChainScan[multiChainName[chain?.id || -1]] ||
    chain?.blockExplorers?.default?.name ||
    bsc.blockExplorers.default.name
  )
}

export function getBscScanLinkForNft(collectionAddress: string | undefined, tokenId?: string): string {
  if (!collectionAddress) return ''
  return `${bsc.blockExplorers.default.url}/token/${collectionAddress}?a=${tokenId}`
}

// add 10%
export function calculateGasMargin(value: bigint, margin = 1000n): bigint {
  return (value * (10000n + margin)) / 10000n
}

// Gas buffer for swap if override by chain
export function getGasMarginByChain(chainId: ChainId): bigint {
  return GAS_MARGIN_BY_CHAIN[chainId] ?? 2000n
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function isTokenOnList(defaultTokens: TokenAddressMap<ChainId>, currency?: Currency): boolean {
  if (currency?.isNative) return true
  return Boolean(currency?.isToken && defaultTokens[currency.chainId]?.[currency.address])
}

export function truncateText(text: string | undefined, maxLength: number = 200) {
  if (!text) return ''

  if (text.length > maxLength) {
    return `${text.slice(0, maxLength)}...`
  }

  return text
}
