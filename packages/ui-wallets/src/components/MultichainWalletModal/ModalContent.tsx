import { useTranslation } from '@pancakeswap/localization'
import { AtomBox, CloseIcon, Grid, Heading, IconButton, RowBetween, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useCallback, useMemo, useState } from 'react'
import { ChainId } from '@pancakeswap/chains'
import { useSelectedWallet, useWalletFilter } from '../../state/hooks'
import { ASSET_CDN } from '../../config/url'
import { ConnectData, WalletAdaptedNetwork, WalletConfigV3, WalletIds } from '../../types'
import { PreviewSection, PreviewStatus } from '../PreviewSection'
import SocialLogin from '../SocialLogin'
import SocialLoginButton from '../SocialLoginButton'
import { desktopWalletSelectionClass } from '../WalletModal.css'
import { WalletChainSelect } from '../WalletSelect/WalletChainSelect'
import { WalletSelect } from '../WalletSelect/WalletSelect'
import { MultichainWalletModalProps } from './types'
import { WalletToggle } from '../WalletToggle'
import { StyledMobileContainer } from './styled'
import { getAvailableWalletNetworks } from '../../config/supportedEvmChains'

export type ModalContentProps = Pick<
  MultichainWalletModalProps,
  'wallets' | 'topWallets' | 'docLink' | 'solanaAddress' | 'evmAddress' | 'onWalletConnectStartCallBack'
> & {
  chainId?: ChainId
  onDismiss: () => void

  previouslyUsedWallets: [WalletConfigV3[], WalletConfigV3[]]
  connectWallet: (wallet: WalletConfigV3, network: WalletAdaptedNetwork) => void
  onWalletConnected: (wallet: WalletConfigV3, network: WalletAdaptedNetwork, connectData?: ConnectData) => void
  displaySocialLogin: () => void

  previewStatus: PreviewStatus
  setPreviewStatus: (section: PreviewStatus) => void

  onGoogleLogin?: () => void
  onXLogin?: () => void
  onTelegramLogin?: () => void
  onDiscordLogin?: () => void
}

export const ModalContent: React.FC<ModalContentProps> = ({
  chainId,
  onDismiss,
  docLink,
  solanaAddress,
  evmAddress,
  wallets: wallets_,
  topWallets: topWallets_,
  previouslyUsedWallets: previouslyUsedWallets_,
  connectWallet,
  onWalletConnected,
  displaySocialLogin,
  previewStatus,
  setPreviewStatus,
  onWalletConnectStartCallBack,
  onGoogleLogin,
  onXLogin,
  onTelegramLogin,
  onDiscordLogin,
}) => {
  const { isMobile } = useMatchBreakpoints()
  const { type: walletFilter, value: walletFilterChecked } = useWalletFilter()
  const solanaOnly = walletFilter === 'solanaOnly' && walletFilterChecked
  const evmOnly = walletFilter === 'evmOnly' && walletFilterChecked

  const getDisplayWallet = useCallback(
    (wallet: WalletConfigV3) => {
      const networks = getAvailableWalletNetworks(wallet, chainId)

      if (networks.length === wallet.networks.length) {
        return wallet
      }

      return {
        ...wallet,
        networks,
      }
    },
    [chainId],
  )

  const wallets: WalletConfigV3[] = useMemo(
    () =>
      wallets_?.map(getDisplayWallet).filter((w) => {
        if (w.networks.length === 0) return false
        if (solanaOnly && !w.networks.includes(WalletAdaptedNetwork.Solana)) return false
        if (evmOnly && !w.networks.includes(WalletAdaptedNetwork.EVM)) return false
        return w.installed !== false || (!w.installed && (w.guide || w.downloadLink || w.qrCode))
      }) ?? [],
    [wallets_, evmOnly, getDisplayWallet, solanaOnly],
  )

  const topWallets: WalletConfigV3[] = useMemo(
    () =>
      topWallets_?.map(getDisplayWallet).filter((w) => {
        if (w.networks.length === 0) return false
        if (solanaOnly && !w.networks.includes(WalletAdaptedNetwork.Solana)) return false
        if (evmOnly && !w.networks.includes(WalletAdaptedNetwork.EVM)) return false
        return !('install' in w) || w.installed !== false || (!w.installed && (w.guide || w.downloadLink || w.qrCode))
      }) ?? [],
    [topWallets_, evmOnly, getDisplayWallet, solanaOnly],
  )

  const previouslyUsedWallets = useMemo(
    () =>
      previouslyUsedWallets_.map((wallets) => {
        const normalizedWallets = wallets.map(getDisplayWallet).filter((wallet) => wallet.networks.length > 0)

        if (solanaOnly) {
          return normalizedWallets.filter((wallet) => wallet.networks.includes(WalletAdaptedNetwork.Solana))
        }

        if (evmOnly) {
          return normalizedWallets.filter((wallet) => wallet.networks.includes(WalletAdaptedNetwork.EVM))
        }

        return normalizedWallets
      }) as [WalletConfigV3[], WalletConfigV3[]],
    [previouslyUsedWallets_, evmOnly, getDisplayWallet, solanaOnly],
  )

  const selected = useSelectedWallet()
  const [qrCode, setQrCode] = useState<string | undefined>(undefined)
  const { t } = useTranslation()

  const [selectedNetwork, setSelectedNetwork] = useState<WalletAdaptedNetwork | null>(null)

  const [selectedMultiChainWallet, setSelectedMultiChainWallet] = useState<WalletConfigV3 | null>(null)

  const [uninstalledWallet, setUninstalledWallet] = useState<WalletConfigV3 | null>(null)

  const trackWalletSelection = useCallback(
    (walletTitle?: string) => {
      onWalletConnectStartCallBack?.(chainId, walletTitle)
    },
    [chainId, onWalletConnectStartCallBack],
  )

  const isWalletInstalledAndPreview = useCallback(
    (wallet: WalletConfigV3, network?: WalletAdaptedNetwork) => {
      if (!('installed' in wallet)) return true

      // bypass installed check for wallet that can init without install
      // @note: for solana, it still need extension wallet for coinbase
      if (wallet.id === WalletIds.Coinbase && network === WalletAdaptedNetwork.EVM) return true

      if (!wallet.installed) {
        setUninstalledWallet(wallet)
        setPreviewStatus(PreviewStatus.NotInstalled)
        setQrCode(undefined)
        if (wallet.qrCode) {
          wallet
            .qrCode(() => onWalletConnected(wallet, WalletAdaptedNetwork.EVM))
            .then(
              (uri) => {
                setQrCode(uri)
              },
              () => {
                // do nothing.
              },
            )
        }

        return false
      }
      return true
    },
    [onWalletConnected, setPreviewStatus],
  )

  const onMultiChainWalletSelected = useCallback(
    (wallet: WalletConfigV3) => {
      trackWalletSelection(wallet.title)
      if (
        !isWalletInstalledAndPreview(wallet) &&
        !wallet.solanaCanInitWithoutInstall &&
        !wallet.evmCanInitWithoutInstall
      )
        return

      setSelectedMultiChainWallet(wallet)
      setPreviewStatus(PreviewStatus.ChainSelect)
    },
    [isWalletInstalledAndPreview, setPreviewStatus, trackWalletSelection],
  )

  const onEvmWalletSelected = useCallback(
    (wallet: WalletConfigV3) => {
      setSelectedNetwork(WalletAdaptedNetwork.EVM)
      connectWallet(wallet, WalletAdaptedNetwork.EVM)
    },
    [connectWallet],
  )

  const onSolanaWalletSelected = useCallback(
    (wallet: WalletConfigV3) => {
      setSelectedNetwork(WalletAdaptedNetwork.Solana)
      connectWallet(wallet, WalletAdaptedNetwork.Solana)
    },
    [connectWallet],
  )

  const onWalletSelected = useCallback(
    (w: WalletConfigV3, network: WalletAdaptedNetwork, shouldTrack = true) => {
      if (shouldTrack) {
        trackWalletSelection(w.title)
      }
      if (!isWalletInstalledAndPreview(w, network) && !w.solanaCanInitWithoutInstall && !w.evmCanInitWithoutInstall)
        return

      setPreviewStatus(PreviewStatus.Confirming)

      if (network === WalletAdaptedNetwork.EVM) {
        onEvmWalletSelected(w)
      } else if (network === WalletAdaptedNetwork.Solana) {
        onSolanaWalletSelected(w)
      }
    },
    [isWalletInstalledAndPreview, setPreviewStatus, onEvmWalletSelected, onSolanaWalletSelected, trackWalletSelection],
  )

  const handleDisplaySocialLogin = useCallback(() => {
    trackWalletSelection('Social Login')
    displaySocialLogin()
  }, [displaySocialLogin, trackWalletSelection])

  const handleGoogleLogin = useCallback(() => {
    trackWalletSelection('io.privy.smart_wallet - Google')
    onGoogleLogin?.()
  }, [onGoogleLogin, trackWalletSelection])

  const handleXLogin = useCallback(() => {
    trackWalletSelection('io.privy.smart_wallet - X')
    onXLogin?.()
  }, [onXLogin, trackWalletSelection])

  const handleTelegramLogin = useCallback(() => {
    trackWalletSelection('io.privy.smart_wallet - Telegram')
    onTelegramLogin?.()
  }, [onTelegramLogin, trackWalletSelection])

  const handleDiscordLogin = useCallback(() => {
    trackWalletSelection('io.privy.smart_wallet - Discord')
    onDiscordLogin?.()
  }, [onDiscordLogin, trackWalletSelection])

  const walletsSection = (
    <>
      {isMobile ? (
        <>
          <RowBetween>
            <Heading color="color" as="h4">
              {t('Connect Wallet')}
            </Heading>
            <IconButton variant="text" onClick={onDismiss} mr="-12px">
              <CloseIcon />
            </IconButton>
          </RowBetween>
          <WalletToggle solanaAddress={solanaAddress} evmAddress={evmAddress} />
        </>
      ) : (
        <RowBetween>
          <Heading color="color" as="h4">
            {t('Connect Wallet')}
          </Heading>
          <WalletToggle solanaAddress={solanaAddress} evmAddress={evmAddress} />
        </RowBetween>
      )}

      <SocialLoginButton onClick={handleDisplaySocialLogin} assetCdn={ASSET_CDN} />

      <WalletSelect
        wallets={wallets}
        topWallets={topWallets}
        previouslyUsedWallets={previouslyUsedWallets}
        onWalletSelected={onWalletSelected}
        onMultiChainWalletSelected={onMultiChainWalletSelected}
      />
      {/* {mevDocLink ? <MEVSection mevDocLink={mevDocLink} /> : null} */}
    </>
  )

  const previewSection = (
    <>
      {previewStatus === PreviewStatus.Intro && (
        <AtomBox
          display="flex"
          flexDirection="column"
          alignItems="center"
          style={{ gap: '12px' }}
          textAlign="center"
          width="100%"
        >
          <PreviewSection.Intro docLink={docLink} />
        </AtomBox>
      )}
      {previewStatus === PreviewStatus.NotInstalled && uninstalledWallet && (
        <PreviewSection.NotInstalled qrCode={qrCode} wallet={uninstalledWallet} />
      )}
      {previewStatus === PreviewStatus.Confirming && selected && selectedNetwork && (
        <PreviewSection.Confirming
          wallet={selected}
          network={selectedNetwork}
          reConnect={() => connectWallet(selected, selectedNetwork)}
        />
      )}
      {previewStatus === PreviewStatus.SocialLogin && (
        <SocialLogin
          chainId={chainId}
          onDismiss={() => setPreviewStatus(PreviewStatus.Intro)}
          onGoogleLogin={handleGoogleLogin}
          onXLogin={handleXLogin}
          onTelegramLogin={handleTelegramLogin}
          onDiscordLogin={handleDiscordLogin}
        />
      )}
      {previewStatus === PreviewStatus.ChainSelect && selectedMultiChainWallet && (
        <WalletChainSelect
          evmAddress={evmAddress}
          solanaAddress={solanaAddress}
          wallet={selectedMultiChainWallet}
          onConnectEVM={() => onWalletSelected(selectedMultiChainWallet, WalletAdaptedNetwork.EVM, false)}
          onConnectSolana={() => onWalletSelected(selectedMultiChainWallet, WalletAdaptedNetwork.Solana, false)}
        />
      )}
    </>
  )

  if (isMobile) {
    if (previewStatus === PreviewStatus.Intro) {
      return (
        <StyledMobileContainer $fullHeight>
          {walletsSection}
          <PreviewSection.Intro docLink={docLink} />
        </StyledMobileContainer>
      )
    }
    return (
      <StyledMobileContainer background="gradientCardHeader" $fullHeight={false}>
        {previewSection}
      </StyledMobileContainer>
    )
  }

  return (
    <Grid gridTemplateColumns="1fr 1fr" width="100%" overflow="hidden" borderRadius="card">
      <AtomBox
        display="flex"
        flexDirection="column"
        bg="backgroundAlt"
        px="16px"
        py="16px"
        pt="24px"
        zIndex="modal"
        borderRadius="card"
        overflow="hidden"
        className={desktopWalletSelectionClass}
        gap="1rem"
      >
        {walletsSection}
      </AtomBox>
      <AtomBox
        flex={1}
        px="16px"
        py="56px"
        display="flex"
        justifyContent="center"
        flexDirection="column"
        alignItems="center"
      >
        {previewSection}
      </AtomBox>
    </Grid>
  )
}
