import { normalizeAddress } from '@pancakeswap/utils/normalizeAddress'
import { getRWAFamily, rwaFamilies } from './registry'
import { RWAFamily, RWAFamilyType, RWAToken, RWATokenIdentifier, RWATokensByFamily } from './types'

const hasToken = (tokens: RWAToken[] | undefined, chainId: number, address: string): boolean => {
  if (!tokens || tokens.length === 0) {
    return false
  }
  const normalizedAddress = normalizeAddress(address)
  return tokens.some((token) => token.chainId === chainId && normalizeAddress(token.address) === normalizedAddress)
}

export const getFamilyByToken = (
  chainId: number,
  address: string,
  tokensByFamily: RWATokensByFamily,
): RWAFamily | undefined => {
  if (!chainId || !address) {
    return undefined
  }

  return rwaFamilies.find((family) => hasToken(tokensByFamily[family.type], chainId, address))
}

export const isToken = (chainId: number, address: string, tokensByFamily: RWATokensByFamily): boolean =>
  Boolean(getFamilyByToken(chainId, address, tokensByFamily))

export const getFamily = (type: RWAFamilyType): RWAFamily => getRWAFamily(type)

export const getTradeFamilies = (
  base: RWATokenIdentifier | undefined,
  quote: RWATokenIdentifier | undefined,
  tokensByFamily: RWATokensByFamily,
): RWAFamily[] => {
  const families: RWAFamily[] = []
  const seen = new Set<RWAFamilyType>()

  for (const token of [base, quote]) {
    if (!token) {
      continue
    }
    const family = getFamilyByToken(token.chainId, token.address, tokensByFamily)
    if (family && !seen.has(family.type)) {
      seen.add(family.type)
      families.push(family)
    }
  }

  return families
}
