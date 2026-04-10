import { UnifiedChainId } from '@pancakeswap/chains'
import { Native, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { useQuery } from '@tanstack/react-query'
import {
  fetchTopTokensByProtocol,
  getExplorerChainName,
  getTopTokenProtocolsForChain,
} from 'components/NavbarSearch/utils'
import { useMemo } from 'react'
import { safeGetAddress } from 'utils'
import { useCombinedActiveList } from 'state/lists/hooks'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'

const MAX_POPULAR = 50 // Explorer API returns 50 top tokens

/**
 * Supports EVM chains, Explorer API doesn't support /top endpoint for Solana yet.
 * Available: 50 tokens per protocol on a chain, deduped and sorted by 24h volume across protocols.
 */
export function usePopularTokens(chainId?: UnifiedChainId, enabled?: boolean): UnifiedCurrency[] {
  const chainName = chainId !== undefined ? getExplorerChainName(chainId) : undefined
  const tokenListMap = useCombinedActiveList()

  // V2 + V3 + Infinity only
  const protocols = useMemo(() => (chainId !== undefined ? getTopTokenProtocolsForChain(chainId) : []), [chainId])

  const { data } = useQuery({
    queryKey: ['popular-tokens', chainName, protocols],
    queryFn: async ({ signal }) => {
      const protocolResults = await Promise.all(
        protocols.map((protocol) => fetchTopTokensByProtocol(chainName!, protocol, signal)),
      )
      // Merge: dedup by address, keep higher volumeUSD24h, sort desc
      const tokenMap = new Map<
        string,
        { id: string; symbol: string; name: string; decimals: number; volumeUSD: number }
      >()
      protocols.forEach((_, i) => {
        protocolResults[i].forEach((token) => {
          const volume = parseFloat(token.volumeUSD24h ?? '0')
          const key = token.id.toLowerCase()
          const existing = tokenMap.get(key)
          if (!existing || volume > existing.volumeUSD) {
            tokenMap.set(key, {
              id: token.id,
              symbol: token.symbol,
              name: token.name,
              decimals: token.decimals,
              volumeUSD: volume,
            })
          }
        })
      })
      return Array.from(tokenMap.values()).sort((a, b) => b.volumeUSD - a.volumeUSD)
    },
    enabled: Boolean(enabled && chainName && protocols.length > 0),
    staleTime: 300_000,
  })

  return useMemo(() => {
    if (!enabled || !data || chainId === undefined) return []
    const chainMap = (tokenListMap[chainId] ?? {}) as Record<string, { token: Token } | undefined>
    return data
      .map((t) => {
        const isNative = t.id.toLowerCase() === ZERO_ADDRESS.toLowerCase()
        if (isNative) return Native.onChain(chainId as number)

        const address = safeGetAddress(t.id)
        if (!address) return null

        // Use WrappedTokenInfo from the token list so logoURI is preserved
        return chainMap[address]?.token ?? null
      })
      .filter(Boolean)
      .slice(0, MAX_POPULAR) as UnifiedCurrency[]
  }, [data, chainId, enabled, tokenListMap])
}
