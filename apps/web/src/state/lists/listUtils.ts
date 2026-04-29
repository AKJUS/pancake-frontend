import { ChainId } from '@pancakeswap/chains'
import { TokenAddressMap as TTokenAddressMap, TokenInfo, TokenList, WrappedTokenInfo } from '@pancakeswap/token-lists'
import uniqBy from 'lodash/uniqBy'
import groupBy from 'lodash/groupBy'
import keyBy from 'lodash/keyBy'
import mapValues from 'lodash/mapValues'
import { USDON_TOKEN_ADDRESS } from 'quoter/atom/ondoTokenAtoms'
import { isNotUndefinedOrNull } from 'utils/isNotUndefinedOrNull'
import { isAddressEqual, safeGetAddress } from 'utils/safeGetAddress'

type TokenAddressMap = TTokenAddressMap<ChainId>

function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter((k) => Number.isNaN(+k)) as K[]
}

const listCache: WeakMap<TokenList, TokenAddressMap> | null =
  typeof WeakMap !== 'undefined' ? new WeakMap<TokenList, TokenAddressMap>() : null

export function sanitizeTokenInfos(list: TokenList): TokenInfo[] {
  if (list.name.includes('Ondo')) {
    return list.tokens
  }

  return list.tokens.filter((tokenInfo) => {
    const name = tokenInfo.name?.toLowerCase()
    if (name && name.includes('ondo tokenized')) {
      return false
    }
    const usdonAddress = USDON_TOKEN_ADDRESS[tokenInfo.chainId]
    if (isAddressEqual(usdonAddress, tokenInfo.address)) {
      return false
    }
    return true
  })
}

export function listToTokenMap(list: TokenList, key?: string): TokenAddressMap {
  const result = listCache?.get(list)
  if (result) return result

  const sanitizedTokens = sanitizeTokenInfos(list)

  const tokenMap: WrappedTokenInfo[] = uniqBy(
    sanitizedTokens,
    (tokenInfo: TokenInfo) => `${tokenInfo.chainId}#${tokenInfo.address}`,
  )
    .map((tokenInfo) => {
      const checksummedAddress = safeGetAddress(tokenInfo.address)
      if (checksummedAddress) {
        return new WrappedTokenInfo({ ...tokenInfo, address: checksummedAddress })
      }
      return null
    })
    .filter(isNotUndefinedOrNull)

  const groupedTokenMap: { [chainId: string]: WrappedTokenInfo[] } = groupBy(tokenMap, 'chainId')

  const tokenAddressMap = mapValues(groupedTokenMap, (tokenInfoList) =>
    mapValues(keyBy(tokenInfoList, key), (tokenInfo) => ({ token: tokenInfo, list })),
  ) as TokenAddressMap

  // add chain id item if not exist
  enumKeys(ChainId).forEach((chainId) => {
    if (!(ChainId[chainId] in tokenAddressMap)) {
      Object.defineProperty(tokenAddressMap, ChainId[chainId], {
        value: {},
      })
    }
  })

  listCache?.set(list, tokenAddressMap)
  return tokenAddressMap
}
