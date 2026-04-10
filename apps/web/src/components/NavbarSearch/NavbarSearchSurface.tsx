import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { TokenPairLogo } from 'components/TokenImage'
import { ASSET_CDN } from 'config/constants/endpoints'
import { useAccountActiveChain } from 'hooks/useAccountActiveChain'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useAtom, useAtomValue } from 'jotai'
import { useRouter } from 'next/router'
import { useMultiChainTokenSearch } from 'hooks/useTokenSearch'
import { useSolanaTokenList } from 'hooks/solana/useSolanaTokenList'
import { UpdaterByChainId } from 'state/lists/updater'
import { combinedTokenMapFromActiveUrlsAtom } from 'state/lists/hooks'
import { useAllChainsOpts } from 'views/universalFarms/hooks/useMultiChains'

import { ChainId, UnifiedChainId } from '@pancakeswap/chains'
import { useDebounce } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { Native, NATIVE, Token, WNATIVE } from '@pancakeswap/sdk'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import {
  ArrowFirstIcon,
  ArrowForwardIcon,
  AtomBox,
  Box,
  ChevronDownIcon,
  Loading,
  CopyIcon,
  EllipsisIcon,
  FeeTier,
  HistoryIcon,
  ModalV2,
  ModalWrapper,
  PoolsChartIcon,
  SearchIcon,
  Text,
  TokensOnPCSIcon,
  TooltipText,
  TradeIcon,
  useMatchBreakpoints,
  useToast,
  useTooltip,
  WarningIcon,
  Flex,
} from '@pancakeswap/uikit'
import { INFINITY_STABLE_POOL_FEE_DENOMINATOR } from '@pancakeswap/infinity-stable-sdk'
import { INetworkProps, NetworkFilter, type NetworkFilterHandle, TokenOverview } from '@pancakeswap/widgets-internal'

import { getTokenNameAlias, getTokenSymbolAlias } from 'utils/getTokenAlias'
import { safeGetAddress } from 'utils/safeGetAddress'
import { useWalletPanel } from '../Menu/WalletPanelContext'

import {
  ALL_TAB_DISPLAY_LIMIT,
  RECENT_SEARCH_DISPLAY_LIMIT,
  RECENT_SEARCH_STORAGE_LIMIT,
  SEARCH_DEBOUNCE_MS,
  SEARCH_RESULTS_PAGE_SIZE,
  SOL_CHAIN_ID,
  getDetailPath,
  getExplorerChainName,
  getNetworkShortLabel,
  getSwapPath,
  isStoredSearchResult,
  navbarSearchRecentItemsAtom,
  poolInfoToSearchResult,
  sortSearchResults,
  useNavbarFarmSearch,
  useNavbarTopTokens,
  type SearchResult,
  type SearchTab,
  type TokenSearchResult,
} from './utils'

import {
  ActionMenu,
  ActionMenuButton,
  ChainStackTrigger,
  ClearButton,
  FiltersRow,
  FiltersStack,
  FilterButton,
  Kbd,
  ModalGrabber,
  MoreButton,
  NetworkBadge,
  NetworkBadgeImage,
  NetworkFilterDropdown,
  NetworkOverflowBadge,
  NetworkStack,
  PoolOverviewWrap,
  ResultList,
  ResultMeta,
  ResultRow,
  ResultSubLabel,
  ResultTitleRow,
  SearchField,
  SearchFieldContainer,
  SearchInput,
  SearchModalCard,
  SearchPanelBody,
  SearchPanelHeader,
  SearchRoot,
  Section,
  SectionTitle,
  TriggerButton,
} from './styled'

import { PoolCautionTag } from './PoolCautionTag'
import { SearchTokenLogo } from './SearchTokenLogo'

export const NavbarSearchSurface: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { chainId: activeChainId } = useActiveChainId()
  const { account: evmAccount, solanaAccount, isWrongNetwork } = useAccountActiveChain()
  const { isMobile } = useMatchBreakpoints()
  const isCompactTrigger = isMobile // compact icon trigger for xs/sm only
  const { openWalletPanel } = useWalletPanel()
  const allChainsOpts = useAllChainsOpts()
  const allNetworkIds = useMemo(() => allChainsOpts.map((chain) => chain.value as UnifiedChainId), [allChainsOpts])
  const [open, setOpen] = useState(false)
  const { toastSuccess } = useToast()
  const [draftQuery, setDraftQuery] = useState('')
  const [activeTab, setActiveTab] = useState<SearchTab>('all')
  const [selectedNetworks, setSelectedNetworks] = useState<UnifiedChainId[]>([])
  const [activeActionMenuKey, setActiveActionMenuKey] = useState<string | null>(null)
  const [actionMenuFlipUp, setActionMenuFlipUp] = useState(false)
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const [showNetworkSelector, setShowNetworkSelector] = useState(false)
  const [storedRecentItems, setRecentItems] = useAtom(navbarSearchRecentItemsAtom)
  const activeTokenMap = useAtomValue(combinedTokenMapFromActiveUrlsAtom)
  const [visibleTokenCount, setVisibleTokenCount] = useState(SEARCH_RESULTS_PAGE_SIZE)
  const [visiblePoolCount, setVisiblePoolCount] = useState(SEARCH_RESULTS_PAGE_SIZE)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const networkSelectorRef = useRef<HTMLDivElement | null>(null)
  const networkFilterPanelRef = useRef<NetworkFilterHandle | null>(null)
  const searchBodyRef = useRef<HTMLDivElement | null>(null)
  const debouncedQuery = useDebounce(draftQuery.trim(), SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    setSelectedNetworks((current) => {
      const next = current.length === 0 ? allNetworkIds : current.filter((chainId) => allNetworkIds.includes(chainId))

      if (next.length === current.length && next.every((chainId, index) => chainId === current[index])) {
        return current
      }

      return next
    })
  }, [allNetworkIds])

  const closeOverlay = useCallback(() => {
    setOpen(false)
    setDraftQuery('')
    setActiveActionMenuKey(null)
    setShowNetworkSelector(false)
  }, [])

  useEffect(() => {
    if (isCompactTrigger) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') return
      const { target } = event
      if (!(target instanceof HTMLElement)) return
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      event.preventDefault()
      setOpen(true)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCompactTrigger])

  useEffect(() => {
    if (!open) return undefined

    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!showNetworkSelector) return undefined

    const handleClickOutside = (event: MouseEvent) => {
      if (networkSelectorRef.current?.contains(event.target as Node)) return
      setShowNetworkSelector(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNetworkSelector])

  useEffect(() => {
    if (showNetworkSelector) {
      networkFilterPanelRef.current?.show()
    }
  }, [showNetworkSelector])

  const queriedChainIds = useMemo(() => {
    return selectedNetworks.filter((chainId) => Boolean(getExplorerChainName(chainId)))
  }, [selectedNetworks])
  const queriedEVMChainIds = useMemo(
    () =>
      selectedNetworks.filter((c) => c !== SOL_CHAIN_ID).filter((chainId) => Boolean(getExplorerChainName(chainId))),
    [selectedNetworks],
  )

  const includeSolana = useMemo(() => selectedNetworks.includes(SOL_CHAIN_ID), [selectedNetworks])
  const hasSearchQuery = debouncedQuery.length > 0
  const showTokensSection = activeTab === 'all' || activeTab === 'tokens'
  const showPoolsSection = activeTab === 'all' || activeTab === 'pools'
  const shouldFetchTopTokens = open && !hasSearchQuery && showTokensSection

  const topTokensQuery = useNavbarTopTokens(queriedEVMChainIds, shouldFetchTopTokens)
  const tokenSearchMatches = useMultiChainTokenSearch(hasSearchQuery ? debouncedQuery : undefined, queriedChainIds)
  const { tokenList: solanaTokens, loading: solanaTokensLoading } = useSolanaTokenList(
    open && includeSolana && showTokensSection,
  )
  const farmSearch = useNavbarFarmSearch(debouncedQuery, queriedChainIds, open && showPoolsSection)

  const solanaTokenResults = useMemo((): TokenSearchResult[] => {
    if (!includeSolana || solanaTokens.length === 0) return []
    return solanaTokens.map((token) => ({
      id: `${SOL_CHAIN_ID}:${token.address}`,
      kind: 'token',
      symbol: token.symbol,
      name: token.name ?? '',
      chainId: SOL_CHAIN_ID,
      address: token.address,
      volumeUSD: 0,
      logoURI: token.logoURI,
    }))
  }, [includeSolana, solanaTokens])

  const tokenResults = useMemo(() => {
    if (!hasSearchQuery) {
      const evmTopTokens = (topTokensQuery.data ?? []).filter((token) => {
        const chainMap = (activeTokenMap[token.chainId as ChainId] ?? {}) as Record<string, unknown>
        const address = safeGetAddress(token.address) ?? token.address
        return Boolean(chainMap[address])
      })
      return [...evmTopTokens, ...solanaTokenResults]
    }

    const normalizedQuery = debouncedQuery.trim().toLowerCase()

    // Prepend native + wrapped-native when the query matches the native symbol.
    // createFilterToken uses prefix-startsWith, so "WBNB" won't match query "bnb";
    // native BNB has no address and is never in token lists — both must be injected manually.
    const nativeFirst: TokenSearchResult[] = []
    const excludeAddresses = new Set<string>() // WNATIVE addresses already added above
    const excludeNativeKeys = new Set<string>() // "${chainId}:${symbol}:${name}" for native tokens already added

    const chainIdsForNative =
      activeChainId && queriedChainIds.includes(activeChainId)
        ? [activeChainId, ...queriedChainIds.filter((c) => c !== activeChainId)]
        : queriedChainIds

    for (const chainId of chainIdsForNative) {
      try {
        const native = NATIVE[chainId as ChainId]
        const wnative = WNATIVE[chainId as ChainId]
        if (!native?.symbol?.toLowerCase().includes(normalizedQuery)) continue

        if (wnative) {
          const wnativeAddress = safeGetAddress(wnative.address) ?? wnative.address
          // Native token (BNB, ETH…) — use WNATIVE address for detail-page navigation;
          // getSwapPath detects native via symbol match against Native.onChain(chainId).symbol
          nativeFirst.push({
            id: `${chainId}:native`,
            kind: 'token',
            symbol: native.symbol,
            name: native.name,
            chainId: chainId as UnifiedChainId,
            address: wnativeAddress,
            volumeUSD: 0,
            isNative: true,
          })
          excludeNativeKeys.add(`${chainId}:${native.symbol.toLowerCase()}:${(native.name ?? '').toLowerCase()}`)
          // Wrapped native (WBNB, WETH…) immediately after
          nativeFirst.push({
            id: `${chainId}:${wnativeAddress}`,
            kind: 'token',
            symbol: wnative.symbol ?? `W${native.symbol}`,
            name: wnative.name ?? `Wrapped ${native.name}`,
            chainId: chainId as UnifiedChainId,
            address: wnativeAddress,
            volumeUSD: 0,
          })
          excludeAddresses.add(`${chainId}:${wnativeAddress.toLowerCase()}`)
        }
      } catch {
        // skip chains where NATIVE/WNATIVE are unavailable
      }
    }

    const mapped: TokenSearchResult[] = tokenSearchMatches
      .filter(
        (t) =>
          !excludeAddresses.has(`${t.chainId}:${t.address.toLowerCase()}`) &&
          !excludeNativeKeys.has(`${t.chainId}:${t.symbol.toLowerCase()}:${(t.name ?? '').toLowerCase()}`),
      )
      .map((token) => ({
        id: `${token.chainId}:${token.address}`,
        kind: 'token',
        symbol: getTokenSymbolAlias(token.address, token.chainId as UnifiedChainId, token.symbol) ?? token.symbol,
        name: getTokenNameAlias(token.address, token.chainId as UnifiedChainId, token.name) ?? token.name ?? '',
        chainId: token.chainId as UnifiedChainId,
        address: token.address,
        volumeUSD: 0,
      }))

    // Inject native SOL + WSOL when query matches, mirroring EVM native handling above
    if (includeSolana && 'sol'.includes(normalizedQuery)) {
      const wsolAddress = 'So11111111111111111111111111111111111111112'
      const solLogoURI = `https://img-v1.raydium.io/icon/${wsolAddress}.png`
      nativeFirst.push({
        id: `${SOL_CHAIN_ID}:native`,
        kind: 'token',
        symbol: 'SOL',
        name: 'Solana',
        chainId: SOL_CHAIN_ID,
        address: wsolAddress,
        volumeUSD: 0,
        isNative: true,
        logoURI: solLogoURI,
      })
      excludeNativeKeys.add(`${SOL_CHAIN_ID}:sol:solana`)
      nativeFirst.push({
        id: `${SOL_CHAIN_ID}:${wsolAddress}`,
        kind: 'token',
        symbol: 'WSOL',
        name: 'Wrapped SOL',
        chainId: SOL_CHAIN_ID,
        address: wsolAddress,
        volumeUSD: 0,
        logoURI: solLogoURI,
      })
      excludeAddresses.add(`${SOL_CHAIN_ID}:${wsolAddress.toLowerCase()}`)
    }

    // Filter Solana tokens by query and merge with EVM results
    const solanaMatches = solanaTokenResults.filter((t) => {
      const s = normalizedQuery
      if (excludeAddresses.has(`${t.chainId}:${t.address.toLowerCase()}`)) return false
      if (excludeNativeKeys.has(`${t.chainId}:${t.symbol.toLowerCase()}:${t.name.toLowerCase()}`)) return false
      return t.symbol.toLowerCase().includes(s) || t.name.toLowerCase().includes(s) || t.address.toLowerCase() === s
    })

    return [...nativeFirst, ...sortSearchResults([...mapped, ...solanaMatches], debouncedQuery)]
  }, [
    activeChainId,
    activeTokenMap,
    debouncedQuery,
    hasSearchQuery,
    includeSolana,
    queriedChainIds,
    solanaTokenResults,
    tokenSearchMatches,
    topTokensQuery.data,
  ])

  const poolResults = useMemo(() => {
    return farmSearch.pools
      .filter((pool) => hasSearchQuery || pool.farm?.inWhitelist !== false)
      .map(poolInfoToSearchResult)
  }, [hasSearchQuery, farmSearch.pools])

  const displayedTokens = useMemo(() => {
    if (activeTab === 'all') {
      return tokenResults.slice(0, ALL_TAB_DISPLAY_LIMIT)
    }

    if (hasSearchQuery) {
      return tokenResults.slice(0, visibleTokenCount)
    }

    return tokenResults
  }, [activeTab, hasSearchQuery, tokenResults, visibleTokenCount])

  const displayedPools = useMemo(() => {
    if (activeTab === 'all') {
      return poolResults.slice(0, ALL_TAB_DISPLAY_LIMIT)
    }

    return poolResults.slice(0, visiblePoolCount)
  }, [activeTab, poolResults, visiblePoolCount])

  const recentItems = useMemo(
    () => storedRecentItems.filter(isStoredSearchResult).slice(0, RECENT_SEARCH_STORAGE_LIMIT),
    [storedRecentItems],
  )

  const visibleRecentItems = useMemo(() => {
    const filteredItems =
      activeTab === 'all'
        ? recentItems
        : recentItems.filter((item) => item.kind === (activeTab === 'tokens' ? 'token' : 'pool'))

    return filteredItems.slice(0, RECENT_SEARCH_DISPLAY_LIMIT)
  }, [activeTab, recentItems])
  const visibleNetworkIds = useMemo(() => selectedNetworks.slice(0, 3), [selectedNetworks])

  const recordRecentItem = useCallback(
    (item: SearchResult) => {
      setRecentItems((current) =>
        [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, RECENT_SEARCH_STORAGE_LIMIT),
      )
    },
    [setRecentItems],
  )

  const clearRecentItems = useCallback(() => {
    setRecentItems([])
  }, [setRecentItems])

  const openResult = useCallback(
    async (item: SearchResult) => {
      if (item.kind === 'token' && item.chainId === SOL_CHAIN_ID) return
      recordRecentItem(item)
      closeOverlay()
      const path = await getDetailPath(item)
      router.push(path)
    },
    [closeOverlay, recordRecentItem, router],
  )

  const runAction = useCallback(
    (item: SearchResult, action: 'swap' | 'send' | 'receive') => {
      recordRecentItem(item)
      closeOverlay()

      if (action === 'swap') {
        router.push(getSwapPath(item))
        return
      }

      openWalletPanel(
        action,
        action === 'send' && item.kind === 'token'
          ? { chainId: item.chainId, tokenAddress: item.isNative ? ZERO_ADDRESS : item.address }
          : undefined,
      )
    },
    [closeOverlay, openWalletPanel, recordRecentItem, router],
  )

  const hasRecentItems = visibleRecentItems.length > 0
  const isLoading = farmSearch.isFetching || topTokensQuery.isLoading || (includeSolana && solanaTokensLoading)
  const canOpenWalletActions = Boolean(evmAccount || solanaAccount || isWrongNetwork)

  const handleNetworkChange = useCallback<INetworkProps['onChange']>(
    (value, event) => {
      if (value.length === 0) {
        event.preventDefault()
        setSelectedNetworks([activeChainId])
        return
      }

      setSelectedNetworks(value as UnifiedChainId[])
    },
    [activeChainId],
  )

  useEffect(() => {
    setVisibleTokenCount(SEARCH_RESULTS_PAGE_SIZE)
    setVisiblePoolCount(SEARCH_RESULTS_PAGE_SIZE)
    setActiveActionMenuKey(null)
    searchBodyRef.current?.scrollTo({ top: 0 })
  }, [activeTab, debouncedQuery, selectedNetworks])

  useEffect(() => {
    const container = searchBodyRef.current
    if (!container || !activeActionMenuKey) return undefined
    const handleScroll = () => setActiveActionMenuKey(null)
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [activeActionMenuKey])

  useEffect(() => {
    const container = searchBodyRef.current
    if (!container || activeTab === 'all') return undefined
    if (!hasSearchQuery && activeTab !== 'pools') return undefined

    let timeoutId: number | null = null
    const handleScroll = () => {
      const scrollPercentage = (container.scrollTop + container.clientHeight) / container.scrollHeight
      if (scrollPercentage < 0.95) return

      if (activeTab === 'tokens') {
        setVisibleTokenCount((current) => Math.min(current + SEARCH_RESULTS_PAGE_SIZE, tokenResults.length))
        return
      }

      setVisiblePoolCount((current) => Math.min(current + SEARCH_RESULTS_PAGE_SIZE, poolResults.length))
    }

    const debouncedHandleScroll = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(handleScroll, 100)
    }

    container.addEventListener('scroll', debouncedHandleScroll)

    return () => {
      container.removeEventListener('scroll', debouncedHandleScroll)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [activeTab, hasSearchQuery, poolResults.length, tokenResults.length])

  useEffect(() => {
    if (activeTab !== 'pools' && activeTab !== 'all') return
    if (!farmSearch.hasNextPage || farmSearch.isFetching) return

    const hasEnoughResults =
      activeTab === 'pools'
        ? visiblePoolCount + SEARCH_RESULTS_PAGE_SIZE <= poolResults.length
        : poolResults.length >= ALL_TAB_DISPLAY_LIMIT
    if (hasEnoughResults) return
    farmSearch.fetchNextPage()
  }, [activeTab, farmSearch, poolResults.length, visiblePoolCount])

  const renderResultRow = useCallback(
    (item: SearchResult, sectionKey: 'recent' | 'tokens' | 'pools') => {
      const actionMenuKey = `${sectionKey}:${item.id}`
      const isActionOpen = activeActionMenuKey === actionMenuKey

      const handleMoreButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        const flipUp = rect.bottom > window.innerHeight / 2
        setActionMenuFlipUp(flipUp)
        setActionMenuPos({ top: flipUp ? rect.top : rect.bottom, right: window.innerWidth - rect.right })
        setActiveActionMenuKey((current) => (current === actionMenuKey ? null : actionMenuKey))
      }

      if (item.kind === 'pool') {
        const token0 = new Token(item.chainId, item.token0Address as `0x${string}`, 18, '', '')
        const token1 = new Token(item.chainId, item.token1Address as `0x${string}`, 18, '', '')

        return (
          <ResultRow key={`${sectionKey}:${item.id}`} onClick={() => openResult(item)} $active={isActionOpen}>
            <PoolOverviewWrap>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <TokenOverview
                  isReady
                  token={token0}
                  quoteToken={token1}
                  titleFontSize="14px"
                  iconWidth="40px"
                  showChainLogo
                  icon={
                    <TokenPairLogo
                      width={40}
                      height={40}
                      variant="inverted"
                      primaryToken={token0}
                      secondaryToken={token1}
                    />
                  }
                  title={item.pairSymbol}
                  desc={getNetworkShortLabel(item.chainId)}
                />
                <PoolCautionTag item={item} />
              </div>
            </PoolOverviewWrap>
            {item.feeTier !== undefined && item.protocol ? (
              <FeeTier
                type={item.protocol}
                fee={item.feeTier}
                dynamic={item.isDynamicFee}
                denominator={item.protocol === 'infinityStable' ? INFINITY_STABLE_POOL_FEE_DENOMINATOR : 1_000_000}
              />
            ) : null}
            <MoreButton type="button" aria-label={t('Open search result actions')} onClick={handleMoreButtonClick}>
              <EllipsisIcon width="18px" color="textSubtle" />
              {isActionOpen &&
                createPortal(
                  <ActionMenu
                    $flipUp={actionMenuFlipUp}
                    $top={actionMenuPos.top}
                    $right={actionMenuPos.right}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ActionMenuButton
                      type="button"
                      onClick={async () => {
                        const path = await getDetailPath(item)
                        if (path) {
                          await navigator.clipboard.writeText(`${window.location.origin}${path}`)
                          setActiveActionMenuKey(null)
                          toastSuccess(t('Copied!'))
                        }
                      }}
                    >
                      <CopyIcon width="16px" color="textSubtle" />
                      {t('Copy address')}
                    </ActionMenuButton>
                  </ActionMenu>,
                  document.body,
                )}
            </MoreButton>
          </ResultRow>
        )
      }

      const isSolanaToken = item.chainId === SOL_CHAIN_ID

      return (
        <ResultRow
          key={`${sectionKey}:${item.id}`}
          onClick={() => openResult(item)}
          $active={isActionOpen}
          style={isSolanaToken ? { cursor: 'default' } : undefined}
        >
          <SearchTokenLogo
            address={item.address}
            chainId={item.chainId}
            symbol={item.symbol}
            isNative={item.isNative}
            logoURI={item.logoURI}
          />
          <ResultMeta>
            <ResultTitleRow>
              <Text
                bold
                fontSize="14px"
                color="text"
                style={{
                  lineHeight: 1.4,
                  flexShrink: 0,
                  maxWidth: '35%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.symbol}
              </Text>
              <Text
                color="textSubtle"
                fontSize="14px"
                style={{ lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {item.name}
              </Text>
            </ResultTitleRow>
            <ResultSubLabel>{getNetworkShortLabel(item.chainId)}</ResultSubLabel>
          </ResultMeta>
          <MoreButton type="button" aria-label={t('Open search result actions')} onClick={handleMoreButtonClick}>
            <EllipsisIcon width="18px" color="textSubtle" />
            {isActionOpen &&
              createPortal(
                <ActionMenu
                  $flipUp={actionMenuFlipUp}
                  $top={actionMenuPos.top}
                  $right={actionMenuPos.right}
                  onClick={(event) => event.stopPropagation()}
                >
                  <ActionMenuButton
                    type="button"
                    onClick={() => {
                      setActiveActionMenuKey(null)
                      runAction(item, 'swap')
                    }}
                  >
                    <TradeIcon width="16px" color="textSubtle" />
                    {t('Swap')}
                  </ActionMenuButton>
                  {canOpenWalletActions && (
                    <ActionMenuButton
                      type="button"
                      onClick={() => {
                        setActiveActionMenuKey(null)
                        runAction(item, 'send')
                      }}
                    >
                      <ArrowForwardIcon width="16px" color="textSubtle" />
                      {t('Send')}
                    </ActionMenuButton>
                  )}
                  {canOpenWalletActions && (
                    <ActionMenuButton
                      type="button"
                      onClick={() => {
                        setActiveActionMenuKey(null)
                        runAction(item, 'receive')
                      }}
                    >
                      <ArrowFirstIcon width="16px" color="textSubtle" style={{ transform: 'rotate(-90deg)' }} />
                      {t('Receive')}
                    </ActionMenuButton>
                  )}
                </ActionMenu>,
                document.body,
              )}
          </MoreButton>
        </ResultRow>
      )
    },
    [
      actionMenuFlipUp,
      actionMenuPos,
      activeActionMenuKey,
      canOpenWalletActions,
      openResult,
      runAction,
      t,
      toastSuccess,
    ],
  )

  return (
    <SearchRoot>
      {open && queriedChainIds.map((chainId) => <UpdaterByChainId key={chainId} chainId={chainId} />)}
      <TriggerButton
        type="button"
        $mobile={isCompactTrigger}
        aria-expanded={open}
        aria-label={isCompactTrigger ? t('Open navbar search') : t('Search tokens and pools')}
        onClick={() => {
          setOpen(true)
        }}
      >
        <SearchIcon color="textSubtle" width={isCompactTrigger ? '20px' : '18px'} />
        {!isCompactTrigger && (
          <>
            <Text color="textSubtle" fontSize="14px" style={{ flex: 1, textAlign: 'left' }}>
              {t('Search')}
            </Text>
            <Kbd>/</Kbd>
          </>
        )}
      </TriggerButton>

      <ModalV2 isOpen={open} onDismiss={closeOverlay} closeOnOverlayClick>
        <ModalWrapper
          onDismiss={closeOverlay}
          minWidth={isMobile ? '100%' : '440px'}
          maxWidth="100%"
          minHeight="120px"
          containerStyle={isMobile ? { width: '100%' } : undefined}
        >
          <SearchModalCard>
            {isMobile && <ModalGrabber />}
            <SearchPanelHeader>
              <SearchFieldContainer ref={networkSelectorRef}>
                <SearchField>
                  <SearchIcon color="textSubtle" width="24px" />
                  <SearchInput
                    ref={inputRef}
                    value={draftQuery}
                    placeholder={t('Search Tokens / Pools')}
                    onChange={(event) => setDraftQuery(event.currentTarget.value)}
                  />
                  <ChainStackTrigger
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowNetworkSelector((prev) => !prev)
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <NetworkStack>
                      {visibleNetworkIds.map((chainId) => (
                        <NetworkBadge key={chainId}>
                          <NetworkBadgeImage
                            alt={`chain-${chainId}`}
                            src={`${ASSET_CDN}/web/chains/square/${chainId}.svg`}
                          />
                        </NetworkBadge>
                      ))}
                      {selectedNetworks.length > 3 && (
                        <NetworkOverflowBadge>+{selectedNetworks.length - 3}</NetworkOverflowBadge>
                      )}
                    </NetworkStack>
                    <ChevronDownIcon width="20px" color="textSubtle" />
                  </ChainStackTrigger>
                </SearchField>
                {showNetworkSelector && (
                  <NetworkFilterDropdown>
                    <NetworkFilter
                      panelRef={networkFilterPanelRef}
                      data={allChainsOpts}
                      value={selectedNetworks}
                      onChange={handleNetworkChange}
                      multiple
                      onPanelClose={() => setShowNetworkSelector(false)}
                    />
                  </NetworkFilterDropdown>
                )}
              </SearchFieldContainer>

              <FiltersStack>
                <FiltersRow>
                  <FilterButton type="button" $active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
                    {t('All')}
                  </FilterButton>
                  <FilterButton type="button" $active={activeTab === 'tokens'} onClick={() => setActiveTab('tokens')}>
                    {t('Tokens')}
                  </FilterButton>
                  <FilterButton type="button" $active={activeTab === 'pools'} onClick={() => setActiveTab('pools')}>
                    {t('Pools')}
                  </FilterButton>
                </FiltersRow>
              </FiltersStack>
            </SearchPanelHeader>

            <SearchPanelBody ref={searchBodyRef} onPointerDownCapture={(e) => e.stopPropagation()}>
              {!hasSearchQuery && hasRecentItems && (
                <Section>
                  <SectionTitle>
                    <HistoryIcon width="16px" color="textSubtle" />
                    <Text color="textSubtle" fontSize="12px">
                      {t('Recent Searches')}
                    </Text>
                    <ClearButton type="button" onClick={clearRecentItems}>
                      {t('Clear')}
                    </ClearButton>
                  </SectionTitle>
                  <ResultList>{visibleRecentItems.map((item) => renderResultRow(item, 'recent'))}</ResultList>
                </Section>
              )}

              {showTokensSection && displayedTokens.length > 0 && (
                <Section>
                  <SectionTitle>
                    <TokensOnPCSIcon width="16px" color="textSubtle" />
                    <Text color="textSubtle" fontSize="12px">
                      {hasSearchQuery ? t('Tokens') : t('Tokens by 24h volume')}
                    </Text>
                  </SectionTitle>
                  <ResultList>{displayedTokens.map((item) => renderResultRow(item, 'tokens'))}</ResultList>
                </Section>
              )}

              {showPoolsSection && displayedPools.length > 0 && (
                <Section>
                  <SectionTitle>
                    <PoolsChartIcon width="16px" color="textSubtle" />
                    <Text color="textSubtle" fontSize="12px">
                      {hasSearchQuery ? t('Pools') : t('Pools by 24h volume')}
                    </Text>
                  </SectionTitle>
                  <ResultList>{displayedPools.map((item) => renderResultRow(item, 'pools'))}</ResultList>
                </Section>
              )}

              {farmSearch.isFetching && activeTab === 'pools' && displayedPools.length > 0 && (
                <Section>
                  <Flex py="8px" justifyContent="center">
                    <Loading />
                  </Flex>
                </Section>
              )}

              {(isLoading && displayedTokens.length === 0 && displayedPools.length === 0) ||
              (showPoolsSection &&
                farmSearch.isFetching &&
                displayedPools.length === 0 &&
                displayedTokens.length > 0) ? (
                <Section>
                  <Flex py="24px" justifyContent="center">
                    <Loading width="24px" height="24px" />
                  </Flex>
                </Section>
              ) : null}

              {!isLoading &&
                hasSearchQuery &&
                (showTokensSection ? displayedTokens.length === 0 : true) &&
                (showPoolsSection ? displayedPools.length === 0 && !farmSearch.isFetching : true) && (
                  <Section>
                    <Text color="textSubtle" textAlign="center" py="24px">
                      {t('No matches found for %query%', { query: debouncedQuery })}
                    </Text>
                  </Section>
                )}
            </SearchPanelBody>
          </SearchModalCard>
        </ModalWrapper>
      </ModalV2>
    </SearchRoot>
  )
}
