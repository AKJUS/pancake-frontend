import { atom } from 'jotai'
import { DEFAULT_WALLET_RUNTIME_STATE, WalletRuntimeState } from '../runtime'

export const walletRuntimeAtom = atom<WalletRuntimeState>(DEFAULT_WALLET_RUNTIME_STATE)
