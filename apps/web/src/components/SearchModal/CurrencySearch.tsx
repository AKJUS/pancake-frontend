import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useUnifiedNativeCurrency } from 'hooks/useNativeCurrency'
import { useSolanaTokenList } from 'hooks/solana/useSolanaTokenList'
import { useSolanaTokenInfo } from 'hooks/solana/useSolanaTokenInfo'
import { useSolanaTokenBalances } from 'state/token/solanaTokenBalances'
import { useSolanaTokenPrices, useSolanaTokenPrice } from 'hooks/solana/useSolanaTokenPrice'
import { VariableSizeList } from 'react-window'
import { UpdaterByChainId } from 'state/lists/updater'
import { useAllTokenBalances } from 'state/wallet/hooks'
import { safeGetAddress } from 'utils'
import { safeGetSolanaAddress, safeGetUnifiedAddress } from 'utils/safeGetAddress'
import { getTokenAddressFromSymbolAlias } from 'utils/getTokenAlias'
import { formatUnits } from 'viem'

import { ChainId, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { useDebounce, useSortedTokensByQuery } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
/* eslint-disable no-restricted-syntax */
import { getTokenComparator, isSolWSolToken, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { useSearchInactiveTokenLists } from 'hooks/useSearchInactiveTokenLists'
import { createFilterToken } from '@pancakeswap/token-lists'
import {
  AutoColumn,
  Box,
  CogIcon,
  Column,
  Flex,
  IconButton,
  ModalCloseButton,
  ModalTitle,
  Text,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import { useAudioPlay } from '@pancakeswap/utils/user'
import { SPLToken, UnifiedToken, ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'

import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import useAddressBalance, { useMultichainNativeBalances } from 'hooks/useAddressBalance'
import { useQuery } from '@tanstack/react-query'
import { getNativeTokenPrices } from '@pancakeswap/price-api-sdk'
import { useBridgeAvailableChains } from 'views/Swap/Bridge/hooks'
import { getSearchTopTokensByChain } from '@pancakeswap/tokens'
import { useMultiChainTokenSearch } from 'hooks/useTokenSearch'
import { MULTI_CHAIN_LIST_URLS } from 'config/constants/lists'
import { useRecentlySwappedTokens } from 'state/transactions/hooks'
import { useCombinedActiveList } from '../../state/lists/hooks'
import { useAllTokens, useIsUserAddedToken, useToken } from '../../hooks/Tokens'
import { usePopularTokens } from './hooks/usePopularTokens'
import Row from '../Layout/Row'
import CommonBases, { BaseWrapper } from './CommonBases'
import RecentSwaps from './RecentSwaps'
import CurrencyList from './CurrencyList'
import { CurrencySearchInput } from './CurrencySearchInput'
import ImportRow from './ImportRow'
import SwapNetworkSelection from './SwapNetworkSelection'
import { getSwapSound } from './swapSound'
import { CommonBasesType } from './types'

interface CurrencySearchProps {
  selectedCurrency?: UnifiedCurrency | null
  onCurrencySelect: (currency: UnifiedCurrency) => void
  otherSelectedCurrency?: UnifiedCurrency | null
  showSearchInput?: boolean
  showCommonBases?: boolean
  commonBasesType?: CommonBasesType
  showImportView: () => void
  setImportToken: (token: UnifiedToken) => void
  height?: number
  tokensToShow?: Token[]
  showChainLogo?: boolean
  showSearchHeader?: boolean
  headerTitle?: React.ReactNode
  onDismiss?: () => void
  setSelectedChainId: (chainId: UnifiedChainId) => void
  selectedChainId?: UnifiedChainId
  mode?: string
  supportCrossChain?: boolean
  onSettingsClick?: () => void
  showNative?: boolean
  showMultichainBalances?: boolean
  enableMultichainSearch?: boolean
}

function CurrencySearch({
  selectedCurrency,
  onCurrencySelect,
  otherSelectedCurrency,
  showCommonBases,
  commonBasesType,
  showSearchInput = true,
  showImportView,
  setImportToken,
  height,
  tokensToShow,
  showChainLogo,
  showSearchHeader,
  onDismiss,
  headerTitle,
  setSelectedChainId,
  selectedChainId,
  mode,
  supportCrossChain = false,
  showNative: showNativeProp,
  onSettingsClick,
  showMultichainBalances = false,
  enableMultichainSearch = false,
}: CurrencySearchProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState<string>('')
  const debouncedQuery = useDebounce(getTokenAddressFromSymbolAlias(searchQuery, selectedChainId, searchQuery), 200)
  // refs for fixed size lists
  const fixedList = useRef<VariableSizeList>()

  const { isMobile } = useMatchBreakpoints()
  const [audioPlay] = useAudioPlay()
  const { chainId: activeChainId } = useActiveChainId()

  // === use all tokens and native currency related to the chainId

  // Use Solana token list if Solana is selected
  const isSolana = selectedChainId === NonEVMChainId.SOLANA
  const allTokens = useAllTokens(selectedChainId)
  const tokenListMap = useCombinedActiveList()
  const { tokenList: solanaTokens } = useSolanaTokenList()
  const native = useUnifiedNativeCurrency(selectedChainId)

  const { account: evmAccount, solanaAccount } = useAccountActiveChain() // useAccount is already imported and works for all chains
  const tokenAddresses = useMemo(() => solanaTokens.map((t) => t.address), [solanaTokens])
  // Solana balances integration
  const solanaBalances = useSolanaTokenBalances(solanaAccount, tokenAddresses)
  const tokenAddressesWithBalance = useMemo(
    () => tokenAddresses.filter((addr) => solanaBalances.balances.get(addr)?.gt(0)),
    [tokenAddresses, solanaBalances.balances],
  )
  const { data: solanaPrices } = useSolanaTokenPrices({
    mints: tokenAddressesWithBalance,
    enabled: isSolana && tokenAddressesWithBalance.length > 0,
  })

  const solanaSearchToken = useSolanaTokenInfo(isSolana && !tokensToShow ? debouncedQuery : undefined)
  const evmSearchToken = useToken(!tokensToShow ? debouncedQuery : undefined, selectedChainId)
  const searchToken = isSolana ? solanaSearchToken : evmSearchToken

  // if they input an address, use it
  const evmSearchTokenIsAdded = useIsUserAddedToken(evmSearchToken, selectedChainId)
  const searchTokenIsAdded = isSolana
    ? !!solanaTokens.find((t) => t.address === (searchToken as SPLToken | undefined)?.address)
    : evmSearchTokenIsAdded

  // if no results on main list, show option to expand into inactive (only when tokensToShow is not set)
  const filteredInactiveTokens = useSearchInactiveTokenLists(
    !tokensToShow ? debouncedQuery : undefined,
    selectedChainId as number,
  )

  const showNative: boolean = useMemo(() => {
    if (tokensToShow && !showNativeProp) return false
    if (!showNativeProp) return false
    const s = debouncedQuery.toLowerCase().trim()
    return native && (s === '' || native.symbol?.toLowerCase?.()?.indexOf(s) !== -1)
  }, [debouncedQuery, native, tokensToShow, showNativeProp])

  const filteredTokens = useMemo(() => {
    if (isSolana) {
      // Simple search for Solana tokens
      const s = debouncedQuery.toLowerCase().trim()
      const otherIsSol = isSolWSolToken(otherSelectedCurrency)
      return solanaTokens.filter(
        (token) =>
          (token.symbol.toLowerCase().includes(s) ||
            token.name?.toLowerCase().includes(s) ||
            token.address.toLowerCase() === s) &&
          !(otherIsSol && isSolWSolToken(token)),
      )
    }
    const filterToken = createFilterToken(debouncedQuery, (address) => Boolean(safeGetAddress(address)))
    // Only EVM tokens here
    return Object.values(tokensToShow || allTokens).filter(filterToken) as Token[]
  }, [tokensToShow, allTokens, debouncedQuery, isSolana, solanaTokens, otherSelectedCurrency])

  const queryTokens = useSortedTokensByQuery(filteredTokens as Token[], debouncedQuery)

  const { balances } = useAllTokenBalances(selectedChainId)

  const filteredSortedTokens: UnifiedCurrency[] = useMemo(() => {
    if (isSolana) {
      return [...filteredTokens].sort((a, b) => {
        const balA = solanaBalances.balances.get(a.address)?.dividedBy(10 ** (a.decimals || 1)) ?? BIG_ZERO
        const balB = solanaBalances.balances.get(b.address)?.dividedBy(10 ** (b.decimals || 1)) ?? BIG_ZERO
        const priceA = solanaPrices?.[a.address.toLowerCase()] ?? 0
        const priceB = solanaPrices?.[b.address.toLowerCase()] ?? 0
        const usdA = balA.multipliedBy(priceA)
        const usdB = balB.multipliedBy(priceB)
        if (!usdA.eq(usdB)) {
          return usdB.comparedTo(usdA)
        }
        const hasBalA = balA.gt(0)
        const hasBalB = balB.gt(0)
        if (hasBalA && hasBalB) {
          if (!balA.eq(balB)) {
            return balB.comparedTo(balA)
          }
        }
        if (hasBalA !== hasBalB) {
          return hasBalB ? 1 : -1
        }
        return 0
      })
    }
    const tokenComparator = getTokenComparator(balances ?? {})
    const hasSearchQuery = debouncedQuery && debouncedQuery.trim().length > 0

    // Only apply high-rank token sorting when there's a search query
    if (hasSearchQuery) {
      const tokenBalances = balances ?? {}
      const highRankTokens = getSearchTopTokensByChain(selectedChainId as ChainId)
      // Create a set of high-rank token addresses for quick lookup
      const highRankTokenAddresses = new Set(highRankTokens.map((token) => token.address.toLowerCase()))
      // Create custom comparator: prioritize balance rules, high-rank tokens come first when balance is equal
      const enhancedComparator = (tokenA: Token, tokenB: Token): number => {
        // First sort by balance (replicate getTokenComparator logic)
        const balanceA = tokenBalances[tokenA.address]
        const balanceB = tokenBalances[tokenB.address]

        // Balance comparison logic
        let balanceComp = 0
        if (balanceA && balanceB) {
          balanceComp = balanceA.greaterThan(balanceB) ? -1 : balanceA.equalTo(balanceB) ? 0 : 1
        } else if (balanceA && balanceA.greaterThan('0')) {
          balanceComp = -1
        } else if (balanceB && balanceB.greaterThan('0')) {
          balanceComp = 1
        }

        // If balance differs, return balance comparison result directly
        if (balanceComp !== 0) return balanceComp

        // When balance is equal, high-rank tokens come first
        const isHighRankA = highRankTokenAddresses.has(tokenA.address.toLowerCase())
        const isHighRankB = highRankTokenAddresses.has(tokenB.address.toLowerCase())
        if (isHighRankA && !isHighRankB) return -1
        if (!isHighRankA && isHighRankB) return 1

        // If both are high-rank or neither is high-rank, sort by symbol
        if (tokenA.symbol && tokenB.symbol) {
          return tokenA.symbol.toLowerCase() < tokenB.symbol.toLowerCase() ? -1 : 1
        }
        return tokenA.symbol ? -1 : tokenB.symbol ? -1 : 0
      }
      return [...(queryTokens as Token[])].sort(enhancedComparator)
    }

    // No search query, use default token comparator
    return [...(queryTokens as Token[])].sort(tokenComparator)
  }, [
    filteredTokens,
    queryTokens,
    balances,
    isSolana,
    solanaBalances.balances,
    solanaPrices,
    selectedChainId,
    debouncedQuery,
  ])

  // When in cross-chain output mode, multichain tokens must be limited to bridge-supported chains only.
  const isCrossChainOutput = supportCrossChain && mode === 'swap-currency-output'
  const { chains: supportedBridgeChains, loading: bridgeChainsLoading } = useBridgeAvailableChains({
    originChainId: activeChainId,
  })

  // === Global multichain token-list search ===
  // When searching with showMultichainBalances, also search token lists across all supported chains
  // so results appear even when the user doesn't hold the token.
  const tokenListChainIds = useMemo(() => {
    const currentChain = selectedChainId ?? activeChainId
    let ids = Object.keys(MULTI_CHAIN_LIST_URLS)
      .map(Number)
      .filter((id) => id !== currentChain)
    if (isCrossChainOutput && !bridgeChainsLoading) {
      ids = ids.filter((id) => supportedBridgeChains.includes(id))
    }
    return ids as UnifiedChainId[]
  }, [selectedChainId, activeChainId, isCrossChainOutput, bridgeChainsLoading, supportedBridgeChains])

  const shouldSearchMultichain = enableMultichainSearch && !tokensToShow && Boolean(debouncedQuery)
  const tokenListSearchResults = useMultiChainTokenSearch(
    shouldSearchMultichain ? debouncedQuery : undefined,
    tokenListChainIds,
  )

  // Solana tokens from the SPL token list — searched when user is NOT on Solana
  const solanaSearchResults: UnifiedCurrency[] = useMemo(() => {
    if (!shouldSearchMultichain || isSolana) return []
    if (isCrossChainOutput && !bridgeChainsLoading && !supportedBridgeChains.includes(NonEVMChainId.SOLANA)) return []
    const s = debouncedQuery.toLowerCase().trim()
    if (!s) return []
    return solanaTokens.filter(
      (t) => t.symbol.toLowerCase().includes(s) || t.name?.toLowerCase().includes(s) || t.address.toLowerCase() === s,
    )
  }, [
    shouldSearchMultichain,
    isSolana,
    isCrossChainOutput,
    bridgeChainsLoading,
    supportedBridgeChains,
    debouncedQuery,
    solanaTokens,
  ])

  // === Multichain balances addon ===
  // When enabled, fetches held tokens across all EVM chains and injects other-chain tokens sorted by USD value
  // alongside the current chain's tokens. If the Wallet API call fails, allChainBalances stays [] and no
  // extra tokens are shown — graceful degradation to normal single-chain behaviour.
  const { balances: evmChainBalances } = useAddressBalance(showMultichainBalances ? evmAccount : undefined, {
    includeSpam: false,
    enabled: Boolean(showMultichainBalances),
  })

  // Solana SPL token balances from the Wallet API — separate endpoint, same BalanceData shape.
  // Only fetched when a Solana wallet is connected.
  const { balances: solanaWalletBalances } = useAddressBalance(
    showMultichainBalances ? solanaAccount ?? undefined : undefined,
    { includeSpam: false, enabled: Boolean(showMultichainBalances && solanaAccount) },
  )

  const allChainBalances = useMemo(
    () => [...(evmChainBalances ?? []), ...(solanaWalletBalances ?? [])],
    [evmChainBalances, solanaWalletBalances],
  )

  // Native balances across all chains (eth_getBalance per chain in parallel).
  // Returns only chains where balance > 0. Graceful degradation: failed chains produce no row.
  const multichainNatives = useMultichainNativeBalances(
    showMultichainBalances ? evmAccount : undefined,
    showMultichainBalances ? solanaAccount ?? undefined : undefined,
    { enabled: Boolean(showMultichainBalances) },
  )

  // SOL unit price via WSOL proxy — useSolanaTokenPrice internally maps native SOL address → WSOL.
  // Used to sort native SOL correctly alongside SPL tokens by USD value.
  const { data: solUnitPrice } = useSolanaTokenPrice({
    mint: '11111111111111111111111111111111',
    enabled: Boolean(showMultichainBalances && solanaAccount),
  })

  // Batch-fetch EVM native prices (ETH, BNB, etc.) using the price-api-sdk.
  // Key is a sorted comma-joined string so useQuery key is stable across renders.
  const evmNativeChainIdsKey = useMemo(
    () =>
      multichainNatives
        .filter((n) => n.chainId !== NonEVMChainId.SOLANA)
        .map((n) => n.chainId)
        .sort()
        .join(','),
    [multichainNatives],
  )

  const { data: evmNativePrices } = useQuery({
    queryKey: ['evmNativePrices', evmNativeChainIdsKey] as const,
    queryFn: async () => {
      const chainIds = evmNativeChainIdsKey.split(',').filter(Boolean).map(Number) as ChainId[]
      return getNativeTokenPrices(chainIds)
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: evmNativeChainIdsKey.length > 0 && Boolean(showMultichainBalances),
  })

  // USD value map for native tokens. All entries in multichainNatives have non-zero balance (the
  // hook filters value > 0n), so even when prices are still loading we assign a small sentinel
  // (Number.EPSILON) to guarantee they sort above zero-balance tokens. Once the real price arrives
  // the sentinel is replaced with the actual USD total.
  const nativeUsdMap = useMemo(() => {
    const map = new Map<number, number>()
    multichainNatives.forEach((n) => {
      // formatUnits handles bigint safely (avoids Number.MAX_SAFE_INTEGER overflow for large balances)
      const nativeAmount = parseFloat(formatUnits(n.value, n.decimals))
      let unitPrice = 0

      if (n.chainId === NonEVMChainId.SOLANA) {
        unitPrice = solUnitPrice ?? 0
      } else {
        unitPrice = evmNativePrices?.get(n.chainId as ChainId) ?? 0
      }

      // Real USD if price is available, else a sentinel > 0 so non-zero natives sort above
      // zero-balance tokens even while prices are loading.
      map.set(n.chainId, unitPrice > 0 ? nativeAmount * unitPrice : Number.EPSILON)
    })
    return map
  }, [multichainNatives, solUnitPrice, evmNativePrices])

  // Map of "chainId-address" → totalUsd from the Wallet API (covers all chains including current).
  const balanceUsdMap = useMemo(() => {
    const map = new Map<string, number>()
    allChainBalances.forEach((b) => {
      const key = safeGetUnifiedAddress(b.chainId, b.token.address) ?? b.token.address.toLowerCase()
      map.set(`${b.chainId}-${key}`, b.price?.totalUsd ?? 0)
    })
    return map
  }, [allChainBalances])

  // Symbols of held native currencies (e.g. "SOL", "ETH") — used to filter bridged duplicates.
  const nativeSymbols = useMemo(
    () => new Set(multichainNatives.map((n) => n.currency.symbol?.toUpperCase())),
    [multichainNatives],
  )

  const multichainTokens: UnifiedCurrency[] = useMemo(() => {
    if (!showMultichainBalances || !allChainBalances.length || tokensToShow) return []

    return (
      allChainBalances
        .filter((b) => b.chainId !== (selectedChainId ?? activeChainId))
        .filter((b) => b.token.address !== ZERO_ADDRESS)
        // Require valid Solana addresses — Wallet API may return non-base58 format for native entries
        .filter((b) => b.chainId !== NonEVMChainId.SOLANA || Boolean(safeGetSolanaAddress(b.token.address)))
        // Filter bridged/wrapped tokens whose symbol matches a native shown via otherChainNatives
        // (e.g. Wormhole-bridged SOL on BSC, native SOL on Solana). Natives are shown separately.
        .filter((b) => !nativeSymbols.has(b.token.symbol?.toUpperCase()))
        // Only show tokens present in an active token list — keeps the multichain set consistent with
        // the single-chain path (useAllTokens) and silently drops LP tokens, which the Wallet API
        // returns as regular ERC-20s but have no isLP flag we can rely on.
        // Solana tokens live outside EVM token lists so they are passed through unchanged.
        .filter((b) => {
          if (b.chainId === NonEVMChainId.SOLANA) return true
          const checksummed = safeGetAddress(b.token.address)
          return checksummed !== undefined && (tokenListMap[b.chainId] ?? {})[checksummed] !== undefined
        })
        .filter((b) => !isCrossChainOutput || bridgeChainsLoading || supportedBridgeChains.includes(b.chainId))
        .filter((b) => {
          if (!debouncedQuery) return true
          const s = debouncedQuery.toLowerCase()
          return Boolean(
            b.token.symbol?.toLowerCase().includes(s) ||
              b.token.name?.toLowerCase().includes(s) ||
              b.token.address.toLowerCase() === s,
          )
        })
        .map((b) => {
          if (b.chainId === NonEVMChainId.SOLANA) {
            // SPLToken requires a programId. The Wallet API does not provide it, so we default to
            // the standard SPL Token program. Token-2022 tokens will get the wrong programId, which
            // only affects sortsBefore() ordering — not functionality.
            return new SPLToken({
              chainId: b.chainId,
              address: b.token.address,
              decimals: b.token.decimals,
              symbol: b.token.symbol,
              name: b.token.name,
              logoURI: b.token.logoURI ?? '',
              programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            })
          }
          return new Token(b.chainId, b.token.address as `0x${string}`, b.token.decimals, b.token.symbol, b.token.name)
        })
    )
  }, [
    showMultichainBalances,
    allChainBalances,
    selectedChainId,
    activeChainId,
    debouncedQuery,
    isCrossChainOutput,
    bridgeChainsLoading,
    supportedBridgeChains,
    nativeSymbols,
    tokenListMap,
    tokensToShow,
  ])

  // Other-chain native currencies (ETH, BNB, SOL, etc.) filtered and ready for display.
  // SOL uses solUnitPrice, while EVM native prices (ETH, BNB, etc.) are batch-fetched above.
  const otherChainNatives: UnifiedCurrency[] = useMemo(() => {
    if (!showMultichainBalances || !multichainNatives.length || tokensToShow) return []

    return multichainNatives
      .filter((n) => n.chainId !== (selectedChainId ?? activeChainId))
      .filter((n) => !isCrossChainOutput || bridgeChainsLoading || supportedBridgeChains.includes(n.chainId))
      .filter((n) => {
        if (!debouncedQuery) return true
        const s = debouncedQuery.toLowerCase()
        return n.currency.symbol?.toLowerCase().includes(s) || n.currency.name?.toLowerCase().includes(s)
      })
      .map((n) => n.currency)
  }, [
    showMultichainBalances,
    multichainNatives,
    selectedChainId,
    activeChainId,
    debouncedQuery,
    isCrossChainOutput,
    bridgeChainsLoading,
    supportedBridgeChains,
    tokensToShow,
  ])

  // Token-list-only multichain results: tokens found via token lists but NOT already in wallet balance results.
  // Capped at 5 per chain to avoid flooding the list with zero-balance results.
  const tokenListOnlyMultichain: UnifiedCurrency[] = useMemo(() => {
    if (!shouldSearchMultichain || (!tokenListSearchResults.length && !solanaSearchResults.length)) return []

    const existing = new Set<string>()
    for (const t of multichainTokens) {
      if (t.isToken) {
        const addr =
          safeGetUnifiedAddress(t.chainId, (t as UnifiedToken).address) ?? (t as UnifiedToken).address.toLowerCase()
        existing.add(`${t.chainId}:${addr}`)
      }
    }
    for (const t of filteredSortedTokens) {
      if (t.isToken) {
        const addr =
          safeGetUnifiedAddress(t.chainId, (t as UnifiedToken).address) ?? (t as UnifiedToken).address.toLowerCase()
        existing.add(`${t.chainId}:${addr}`)
      }
    }

    const perChainCount = new Map<number, number>()
    const MAX_PER_CHAIN = 5
    return [...tokenListSearchResults, ...solanaSearchResults].filter((t) => {
      if (!t.isToken) return false
      const addr =
        safeGetUnifiedAddress(t.chainId, (t as UnifiedToken).address) ?? (t as UnifiedToken).address.toLowerCase()
      if (existing.has(`${t.chainId}:${addr}`)) return false
      const count = perChainCount.get(t.chainId) ?? 0
      if (count >= MAX_PER_CHAIN) return false
      perChainCount.set(t.chainId, count + 1)
      return true
    })
  }, [shouldSearchMultichain, tokenListSearchResults, solanaSearchResults, multichainTokens, filteredSortedTokens])

  // Merge and sort by USD value so other-chain tokens appear inline with current-chain tokens.
  // Native tokens (isToken: false) sort with USD=0 and appear after ERC-20s with USD values.
  // Token-list-only results (no balance) get USD=0 and naturally sort after balance-holding tokens.
  const combinedCurrencies: UnifiedCurrency[] = useMemo(() => {
    const hasBalanceExtra = showMultichainBalances && (multichainTokens.length > 0 || otherChainNatives.length > 0)
    const hasSearchExtra = tokenListOnlyMultichain.length > 0
    if (!hasBalanceExtra && !hasSearchExtra) return filteredSortedTokens

    return [...filteredSortedTokens, ...multichainTokens, ...otherChainNatives, ...tokenListOnlyMultichain]
      .filter((c) => !(c.isToken && (c as UnifiedToken).address === ZERO_ADDRESS))
      .sort((a, b) => {
        let aUsd: number
        let bUsd: number
        if (a.isToken) {
          const aRaw = (a as UnifiedToken).address
          const aAddress = safeGetUnifiedAddress(a.chainId, aRaw) ?? aRaw.toLowerCase()
          aUsd = balanceUsdMap.get(`${a.chainId}-${aAddress}`) ?? 0
        } else {
          aUsd = nativeUsdMap.get(a.chainId) ?? 0
        }
        if (b.isToken) {
          const bRaw = (b as UnifiedToken).address
          const bAddress = safeGetUnifiedAddress(b.chainId, bRaw) ?? bRaw.toLowerCase()
          bUsd = balanceUsdMap.get(`${b.chainId}-${bAddress}`) ?? 0
        } else {
          bUsd = nativeUsdMap.get(b.chainId) ?? 0
        }
        return bUsd - aUsd
      })
  }, [
    filteredSortedTokens,
    multichainTokens,
    otherChainNatives,
    tokenListOnlyMultichain,
    balanceUsdMap,
    nativeUsdMap,
    showMultichainBalances,
  ])

  const isWalletDisconnected = !evmAccount && !solanaAccount
  const popularTokens = usePopularTokens(selectedChainId, isWalletDisconnected && !debouncedQuery && !tokensToShow)
  const recentTokens = useRecentlySwappedTokens()

  const handleCurrencySelect = useCallback(
    (currency: UnifiedCurrency) => {
      onCurrencySelect(currency)
      if (audioPlay) {
        getSwapSound().play()
      }
    },
    [audioPlay, onCurrencySelect],
  )

  // manage focus on modal show
  const inputRef = useRef<HTMLInputElement>()

  useEffect(() => {
    if (!isMobile) inputRef.current?.focus()
  }, [isMobile])

  const handleOnInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value
    const checksummedInput = safeGetAddress(input)
    setSearchQuery(checksummedInput || input)
    fixedList.current?.scrollTo(0)
  }, [])

  const handleEnter = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const s = debouncedQuery.toLowerCase().trim()
        if (!isSolana && showNativeProp && s === native.symbol.toLowerCase().trim()) {
          handleCurrencySelect(native)
        } else if (combinedCurrencies.length > 0) {
          if (
            isSolana ||
            combinedCurrencies[0].symbol?.toLowerCase() === debouncedQuery.trim().toLowerCase() ||
            combinedCurrencies.length === 1
          ) {
            handleCurrencySelect(isSolana ? (combinedCurrencies[0] as any) : combinedCurrencies[0])
          }
        }
      }
    },
    [debouncedQuery, combinedCurrencies, handleCurrencySelect, native, isSolana, showNativeProp],
  )

  const hasFilteredInactiveTokens = Boolean(filteredInactiveTokens?.length)

  const getCurrencyListRows = useCallback(() => {
    // Don't show import functionality when tokensToShow is provided
    if (!tokensToShow && searchToken && !searchTokenIsAdded && !hasFilteredInactiveTokens) {
      return (
        <Column style={{ padding: '20px 0', height: '100%' }}>
          <ImportRow
            chainId={selectedChainId}
            onCurrencySelect={handleCurrencySelect}
            token={searchToken}
            showImportView={showImportView}
            setImportToken={setImportToken}
          />
        </Column>
      )
    }

    return Boolean(combinedCurrencies?.length) || hasFilteredInactiveTokens || showNative ? (
      <Box mx="-24px" mt="20px" height="100%">
        <CurrencyList
          height={
            isMobile
              ? showCommonBases && (commonBasesType !== CommonBasesType.SWAP || recentTokens.length > 0)
                ? height || 250
                : height
                ? height + 80
                : 350
              : 340
          }
          showNative={showNative}
          currencies={combinedCurrencies}
          inactiveCurrencies={
            isSolana
              ? filteredInactiveTokens
              : filteredInactiveTokens.filter(
                  (t) => t && typeof t === 'object' && 'equals' in t && typeof t.equals === 'function',
                )
          }
          breakIndex={
            Boolean(filteredInactiveTokens?.length) && combinedCurrencies ? combinedCurrencies.length : undefined
          }
          onCurrencySelect={handleCurrencySelect}
          otherCurrency={otherSelectedCurrency}
          selectedCurrency={selectedCurrency}
          fixedListRef={fixedList}
          showImportView={showImportView}
          setImportToken={setImportToken}
          showChainLogo={showMultichainBalances || enableMultichainSearch || showChainLogo}
          chainId={selectedChainId}
          popularTokens={popularTokens}
        />
      </Box>
    ) : (
      <Column style={{ padding: '20px', height: '100%' }}>
        <Text color="textSubtle" textAlign="center" mb="20px">
          {t('No results found.')}
        </Text>
      </Column>
    )
  }, [
    filteredInactiveTokens,
    combinedCurrencies,
    handleCurrencySelect,
    hasFilteredInactiveTokens,
    otherSelectedCurrency,
    searchToken,
    searchTokenIsAdded,
    selectedCurrency,
    setImportToken,
    showNative,
    showImportView,
    t,
    showCommonBases,
    isMobile,
    height,
    showChainLogo,
    showMultichainBalances,
    selectedChainId,
    isSolana,
    tokensToShow,
    popularTokens,
  ])

  return (
    <>
      {selectedChainId ? <UpdaterByChainId chainId={selectedChainId} /> : null}
      {showSearchHeader && (
        <ModalTitle my="12px" display="flex" flexDirection="column">
          <Flex justifyContent="space-between" alignItems="center" width="100%">
            <Text fontSize="20px" mr="16px" bold>
              {headerTitle}
            </Text>
            <Box mr="-16px">
              <ModalCloseButton onDismiss={onDismiss} padding="0" />
            </Box>
          </Flex>
          <Flex width="100%" alignItems="center">
            <CurrencySearchInput
              autoFocus={false}
              inputRef={inputRef}
              handleEnter={handleEnter}
              onInput={handleOnInput}
              compact
            />

            {onSettingsClick && (
              <IconButton onClick={onSettingsClick} variant="text" scale="sm" ml="8px">
                <BaseWrapper style={{ padding: '6px' }}>
                  <CogIcon height={24} width={24} color="textSubtle" />
                </BaseWrapper>
              </IconButton>
            )}
          </Flex>
        </ModalTitle>
      )}
      <AutoColumn gap="16px">
        {showSearchInput && !showSearchHeader && (
          <Row>
            <CurrencySearchInput inputRef={inputRef} handleEnter={handleEnter} onInput={handleOnInput} />
          </Row>
        )}
        {supportCrossChain ? (
          <SwapNetworkSelection
            chainId={selectedChainId}
            onSelect={(currentChainId) => setSelectedChainId(currentChainId)}
            isDependent={mode === 'swap-currency-output'}
          />
        ) : null}

        {showCommonBases &&
          (commonBasesType === CommonBasesType.SWAP ? (
            <RecentSwaps
              onSelect={handleCurrencySelect}
              selectedCurrency={selectedCurrency}
              supportCrossChain={supportCrossChain}
              allowedChainIds={isCrossChainOutput ? [activeChainId!, ...supportedBridgeChains] : undefined}
            />
          ) : (
            <CommonBases
              supportCrossChain={supportCrossChain}
              chainId={selectedChainId}
              onSelect={handleCurrencySelect}
              selectedCurrency={selectedCurrency}
              commonBasesType={commonBasesType}
              disabledCurrencies={isSolWSolToken(otherSelectedCurrency?.wrapped) ? [native] : undefined}
              showNative={showNativeProp}
            />
          ))}
      </AutoColumn>
      {getCurrencyListRows()}
    </>
  )
}

export default CurrencySearch
