import { useMemo } from 'react'

import { CHAINS } from 'config/chains'
import { ASSET_CDN } from 'config/constants/endpoints'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useUserShowTestnet } from 'state/user/hooks/useUserShowTestnet'

import { ChainId, isEvm, NonEVMChainId } from '@pancakeswap/chains'

export const MAINNET_CHAINS = CHAINS.filter((chain) => {
  if ('testnet' in chain && chain.testnet && chain.id !== ChainId.BSC_TESTNET && chain.id !== ChainId.MONAD_TESTNET) {
    return false
  }
  return true
})

export const useAllChain = () => {
  const [showTestnet] = useUserShowTestnet()
  return useMemo(
    () =>
      CHAINS.filter((chain) => {
        if ('testnet' in chain && chain.testnet) {
          return showTestnet
        }
        return true
      }),
    [showTestnet],
  )
}

export const useAllChainIds = () => {
  const allChains = useAllChain()
  return useMemo(() => allChains.map((chain) => chain.id).concat(NonEVMChainId.SOLANA), [allChains])
}

export const useAllEvmChainIds = () => {
  const allChains = useAllChain()
  return useMemo(() => allChains.map((chain) => chain.id).filter((id) => isEvm(id)), [allChains])
}

export const useAllChainsOpts = ({ includeSolana = true }: { includeSolana?: boolean } = {}) => {
  const chains = useAllChain()
  return useMemo(() => {
    const evmChains = chains.map((chain) => ({
      icon: `${ASSET_CDN}/web/chains/square/${chain.id}.svg`,
      value: chain.id,
      label: chain.name,
    }))

    if (includeSolana) {
      // non-evm chains
      evmChains.unshift({
        icon: `${ASSET_CDN}/web/chains/square/${NonEVMChainId.SOLANA}.svg`,
        value: NonEVMChainId.SOLANA,
        label: 'Solana',
      })
    }

    return evmChains
  }, [chains, includeSolana])
}

export const useOrderChainIds = () => {
  const allChainIds = useAllChainIds()
  const { chainId: activeChainId } = useActiveChainId()
  const othersChains = useMemo(() => allChainIds.filter((id) => id !== activeChainId), [allChainIds, activeChainId])
  const orderedChainIds = useMemo(() => [activeChainId, ...othersChains], [activeChainId, othersChains])
  return {
    activeChainId,
    othersChains,
    orderedChainIds,
  }
}
