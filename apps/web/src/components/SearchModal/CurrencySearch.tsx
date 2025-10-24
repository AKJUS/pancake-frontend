import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useUnifiedNativeCurrency } from 'hooks/useNativeCurrency'
import { useSolanaTokenList } from 'hooks/solana/useSolanaTokenList'
import { useSolanaTokenInfo } from 'hooks/solana/useSolanaTokenInfo'
import { useSolanaTokenBalances } from 'state/token/solanaTokenBalances'
import { useSolanaTokenPrices } from 'hooks/solana/useSolanaTokenPrice'
import { FixedSizeList } from 'react-window'
import { sanitizeTokenInfos, useAllLists, useInactiveListUrls } from 'state/lists/hooks'
import { UpdaterByChainId } from 'state/lists/updater'
import { useAllTokenBalances } from 'state/wallet/hooks'
import { safeGetAddress } from 'utils'
import { getTokenAddressFromSymbolAlias } from 'utils/getTokenAlias'
import { isAddress } from 'viem'

import { NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { useDebounce, useSortedTokensByQuery } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
/* eslint-disable no-restricted-syntax */
import { getTokenComparator, isSolWSolToken, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { createFilterToken, WrappedTokenInfo } from '@pancakeswap/token-lists'
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
import { SPLToken, UnifiedToken } from '@pancakeswap/swap-sdk-core'

import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { useAllTokens, useIsUserAddedToken, useToken } from '../../hooks/Tokens'
import Row from '../Layout/Row'
import CommonBases, { BaseWrapper } from './CommonBases'
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
}

function useSearchInactiveTokenLists(search: string | undefined, minResults = 10): WrappedTokenInfo[] {
  const lists = useAllLists()
  const inactiveUrls = useInactiveListUrls()

  const { chainId } = useActiveChainId()

  const activeTokens = useAllTokens()

  return useMemo(() => {
    if (!search || search.trim().length === 0) return []
    const filterToken = createFilterToken(search, (address) => isAddress(address))
    const exactMatches: WrappedTokenInfo[] = []
    const rest: WrappedTokenInfo[] = []
    const addressSet: { [address: string]: true } = {}
    const trimmedSearchQuery = search.toLowerCase().trim()
    for (const url of inactiveUrls) {
      const list = lists[url]?.current
      // eslint-disable-next-line no-continue
      if (!list) continue
      const sanitizedTokens = sanitizeTokenInfos(list)
      for (const tokenInfo of sanitizedTokens) {
        if (
          tokenInfo.chainId === chainId &&
          !(tokenInfo.address in activeTokens) &&
          !addressSet[tokenInfo.address] &&
          filterToken(tokenInfo)
        ) {
          const wrapped: WrappedTokenInfo = new WrappedTokenInfo({
            ...tokenInfo,
            address: safeGetAddress(tokenInfo.address) || tokenInfo.address,
          })
          addressSet[wrapped.address] = true
          if (
            tokenInfo.name?.toLowerCase() === trimmedSearchQuery ||
            tokenInfo.symbol?.toLowerCase() === trimmedSearchQuery
          ) {
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
}: CurrencySearchProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState<string>('')
  const debouncedQuery = useDebounce(getTokenAddressFromSymbolAlias(searchQuery, selectedChainId, searchQuery), 200)
  // refs for fixed size lists
  const fixedList = useRef<FixedSizeList>()

  const { isMobile } = useMatchBreakpoints()
  const [audioPlay] = useAudioPlay()

  // === use all tokens and native currency related to the chainId

  // Use Solana token list if Solana is selected
  const isSolana = selectedChainId === NonEVMChainId.SOLANA
  const allTokens = useAllTokens(selectedChainId)
  const { tokenList: solanaTokens } = useSolanaTokenList()
  const native = useUnifiedNativeCurrency(selectedChainId)

  const { solanaAccount } = useAccountActiveChain() // useAccount is already imported and works for all chains
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
  const filteredInactiveTokens = useSearchInactiveTokenLists(!tokensToShow ? debouncedQuery : undefined)

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
    const filterToken = createFilterToken(debouncedQuery, (address) => isAddress(address))
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
    return [...(queryTokens as Token[])].sort(tokenComparator)
  }, [filteredTokens, queryTokens, balances, isSolana, solanaBalances.balances, solanaPrices])

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
        if (!isSolana && s === native.symbol.toLowerCase().trim()) {
          handleCurrencySelect(native)
        } else if (filteredSortedTokens.length > 0) {
          if (
            isSolana ||
            filteredSortedTokens[0].symbol?.toLowerCase() === debouncedQuery.trim().toLowerCase() ||
            filteredSortedTokens.length === 1
          ) {
            handleCurrencySelect(isSolana ? (filteredSortedTokens[0] as any) : filteredSortedTokens[0])
          }
        }
      }
    },
    [debouncedQuery, filteredSortedTokens, handleCurrencySelect, native, isSolana],
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

    return Boolean(filteredSortedTokens?.length) || hasFilteredInactiveTokens || showNative ? (
      <Box mx="-24px" mt="20px" height="100%">
        <CurrencyList
          height={isMobile ? (showCommonBases ? height || 250 : height ? height + 80 : 350) : 340}
          showNative={showNative}
          currencies={filteredSortedTokens}
          inactiveCurrencies={
            isSolana
              ? filteredInactiveTokens
              : filteredInactiveTokens.filter(
                  (t) => t && typeof t === 'object' && 'equals' in t && typeof t.equals === 'function',
                )
          }
          breakIndex={
            Boolean(filteredInactiveTokens?.length) && filteredSortedTokens ? filteredSortedTokens.length : undefined
          }
          onCurrencySelect={handleCurrencySelect}
          otherCurrency={otherSelectedCurrency}
          selectedCurrency={selectedCurrency}
          fixedListRef={fixedList}
          showImportView={showImportView}
          setImportToken={setImportToken}
          showChainLogo={showChainLogo}
          chainId={selectedChainId}
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
    filteredSortedTokens,
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
    selectedChainId,
    isSolana,
    tokensToShow,
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

        {showCommonBases && (
          <CommonBases
            supportCrossChain={supportCrossChain}
            chainId={selectedChainId}
            onSelect={handleCurrencySelect}
            selectedCurrency={selectedCurrency}
            commonBasesType={commonBasesType}
            disabledCurrencies={isSolWSolToken(otherSelectedCurrency?.wrapped) ? [native] : undefined}
          />
        )}
      </AutoColumn>
      {getCurrencyListRows()}
    </>
  )
}

export default CurrencySearch
