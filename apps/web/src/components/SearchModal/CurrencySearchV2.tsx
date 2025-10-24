import { useDebounce, useSortedTokensByQuery } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
/* eslint-disable no-restricted-syntax */
import { Currency, Token, UnifiedCurrency, UnifiedToken } from '@pancakeswap/sdk'
import { WrappedTokenInfo, createFilterToken } from '@pancakeswap/token-lists'
import { AutoColumn, Box, Column, Input, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useAudioPlay } from '@pancakeswap/utils/user'
import { KeyboardEvent, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FixedSizeList } from 'react-window'
import { isAddress } from 'viem'

import { useActiveChainId } from 'hooks/useActiveChainId'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { sanitizeTokenInfos, useAllLists, useInactiveListUrls } from 'state/lists/hooks'
import { safeGetAddress } from 'utils'

import { useTokenComparator } from 'hooks/useTokenComparator'
import { useAllTokens, useIsUserAddedToken, useTokenByChainId } from '../../hooks/Tokens'
import Row from '../Layout/Row'
import CommonBases from './CommonBases'
import CurrencyListV2 from './CurrencyListV2'
import ImportRow from './ImportRow'
import { getSwapSound } from './swapSound'
import { CommonBasesType } from './types'

interface CurrencySearchV2Props {
  selectedCurrency?: Currency | null
  onCurrencySelect: (currency: UnifiedCurrency) => void
  otherSelectedCurrency?: Currency | null
  showSearchInput?: boolean
  showCommonBases?: boolean
  commonBasesType?: CommonBasesType
  showImportView: () => void
  setImportToken: (token: UnifiedToken) => void
  height?: number
  tokensToShow?: Token[]
  chainId?: number
}

function useSearchInactiveTokenLists(
  search: string | undefined,
  overrideChainId: number,
  minResults = 10,
): WrappedTokenInfo[] {
  const lists = useAllLists()
  const inactiveUrls = useInactiveListUrls()

  const { chainId: activeChainId } = useActiveChainId()
  const chainId = overrideChainId || activeChainId

  const activeTokens = useAllTokens(chainId)

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

function CurrencySearchV2({
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
  chainId: chainIdProp,
}: CurrencySearchV2Props) {
  const { t } = useTranslation()
  const { chainId: activeChainId } = useActiveChainId()
  const chainId = chainIdProp || activeChainId

  // refs for fixed size lists
  const fixedList = useRef<FixedSizeList>()

  const [searchQuery, setSearchQuery] = useState<string>('')
  const debouncedQuery = useDebounce(searchQuery, 200)

  const [invertSearchOrder] = useState<boolean>(false)

  const allTokens = useAllTokens(chainId)

  // if they input an address, use it (only when tokensToShow is not set)
  const searchToken = useTokenByChainId(!tokensToShow ? debouncedQuery : undefined, chainId)
  const searchTokenIsAdded = useIsUserAddedToken(searchToken, chainId)

  const { isMobile } = useMatchBreakpoints()
  const [audioPlay] = useAudioPlay()

  const native = useNativeCurrency(chainId)

  const showNative: boolean = useMemo(() => {
    if (tokensToShow) return false
    const s = debouncedQuery.toLowerCase().trim()
    return native && native.symbol?.toLowerCase?.()?.indexOf(s) !== -1
  }, [debouncedQuery, native, tokensToShow])

  const filteredTokens: Token[] = useMemo(() => {
    const filterToken = createFilterToken(debouncedQuery, (address) => isAddress(address))
    return Object.values(tokensToShow || allTokens).filter(filterToken)
  }, [tokensToShow, allTokens, debouncedQuery])

  const filteredQueryTokens = useSortedTokensByQuery(filteredTokens, debouncedQuery)
  const tokenComparator = useTokenComparator(invertSearchOrder, chainId)

  const filteredSortedTokens: Token[] = useMemo(
    () => [...filteredQueryTokens].sort(tokenComparator),
    [filteredQueryTokens, tokenComparator],
  )

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

  const handleInput = useCallback((event) => {
    const input = event.target.value
    const checksummedInput = safeGetAddress(input)
    setSearchQuery(checksummedInput || input)
    fixedList.current?.scrollTo(0)
  }, [])

  const handleEnter = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const s = debouncedQuery.toLowerCase().trim()
        if (s === native.symbol.toLowerCase().trim()) {
          handleCurrencySelect(native)
        } else if (filteredSortedTokens.length > 0) {
          if (
            filteredSortedTokens[0].symbol?.toLowerCase() === debouncedQuery.trim().toLowerCase() ||
            filteredSortedTokens.length === 1
          ) {
            handleCurrencySelect(filteredSortedTokens[0])
          }
        }
      }
    },
    [debouncedQuery, filteredSortedTokens, handleCurrencySelect, native],
  )

  // if no results on main list, show option to expand into inactive (only when tokensToShow is not set)
  const filteredInactiveTokens = useSearchInactiveTokenLists(!tokensToShow ? debouncedQuery : undefined, chainId)

  const hasFilteredInactiveTokens = Boolean(filteredInactiveTokens?.length)

  const getCurrencyListRows = useCallback(() => {
    // Don't show import functionality when tokensToShow is provided
    if (!tokensToShow && searchToken && !searchTokenIsAdded && !hasFilteredInactiveTokens) {
      return (
        <Column style={{ padding: '20px 0', height: '100%' }}>
          <ImportRow
            onCurrencySelect={handleCurrencySelect}
            token={searchToken}
            showImportView={showImportView}
            setImportToken={setImportToken}
          />
        </Column>
      )
    }

    return Boolean(filteredSortedTokens?.length) || hasFilteredInactiveTokens ? (
      <Box mx="-24px" my="24px">
        <CurrencyListV2
          height={isMobile ? (showCommonBases ? height || 250 : height ? height + 80 : 350) : 390}
          showNative={showNative}
          currencies={filteredSortedTokens}
          inactiveCurrencies={filteredInactiveTokens}
          breakIndex={
            Boolean(filteredInactiveTokens?.length) && filteredSortedTokens ? filteredSortedTokens.length : undefined
          }
          onCurrencySelect={handleCurrencySelect}
          otherCurrency={otherSelectedCurrency}
          selectedCurrency={selectedCurrency}
          fixedListRef={fixedList}
          showImportView={showImportView}
          setImportToken={setImportToken}
          chainId={chainId}
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
    chainId,
    tokensToShow,
  ])

  return (
    <>
      <AutoColumn gap="16px">
        {showSearchInput && (
          <Row>
            <Input
              id="token-search-input"
              placeholder={t('Search name or paste address')}
              scale="lg"
              autoComplete="off"
              value={searchQuery}
              ref={inputRef as RefObject<HTMLInputElement>}
              onChange={handleInput}
              onKeyDown={handleEnter}
            />
          </Row>
        )}
        {showCommonBases && (
          <CommonBases
            chainId={chainId}
            onSelect={handleCurrencySelect}
            selectedCurrency={selectedCurrency}
            commonBasesType={commonBasesType}
          />
        )}
      </AutoColumn>
      {getCurrencyListRows()}
    </>
  )
}

export default CurrencySearchV2
