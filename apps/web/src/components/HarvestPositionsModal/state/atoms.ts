import { atom } from 'jotai'

export enum HarvestTxStatus {
  Idle = 'idle',
  Pending = 'pending',
  Success = 'success',
  Failed = 'failed',
}

export interface HarvestTxState {
  status: HarvestTxStatus
  hash?: string
  error?: string
}

const SOLANA_KEY_PREFIX = 'sol-'

export const harvestTxMapAtom = atom<Record<string, HarvestTxState>>({})

/** EVM batch harvest in progress (Solana panel must not read this). */
export const evmHarvestingAtom = atom(false)

/**
 * Optimistic UI: hide Solana positions that have been successfully harvested
 * until background refetch confirms updated on-chain state.
 */
export const solanaOptimisticallyRemovedKeysAtom = atom<Set<string>>(new Set<string>())

export const addSolanaOptimisticallyRemovedKeyAtom = atom(null, (get, set, key: string) => {
  const prev = get(solanaOptimisticallyRemovedKeysAtom)
  if (prev.has(key)) return
  set(solanaOptimisticallyRemovedKeysAtom, new Set(prev).add(key))
})

export const resetSolanaOptimisticallyRemovedKeysAtom = atom(null, (_get, set) => {
  set(solanaOptimisticallyRemovedKeysAtom, new Set<string>())
})

export const setHarvestStatusAtom = atom(
  null,
  (get, set, update: { key: string; status: HarvestTxStatus; hash?: string; error?: string }) => {
    const prev = get(harvestTxMapAtom)
    set(harvestTxMapAtom, {
      ...prev,
      [update.key]: {
        status: update.status,
        hash: update.hash ?? prev[update.key]?.hash,
        error: update.error,
      },
    })
  },
)

/** Resets ALL harvest tx statuses (both EVM and Solana). */
export const resetHarvestStatusAtom = atom(null, (_get, set) => {
  set(harvestTxMapAtom, {})
  set(solanaOptimisticallyRemovedKeysAtom, new Set<string>())
})

/** Resets only EVM harvest tx statuses, preserving Solana entries. */
export const resetEvmHarvestStatusAtom = atom(null, (get, set) => {
  const prev = get(harvestTxMapAtom)
  const solanaOnly: Record<string, HarvestTxState> = {}
  for (const [key, value] of Object.entries(prev)) {
    if (key.startsWith(SOLANA_KEY_PREFIX)) {
      solanaOnly[key] = value
    }
  }
  set(harvestTxMapAtom, solanaOnly)
})

/** Derived: only EVM entries from the tx map. */
export const evmTxMapAtom = atom((get) => {
  const all = get(harvestTxMapAtom)
  const evm: Record<string, HarvestTxState> = {}
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(SOLANA_KEY_PREFIX)) {
      evm[key] = value
    }
  }
  return evm
})
