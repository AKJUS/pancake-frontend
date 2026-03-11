import { solanaExplorerAtom } from '@pancakeswap/utils/user'
import { SOLANA_CHAIN } from 'config/chains'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'

const globalSolanaExplorer = {
  name: SOLANA_CHAIN.blockExplorers.default.name,
  icon: '',
  host: SOLANA_CHAIN.blockExplorers.default.url,
}

export function getGlobalSolanaExplorer() {
  return globalSolanaExplorer
}

export function useInitSolanaExplorer() {
  const solanaExplorer = useAtomValue(solanaExplorerAtom)

  useEffect(() => {
    Object.assign(globalSolanaExplorer, solanaExplorer)
  }, [solanaExplorer])
}
