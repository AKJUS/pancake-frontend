import { ChainId, NonEVMChainId } from '@pancakeswap/chains'
import { useAtomValue } from 'jotai'
import { solanaExplorerAtom } from '@pancakeswap/utils/user'
import { multiChainScanName } from 'state/info/constant'
import { bsc } from 'wagmi/chains'
import { chains } from 'utils/wagmi'
import { useCallback } from 'react'

export function useBlockExploreName(chainIdOverride?: number) {
  const solanaExplorer = useAtomValue(solanaExplorerAtom)
  const chainId = chainIdOverride || ChainId.BSC

  if (chainId === NonEVMChainId.SOLANA) {
    return solanaExplorer.name || 'Solscan'
  }

  const chain = chains.find((c) => c.id === chainId)

  return multiChainScanName[chain?.id || -1] || chain?.blockExplorers?.default.name || bsc.blockExplorers.default.name
}

function getSolExplorerLink(
  data: string | number | undefined | null,
  type: 'transaction' | 'token' | 'address' | 'block' | 'countdown' | 'nft',
  explorerHost: string,
) {
  switch (type) {
    case 'transaction':
      return `${explorerHost}/tx/${data}`
    case 'token':
      return `${explorerHost}/token/${data}`
    case 'address':
      return `${explorerHost}/address/${data}`
    default:
      throw new Error(`Unsupported Solana explorer type: ${type}`)
  }
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
        return getSolExplorerLink(data, type, solanaExplorer.host)
      }

      const chain = chains.find((c) => c.id === chainId)
      if (!chain || !data) return bsc.blockExplorers.default.url

      switch (type) {
        case 'transaction':
          return `${chain.blockExplorers?.default.url}/tx/${data}`
        case 'token':
          return `${chain.blockExplorers?.default.url}/token/${data}`
        case 'block':
          return `${chain.blockExplorers?.default.url}/block/${data}`
        case 'countdown':
          return `${chain.blockExplorers?.default.url}/block/countdown/${data}`
        case 'nft':
          return `${chain.blockExplorers?.default.url}/nft/${data}`
        default:
          return `${chain.blockExplorers?.default.url}/address/${data}`
      }
    },
    [solanaExplorer],
  )
}
