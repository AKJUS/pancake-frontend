import { atom } from 'jotai'

export type BaseMiniAppAutoConnectStatus = 'idle' | 'checking' | 'connecting' | 'failed' | 'connected'

export const walletModalVisibleAtom = atom<boolean>(false)
export const connectedWalletModalVisibleAtom = atom<boolean>(false)
export const baseMiniAppAutoConnectStatusAtom = atom<BaseMiniAppAutoConnectStatus>('idle')
export const baseMiniAppAutoConnectRetryAtom = atom(0)
