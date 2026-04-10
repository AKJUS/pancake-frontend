import { useMemo } from 'react'

import { CHAIN_QUERY_NAME } from 'config/chains'
import { chainIdToExplorerInfoChainName, explorerApiClient } from 'state/info/api/client'
import { multiChainName, multiChainPaths } from 'state/info/constant'
import { InfoDataSource } from 'state/info/types'
import { getPoolDetailPageLink } from 'utils/getPoolLink'
import { getTokenInfoPath } from 'state/info/utils'
import { PoolInfo } from 'state/farmsV4/state/type'
import atomWithStorageWithErrorCatch from 'utils/atomWithStorageWithErrorCatch'
import { getTokenNameAlias, getTokenSymbolAlias, getCurrencySymbol } from 'utils/getTokenAlias'
import { safeGetAddress } from 'utils/safeGetAddress'
import { calculateInfiFeePercent } from 'utils/computeSmartTradePriceBreakdown'
import { isInfinityProtocol } from 'utils/protocols'
import { useFarmSearch } from 'views/universalFarms/hooks/useFarmSearch'

import { ChainId, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { getCurrencyAddress, NATIVE } from '@pancakeswap/sdk'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { FarmV4SupportedChainId, Protocol } from '@pancakeswap/farms'
import { InfinityBinPool, InfinityClPool } from '@pancakeswap/smart-router'
import { CAKE } from '@pancakeswap/tokens'
import { useQueries } from '@tanstack/react-query'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SearchTab = 'all' | 'tokens' | 'pools'

export type TokenSearchResult = {
  id: string
  kind: 'token'
  symbol: string
  name: string
  chainId: UnifiedChainId
  address: string
  volumeUSD: number
  protocol?: 'infinity' | 'v3' | 'v2'
  isNative?: boolean
  logoURI?: string
}

export type PoolSearchResult = {
  id: string
  kind: 'pool'
  pairSymbol: string
  chainId: UnifiedChainId
  address: string
  token0Address: string
  token1Address: string
  volumeUSD: number
  protocol?: TopPoolApi['protocol']
  feeTier?: number
  isDynamicFee?: boolean
}

export type SearchResult = TokenSearchResult | PoolSearchResult

export type TopTokenApi = {
  id: string
  symbol: string
  name: string
  decimals: number
  volumeUSD24h?: string | null
}

export type TopPoolApi = {
  id: string
  protocol?: 'v2' | 'v3' | 'stable' | 'infinityBin' | 'infinityCl' | 'infinityStable'
  token0: { id: string; symbol: string }
  token1: { id: string; symbol: string }
  volumeUSD24h?: string
  feeTier?: number
  protocolFee?: number
  isDynamicFee?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const NAVBAR_SEARCH_RECENT_ITEMS_KEY = 'navbarSearchRecentItems'
export const RECENT_SEARCH_STORAGE_LIMIT = 20
export const RECENT_SEARCH_DISPLAY_LIMIT = 3
export const ALL_TAB_DISPLAY_LIMIT = 5
export const SEARCH_RESULTS_PAGE_SIZE = 20
export const SEARCH_DEBOUNCE_MS = 300
export const CHAIN_TOP_FETCH_STAGGER_MS = 1000
export const TOP_TOKEN_PROTOCOLS = ['infinity', 'v3', 'v2'] as const
export const INFINITY_PROTOCOLS = ['infinityCl', 'infinityBin', 'infinityStable'] as const
export const INFINITY_SUPPORTED_CHAIN_IDS: UnifiedChainId[] = [56, 8453]
export const SOL_CHAIN_ID: UnifiedChainId = NonEVMChainId.SOLANA
export const navbarSearchRecentItemsAtom = atomWithStorageWithErrorCatch<SearchResult[]>(
  NAVBAR_SEARCH_RECENT_ITEMS_KEY,
  [],
)

export const NETWORK_SHORT_LABELS: Partial<Record<UnifiedChainId, string>> = {
  56: 'BNB',
  1: 'ETH',
  324: 'ZK',
  42161: 'ARB',
  59144: 'LINEA',
  8453: 'BASE',
  204: 'OP',
  [SOL_CHAIN_ID]: 'SOL',
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

export function getExplorerChainName(chainId: UnifiedChainId) {
  return chainIdToExplorerInfoChainName[chainId as keyof typeof chainIdToExplorerInfoChainName]
}

export function getNetworkShortLabel(chainId: UnifiedChainId) {
  return NETWORK_SHORT_LABELS[chainId] ?? multiChainName[chainId] ?? ''
}

export function getSwapPath(item: SearchResult) {
  const chainQueryName = CHAIN_QUERY_NAME[item.chainId]

  if (item.kind === 'token') {
    if (item.isNative || item.address === ZERO_ADDRESS) {
      const native = NATIVE[item.chainId as ChainId]
      const cakeAddress = CAKE[item.chainId as ChainId]?.address
      const inputCurrency = cakeAddress ?? 'CAKE'
      const outputCurrency = native?.symbol ?? item.symbol
      return `/swap?inputCurrency=${inputCurrency}&outputCurrency=${outputCurrency}&chainOut=${chainQueryName}`
    }

    return `/swap?outputCurrency=${item.address}&chainOut=${chainQueryName}`
  }

  return `/swap?inputCurrency=${item.token0Address}&outputCurrency=${item.token1Address}&chainOut=${chainQueryName}`
}

export async function getDetailPath(item: SearchResult) {
  if (item.kind === 'token') {
    if (item.protocol === 'infinity') {
      const chainPath = multiChainPaths[item.chainId as ChainId] ?? ''
      const chainQuery = CHAIN_QUERY_NAME[item.chainId]
      return `/info/infinity${chainPath}/tokens/${item.address}?chain=${chainQuery}`
    }

    if (item.protocol === 'v2') {
      return getTokenInfoPath(item.chainId as ChainId, item.address as `0x${string}`, InfoDataSource.V2)
    }

    if (item.protocol === 'v3') {
      return getTokenInfoPath(item.chainId as ChainId, item.address as `0x${string}`, InfoDataSource.V3)
    }

    // Native token without an explicit protocol — use infinity on supported chains.
    // Infinity represents native tokens with ZERO_ADDRESS, not WNATIVE address.
    if (item.isNative && isInfinitySupportedChain(item.chainId)) {
      const chainPath = multiChainPaths[item.chainId as ChainId] ?? ''
      const chainQuery = CHAIN_QUERY_NAME[item.chainId]
      return `/info/infinity${chainPath}/tokens/${ZERO_ADDRESS}?chain=${chainQuery}`
    }

    // protocol is undefined — fetch both and pick the one with higher 24h volume
    const chainName = getExplorerChainName(item.chainId)

    if (chainName) {
      try {
        const [v2Result, v3Result] = await Promise.allSettled([
          explorerApiClient.GET('/cached/tokens/v2/{chainName}/{address}', {
            params: { path: { chainName, address: item.address } },
          }),
          explorerApiClient.GET('/cached/tokens/v3/{chainName}/{address}', {
            params: { path: { chainName, address: item.address } },
          }),
        ])
        const v2Vol = v2Result.status === 'fulfilled' ? Number(v2Result.value.data?.volumeUSD24h ?? 0) : 0
        const v3Vol = v3Result.status === 'fulfilled' ? Number(v3Result.value.data?.volumeUSD24h ?? 0) : 0
        const dataSource = v2Vol > v3Vol ? InfoDataSource.V2 : InfoDataSource.V3
        return getTokenInfoPath(item.chainId as ChainId, item.address as `0x${string}`, dataSource)
      } catch {
        // fall through to V3 default
      }
    }

    return getTokenInfoPath(item.chainId as ChainId, item.address as `0x${string}`, InfoDataSource.V3)
  }

  return getPoolDetailPageLink({ chainId: item.chainId, protocol: item.protocol, lpAddress: item.address } as any)
}

export function getSearchTitle(item: SearchResult) {
  return item.kind === 'token' ? item.symbol : item.pairSymbol
}

export function getSearchSubtitle(item: SearchResult) {
  return item.kind === 'token' ? item.name : item.protocol ?? ''
}

export function getSearchRank(item: SearchResult, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 0

  const title = getSearchTitle(item).toLowerCase()
  const subtitle = getSearchSubtitle(item).toLowerCase()
  const address = item.address.toLowerCase()

  if (title === normalizedQuery) return 0
  if (title.startsWith(normalizedQuery)) return 1
  if (subtitle === normalizedQuery) return 2
  if (subtitle.startsWith(normalizedQuery)) return 3
  if (address === normalizedQuery) return 4
  return 5
}

export function sortSearchResults<T extends SearchResult>(items: T[], query: string) {
  return [...items].sort((a, b) => {
    const rankDiff = getSearchRank(a, query) - getSearchRank(b, query)
    if (rankDiff !== 0) return rankDiff
    if (b.volumeUSD !== a.volumeUSD) return b.volumeUSD - a.volumeUSD
    return getSearchTitle(a).localeCompare(getSearchTitle(b))
  })
}

export function isStoredSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== 'object') return false

  const item = value as Partial<SearchResult>

  if (item.kind === 'token') {
    return Boolean(item.id && item.symbol && item.name && item.chainId && item.address)
  }

  if (item.kind === 'pool') {
    return Boolean(
      item.id && item.pairSymbol && item.chainId && item.address && item.token0Address && item.token1Address,
    )
  }

  return false
}

export function buildTokenSearchResult(
  chainId: UnifiedChainId,
  token: TopTokenApi,
  protocol?: TokenSearchResult['protocol'],
): TokenSearchResult {
  const address = safeGetAddress(token.id) ?? token.id
  return {
    id: `${chainId}:${address}:${protocol ?? ''}`,
    kind: 'token',
    symbol: getTokenSymbolAlias(address, chainId, token.symbol) ?? token.symbol,
    name: getTokenNameAlias(address, chainId, token.name) ?? token.name ?? '',
    chainId,
    address,
    volumeUSD: Number(token.volumeUSD24h ?? 0),
    protocol,
  }
}

export async function fetchTopTokensByProtocol(
  chainName: ReturnType<typeof getExplorerChainName>,
  protocol: (typeof TOP_TOKEN_PROTOCOLS)[number],
  signal?: AbortSignal,
): Promise<TopTokenApi[]> {
  if (!chainName) return [] as TopTokenApi[]

  switch (protocol) {
    case 'infinity':
      return (
        (
          await explorerApiClient.GET('/cached/tokens/infinity/{chainName}/list/top', {
            signal,
            params: { path: { chainName } },
          })
        ).data ?? []
      )
    case 'v3':
      return (
        (
          await explorerApiClient.GET('/cached/tokens/v3/{chainName}/list/top', {
            signal,
            params: { path: { chainName } },
          })
        ).data ?? []
      )
    case 'v2':
      return (
        (
          await explorerApiClient.GET('/cached/tokens/v2/{chainName}/list/top', {
            signal,
            params: { path: { chainName } },
          })
        ).data ?? []
      )
    default:
      return []
  }
}

export function isInfinitySupportedChain(chainId: UnifiedChainId) {
  return INFINITY_SUPPORTED_CHAIN_IDS.includes(chainId)
}

export function getTopTokenProtocolsForChain(chainId: UnifiedChainId) {
  return TOP_TOKEN_PROTOCOLS.filter((protocol) => {
    if (protocol === 'infinity') return isInfinitySupportedChain(chainId)
    if (protocol === 'v2') return chainId !== SOL_CHAIN_ID
    return true
  })
}

export function delayWithSignal(ms: number, signal?: AbortSignal) {
  if (!ms) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }

    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)

    const handleAbort = () => {
      window.clearTimeout(timeoutId)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

export function poolInfoToSearchResult(pool: PoolInfo): PoolSearchResult {
  const address = pool.lpAddress ?? pool.poolId ?? pool.stableSwapAddress ?? ''
  const token0Address = getCurrencyAddress(pool.token0) ?? ''
  const token1Address = getCurrencyAddress(pool.token1) ?? ''
  const resolvedAddress = safeGetAddress(address) ?? address
  return {
    id: `${pool.chainId}:${resolvedAddress}`,
    kind: 'pool',
    pairSymbol: `${getCurrencySymbol(pool.token0)} / ${getCurrencySymbol(pool.token1)}`,
    chainId: pool.chainId as UnifiedChainId,
    address: resolvedAddress,
    token0Address: safeGetAddress(token0Address) ?? token0Address,
    token1Address: safeGetAddress(token1Address) ?? token1Address,
    volumeUSD: Number(pool.vol24hUsd ?? 0),
    protocol: pool.protocol as PoolSearchResult['protocol'],
    feeTier: (() => {
      if (isInfinityProtocol(pool.protocol as Protocol) && pool.feeTier !== undefined) {
        const protocolFee = (pool.farm?.pool as InfinityClPool | InfinityBinPool | undefined)?.protocolFee
        return calculateInfiFeePercent(pool.feeTier, protocolFee).totalFee
      }
      return pool.feeTier
    })(),
    isDynamicFee: pool.isDynamicFee,
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useNavbarTopTokens(chainIds: UnifiedChainId[], enabled: boolean) {
  return useQueries({
    queries: chainIds.map((chainId, index) => ({
      queryKey: ['navbarSearch', 'topTokens', chainId],
      queryFn: async ({ signal }: { signal?: AbortSignal }) => {
        const chainName = getExplorerChainName(chainId)
        if (!chainName) return [] as TokenSearchResult[]

        await delayWithSignal(index * CHAIN_TOP_FETCH_STAGGER_MS, signal)
        const protocols = getTopTokenProtocolsForChain(chainId)

        const protocolResults = await Promise.all(
          protocols.map((protocol) => fetchTopTokensByProtocol(chainName, protocol, signal)),
        )

        const tokenMap = new Map<string, TokenSearchResult>()
        protocols.forEach((protocol, i) => {
          protocolResults[i].forEach((token) => {
            const result = buildTokenSearchResult(chainId, token, protocol)
            const dedupeKey = `${chainId}:${result.address}`
            const existing = tokenMap.get(dedupeKey)

            if (existing) {
              if (result.volumeUSD > existing.volumeUSD) {
                tokenMap.set(dedupeKey, result)
              }
              return
            }

            tokenMap.set(dedupeKey, result)
          })
        })

        return Array.from(tokenMap.values()).sort((a, b) => b.volumeUSD - a.volumeUSD)
      },
      enabled: enabled && Boolean(getExplorerChainName(chainId)),
      staleTime: 300_000,
      refetchOnWindowFocus: false,
    })),
    combine(results) {
      return {
        data: results.flatMap((result) => result.data ?? []),
        isLoading: results.some((result) => result.isLoading),
      }
    },
  })
}

export function useNavbarFarmSearch(query: string, chainIds: UnifiedChainId[], enabled: boolean) {
  const params = useMemo(
    () => ({ enabled, queries: { keywords: query, chains: chainIds as FarmV4SupportedChainId[] } }),
    [enabled, query, chainIds],
  )
  return useFarmSearch(params)
}
