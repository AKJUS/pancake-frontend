import { useMemo } from 'react'
import { isAddress } from 'viem'
import { useAtomValue } from 'jotai'
import { ChainId, UnifiedChainId } from '@pancakeswap/chains'
import { useSortedTokensByQuery } from '@pancakeswap/hooks'
import { Token } from '@pancakeswap/sdk'
import { createFilterToken, WrappedTokenInfo } from '@pancakeswap/token-lists'
import { useAllTokens } from 'hooks/Tokens'
import { useTokenComparator } from 'hooks/useTokenComparator'
import { combinedTokenMapFromActiveUrlsAtom } from 'state/lists/hooks'
import { safeGetAddress } from 'utils/safeGetAddress'
import { useSearchInactiveTokenLists, useSearchInactiveTokenListsMultiChain } from './useSearchInactiveTokenLists'

/**
 * Single-chain token search — mirrors the filteredSortedTokens + filteredInactiveTokens
 * logic from CurrencySearch / CurrencySearchV2. Safe to reuse in any single-chain context.
 */
export function useFilteredSortedTokens(
  query: string,
  chainId: number,
  options?: { tokensToShow?: Token[]; invertSearchOrder?: boolean },
): {
  filteredSortedTokens: Token[]
  filteredInactiveTokens: WrappedTokenInfo[]
} {
  const { tokensToShow, invertSearchOrder = false } = options ?? {}
  const allTokens = useAllTokens(chainId)

  const filteredTokens = useMemo(() => {
    const filterToken = createFilterToken(query, (address) => isAddress(address))
    return Object.values(tokensToShow ?? allTokens).filter(filterToken) as Token[]
  }, [tokensToShow, allTokens, query])

  const queryTokens = useSortedTokensByQuery(filteredTokens, query)
  const tokenComparator = useTokenComparator(invertSearchOrder, chainId)

  const filteredSortedTokens = useMemo(() => [...queryTokens].sort(tokenComparator), [queryTokens, tokenComparator])

  const filteredInactiveTokens = useSearchInactiveTokenLists(tokensToShow ? undefined : query, chainId)

  return { filteredSortedTokens, filteredInactiveTokens }
}

/**
 * Multi-chain token search — searches active + inactive token lists across
 * multiple chains for a given query. Returns combined, deduplicated WrappedTokenInfo[]
 * with active-list matches first, then inactive-list matches.
 */
export function useMultiChainTokenSearch(query: string | undefined, chainIds: UnifiedChainId[]): WrappedTokenInfo[] {
  const activeMap = useAtomValue(combinedTokenMapFromActiveUrlsAtom)
  const inactiveMatches = useSearchInactiveTokenListsMultiChain(query, chainIds)

  const activeMatches = useMemo(() => {
    if (!query || !query.trim()) return []
    const chainIdSet = new Set(chainIds)
    const filterToken = createFilterToken(query, (address) => isAddress(address))
    const results: WrappedTokenInfo[] = []
    const seen = new Set<string>()

    for (const chainId of chainIdSet) {
      const chainMap = (activeMap[chainId as ChainId] ?? {}) as Record<string, { token: WrappedTokenInfo }>
      for (const { token } of Object.values(chainMap)) {
        if (!filterToken(token)) continue
        const address = safeGetAddress(token.address) ?? token.address
        const key = `${chainId}:${address}`
        if (seen.has(key)) continue
        seen.add(key)
        results.push(token)
      }
    }
    return results
  }, [activeMap, chainIds, query])

  return useMemo(() => {
    if (!query || !query.trim()) return []
    const seenKeys = new Set(activeMatches.map((t) => `${t.chainId}:${t.address}`))
    const deduplicatedInactive = inactiveMatches.filter(
      (t) => !seenKeys.has(`${t.chainId}:${safeGetAddress(t.address) ?? t.address}`),
    )
    return [...activeMatches, ...deduplicatedInactive]
  }, [activeMatches, inactiveMatches, query])
}
