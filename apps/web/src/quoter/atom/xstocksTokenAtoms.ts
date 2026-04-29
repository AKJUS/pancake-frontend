import { atom as jotaiAtom } from 'jotai'
import type { TokenInfo } from '@pancakeswap/token-lists'
import { normalizeAddress } from '@pancakeswap/utils/normalizeAddress'
import { atomFamily } from 'jotai/utils'
import { rwaFamilyByTokenAtom, rwaFamilyTokenListAtom } from 'rwa/familyTokenAtoms'

export const xstocksTokenListAtom = jotaiAtom((get) => get(rwaFamilyTokenListAtom('xstocks')) as TokenInfo[])

export const isXStocksTokenAtom = atomFamily(
  ({ chainId, address }: { chainId: number; address: string }) =>
    jotaiAtom((get) => get(rwaFamilyByTokenAtom({ chainId, address }))?.type === 'xstocks'),
  (a, b) => a.chainId === b.chainId && normalizeAddress(a.address) === normalizeAddress(b.address),
)
