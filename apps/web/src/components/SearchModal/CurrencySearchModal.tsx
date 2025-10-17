import { useCallback, useEffect, useRef, useState } from 'react'

import AddToWalletButton from 'components/AddToWallet/AddToWalletButton'
import { ViewOnExplorerButton } from 'components/ViewOnExplorerButton'
import { useAllLists } from 'state/lists/hooks'
import { useListState } from 'state/lists/lists'
import { styled } from 'styled-components'
import { getTokenSymbolAlias } from 'utils/getTokenAlias'

import { UnifiedChainId } from '@pancakeswap/chains'
import { usePreviousValue } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { SPLToken, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { TokenList, WrappedTokenInfo } from '@pancakeswap/token-lists'
import { enableList, removeList, useFetchListCallback } from '@pancakeswap/token-lists/react'
import {
  CopyButton,
  FlexGap,
  InjectedModalProps,
  MODAL_SWIPE_TO_CLOSE_VELOCITY,
  ModalBackButton,
  ModalBody,
  ModalCloseButton,
  ModalContainer,
  ModalHeader,
  ModalTitle,
  Text,
} from '@pancakeswap/uikit'
import { CurrencyLogo, ImportList } from '@pancakeswap/widgets-internal'

import CurrencySearch from './CurrencySearch'
import ImportToken from './ImportToken'
import Manage from './Manage'
import { CommonBasesType, CurrencyModalView } from './types'
import SolanaImportToken from './SolanaImportToken'

const StyledModalContainer = styled(ModalContainer)`
  width: 100%;
  min-width: 320px;
  min-height: calc(var(--vh, 1vh) * 90);

  ${({ theme }) => theme.mediaQueries.sm} {
    max-width: 420px !important;
    min-height: auto;
  }
`

const StyledModalHeader = styled(ModalHeader)`
  border: none;
`

const StyledModalBody = styled(ModalBody)<{ $allowScroll?: boolean }>`
  padding: 4px 24px 24px;
  max-height: calc(90vh);

  overflow-y: ${({ $allowScroll }) => ($allowScroll ? 'auto' : 'hidden')};
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`

export interface CurrencySearchModalProps extends InjectedModalProps {
  selectedCurrency?: UnifiedCurrency | null
  onCurrencySelect?: (currency: UnifiedCurrency) => void
  otherSelectedCurrency?: UnifiedCurrency | null
  showCommonBases?: boolean
  commonBasesType?: CommonBasesType
  showSearchInput?: boolean
  tokensToShow?: Token[]
  showCurrencyInHeader?: boolean
  showSearchHeader?: boolean
  modalTitle?: React.ReactNode
  mode?: string
  supportCrossChain?: boolean
  showNative?: boolean
}

export default function CurrencySearchModal({
  supportCrossChain = false,
  onDismiss = () => null,
  onCurrencySelect,
  selectedCurrency,
  otherSelectedCurrency,
  commonBasesType,
  tokensToShow,
  modalTitle,
  showCommonBases = true,
  showSearchInput,
  showCurrencyInHeader = false,
  showSearchHeader,
  mode,
  showNative = true,
}: CurrencySearchModalProps) {
  const [modalView, setModalView] = useState<CurrencyModalView>(CurrencyModalView.search)
  const [selectedChainId, setSelectedChainId] = useState<UnifiedChainId | undefined>(selectedCurrency?.chainId)

  const handleCurrencySelect = useCallback(
    (currency: UnifiedCurrency) => {
      onDismiss?.()
      onCurrencySelect?.(currency)
    },
    [onDismiss, onCurrencySelect],
  )

  // for token import view
  const prevView = usePreviousValue(modalView)

  // used for import token flow
  const [importToken, setImportToken] = useState<Token | SPLToken | undefined>()

  // used for import list
  const [importList, setImportList] = useState<TokenList | undefined>()
  const [listURL, setListUrl] = useState<string | undefined>()

  const { t } = useTranslation()

  const [, dispatch] = useListState()
  const lists = useAllLists()
  const adding = Boolean(listURL && lists[listURL]?.loadingRequestId)

  const fetchList = useFetchListCallback(dispatch)

  const [addError, setAddError] = useState<string | null>(null)

  const handleAddList = useCallback(() => {
    if (adding || !listURL) return
    setAddError(null)
    fetchList(listURL)
      .then(() => {
        dispatch(enableList(listURL))
        setModalView(CurrencyModalView.manage)
      })
      .catch((error) => {
        setAddError(error.message)
        dispatch(removeList(listURL))
      })
  }, [adding, dispatch, fetchList, listURL])

  const config = {
    [CurrencyModalView.search]: { title: t('Select a Token'), onBack: undefined },
    [CurrencyModalView.manage]: { title: t('Manage Tokens'), onBack: () => setModalView(CurrencyModalView.search) },
    [CurrencyModalView.importToken]: {
      title: t('Import Tokens'),
      onBack: () =>
        setModalView(prevView && prevView !== CurrencyModalView.importToken ? prevView : CurrencyModalView.search),
    },
    [CurrencyModalView.importList]: { title: t('Import List'), onBack: () => setModalView(CurrencyModalView.search) },
  }
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!wrapperRef.current) return

    setHeight(wrapperRef.current.offsetHeight)
  }, [])

  return (
    <StyledModalContainer
      dragConstraints={{ top: 0, bottom: 600 }}
      dragElastic={{ top: 0 }}
      dragSnapToOrigin
      onDragStart={() => {
        if (wrapperRef.current) wrapperRef.current.style.animation = 'none'
      }}
      // @ts-ignore
      onDragEnd={(e, info) => {
        if (info.velocity.y > MODAL_SWIPE_TO_CLOSE_VELOCITY && onDismiss) onDismiss()
      }}
      ref={wrapperRef}
    >
      {(!showSearchHeader || modalView !== CurrencyModalView.search) && (
        <StyledModalHeader>
          <ModalTitle>
            {config[modalView].onBack && <ModalBackButton onBack={config[modalView].onBack} />}
            {showCurrencyInHeader && selectedCurrency ? (
              <>
                <CurrencyLogo
                  size="32px"
                  showChainLogo={supportCrossChain}
                  currency={selectedCurrency}
                  style={{ borderRadius: '50%' }}
                />
                <Text px="8px" bold fontSize="20px">
                  {getTokenSymbolAlias(
                    selectedCurrency.wrapped.address,
                    selectedCurrency.chainId,
                    selectedCurrency.symbol,
                  )}
                </Text>
                {!selectedCurrency.isNative && (
                  <FlexGap gap="8px" alignItems="center">
                    <CopyButton
                      data-dd-action-name="Copy token address"
                      width="16px"
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
                      width="18px"
                      tooltipPlacement="top"
                    />
                    <AddToWalletButton
                      data-dd-action-name="Add to wallet"
                      variant="text"
                      p="0"
                      height="auto"
                      width="fit-content"
                      tokenAddress={selectedCurrency.wrapped.address}
                      tokenSymbol={selectedCurrency.symbol}
                      tokenDecimals={selectedCurrency.decimals}
                      tokenLogo={
                        selectedCurrency.wrapped instanceof WrappedTokenInfo
                          ? selectedCurrency.wrapped.logoURI
                          : undefined
                      }
                      tooltipPlacement="top"
                    />
                  </FlexGap>
                )}
              </>
            ) : (
              <Text fontSize="18px" bold>
                {config[modalView].title}
              </Text>
            )}
          </ModalTitle>
          <ModalCloseButton onDismiss={onDismiss} />
        </StyledModalHeader>
      )}
      <StyledModalBody $allowScroll={modalView === CurrencyModalView.importToken}>
        {modalView === CurrencyModalView.search ? (
          <CurrencySearch
            onSettingsClick={() => setModalView(CurrencyModalView.manage)}
            supportCrossChain={supportCrossChain}
            onCurrencySelect={handleCurrencySelect}
            selectedCurrency={selectedCurrency}
            otherSelectedCurrency={otherSelectedCurrency}
            showCommonBases={showCommonBases}
            commonBasesType={commonBasesType}
            showSearchInput={showSearchInput}
            showImportView={() => setModalView(CurrencyModalView.importToken)}
            setImportToken={setImportToken}
            height={height}
            tokensToShow={tokensToShow}
            showChainLogo={supportCrossChain}
            showSearchHeader={showSearchHeader}
            headerTitle={modalTitle}
            onDismiss={onDismiss}
            mode={mode}
            setSelectedChainId={setSelectedChainId}
            selectedChainId={selectedChainId}
            showNative={showNative}
          />
        ) : modalView === CurrencyModalView.importToken && importToken ? (
          importToken instanceof SPLToken ? (
            <SolanaImportToken tokens={[importToken]} handleCurrencySelect={handleCurrencySelect} />
          ) : (
            <ImportToken tokens={[importToken]} handleCurrencySelect={handleCurrencySelect} />
          )
        ) : modalView === CurrencyModalView.importList && importList && listURL ? (
          <ImportList
            onAddList={handleAddList}
            addError={addError}
            listURL={listURL}
            listLogoURI={importList?.logoURI}
            listName={importList?.name}
            listTokenLength={importList?.tokens.length}
          />
        ) : modalView === CurrencyModalView.manage ? (
          <Manage
            setModalView={setModalView}
            setImportToken={setImportToken}
            setImportList={setImportList}
            setListUrl={setListUrl}
            chainId={selectedChainId}
          />
        ) : null}
      </StyledModalBody>
    </StyledModalContainer>
  )
}
