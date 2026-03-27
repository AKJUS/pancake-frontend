import { useAllTokens } from 'hooks/Tokens'
import {
  combinedTokenMapFromActiveUrlsAtom,
  sanitizeTokenInfos,
  selectorByUrlsAtom,
  useAllListsByChainId,
  useInactiveListUrls,
} from 'state/lists/hooks'
import { safeGetAddress } from 'utils/safeGetAddress'
import { isAddress } from 'viem'
import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { createFilterToken, WrappedTokenInfo } from '@pancakeswap/token-lists'
import { ChainId } from '@pancakeswap/chains'

/**
 * Searches inactive token lists for a given query and chainId.
 * Mirrors the logic used in CurrencySearch / CurrencySearchV2.
 * Returns WrappedTokenInfo[] (with logoURI) sorted with exact matches first.
 */
export function useSearchInactiveTokenLists(
  search: string | undefined,
  chainId: number,
  minResults = 10,
): WrappedTokenInfo[] {
  const lists = useAllListsByChainId(chainId)
  const inactiveUrls = useInactiveListUrls()
  const activeTokens = useAllTokens(chainId)

  return useMemo(() => {
    if (!search || search.trim().length === 0) return []
    const filterToken = createFilterToken(search, (address) => isAddress(address))
    const exactMatches: WrappedTokenInfo[] = []
    const rest: WrappedTokenInfo[] = []
    const addressSet: { [address: string]: true } = {}
    const trimmedSearch = search.toLowerCase().trim()

    for (const url of inactiveUrls) {
      const list = lists[url]?.current
      // eslint-disable-next-line no-continue
      if (!list) continue
      for (const tokenInfo of sanitizeTokenInfos(list)) {
        if (
          tokenInfo.chainId === chainId &&
          !(tokenInfo.address in activeTokens) &&
          !addressSet[tokenInfo.address] &&
          filterToken(tokenInfo)
        ) {
          const wrapped = new WrappedTokenInfo({
            ...tokenInfo,
            address: safeGetAddress(tokenInfo.address) || tokenInfo.address,
          })
          addressSet[wrapped.address] = true
          if (tokenInfo.name?.toLowerCase() === trimmedSearch || tokenInfo.symbol?.toLowerCase() === trimmedSearch) {
            exactMatches.push(wrapped)
          } else {
            rest.push(wrapped)
          }
        }
      }
    }
    return [...exactMatches, ...rest].slice(0, minResults)
  }, [activeTokens, chainId, inactiveUrls, lists, minResults, search])
}

/**
 * Multi-chain variant for use in NavbarSearch (can't call hooks per chain in a loop).
 * Searches inactive token lists across multiple chains for a given query.
 */
export function useSearchInactiveTokenListsMultiChain(
  search: string | undefined,
  chainIds: number[],
): WrappedTokenInfo[] {
  const allListStates = useAtomValue(selectorByUrlsAtom)
  const inactiveUrls = useInactiveListUrls()
  const activeMap = useAtomValue(combinedTokenMapFromActiveUrlsAtom)

  return useMemo(() => {
    if (!search || search.trim().length === 0) return []
    const chainIdSet = new Set(chainIds)
    const filterToken = createFilterToken(search, (address) => isAddress(address))
    const exactMatches: WrappedTokenInfo[] = []
    const rest: WrappedTokenInfo[] = []
    const addressSet = new Set<string>()
    const trimmedSearch = search.toLowerCase().trim()

    for (const url of inactiveUrls) {
      const list = allListStates[url]?.current
      // eslint-disable-next-line no-continue
      if (!list) continue
      for (const tokenInfo of sanitizeTokenInfos(list)) {
        if (!chainIdSet.has(tokenInfo.chainId)) continue
        const checksumAddr = safeGetAddress(tokenInfo.address) ?? tokenInfo.address
        const activeChainMap = (activeMap[tokenInfo.chainId as ChainId] ?? {}) as Record<string, unknown>
        if (activeChainMap[checksumAddr]) continue
        const key = `${tokenInfo.chainId}:${checksumAddr}`
        if (addressSet.has(key)) continue
        if (!filterToken(tokenInfo)) continue

        addressSet.add(key)
        const wrapped = new WrappedTokenInfo({ ...tokenInfo, address: checksumAddr })
        if (tokenInfo.name?.toLowerCase() === trimmedSearch || tokenInfo.symbol?.toLowerCase() === trimmedSearch) {
          exactMatches.push(wrapped)
        } else {
          rest.push(wrapped)
        }
      }
    }
    return [...exactMatches, ...rest]
  }, [search, chainIds, allListStates, inactiveUrls, activeMap])
}
