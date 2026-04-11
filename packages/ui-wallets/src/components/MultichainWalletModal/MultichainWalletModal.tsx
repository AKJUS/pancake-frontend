import { NonEVMChainId } from '@pancakeswap/chains'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletName } from '@solana/wallet-adapter-base'
import { useTranslation } from '@pancakeswap/localization'
import { AtomBox, ModalV2, ModalWrapper, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useTheme } from '@pancakeswap/hooks'
import { useAtom, useSetAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { EvmConnectorNames, SolanaConnectorNames } from '../../config/connectorNames'
import { getTopWalletsConfig, getWalletsConfig } from '../../config/wallets'
import { WalletConnectorNotFoundError, WalletSwitchChainError } from '../../error'
import {
  errorEvmAtom,
  errorSolanaAtom,
  lastUsedEvmWalletNameAtom,
  lastUsedSolanaWalletNameAtom,
  previouslyUsedEvmWalletsAtom,
  previouslyUsedSolanaWalletsAtom,
  setSelectedEvmWalletAtom,
  setSelectedSolanaWalletAtom,
} from '../../state/atom'
import { ConnectData, WalletAdaptedNetwork, WalletConfigV3 } from '../../types'
import { PreviewStatus } from '../PreviewSection'
import { ModalContent } from './ModalContent'
import { MultichainWalletModalProps } from './types'
import { modalWrapperClass } from './modal.css'
import { useWalletFilterEffect, useWalletFilterValue } from '../../state/hooks'
import { useSolanaLogin } from './hooks/useSolanaLogin'

const getWalletConnectErrorMeta = (error: unknown): { errorType: string; errorMessage?: string } => {
  const err = error as { code?: number | string; message?: string }

  if (error instanceof WalletConnectorNotFoundError) {
    return { errorType: 'NO_PROVIDER', errorMessage: err?.message }
  }

  if (error instanceof WalletSwitchChainError) {
    return { errorType: 'SWITCH_CHAIN_FAILED', errorMessage: err?.message }
  }

  if (
    err?.code === 4001 ||
    err?.code === 'ACTION_REJECTED' ||
    err?.message?.toLowerCase().includes('user rejected') ||
    err?.message?.toLowerCase().includes('rejected')
  ) {
    return { errorType: 'USER_REJECTED', errorMessage: err?.message }
  }

  return { errorType: 'UNKNOWN', errorMessage: err?.message }
}

export const MultichainWalletModal: React.FC<MultichainWalletModalProps> = (props) => {
  const {
    evmAddress,
    solanaAddress,
    wallets,
    topWallets,
    chainId,
    evmLogin,
    createEvmQrCode,
    onWalletConnectStartCallBack,
    onWalletConnectCallBack,
    onWalletConnectFailCallBack,
    onGoogleLogin,
    onXLogin,
    onTelegramLogin,
    onDiscordLogin,
    onDismiss,
    docLink,
    shouldShowMetamaskVersionWarning,
    ...rest
  } = props

  const { t } = useTranslation()
  const { theme } = useTheme()

  const solanaLogin = useSolanaLogin()

  const walletFilter = useWalletFilterValue()
  useWalletFilterEffect({ evmAddress, solanaAddress })

  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>(PreviewStatus.Intro)

  const { wallets: solanaWallets } = useWallet()

  const wallets_ = useMemo(
    () => wallets ?? getWalletsConfig({ walletFilter, createEvmQrCode, solanaWalletAdapters: solanaWallets }),
    [wallets, walletFilter, createEvmQrCode, solanaWallets],
  )
  const topWallets_ = useMemo(
    () => topWallets ?? getTopWalletsConfig(wallets_, walletFilter, chainId),
    [topWallets, wallets_, walletFilter, chainId],
  )

  const handleDismiss = useCallback(() => {
    onDismiss?.()
    setPreviewStatus(PreviewStatus.Intro)
  }, [onDismiss])

  const setEvmSelectedWallet = useSetAtom(setSelectedEvmWalletAtom)
  const [, setSolanaError] = useAtom(errorSolanaAtom)
  const [, setLastUsedSolanaWallet] = useAtom(lastUsedSolanaWalletNameAtom)
  const [previouslyUsedSolanaWalletsId] = useAtom(previouslyUsedSolanaWalletsAtom)
  const previouslyUsedSolanaWallets = useMemo(
    () =>
      previouslyUsedSolanaWalletsId
        .map((id) => wallets_.find((w) => w.id === id))
        .filter<WalletConfigV3<SolanaConnectorNames>>((w): w is WalletConfigV3<SolanaConnectorNames> => Boolean(w)),
    [wallets_, previouslyUsedSolanaWalletsId],
  )

  const setSolanaSelectedWallet = useSetAtom(setSelectedSolanaWalletAtom)
  const [, setEvmError] = useAtom(errorEvmAtom)
  const [, setLastUsedEvmWallet] = useAtom(lastUsedEvmWalletNameAtom)
  const [previouslyUsedEvmWalletsId] = useAtom(previouslyUsedEvmWalletsAtom)
  const previouslyUsedEvmWallets = useMemo(
    () =>
      previouslyUsedEvmWalletsId
        .map((id) => wallets_.find((w) => w.id === id))
        .filter<WalletConfigV3<EvmConnectorNames>>((w): w is WalletConfigV3<EvmConnectorNames> => Boolean(w)),
    [wallets_, previouslyUsedEvmWalletsId],
  )

  const handleWalletConnected = useCallback(
    (wallet: WalletConfigV3, network: WalletAdaptedNetwork, connectData?: ConnectData) => {
      if (network === WalletAdaptedNetwork.Solana) setLastUsedSolanaWallet(wallet.id)
      if (network === WalletAdaptedNetwork.EVM) {
        setLastUsedEvmWallet(wallet.id)

        onWalletConnectCallBack?.(
          connectData?.chainId ? Number(connectData.chainId) : undefined,
          wallet.title,
          connectData?.accounts?.[0],
        )
      }
    },
    [onWalletConnectCallBack, setLastUsedEvmWallet, setLastUsedSolanaWallet],
  )

  const connectWallet = useCallback(
    (wallet: WalletConfigV3, network: WalletAdaptedNetwork) => {
      if (network === WalletAdaptedNetwork.Solana) {
        setSolanaSelectedWallet(wallet as WalletConfigV3<SolanaConnectorNames>)
        setSolanaError('')
      }
      if (network === WalletAdaptedNetwork.EVM) {
        setEvmSelectedWallet(wallet as WalletConfigV3<EvmConnectorNames>)
        setEvmError('')
      }

      if (wallet.installed || wallet.evmCanInitWithoutInstall || wallet.solanaCanInitWithoutInstall) {
        if (network === WalletAdaptedNetwork.EVM) {
          if (!wallet.installed && !wallet.evmCanInitWithoutInstall) {
            setPreviewStatus(PreviewStatus.NotInstalled)
            return
          }
          evmLogin(wallet as WalletConfigV3<EvmConnectorNames>)
            .then((connectData) => {
              if (connectData) {
                handleWalletConnected(wallet, network, connectData)
                if (wallet.networks.includes(WalletAdaptedNetwork.Solana) && !solanaAddress) {
                  setPreviewStatus(PreviewStatus.ChainSelect)
                } else {
                  handleDismiss()
                }
              }
            })
            .catch((err) => {
              const { errorType, errorMessage } = getWalletConnectErrorMeta(err)
              onWalletConnectFailCallBack?.(chainId, wallet.title, network, errorType, errorMessage)

              if (err instanceof WalletConnectorNotFoundError) {
                setEvmError(t('no provider found'))
              } else if (err instanceof WalletSwitchChainError) {
                setEvmError(err.message)
              } else {
                setEvmError(t('Error connecting, please authorize wallet to access.'))
              }
            })
        }

        if (network === WalletAdaptedNetwork.Solana && wallet.solanaAdapterName) {
          if (!wallet.installed && !wallet.solanaCanInitWithoutInstall) {
            setPreviewStatus(PreviewStatus.NotInstalled)
            return
          }
          solanaLogin(wallet.solanaAdapterName as WalletName)
            .then((address) => {
              handleWalletConnected(wallet, network, { accounts: [address], chainId: NonEVMChainId.SOLANA })
              if (wallet.networks.includes(WalletAdaptedNetwork.EVM) && !evmAddress) {
                setPreviewStatus(PreviewStatus.ChainSelect)
              } else {
                handleDismiss()
              }
            })
            .catch((err) => {
              const { errorType, errorMessage } = getWalletConnectErrorMeta(err)
              onWalletConnectFailCallBack?.(NonEVMChainId.SOLANA, wallet.title, network, errorType, errorMessage)

              if (err instanceof WalletConnectorNotFoundError) {
                setSolanaError(t('no provider found'))
              } else {
                setSolanaError(t('Error connecting, please authorize wallet to access.'))
              }
            })
        }
      }
    },
    [
      setSolanaSelectedWallet,
      setSolanaError,
      setEvmSelectedWallet,
      setEvmError,
      evmLogin,
      handleWalletConnected,
      solanaAddress,
      evmAddress,
      t,
      solanaLogin,
      handleDismiss,
      onWalletConnectFailCallBack,
      chainId,
    ],
  )

  const displaySocialLogin = useCallback(() => {
    setPreviewStatus(PreviewStatus.SocialLogin)
  }, [])
  const handleSocialLoginWithCleanup = useCallback(
    (originalCallback?: () => void) => {
      return () => {
        // Close modal when social login is initiated
        onDismiss?.()

        // Execute the original callback
        originalCallback?.()
      }
    },
    [onDismiss],
  )

  const { isMobile } = useMatchBreakpoints()

  const mobileContainerStyle: React.CSSProperties = useMemo(
    () =>
      isMobile
        ? {
            ...(previewStatus === PreviewStatus.Intro
              ? {
                  height: '100%',
                  borderRadius: 0,
                  background: theme.colors.background,
                }
              : {
                  background: theme.colors.gradientCardHeader,
                }),
            transition: 'height 0.3s ease-in-out',
          }
        : {},
    [isMobile, theme.colors.background, theme.colors.gradientCardHeader, previewStatus],
  )

  const previouslyUsedWallets = useMemo<[WalletConfigV3<EvmConnectorNames>[], WalletConfigV3<SolanaConnectorNames>[]]>(
    () => [previouslyUsedEvmWallets, previouslyUsedSolanaWallets],
    [previouslyUsedEvmWallets, previouslyUsedSolanaWallets],
  )

  return (
    <ModalV2 closeOnOverlayClick disableOutsidePointerEvents={false} {...rest} onDismiss={handleDismiss}>
      <ModalWrapper
        onDismiss={handleDismiss}
        containerStyle={{ border: 'none', ...mobileContainerStyle }}
        style={{
          overflow: 'visible',
          border: 'none',
          ...mobileContainerStyle,
        }}
      >
        <AtomBox position="relative" zIndex="modal" className={modalWrapperClass}>
          <AtomBox
            display="flex"
            position="relative"
            background={isMobile && previewStatus === PreviewStatus.Intro ? 'background' : 'gradientCardHeader'}
            borderRadius="card"
            flexDirection={isMobile ? 'column' : 'row'}
            px={isMobile ? '16px' : '0px'}
            py={isMobile ? '24px' : '0px'}
            borderBottomRadius={{
              xs: '0',
              md: 'card',
            }}
            zIndex="modal"
            width="100%"
          >
            <ModalContent
              chainId={chainId}
              evmAddress={evmAddress}
              solanaAddress={solanaAddress}
              onDismiss={handleDismiss}
              wallets={wallets_}
              topWallets={topWallets_}
              previouslyUsedWallets={previouslyUsedWallets}
              connectWallet={connectWallet}
              onWalletConnected={handleWalletConnected}
              displaySocialLogin={displaySocialLogin}
              previewStatus={previewStatus}
              setPreviewStatus={setPreviewStatus}
              docLink={docLink}
              shouldShowMetamaskVersionWarning={shouldShowMetamaskVersionWarning}
              onWalletConnectStartCallBack={onWalletConnectStartCallBack}
              onGoogleLogin={handleSocialLoginWithCleanup(onGoogleLogin)}
              onXLogin={handleSocialLoginWithCleanup(onXLogin)}
              onTelegramLogin={handleSocialLoginWithCleanup(onTelegramLogin)}
              onDiscordLogin={handleSocialLoginWithCleanup(onDiscordLogin)}
            />
          </AtomBox>
        </AtomBox>
      </ModalWrapper>
    </ModalV2>
  )
}
