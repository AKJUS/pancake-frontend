import { ChainId, NonEVMChainId } from '@pancakeswap/chains'
import { useAtomValue } from 'jotai'
import { solanaExplorerAtom } from '@pancakeswap/utils/user'
import { bsc } from 'wagmi/chains'
import { chains } from 'utils/wagmi'
import { useCallback } from 'react'
import { getBlockExploreName, getSolExplorerLink } from 'utils'

export function useBlockExploreName(chainIdOverride?: number) {
  const solanaExplorer = useAtomValue(solanaExplorerAtom)
  const chainId = chainIdOverride || ChainId.BSC

  if (chainId === NonEVMChainId.SOLANA) {
    return solanaExplorer.name || 'Solscan'
  }

  return getBlockExploreName(chainId)
}

export function useBlockExploreLink() {
  const solanaExplorer = useAtomValue(solanaExplorerAtom)

  return useCallback(
    (
      data: string | number | undefined | null,
      type: 'transaction' | 'token' | 'address' | 'block' | 'countdown' | 'nft',
      chainIdOverride?: number,
    ): string => {
      const chainId = chainIdOverride || ChainId.BSC

      if (chainId === NonEVMChainId.SOLANA) {
        if (!data) return solanaExplorer.host
        return getSolExplorerLink(data, type, solanaExplorer.host)
      }

      const baseUrl = chains.find((c) => c.id === chainId)?.blockExplorers?.default?.url
      if (!baseUrl) return bsc.blockExplorers.default.url
      const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
      if (!data) return url

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
    },
    [solanaExplorer],
  )
}
