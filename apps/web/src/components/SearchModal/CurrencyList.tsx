import { CSSProperties, MutableRefObject, useCallback, useMemo, useState } from 'react'
import BN from 'bignumber.js'

import AddToWalletButton from 'components/AddToWallet/AddToWalletButton'
import { LightGreyCard } from 'components/Card'
import { ViewOnExplorerButton } from 'components/ViewOnExplorerButton'
import { useUnifiedNativeCurrency } from 'hooks/useNativeCurrency'
import { useUnifiedCurrencyBalance } from 'hooks/useUnifiedCurrencyBalance'
import { VariableSizeList } from 'react-window'
import { styled } from 'styled-components'
import { getTokenSymbolAlias } from 'utils/getTokenAlias'
import { wrappedCurrency } from 'utils/wrappedCurrency'

import { useTranslation } from '@pancakeswap/localization'
import { ChainId, Currency, UnifiedCurrency, UnifiedCurrencyAmount, UnifiedToken } from '@pancakeswap/sdk'
import { WrappedTokenInfo } from '@pancakeswap/token-lists'
import {
  useMatchBreakpoints,
  ArrowForwardIcon,
  AutoColumn,
  Column,
  CopyButton,
  FlexGap,
  QuestionHelper,
  Text,
} from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { useUnifiedTokenUsdPrice } from 'hooks/useUnifiedTokenUsdPrice'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { isSolana, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'

import truncateHash from '@pancakeswap/utils/truncateHash'
import { CHAINS } from 'config/chains'
import { chainNameConverter } from 'utils/chainNameConverter'
import { useIsUserAddedToken } from '../../hooks/Tokens'
import { useCombinedActiveList } from '../../state/lists/hooks'
import { isTokenOnList } from '../../utils'
import { RowBetween, RowFixed } from '../Layout/Row'
import CircleLoader from '../Loader/CircleLoader'
import ImportRow from './ImportRow'

function currencyKey(currency: Currency): string {
  return currency?.isToken ? currency.address : currency?.isNative ? currency.symbol : ''
}

const StyledBalanceText = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  max-width: 5rem;
  text-overflow: ellipsis;
`

const FixedContentRow = styled.div`
  padding: 4px 20px;
  height: 56px;
  display: grid;
  grid-gap: 16px;
  align-items: center;
`

function Balance({ balance }: { balance: UnifiedCurrencyAmount<UnifiedCurrency> }) {
  return (
    <StyledBalanceText title={balance.toExact()} bold>
      {formatAmount(balance, 4)}
    </StyledBalanceText>
  )
}

const MenuItem = styled(RowBetween)`
  height: 56px;
  padding: 0 8px;
`

const MenuItemInner = styled.div<{ disabled?: boolean; selected: boolean }>`
  width: 100%;
  padding: 6px 12px;
  border-radius: 16px;

  display: grid;
  grid-template-columns: auto minmax(auto, 1fr) minmax(0, 72px);
  grid-gap: 10px;
  cursor: ${({ disabled }) => !disabled && 'pointer'};
  &:hover {
    background-color: ${({ theme, disabled }) => !disabled && theme.colors.background};
  }
  opacity: ${({ disabled, selected }) => (disabled || selected ? 0.5 : 1)};

  transition: background-color 0.15s;
`

function ComplementSection({
  selectedCurrency,
  isSelected,
  showActions,
}: {
  selectedCurrency: Currency
  isSelected: boolean
  showActions: boolean
}) {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()

  if (selectedCurrency.isNative) {
    return null
  }

  return (
    <FlexGap ml="8px" alignItems="center">
      {isMobile ? (
        <Text color="textSubtle" fontSize="12px">
          {truncateHash(selectedCurrency.wrapped.address)}
        </Text>
      ) : (
        showActions && (
          <>
            <CopyButton
              data-dd-action-name="Copy token address"
              width="13px"
              buttonColor="textSubtle"
              text={selectedCurrency.wrapped.address}
              tooltipMessage={t('Token address copied')}
              defaultTooltipMessage={t('Copy token address')}
              tooltipPlacement="top"
            />
            <ViewOnExplorerButton
              address={selectedCurrency.wrapped.address}
              chainId={selectedCurrency.chainId}
              type="token"
              color="textSubtle"
              width="15px"
              ml="8px"
              tooltipPlacement="top"
            />
            {selectedCurrency.chainId === NonEVMChainId.SOLANA ? null : (
              <AddToWalletButton
                data-dd-action-name="Add to wallet"
                variant="text"
                p="0"
                ml="12px"
                height="auto"
                width="fit-content"
                tokenAddress={selectedCurrency.wrapped.address}
                tokenSymbol={selectedCurrency.symbol}
                tokenDecimals={selectedCurrency.decimals}
                tokenLogo={
                  selectedCurrency.wrapped instanceof WrappedTokenInfo ? selectedCurrency.wrapped.logoURI : undefined
                }
                tooltipPlacement="top"
              />
            )}
          </>
        )
      )}
    </FlexGap>
  )
}

function CurrencyRow({
  currency,
  onSelect,
  isSelected,
  otherSelected,
  style,
  showChainLogo,
}: {
  currency: Currency
  onSelect: () => void
  isSelected: boolean
  otherSelected: boolean
  style: CSSProperties
  showChainLogo?: boolean
}) {
  const { account: evmAccount, solanaAccount } = useAccountActiveChain()
  const { t } = useTranslation()
  const key = currencyKey(currency)
  const selectedTokenList = useCombinedActiveList()
  const isOnSelectedList = isTokenOnList(selectedTokenList, currency)
  const customAdded = useIsUserAddedToken(currency)
  const [isHovered, setIsHovered] = useState(false)

  // Must do: for solana case, this causes expensive call due to getting token balance by each call
  // useUnifiedCurrencyBalance is only good for getting balance of a single token
  // useUnifiedCurrencyBalances is good for getting balance of multiple tokens but not have the refresh mechanism
  const balanceAmount = useUnifiedCurrencyBalance(currency)
  const currencyUsdPrice = useUnifiedTokenUsdPrice(currency, Boolean(balanceAmount))
  const balanceUSD = useMemo(() => {
    if (!balanceAmount || !currencyUsdPrice.data) return undefined
    return new BN(balanceAmount.toExact()).times(currencyUsdPrice.data).toFixed(2)
  }, [balanceAmount, currencyUsdPrice])

  const isConnected = useMemo(
    () =>
      currency.chainId in ChainId ? evmAccount : currency.chainId === NonEVMChainId.SOLANA ? solanaAccount : evmAccount,
    [evmAccount, solanaAccount, currency.chainId],
  )

  const chainName = useMemo(() => {
    if (isSolana(currency.chainId)) return 'Solana'
    const chain = CHAINS.find((c) => c.id === currency.chainId)
    return chain ? chainNameConverter(chain.name) : ''
  }, [currency.chainId])

  const setIsHoveredCallback = useCallback(() => {
    setIsHovered(true)
  }, [])

  const setIsHoveredLeaveCallback = useCallback(() => {
    setIsHovered(false)
  }, [])

  // only show add or remove buttons if not on selected list
  return (
    <MenuItem style={style} className={`token-item-${key}`}>
      <MenuItemInner
        disabled={isSelected}
        selected={otherSelected}
        onClick={isSelected ? undefined : onSelect}
        onMouseEnter={setIsHoveredCallback}
        onMouseLeave={setIsHoveredLeaveCallback}
      >
        <CurrencyLogo showChainLogo={showChainLogo} currency={currency} size="40px" />

        <Column>
          <FlexGap alignItems="center">
            <Text bold>{getTokenSymbolAlias(currency?.wrapped?.address, currency?.chainId, currency?.symbol)}</Text>
            <Text color="textSubtle" small ml="4px" ellipsis>
              {currency?.name}
            </Text>
            <ComplementSection isSelected={isSelected} selectedCurrency={currency} showActions={isHovered} />
          </FlexGap>
          <Text color="textSubtle" fontSize="12px" ellipsis bold maxWidth="200px">
            {!isOnSelectedList && customAdded && `${t('Added by user')} •`} {chainName}
          </Text>
        </Column>
        <RowFixed style={{ justifySelf: 'flex-end' }}>
          {balanceAmount ? (
            <AutoColumn justify="flex-end">
              <Balance balance={balanceAmount} />
              <div>
                {balanceUSD && Number(balanceUSD) > 0 && (
                  <Text color="textSubtle" small ellipsis maxWidth="200px">
                    ${balanceUSD}
                  </Text>
                )}
              </div>
            </AutoColumn>
          ) : isConnected ? (
            <CircleLoader />
          ) : (
            <ArrowForwardIcon />
          )}
        </RowFixed>
      </MenuItemInner>
    </MenuItem>
  )
}

export const POPULAR_HEADER = 'popular-header' as const
const ALL_TOKENS_HEADER = 'all-tokens-header' as const
type ListItem = UnifiedCurrency | undefined | typeof POPULAR_HEADER | typeof ALL_TOKENS_HEADER

export default function CurrencyList({
  height,
  currencies,
  inactiveCurrencies,
  selectedCurrency,
  onCurrencySelect,
  otherCurrency,
  fixedListRef,
  showNative,
  showImportView,
  setImportToken,
  breakIndex,
  showChainLogo,
  chainId,
  popularTokens,
}: {
  height: number | string
  currencies: UnifiedCurrency[]
  inactiveCurrencies: UnifiedCurrency[]
  selectedCurrency?: UnifiedCurrency | null
  onCurrencySelect: (currency: UnifiedCurrency) => void
  otherCurrency?: UnifiedCurrency | null
  fixedListRef?: MutableRefObject<VariableSizeList | undefined>
  showNative: boolean
  showImportView: () => void
  setImportToken: (token: UnifiedToken) => void
  breakIndex: number | undefined
  showChainLogo?: boolean
  chainId?: UnifiedChainId
  popularTokens?: UnifiedCurrency[]
}) {
  const native = useUnifiedNativeCurrency(chainId)

  // Track popular section length so the Row callback can correctly offset showImport.
  // +1 for POPULAR_HEADER, +1 for ALL_TOKENS_HEADER.
  const popularSectionLength = popularTokens?.length ? popularTokens.length + 2 : 0

  const itemData: ListItem[] = useMemo(() => {
    const popularSection: ListItem[] =
      popularSectionLength > 0 ? [POPULAR_HEADER, ...popularTokens!, ALL_TOKENS_HEADER] : []

    let formatted: ListItem[] = showNative
      ? [...popularSection, native, ...currencies, ...inactiveCurrencies]
      : [...popularSection, ...currencies, ...inactiveCurrencies]

    if (breakIndex !== undefined) {
      const adjustedBreak = breakIndex + popularSection.length
      formatted = [...formatted.slice(0, adjustedBreak), undefined, ...formatted.slice(adjustedBreak)]
    }
    return formatted
  }, [breakIndex, currencies, inactiveCurrencies, showNative, native, popularTokens, popularSectionLength])

  const { t } = useTranslation()

  const Row = useCallback(
    ({ data, index, style }) => {
      const currency: any = data[index]

      const isSelected = Boolean(selectedCurrency && currency && selectedCurrency.equals(currency))
      const otherSelected = Boolean(otherCurrency && currency && otherCurrency.equals(currency))
      const isNativeWrap = Boolean(
        isSolana(chainId) &&
          currency?.wrapped &&
          otherCurrency?.wrapped &&
          otherCurrency.wrapped.equals(currency.wrapped) &&
          !otherSelected,
      )

      if (currency === POPULAR_HEADER) {
        return (
          <div style={{ ...style, display: 'flex', alignItems: 'center', paddingLeft: '20px' }}>
            <Text color="textSubtle" small>
              {t('Popular Tokens')}
            </Text>
          </div>
        )
      }

      if (currency === ALL_TOKENS_HEADER) {
        return (
          <div style={{ ...style, display: 'flex', alignItems: 'end', paddingLeft: '20px', paddingBottom: '8px' }}>
            <Text color="textSubtle" small>
              {t('All Tokens')}
            </Text>
          </div>
        )
      }

      // undefined slot = the inactive-list separator row
      if (currency === undefined) {
        return (
          <FixedContentRow style={style}>
            <LightGreyCard padding="8px 12px" borderRadius="8px">
              <RowBetween>
                <Text small>{t('Expanded results from inactive Token Lists')}</Text>
                <QuestionHelper
                  text={t(
                    "Tokens from inactive lists. Import specific tokens below or click 'Manage' to activate more lists.",
                  )}
                  ml="4px"
                />
              </RowBetween>
            </LightGreyCard>
          </FixedContentRow>
        )
      }

      const handleSelect = () => onCurrencySelect(currency)
      const token = wrappedCurrency(currency, currency?.chainId)
      // Inactive currencies start after the separator, which is at popularSectionLength + currencies.length
      const showImport = index > popularSectionLength + currencies.length

      if (showImport && token) {
        return (
          <ImportRow
            onCurrencySelect={handleSelect}
            style={style}
            token={token}
            showImportView={showImportView}
            setImportToken={setImportToken}
            dim
          />
        )
      }
      return (
        <CurrencyRow
          style={style}
          currency={currency}
          isSelected={isSelected || isNativeWrap}
          onSelect={handleSelect}
          otherSelected={otherSelected}
          showChainLogo={showChainLogo}
        />
      )
    },
    [
      chainId,
      selectedCurrency,
      otherCurrency,
      currencies.length,
      popularSectionLength,
      onCurrencySelect,
      t,
      showImportView,
      setImportToken,
      showChainLogo,
    ],
  )

  const itemKey = useCallback((index: number, data: any) => `${currencyKey(data[index])}-${index}`, [])

  const getItemSize = useCallback(
    (index: number) => {
      const item = itemData[index]
      if (item === POPULAR_HEADER) return 36

      // CurrencyRows and ALL_TOKENS_HEADER
      return 56
    },
    [itemData],
  )

  return (
    <VariableSizeList
      key={popularSectionLength}
      height={height}
      ref={fixedListRef as any}
      width="100%"
      itemData={itemData}
      itemCount={itemData.length}
      itemSize={getItemSize}
      itemKey={itemKey}
    >
      {Row}
    </VariableSizeList>
  )
}
