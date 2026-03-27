import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ConnectWalletButton from 'components/ConnectWalletButton'
import { WalletContent, WalletModalV2 } from 'components/WalletModalV2'
import { SEND_ENTRY, ViewState } from 'components/WalletModalV2/type'
import {
  useWalletModalV2ViewState,
  WalletModalV2ViewStateProvider,
} from 'components/WalletModalV2/WalletModalV2ViewStateProvider'
import { useAccountActiveChain } from 'hooks/useAccountActiveChain'
import { useMultichainAddressBalance } from 'hooks/useAddressBalance'
import useAuth from 'hooks/useAuth'
import { useDomainNameForAddress } from 'hooks/useDomain'
import { useProfile } from 'state/profile/hooks'
import { usePendingTransactions } from 'state/transactions/hooks'
import { useCurrentWalletIcon } from 'state/wallet/hooks'
import styled from 'styled-components'
import { logGTMDisconnectWalletEvent } from 'utils/customGTMEventTracking'
import { formatAmount } from 'utils/formatInfoNumbers'
import { useCakepadBaseExperience } from 'views/Cakepad/hooks/useCakepadBaseExperience'
import { useAutoFillCode } from 'views/Gift/hooks/useAutoFillCode'
import { ClaimGiftProvider, useClaimGiftContext } from 'views/Gift/providers/ClaimGiftProvider'
import { SendGiftProvider, useSendGiftContext } from 'views/Gift/providers/SendGiftProvider'
import { UnclaimedOnlyProvider } from 'views/Gift/providers/UnclaimedOnlyProvider'
import { useAccount } from 'wagmi'
import SolanaConnectButton from 'wallet/components/SolanaConnectButton'
import { usePrivyWalletAddress } from 'wallet/Privy/hooks'

import { isSolana, NonEVMChainId } from '@pancakeswap/chains'
import { Trans, useTranslation } from '@pancakeswap/localization'
import {
  Box,
  FlexGap,
  useMatchBreakpoints,
  UserMenu as UIKitUserMenu,
  UserMenuVariant,
  useTooltip,
} from '@pancakeswap/uikit'
import { usePrivy } from '@privy-io/react-auth'
import { useWallet } from '@solana/wallet-adapter-react'

import { useWalletPanel } from '../WalletPanelContext'
import { MenuTabProvider, useMenuTab, WalletView } from './providers/MenuTabProvider'

const UserMenuItems = ({ onReceiveClick, onDismiss }: { onReceiveClick: () => void; onDismiss: () => void }) => {
  const { logout } = useAuth()
  const { chainId, account, solanaAccount } = useAccountActiveChain()
  const { disconnect } = useWallet()
  const { connector } = useAccount()
  const { setViewState } = useWalletModalV2ViewState()
  const { isMobile } = useMatchBreakpoints()

  const handleClickDisconnect = useCallback(() => {
    logGTMDisconnectWalletEvent(chainId, connector?.name, account)
    if (chainId === NonEVMChainId.SOLANA) {
      disconnect()
    } else {
      logout()
    }
  }, [disconnect, logout, connector?.name, account, chainId])

  const handleReceiveClick = useCallback(() => {
    if (isMobile) {
      onReceiveClick()
    } else {
      setViewState(ViewState.RECEIVE_OPTIONS)
    }
  }, [isMobile, onReceiveClick, setViewState])

  return (
    <WalletContent
      solanaAccount={solanaAccount ?? undefined}
      evmAccount={account}
      onDismiss={onDismiss}
      onReceiveClick={handleReceiveClick}
      onDisconnect={handleClickDisconnect}
    />
  )
}

// Custom wrapper for UIKitUserMenu that adds click functionality for desktop
const ClickableUserMenu = styled.div`
  position: relative;
`

const ClickablePopover = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 1001;
  min-width: 380px;
  background-color: ${({ theme }) => theme.card.background};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: 16px;
  margin-top: 0;
  visibility: ${({ isOpen }) => (isOpen ? 'visible' : 'hidden')};
  opacity: ${({ isOpen }) => (isOpen ? 1 : 0)};
  transition: visibility 0.2s, opacity 0.2s;
  pointer-events: ${({ isOpen }) => (isOpen ? 'auto' : 'none')};
`

const useAvatar = () => {
  const { chainId, unifiedAccount } = useAccountActiveChain()
  const { profile } = useProfile()
  const { avatar } = useDomainNameForAddress(isSolana(chainId) ? undefined : unifiedAccount ?? undefined)
  const walletIcon = useCurrentWalletIcon()
  return useMemo(() => {
    if (!isSolana(chainId) && profile?.nft?.image?.thumbnail) return profile.nft.image.thumbnail
    if (avatar) return avatar

    return walletIcon
  }, [avatar, chainId, profile?.nft?.image?.thumbnail, walletIcon])
}

const UserMenu = () => {
  const { t } = useTranslation()
  const { chainId, account: evmAccount, solanaAccount, isWrongNetwork } = useAccountActiveChain()
  const { connector } = useAccount()
  const { ready, authenticated, user } = usePrivy()
  const isCakepadBaseRoute = useCakepadBaseExperience()

  // Use new Privy wallet address hook to prevent flickering
  const { address: privyAddress, isLoading: isPrivyAddressLoading, hasSetupFailed } = usePrivyWalletAddress()

  // Determine which address to use: if Privy login use privyAddress, otherwise use account
  const finalAddress = useMemo(() => {
    if (ready && authenticated && user) return privyAddress
    if (chainId === NonEVMChainId.SOLANA && solanaAccount) return solanaAccount
    if (chainId !== NonEVMChainId.SOLANA && evmAccount) return evmAccount

    return evmAccount ?? solanaAccount ?? undefined
  }, [ready, authenticated, user, privyAddress, evmAccount, solanaAccount, chainId])

  const shouldShowLoading = ready && authenticated && user ? isPrivyAddressLoading : false
  const currentAccount = chainId === NonEVMChainId.SOLANA ? solanaAccount ?? undefined : evmAccount
  const { domainName } = useDomainNameForAddress(chainId === NonEVMChainId.SOLANA ? undefined : currentAccount)
  const avatarSrc = useAvatar()

  const { logout } = useAuth()
  const { disconnect } = useWallet()
  const { hasPendingTransactions, pendingNumber } = usePendingTransactions()
  const [userMenuText, setUserMenuText] = useState<string>('')
  const [userMenuVariable, setUserMenuVariable] = useState<UserMenuVariant>('default')
  const { isMobile } = useMatchBreakpoints()
  // State for mobile modal
  const [showMobileWalletModal, setShowMobileWalletModal] = useState(false)
  const [showDesktopPopup] = useState(true)

  const { reset: resetViewState, viewState } = useWalletModalV2ViewState()
  const { setSendEntry, setViewState } = useWalletModalV2ViewState()
  const { setCode, code: giftCode } = useClaimGiftContext()
  const { setNativeAmount, setIncludeStarterGas } = useSendGiftContext()
  const { request: walletPanelRequest, clearWalletPanelRequest } = useWalletPanel()
  // State for click-based menu (mobile) / hover-based (desktop)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const viewStateRef = useRef(viewState)
  viewStateRef.current = viewState
  const menuRef = useRef<HTMLDivElement>(null)
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { totalBalanceUsd } = useMultichainAddressBalance()
  const desktopBalanceLabel = useMemo(() => {
    if (isMobile) return undefined
    const display = formatAmount(totalBalanceUsd)?.split('.')
    if (!display?.[0]) return undefined
    return { integer: `$${display[0]}`, decimal: `.${display[1] ?? '00'}` }
  }, [totalBalanceUsd, isMobile])

  const clearHoverLeave = useCallback(() => {
    if (hoverLeaveTimer.current) {
      clearTimeout(hoverLeaveTimer.current)
      hoverLeaveTimer.current = null
    }
  }, [])

  const handleWalletHoverEnter = useCallback(() => {
    if (isMobile) return
    clearHoverLeave()
    setIsMenuOpen(true)
  }, [isMobile, clearHoverLeave])

  const handleWalletHoverLeave = useCallback(() => {
    if (isMobile) return
    if (viewStateRef.current > ViewState.WALLET_INFO) return
    clearHoverLeave()
    hoverLeaveTimer.current = setTimeout(() => {
      if (viewStateRef.current > ViewState.WALLET_INFO) return
      setIsMenuOpen(false)
      resetViewState()
      setCode('')
    }, 120)
  }, [isMobile, clearHoverLeave, resetViewState, setCode])
  const { setView } = useMenuTab()
  const [hasInitialized, setHasInitialized] = useState(false)

  // Show AA wallet setup failed state - moved to top level
  const { targetRef, tooltip, tooltipVisible } = useTooltip(t('Please refresh the page and try it again'), {
    placement: 'top',
  })

  // Track if we should show error state
  // Only show error after proper initialization and multiple failed attempts
  useEffect(() => {
    if (ready && authenticated && user) {
      // Wait longer on first load to ensure AA wallet has time to setup
      const delay = hasInitialized ? 1000 : 5000 // 5 seconds on first load, 1 second on subsequent
      const timer = setTimeout(() => {
        setHasInitialized(true)
      }, delay)
      return () => clearTimeout(timer)
    }
    // Reset when not authenticated
    setHasInitialized(false)

    return undefined
  }, [ready, authenticated, user, hasInitialized])

  // Reset hasInitialized when successfully connected to prevent false error states
  useEffect(() => {
    if (finalAddress && !isPrivyAddressLoading) {
      setHasInitialized(false) // Reset so next login gets proper delay
    }
  }, [finalAddress, isPrivyAddressLoading])

  const ConnectBtn = useMemo(() => {
    if (chainId === NonEVMChainId.SOLANA) {
      return SolanaConnectButton
    }
    return ConnectWalletButton
  }, [chainId])

  useAutoFillCode({
    onAutoFillCode: () => {
      if (isMobile) {
        setShowMobileWalletModal(true)
      } else {
        setIsMenuOpen(true)
      }
    },
  })

  useEffect(() => {
    if (isMenuOpen && viewState === ViewState.WALLET_INFO) {
      setView(WalletView.WALLET_INFO)
      setNativeAmount(undefined)
      setIncludeStarterGas(false)
    }
  }, [isMenuOpen, viewState, setView, setNativeAmount, setIncludeStarterGas])

  useEffect(() => {
    if (!walletPanelRequest) return

    if (!(finalAddress || giftCode || isWrongNetwork)) {
      clearWalletPanelRequest()
      return
    }

    setView(WalletView.WALLET_INFO)
    setNativeAmount(undefined)
    setIncludeStarterGas(false)

    if (walletPanelRequest.action === 'send') {
      setSendEntry(SEND_ENTRY.SEND_ONLY)
      setViewState(ViewState.SEND_ASSETS)
    } else {
      setViewState(ViewState.RECEIVE_OPTIONS)
    }

    if (isMobile) {
      setShowMobileWalletModal(true)
    } else {
      clearHoverLeave()
      setIsMenuOpen(true)
    }

    clearWalletPanelRequest()
  }, [
    walletPanelRequest,
    finalAddress,
    giftCode,
    isWrongNetwork,
    clearWalletPanelRequest,
    setView,
    setNativeAmount,
    setIncludeStarterGas,
    setSendEntry,
    setViewState,
    isMobile,
    clearHoverLeave,
  ])

  // Click outside to close (mobile always, desktop when in send/receive views)
  useEffect(() => {
    const isNonWalletView = viewState > ViewState.WALLET_INFO
    if (!isMobile && !isNonWalletView) return undefined
    if (!isMenuOpen && !showMobileWalletModal) return undefined
    if (viewState === ViewState.CONFIRM_TRANSACTION) return undefined

    const handleClickOutside = (event: MouseEvent) => {
      const portalRoot = document.getElementById('portal-root')
      const isClickInPortal = portalRoot?.contains(event.target as Node)
      if (isClickInPortal) return
      if (menuRef.current?.contains(event.target as Node)) return

      setIsMenuOpen(false)
      if (isMobile) setShowMobileWalletModal(false)
      resetViewState()
      setCode('')
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMobile, isMenuOpen, showMobileWalletModal, viewState, resetViewState, setCode])

  useEffect(() => {
    if (hasPendingTransactions) {
      setUserMenuText(t('%num% Pending', { num: pendingNumber }))
      setUserMenuVariable('pending')
    } else {
      setUserMenuText('')
      setUserMenuVariable('default')
    }
  }, [hasPendingTransactions, pendingNumber, t])

  const handleClickDisconnect = useCallback(() => {
    logGTMDisconnectWalletEvent(chainId, connector?.name, finalAddress)
    if (chainId === NonEVMChainId.SOLANA) {
      disconnect()
    } else {
      logout()
    }
  }, [disconnect, logout, connector?.name, finalAddress, chainId])

  const accountDisplay = useMemo(() => {
    return domainName || finalAddress
  }, [domainName, finalAddress])

  const desktopBalanceText = useMemo(() => {
    if (isMobile || !desktopBalanceLabel) return undefined
    return (
      <>
        {desktopBalanceLabel.integer}
        <span style={{ color: 'var(--colors-textSubtle)' }}>{desktopBalanceLabel.decimal}</span>
      </>
    )
  }, [isMobile, desktopBalanceLabel])

  if (shouldShowLoading) {
    if (isCakepadBaseRoute) {
      return null
    }

    return (
      <ClickableUserMenu ref={menuRef}>
        <UIKitUserMenu
          account={t('Loading...')}
          ellipsis={false}
          avatarSrc={avatarSrc}
          avatarSize={isMobile ? undefined : 24}
          text=""
          variant="default"
          popperStyle={{
            minWidth: '380px',
          }}
          onClick={() => {
            // Don't allow clicking during loading
          }}
        >
          {undefined}
        </UIKitUserMenu>
      </ClickableUserMenu>
    )
  }

  if (finalAddress || giftCode) {
    return (
      <>
        <ClickableUserMenu ref={menuRef} onMouseEnter={handleWalletHoverEnter} onMouseLeave={handleWalletHoverLeave}>
          <UIKitUserMenu
            account={accountDisplay}
            ellipsis={isMobile ? !domainName : false}
            avatarSrc={avatarSrc}
            avatarSize={isMobile ? undefined : 24}
            text={userMenuText || desktopBalanceText}
            variant={userMenuVariable}
            popperStyle={{
              minWidth: '380px',
            }}
            onClick={() => {
              if (isCakepadBaseRoute) {
                return
              }
              if (isMobile) {
                setShowMobileWalletModal(true)
              }
            }}
          >
            {/* Make sure the menu won't be triggered by hover */}
            {undefined}
          </UIKitUserMenu>

          {!isMobile && (
            <ClickablePopover
              isOpen={isMenuOpen}
              onMouseEnter={handleWalletHoverEnter}
              onMouseLeave={handleWalletHoverLeave}
            >
              {isMenuOpen && showDesktopPopup && (
                <UserMenuItems onDismiss={() => setIsMenuOpen(false)} onReceiveClick={() => {}} />
              )}
            </ClickablePopover>
          )}
        </ClickableUserMenu>

        {!isCakepadBaseRoute && (
          <WalletModalV2
            isOpen={showMobileWalletModal}
            evmAccount={evmAccount}
            solanaAccount={solanaAccount ?? undefined}
            onReceiveClick={() => {}}
            onDisconnect={handleClickDisconnect}
            onDismiss={() => {
              setShowMobileWalletModal(false)
              resetViewState()
            }}
          />
        )}
      </>
    )
  }

  if (isWrongNetwork) {
    if (isCakepadBaseRoute) {
      return null
    }

    return (
      <ClickableUserMenu ref={menuRef} onMouseEnter={handleWalletHoverEnter} onMouseLeave={handleWalletHoverLeave}>
        <UIKitUserMenu text={t('Network')} variant="danger" avatarSize={isMobile ? undefined : 24}>
          {undefined}
        </UIKitUserMenu>

        {!isMobile && (
          <ClickablePopover
            isOpen={isMenuOpen}
            onMouseEnter={handleWalletHoverEnter}
            onMouseLeave={handleWalletHoverLeave}
          >
            {isMenuOpen && <UserMenuItems onReceiveClick={() => {}} onDismiss={() => setIsMenuOpen(false)} />}
          </ClickablePopover>
        )}
      </ClickableUserMenu>
    )
  }

  // Only show failed state after proper initialization and when not loading
  // This prevents flash on login and ensures the error is real
  if (ready && authenticated && user && hasSetupFailed && hasInitialized && !isPrivyAddressLoading) {
    if (isCakepadBaseRoute) {
      return null
    }

    return (
      <FlexGap gap="8px">
        <Box ref={targetRef}>
          <ConnectBtn scale="sm" variant="danger">
            <Box display={['none', null, null, 'block']}>
              <Trans>Failed to Connect</Trans>
            </Box>
            <Box display={['block', null, null, 'none']}>
              <Trans>Failed</Trans>
            </Box>
          </ConnectBtn>
        </Box>
        {tooltipVisible && tooltip}
      </FlexGap>
    )
  }

  if (isCakepadBaseRoute) {
    return null
  }

  return (
    <FlexGap gap="8px">
      <ConnectWalletButton scale="sm">
        <Box display={['none', null, null, 'block']}>
          <Trans>Connect Wallet</Trans>
        </Box>
        <Box display={['block', null, null, 'none']}>
          <Trans>Connect</Trans>
        </Box>
      </ConnectWalletButton>
    </FlexGap>
  )
}

const UserMenuContainer = () => {
  return (
    <WalletModalV2ViewStateProvider>
      <MenuTabProvider>
        <SendGiftProvider>
          <ClaimGiftProvider>
            <UnclaimedOnlyProvider>
              <UserMenu />
            </UnclaimedOnlyProvider>
          </ClaimGiftProvider>
        </SendGiftProvider>
      </MenuTabProvider>
    </WalletModalV2ViewStateProvider>
  )
}

export default UserMenuContainer
