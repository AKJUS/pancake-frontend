import React, { useCallback, useMemo, useRef, useState } from 'react'

import { RecentTransactions } from 'components/App/Transactions/TransactionsModal'
import { ASSET_CDN } from 'config/constants/endpoints'
import { useMenuTab, WalletView } from 'components/Menu/UserMenu/providers/MenuTabProvider'
import { StyledButtonMenuItem, TabsComponent } from 'components/Menu/UserMenu/WalletModal'
import { walletsConfig } from 'config/wallet'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useMultichainAddressBalance } from 'hooks/useAddressBalance'
import { useAtomValue, useSetAtom } from 'jotai'
import { useRouter } from 'next/router'
import { connectedWalletModalVisibleAtom } from 'state/wallet/atom'
import styled from 'styled-components'
import { formatAmount } from 'utils/formatInfoNumbers'
import { ClaimGiftConfirmView } from 'views/Gift/components/ClaimGiftConfirmView'
import { ClaimGiftView } from 'views/Gift/components/ClaimGiftView'
import { GiftInfoDetailView } from 'views/Gift/components/GiftInfoDetailView'
import { GiftsDashboard } from 'views/Gift/components/GiftsDashboard'
import { CancelGiftProvider } from 'views/Gift/providers/CancelGiftProvider'
import { useClaimGiftContext } from 'views/Gift/providers/ClaimGiftProvider'
import { NetworkSelectPanel } from 'components/NetworkSwitcherModal'
import { useConnect } from 'wagmi'

import { NonEVMChainId } from '@pancakeswap/chains'
import { useTheme } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { previouslyUsedEvmWalletsAtom } from '@pancakeswap/ui-wallets/src/state/atom'
import {
  ArrowBackIcon,
  ArrowForwardIcon,
  Box,
  Button,
  ButtonMenu,
  Checkbox,
  ChevronDownIcon,
  Flex,
  FlexGap,
  InfoIcon,
  Modal,
  ModalHeader,
  ModalV2,
  Text,
  useMatchBreakpoints,
  useTooltip,
} from '@pancakeswap/uikit'
import { useWallet } from '@solana/wallet-adapter-react'

import { ActionButton } from './ActionButton'
import { AssetsList } from './AssetsList'
import { ConnectedWallets } from './ConnectedWallets'
import { ConnectedWalletsButton } from './ConnectedWalletsButton'
import EmptyWalletActions from './EmptyWalletActions'
import { ReceiveContent } from './ReceiveModal'
import ReceiveOptionsView from './ReceiveOptionsView'
import { SendAssets } from './SendAssets'
import { SEND_ENTRY, ViewState } from './type'
import { useWalletModalV2ViewState } from './WalletModalV2ViewStateProvider'

interface WalletModalProps {
  isOpen: boolean
  evmAccount?: string
  solanaAccount?: string
  onDismiss: () => void
  onReceiveClick: () => void
  onDisconnect: () => void
}

const StyledModal = styled(Modal)`
  width: 100%;
  border-radius: 24px;
  padding: 0;
  overflow: hidden;
  ${ModalHeader} {
    display: none;
  }
`

const GrabberBar = styled.div`
  width: 36px;
  height: 4px;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.textSubtle};
  opacity: 0.3;
  margin: 8px auto 4px;
  flex-shrink: 0;
`

const TotalBalanceInteger = styled(Text)`
  font-size: 40px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`

const TotalBalanceDecimal = styled(Text)`
  font-size: 40px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSubtle};
`

const ActionButtonsContainer = styled(FlexGap)`
  padding: 16px 0px;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  ${({ theme }) => theme.mediaQueries.md} {
    padding: 16px;
  }
`

const WalletOuterBox = styled(Box)`
  display: flex;
  flex-direction: column;
  height: calc(90vh - 105px);
  overflow: hidden;
  ${({ theme }) => theme.mediaQueries.md} {
    height: calc(100vh - 80px);
    min-height: 610px;
    max-height: 734px;
  }
`

const WalletContentBody = styled(Box)`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

const ChainSelectorButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0;
  padding: 8px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-bottom-width: 2px;
  background: ${({ theme }) => theme.colors.cardSecondary};
  cursor: pointer;
`

const SquareChainIcon = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  object-fit: contain;
`

const ChainPickerOverlay = styled(Box)`
  position: absolute;
  top: 72px;
  left: 16px;
  right: 16px;
  z-index: 10;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.secondary};
  background: ${({ theme }) => theme.colors.input};
  box-shadow: 2px 2px 2px 2px #7645d933, -2px 2px 2px 2px #7645d933;
  overflow: hidden;
`

const ChainPickerBackdrop = styled(Box)`
  position: absolute;
  inset: 0;
  z-index: 9;
`

const FilterRow = styled(Flex)`
  align-items: center;
  justify-content: space-between;
  width: 100%;
`

const FilterPill = styled(Flex)`
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-bottom-width: 2px;
  background: ${({ theme }) => theme.colors.cardSecondary};
`

const WalletModal: React.FC<WalletModalProps> = ({
  evmAccount,
  solanaAccount,
  onDismiss,
  isOpen,
  onReceiveClick,
  onDisconnect,
}) => {
  const { viewState } = useWalletModalV2ViewState()
  const { isMobile } = useMatchBreakpoints()

  // If no account is provided, show a message or redirect
  if (!evmAccount && !solanaAccount && viewState !== ViewState.CLAIM_GIFT) {
    return null
  }
  return (
    <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
      <StyledModal title={undefined} onDismiss={onDismiss} hideCloseButton bodyPadding="16px">
        {isMobile && <GrabberBar />}
        <WalletContent
          evmAccount={evmAccount}
          solanaAccount={solanaAccount}
          onDisconnect={onDisconnect}
          onDismiss={onDismiss}
          onReceiveClick={onReceiveClick}
        />
      </StyledModal>
    </ModalV2>
  )
}

export const WalletContent = ({
  evmAccount,
  solanaAccount,
  onDismiss,
  onReceiveClick: _onReceiveClick,
  onDisconnect: _onDisconnect,
}: {
  evmAccount: string | undefined
  solanaAccount: string | undefined
  onDismiss: () => void
  onReceiveClick: () => void
  onDisconnect: () => void
}) => {
  const { view, setView } = useMenuTab()
  const { t } = useTranslation()
  const router = useRouter()
  const { isMobile } = useMatchBreakpoints()
  const { viewState, setViewState, goBack, setSendEntry } = useWalletModalV2ViewState()
  const { setCode } = useClaimGiftContext()
  const { theme } = useTheme()
  const setConnectedWalletModalVisible = useSetAtom(connectedWalletModalVisibleAtom)

  const { chainId } = useActiveChainId()
  const [selectedReceiveAccount, setSelectedReceiveAccount] = useState<string | undefined>(undefined)
  const [selectedReceiveChain, setSelectedReceiveChain] = useState<'evm' | 'solana' | undefined>(undefined)

  // Wallet connection hooks for getting icons
  const { connectAsync } = useConnect()
  const { wallet: solanaWallet } = useWallet()
  const previouslyUsedEvmWalletsId = useAtomValue(previouslyUsedEvmWalletsAtom)
  const walletConfig = walletsConfig({ chainId, connect: connectAsync })

  // Get selected wallet icon
  const selectedWalletIcon = useMemo(() => {
    if (selectedReceiveChain === 'solana') {
      return solanaWallet?.adapter.icon as string | undefined
    }
    if (selectedReceiveChain === 'evm') {
      const evmWallet = walletConfig.find((w) => w.id === previouslyUsedEvmWalletsId[0])
      return evmWallet?.icon as string | undefined
    }
    return undefined
  }, [selectedReceiveChain, solanaWallet, walletConfig, previouslyUsedEvmWalletsId])

  // Fetch balances using the hook we created
  const { balances, isLoading, totalBalanceUsd } = useMultichainAddressBalance()

  const [hideSmallBalances, setHideSmallBalances] = useState(false)
  const [showChainPicker, setShowChainPicker] = useState(false)
  const {
    targetRef: hideSmallBalancesRef,
    tooltip: hideSmallBalancesTooltip,
    tooltipVisible: hideSmallBalancesTooltipVisible,
  } = useTooltip(t('Hides tokens worth less than $0.1'), { placement: 'bottom' })
  const chainPickerRef = useRef<HTMLButtonElement>(null)

  const filteredBalances = useMemo(() => {
    return balances.filter((balance) => {
      if (hideSmallBalances && (balance.price?.totalUsd ?? 0) < 0.1) return false
      return true
    })
  }, [balances, hideSmallBalances])

  const balanceDisplay = useMemo(() => {
    const display = formatAmount(totalBalanceUsd)?.split('.')
    return {
      integer: display?.[0] || '',
      decimal: display?.[1] || '',
    }
  }, [totalBalanceUsd])

  const noAssets = (balances.length === 0 || totalBalanceUsd === 0) && !isLoading
  const handleClick = useCallback(
    (newIndex: number) => {
      setView(newIndex)
    },
    [setView],
  )

  const actionView = useMemo(() => {
    if (viewState === ViewState.GIFT_INFO_DETAIL) return <GiftInfoDetailView />

    // Receive Options
    if (viewState === ViewState.RECEIVE_OPTIONS) {
      return (
        <ReceiveOptionsView
          onSelectEVM={() => {
            setSelectedReceiveAccount(evmAccount)
            setSelectedReceiveChain('evm')
            setViewState(ViewState.RECEIVE_QR)
          }}
          onSelectSolana={() => {
            setSelectedReceiveAccount(solanaAccount ?? undefined)
            setSelectedReceiveChain('solana')
            setViewState(ViewState.RECEIVE_QR)
          }}
          evmAccount={evmAccount}
          solanaAccount={solanaAccount ?? undefined}
        />
      )
    }

    // Receive QR
    if (viewState === ViewState.RECEIVE_QR) {
      return (
        <>
          <ButtonMenu
            scale="sm"
            variant="text"
            onItemClick={(index) =>
              index === 0 ? setViewState(ViewState.RECEIVE_QR) : setViewState(ViewState.CLAIM_GIFT)
            }
            activeIndex={viewState === ViewState.RECEIVE_QR ? 0 : 1}
          >
            <StyledButtonMenuItem>{t('Address')}</StyledButtonMenuItem>
            <StyledButtonMenuItem>{t('Claim Gift')}</StyledButtonMenuItem>
          </ButtonMenu>

          <ReceiveContent
            account={selectedReceiveAccount || ''}
            chainType={selectedReceiveChain}
            walletIcon={selectedWalletIcon}
          />
        </>
      )
    }

    // Claim Gift
    if ([ViewState.CLAIM_GIFT, ViewState.CLAIM_GIFT_CONFIRM].includes(viewState)) {
      return (
        <>
          {viewState === ViewState.CLAIM_GIFT ? (
            <ClaimGiftView setViewState={setViewState} />
          ) : (
            <ClaimGiftConfirmView />
          )}
        </>
      )
    }

    return (
      <SendAssets
        assets={balances}
        isLoading={isLoading}
        onViewStateChange={setViewState}
        viewState={viewState}
        onBack={goBack}
      />
    )
  }, [
    t,
    viewState,
    balances,
    isLoading,
    goBack,
    setViewState,
    evmAccount,
    solanaAccount,
    selectedReceiveAccount,
    selectedReceiveChain,
    selectedWalletIcon,
  ])

  if (viewState === ViewState.CONNECTED_WALLETS) {
    return (
      <Box
        minWidth={isMobile ? '100%' : '357px'}
        maxHeight={isMobile ? 'auto' : 'calc(100vh - 80px)'}
        maxWidth={isMobile ? '100%' : '377px'}
        overflowY={isMobile ? undefined : 'auto'}
        p="16px"
      >
        <ConnectedWallets onBack={goBack} solanaAddress={solanaAccount} evmAddress={evmAccount} />
      </Box>
    )
  }

  return (
    <WalletOuterBox minWidth={isMobile ? '100%' : '357px'} maxWidth={isMobile ? '100%' : '377px'} position="relative">
      {showChainPicker && viewState === ViewState.WALLET_INFO && (
        <>
          <ChainPickerBackdrop onClick={() => setShowChainPicker(false)} />
          <ChainPickerOverlay>
            <NetworkSelectPanel onDismiss={() => setShowChainPicker(false)} />
          </ChainPickerOverlay>
        </>
      )}
      {(evmAccount || solanaAccount) && viewState === ViewState.WALLET_INFO ? (
        <FlexGap py="16px" px={isMobile ? 0 : '16px'} justifyContent="space-between" alignItems="center" gap="8px">
          <ConnectedWalletsButton
            evmAccount={evmAccount}
            solanaAccount={solanaAccount}
            onClick={() => {
              setConnectedWalletModalVisible(true)
              setViewState(ViewState.CONNECTED_WALLETS)
            }}
          />
          <ChainSelectorButton
            ref={chainPickerRef as React.RefObject<HTMLButtonElement>}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowChainPicker((c) => !c)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SquareChainIcon src={`${ASSET_CDN}/web/chains/square/${chainId}.svg`} alt={`chain-${chainId}`} />
            <ChevronDownIcon color="textSubtle" width="24px" />
          </ChainSelectorButton>
        </FlexGap>
      ) : null}
      {viewState > ViewState.SEND_ASSETS && (
        <FlexGap py="16px" gap="8px" justifyContent="space-between" alignItems="center">
          <FlexGap alignItems="center" gap="8px" ml={isMobile ? '8px' : '16px'}>
            <Button
              variant="tertiary"
              style={{ width: '34px', height: '34px', padding: '6px', borderRadius: '12px' }}
              onClick={() => {
                if (ViewState.CLAIM_GIFT_CONFIRM === viewState) {
                  setCode('')
                }
                goBack()
              }}
            >
              <ArrowBackIcon fontSize="24px" color={theme.colors.primary60} />
            </Button>
            {[ViewState.RECEIVE_OPTIONS, ViewState.RECEIVE_QR].includes(viewState) && (
              <Text fontSize="20px" fontWeight="600" color="text">
                {t('Receive Crypto')}
              </Text>
            )}
            {[ViewState.CLAIM_GIFT, ViewState.CLAIM_GIFT_CONFIRM].includes(viewState) && (
              <Text fontSize="20px" fontWeight="600" color="text">
                {t('Claim Gift')}
              </Text>
            )}
          </FlexGap>
        </FlexGap>
      )}

      <CancelGiftProvider>
        <WalletContentBody padding={isMobile ? '0' : '0 16px 16px'}>
          {viewState >= ViewState.SEND_ASSETS ? (
            actionView
          ) : (
            <>
              {!noAssets && (
                <Box mb="16px" ml="-16px" onClick={(e) => e.stopPropagation()}>
                  <TabsComponent
                    view={view}
                    solanaAccount={solanaAccount}
                    evmAccount={evmAccount}
                    handleClick={handleClick}
                    style={{ backgroundColor: 'transparent', padding: '0', borderBottom: 'none' }}
                  />
                </Box>
              )}
              <Box mb="16px" style={{ flexShrink: 0 }}>
                <Text fontSize="20px" fontWeight="600">
                  {t('My Wallet')}
                </Text>
                <FlexGap alignItems="center" gap="3px">
                  <TotalBalanceInteger lineHeight={1.2}>${balanceDisplay.integer}</TotalBalanceInteger>
                  <TotalBalanceDecimal lineHeight={1.2}>.{balanceDisplay.decimal}</TotalBalanceDecimal>
                </FlexGap>
              </Box>
              {view === WalletView.GIFTS ? (
                <GiftsDashboard setViewState={setViewState} />
              ) : view === WalletView.WALLET_INFO && !noAssets ? (
                <>
                  <FilterRow mb="16px">
                    <FilterPill>
                      <Text fontSize="14px" color="textSubtle">
                        {t('Hide small balances')}
                      </Text>
                      <span ref={hideSmallBalancesRef} style={{ display: 'inline-flex', cursor: 'pointer' }}>
                        <InfoIcon width="16px" color="textSubtle" />
                      </span>
                      {hideSmallBalancesTooltipVisible && hideSmallBalancesTooltip}
                      <Checkbox
                        scale="xs"
                        checked={hideSmallBalances}
                        onChange={() => setHideSmallBalances((c) => !c)}
                      />
                    </FilterPill>
                  </FilterRow>
                  <AssetsList assets={filteredBalances} isLoading={isLoading} />
                </>
              ) : (
                !noAssets && (
                  <Box padding="16px 0" maxHeight="280px" overflow="auto">
                    <RecentTransactions />
                  </Box>
                )
              )}
            </>
          )}
        </WalletContentBody>
      </CancelGiftProvider>
      {viewState === ViewState.WALLET_INFO && (
        <>
          {noAssets ? (
            chainId === NonEVMChainId.SOLANA ? (
              <EmptyWalletActions
                onDismiss={onDismiss}
                setViewState={setViewState}
                description={t('This wallet looks new. Does not have any assets.')}
              />
            ) : (
              <EmptyWalletActions onDismiss={onDismiss} setViewState={setViewState} />
            )
          ) : view === WalletView.GIFTS ? null : (
            <ActionButtonsContainer>
              <FlexGap gap="8px" width="100%">
                <ActionButton
                  onClick={() => {
                    router.push('/buy-crypto')
                    onDismiss()
                  }}
                  variant="tertiary"
                >
                  {t('Buy')}
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    setViewState(ViewState.SEND_ASSETS)
                    setSendEntry(SEND_ENTRY.SEND_ONLY)
                  }}
                  variant="tertiary"
                >
                  {t('Send')}
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    setViewState(ViewState.RECEIVE_OPTIONS)
                  }}
                  variant="tertiary"
                >
                  {t('Receive')}
                </ActionButton>
              </FlexGap>

              <Button
                variant="text"
                onClick={() => {
                  router.push('/bridge')
                  onDismiss()
                }}
              >
                {t('Bridge Crypto')}?
                <ArrowForwardIcon color="primary" />
              </Button>
            </ActionButtonsContainer>
          )}
        </>
      )}
    </WalletOuterBox>
  )
}

export default WalletModal
