import { atom } from 'jotai'
import { EvmConnectorNames, SolanaConnectorNames } from '../config/connectorNames'
import { isWalletId } from '../config/walletIds'
import { WalletConfigV3 } from '../types'

const MAXIMUM_STORE_NUM = 3
export const previouslyUsedEvmWalletsKey = 'previous-used-evm-wallets'
export const previouslyUsedSolanaWalletsKey = 'previous-used-solana-wallets'
const previouslyUsedWalletsStoreSeparator = ','

export const errorEvmAtom = atom<string>('')
export const errorSolanaAtom = atom<string>('')

export const selectedEvmWalletAtom = atom<WalletConfigV3<EvmConnectorNames> | null>(null)
export const selectedSolanaWalletAtom = atom<WalletConfigV3<SolanaConnectorNames> | null>(null)

// Clear Solana wallet when setting EVM wallet
export const setSelectedEvmWalletAtom = atom(null, (get, set, newValue: WalletConfigV3<EvmConnectorNames> | null) => {
  set(selectedEvmWalletAtom, newValue)
  set(selectedSolanaWalletAtom, null)
})

// Clear EVM wallet when setting Solana wallet
export const setSelectedSolanaWalletAtom = atom(
  null,
  (get, set, newValue: WalletConfigV3<SolanaConnectorNames> | null) => {
    set(selectedSolanaWalletAtom, newValue)
    set(selectedEvmWalletAtom, null)
  },
)

// Computed atom that returns the currently selected wallet (EVM or Solana)
export const selectedWalletAtom = atom((get) => {
  const evmWallet = get(selectedEvmWalletAtom)
  const solanaWallet = get(selectedSolanaWalletAtom)

  // Due to mutual exclusion logic, only one wallet will be non-null
  return evmWallet || solanaWallet || null
})

export const lastUsedEvmWalletNameAtom = atom('', (get, set, update: string) => {
  const list = get(previouslyUsedEvmWalletsAtom)
  set(previouslyUsedEvmWalletsAtom, [update, ...list.filter((i) => i !== update)].slice(0, MAXIMUM_STORE_NUM))
})

export const previouslyUsedEvmWalletsAtom = atom([] as string[], (_get, set, update: string[]) => {
  set(previouslyUsedEvmWalletsAtom, update)
  if (update && Array.isArray(update)) {
    localStorage?.setItem(previouslyUsedEvmWalletsKey, update.join(previouslyUsedWalletsStoreSeparator))
  }
})

previouslyUsedEvmWalletsAtom.onMount = (set) => {
  const preferred = localStorage?.getItem(previouslyUsedEvmWalletsKey)
  if (preferred) {
    set(preferred.split(previouslyUsedWalletsStoreSeparator).filter(isWalletId))
  }
}

export const lastUsedSolanaWalletNameAtom = atom('', (get, set, update: string) => {
  const list = get(previouslyUsedSolanaWalletsAtom)
  set(previouslyUsedSolanaWalletsAtom, [update, ...list.filter((i) => i !== update)].slice(0, MAXIMUM_STORE_NUM))
})

export const previouslyUsedSolanaWalletsAtom = atom([] as string[], (_get, set, update: string[]) => {
  set(previouslyUsedSolanaWalletsAtom, update)
  if (update && Array.isArray(update)) {
    localStorage?.setItem(previouslyUsedSolanaWalletsKey, update.join(previouslyUsedWalletsStoreSeparator))
  }
})

previouslyUsedSolanaWalletsAtom.onMount = (set) => {
  const preferred = localStorage?.getItem(previouslyUsedSolanaWalletsKey)
  if (preferred) {
    set(preferred.split(previouslyUsedWalletsStoreSeparator).filter(isWalletId))
  }
}

export const previouslyUsedWalletsAtom = atom((get) => {
  const evmWallets = get(previouslyUsedEvmWalletsAtom)
  const solanaWallets = get(previouslyUsedSolanaWalletsAtom)
  return [...evmWallets, ...solanaWallets]
})

export type WalletFilter = {
  type: 'solanaOnly' | 'evmOnly'
  value: boolean
}
export const walletFilterAtom = atom<WalletFilter>({ type: 'solanaOnly', value: false })
