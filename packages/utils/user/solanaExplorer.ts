import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

const host = 'https://solana.pancakeswap.finance'
export const supportedExplorers = [
  {
    name: 'Solscan',
    icon: `${host}/images/explorer-solscan.png`,
    host: 'https://solscan.io',
  },
  {
    name: 'Explorer',
    icon: `${host}/images/explorer-solana.png`,
    host: 'https://explorer.solana.com',
  },
]
const EXPLORER_STORAGE_KEY = 'defaultExplorer'

const explorerAtom = atomWithStorage<{ host: string; name?: string }>(EXPLORER_STORAGE_KEY, supportedExplorers[0])

// Derived atom to extract just the host
export const solanaExplorerAtom = atom(
  (get) => {
    const stored = get(explorerAtom)
    const explorer = supportedExplorers.find((e) => e.host === stored.host)
    return explorer ?? supportedExplorers[0]
  },
  (get, set, newHost: string) => {
    const existingExplorer = supportedExplorers.find((e) => e.host === newHost)
    set(explorerAtom, {
      host: newHost,
      name: existingExplorer?.name,
    })
  },
)

// Atom to check if current explorer is in supported list
export const isSupportedExplorerAtom = atom((get) => {
  const { host } = get(explorerAtom)
  return supportedExplorers.some((e) => e.host === host)
})

export const availableExplorersAtom = atom(supportedExplorers)
