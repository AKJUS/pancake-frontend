import { createContext, useContext } from 'react'

export type HarvestTab = 'evm' | 'solana'

/**
 * Shared context that lets any position action button open the centralised
 * HarvestEarningsModal without prop-drilling through the positions table tree.
 * An optional defaultTab can be passed to pre-select a tab when opening.
 * An optional chainId can be passed to indicate which chain the triggered position is on —
 * when the active wallet chain differs, the modal will show a "Switch Network" button instead of "Harvest All".
 */
export const HarvestModalContext = createContext<((defaultTab?: HarvestTab, chainId?: number) => void) | null>(null)

export function useOpenHarvestModal(): ((defaultTab?: HarvestTab, chainId?: number) => void) | null {
  return useContext(HarvestModalContext)
}
