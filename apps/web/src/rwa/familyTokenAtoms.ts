import { RWA, RWAFamilyType, RWATokensByFamily } from '@pancakeswap/rwa-sdk'
import type { TokenInfo } from '@pancakeswap/token-lists'
import { normalizeAddress } from '@pancakeswap/utils/normalizeAddress'
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { listsAtom } from 'state/lists/lists'

export type RwaExclusiveTokenLike = {
  chainId: number
  address: string
  symbol?: string
  name?: string
}

const emptyFamilyTokens = (): Record<RWAFamilyType, TokenInfo[]> => ({
  ondo: [],
  xstocks: [],
})

export const rwaFamilyTokensAtom = atom((get) => {
  const lists = get(listsAtom)
  const byFamily = emptyFamilyTokens()

  if (!lists?.byUrl) {
    return byFamily
  }

  for (const family of RWA.families) {
    const seen = new Set<string>()
    const tokens: TokenInfo[] = []

    for (const url of family.listUrls) {
      const tokenList = lists.byUrl[url]?.current
      if (!tokenList?.tokens?.length) {
        continue
      }

      for (const token of tokenList.tokens) {
        const normalizedAddress = normalizeAddress(token.address)
        const key = `${token.chainId}:${normalizedAddress}`
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        tokens.push(token)
      }
    }

    byFamily[family.type] = tokens
  }

  return byFamily
})

export const rwaFamilyTokenListAtom = atomFamily(
  (family: RWAFamilyType) =>
    atom((get) => {
      const tokensByFamily = get(rwaFamilyTokensAtom)
      return tokensByFamily[family]
    }),
  (a, b) => a === b,
)

export const rwaExclusiveTokenFilterAtom = atom((get) => {
  const tokensByFamily = get(rwaFamilyTokensAtom)
  const addressesByChain = new Map<number, Set<string>>()
  const namesByChain = new Map<number, Set<string>>()

  const addToChainSet = <T>(map: Map<number, Set<T>>, chainId: number, value: T) => {
    const set = map.get(chainId) ?? new Set<T>()
    set.add(value)
    map.set(chainId, set)
  }

  Object.values(tokensByFamily)
    .flat()
    .forEach((token) => {
      addToChainSet(addressesByChain, token.chainId, normalizeAddress(token.address))

      const symbol = token.symbol?.trim().toLowerCase()
      if (symbol) {
        addToChainSet(namesByChain, token.chainId, symbol)
      }

      const name = token.name?.trim().toLowerCase()
      if (name) {
        addToChainSet(namesByChain, token.chainId, name)
      }
    })

  return (token: RwaExclusiveTokenLike) => {
    const address = normalizeAddress(token.address)
    const rwaAddresses = addressesByChain.get(token.chainId)
    if (rwaAddresses?.has(address)) return true

    const rwaNames = namesByChain.get(token.chainId)
    if (!rwaNames?.size) return true

    const symbol = token.symbol?.trim().toLowerCase()
    const name = token.name?.trim().toLowerCase()

    return !(symbol && rwaNames.has(symbol)) && !(name && rwaNames.has(name))
  }
})

export const rwaTokensByFamilyForSdkAtom = atom((get): RWATokensByFamily => {
  const tokensByFamily = get(rwaFamilyTokensAtom)
  return {
    ondo: tokensByFamily.ondo.map((token) => ({
      chainId: token.chainId,
      address: token.address,
      symbol: token.symbol,
    })),
    xstocks: tokensByFamily.xstocks.map((token) => ({
      chainId: token.chainId,
      address: token.address,
      symbol: token.symbol,
    })),
  }
})

export const rwaFamilyByTokenAtom = atomFamily(
  ({ chainId, address }: { chainId: number; address: string }) =>
    atom((get) => {
      const tokensByFamily = get(rwaTokensByFamilyForSdkAtom)
      return RWA.getFamilyByToken(chainId, address, tokensByFamily)
    }),
  (a, b) => a.chainId === b.chainId && normalizeAddress(a.address) === normalizeAddress(b.address),
)
