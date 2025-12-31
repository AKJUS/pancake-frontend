import { usePreloadImages, useTheme } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import {
  AtomBox,
  Button,
  ButtonMenu,
  ButtonMenuItem,
  CloseIcon,
  Column,
  Heading,
  IconButton,
  Image,
  LinkExternal,
  ModalV2,
  ModalWrapper,
  MoreHorizontalIcon,
  Row,
  ShieldCheckIcon,
  Tab,
  TabMenu,
  Text,
  useMatchBreakpoints,
  WarningIcon,
} from '@pancakeswap/uikit'
import { useAtom } from 'jotai'
import { lazy, MouseEvent, PropsWithChildren, Suspense, useCallback, useMemo, useState } from 'react'
import { isMobile as isMobileDevice } from 'react-device-detect'
import { styled } from 'styled-components'
import {
  desktopWalletSelectionClass,
  fullSizeModalWrapperClass,
  modalWrapperClass,
  scrollbarClass,
  walletIconClass,
  walletSelectWrapperClass,
} from '../WalletModal.css'
import { errorAtom, lastUsedWalletNameAtom, previouslyUsedWalletsAtom, selectedWalletAtom } from './atom'
import SocialLoginButton from '../SocialLoginButton'
import { ConnectData, LinkOfDevice, WalletConfigV2 } from '../../types'
import { WalletModalV2Props } from './types'
import { WalletConnectorNotFoundError, WalletSwitchChainError } from '../../error'

export const ASSET_CDN = 'https://assets.pancakeswap.finance'

const StepIntro = lazy(() => import('./components/Intro'))

const Qrcode = lazy(() => import('../QRCode'))

const SocialLoginModal = lazy(() => import('./components/SocialLoginModal'))

export function useSelectedWallet<T>() {
  // @ts-ignore
  return useAtom<WalletConfigV2<T> | null>(selectedWalletAtom)
}

const StyledTab = styled(Tab)`
  height: 32px;
  padding: 4px 12px;
`

type TabContainerProps = PropsWithChildren<{
  docLink: string
  docText: string
  fullSize?: boolean
  onDismiss?: () => void
}>

const TabContainer = ({ children, docLink, docText, fullSize = true, onDismiss }: TabContainerProps) => {
  const [index, setIndex] = useState(0)
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()

  return (
    <AtomBox position="relative" zIndex="modal" className={fullSize ? fullSizeModalWrapperClass : modalWrapperClass}>
      {isMobile ? null : (
        <AtomBox position="absolute" style={{ top: '-48px', left: '10px' }}>
          <TabMenu activeIndex={index} onItemClick={setIndex} gap="16px" isColorInverse isShowBorderBottom={false}>
            <StyledTab>{t('Connect Wallet')}</StyledTab>
            <StyledTab>{t('What’s a Web3 Wallet?')}</StyledTab>
          </TabMenu>
        </AtomBox>
      )}
      <AtomBox
        display="flex"
        position="relative"
        background={isMobile ? 'backgroundAlt' : 'gradientCardHeader'}
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
        {isMobile ? (
          <Row mb="16px" gap="16px">
            <ButtonMenu scale="md" activeIndex={index} onItemClick={setIndex} variant="subtle">
              <ButtonMenuItem>{t('Connect Wallet')}</ButtonMenuItem>
              <ButtonMenuItem minWidth="57%">{t('What’s a Web3 Wallet?')}</ButtonMenuItem>
            </ButtonMenu>

            <IconButton
              mr="-6px"
              variant="text"
              onClick={(e: MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation()
                onDismiss?.()
              }}
              aria-label="Close the dialog"
            >
              <CloseIcon color="textSubtle" />
            </IconButton>
          </Row>
        ) : null}
        {index === 0 && children}
        {index === 1 && (
          <Suspense>
            <StepIntro docLink={docLink} docText={docText} />
          </Suspense>
        )}
      </AtomBox>
    </AtomBox>
  )
}

const MOBILE_DEFAULT_DISPLAY_COUNT = 8

function MobileModal<T>({
  wallets,
  topWallets,
  previouslyUsedWallets,
  connectWallet,
  mevDocLink,
  onOpenSocialLoginModal,
}: Pick<WalletModalV2Props<T>, 'wallets' | 'topWallets' | 'docLink' | 'docText' | 'mevDocLink'> & {
  connectWallet: (wallet: WalletConfigV2<T>) => void
  previouslyUsedWallets: WalletConfigV2<T>[]
  onOpenSocialLoginModal?: () => void
}) {
  const [selected] = useSelectedWallet()
  const [error] = useAtom(errorAtom)

  const installedWallets: WalletConfigV2<T>[] = useMemo(
    () => [...wallets, ...topWallets, ...previouslyUsedWallets].filter((w) => w.installed),
    [wallets, topWallets, previouslyUsedWallets],
  )
  const filterFn = useCallback(
    (w: WalletConfigV2<T>) => {
      return isMobileDevice
        ? installedWallets.length
          ? w.installed
          : w.installed !== false || w.deepLink
        : w.installed !== false || (!w.installed && (w.guide || w.downloadLink || w.qrCode))
    },
    [installedWallets.length],
  )

  // const installedWallets: WalletConfigV2<T>[] = wallets.filter((w) => w.installed)
  const walletsToShow: WalletConfigV2<T>[] = wallets.filter(filterFn)

  const topWalletsToShow: WalletConfigV2<T>[] = topWallets.filter(filterFn)
  const previouslyUsedWalletsToShow: WalletConfigV2<T>[] = previouslyUsedWallets.filter(filterFn)

  return (
    <AtomBox width="100%">
      {error ? (
        <AtomBox
          display="flex"
          flexDirection="column"
          alignItems="center"
          style={{ gap: '24px' }}
          textAlign="center"
          p="24px"
        >
          {selected && typeof selected.icon === 'string' && <Image src={selected.icon} width={108} height={108} />}
          <div style={{ maxWidth: '246px' }}>
            <ErrorMessage message={error} />
          </div>
        </AtomBox>
      ) : null}
      <AtomBox display="flex" flexDirection="column" gap="16px" justifyContent="space-between">
        {onOpenSocialLoginModal ? (
          <SocialLoginButton onClick={onOpenSocialLoginModal} assetCdn={ASSET_CDN} style={{ marginBottom: '8px' }} />
        ) : null}

        <WalletSelect
          style={{ height: `calc(100vh - 200px)` }}
          displayCount="all"
          wallets={walletsToShow}
          topWallets={topWalletsToShow}
          previouslyUsedWallets={previouslyUsedWalletsToShow}
          onClick={(wallet) => {
            connectWallet(wallet)
            if (wallet.deepLink && wallet.installed === false) {
              window.open(wallet.deepLink, '_blank', 'noopener noreferrer')
            }
          }}
        />
        {mevDocLink ? <MEVSection mevDocLink={mevDocLink} /> : null}
      </AtomBox>
    </AtomBox>
  )
}

function WalletSelect<T>({
  wallets,
  topWallets,
  previouslyUsedWallets,
  onClick,
  displayCount = 9,
  style = {},
}: {
  wallets: WalletConfigV2<T>[]
  topWallets: WalletConfigV2<T>[]
  previouslyUsedWallets: WalletConfigV2<T>[]
  onClick: (wallet: WalletConfigV2<T>) => void
  displayCount?: number | 'all'
  style?: React.CSSProperties
}) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const [showMore, setShowMore] = useState(false)
  const walletDisplayCount = useMemo(
    () => (displayCount === 'all' ? wallets.length : wallets.length > displayCount ? displayCount - 1 : displayCount),
    [displayCount, wallets.length],
  )
  const walletsToShow = useMemo(
    () => (showMore ? wallets : wallets.slice(0, walletDisplayCount)),
    [showMore, wallets, walletDisplayCount],
  )
  const sections: { label: string; items: WalletConfigV2<T>[]; isMore?: boolean }[] = useMemo(
    () => [
      { label: t('Previously used'), items: previouslyUsedWallets },
      { label: t('Top Wallets'), items: topWallets },
      { label: t('More Wallets'), items: walletsToShow, isMore: true },
    ],
    [t, walletsToShow, topWallets, previouslyUsedWallets],
  )
  return (
    <Column
      overflowY="auto"
      overflowX="hidden"
      gap="16px"
      style={{ paddingRight: '28px', marginRight: '-40px', ...style }}
      className={scrollbarClass}
    >
      {sections.map(({ label, items, isMore }) =>
        items.length > 0 ? (
          <Column gap="6px">
            <Text fontSize="14px" color="textSubtle" lineHeight={1.5}>
              {label}
            </Text>
            <AtomBox display="grid" overflowY="auto" overflowX="hidden" className={walletSelectWrapperClass}>
              {items.map((wallet) => {
                const isImage = typeof wallet.icon === 'string'
                const Icon = wallet.icon

                return (
                  <AtomBox border="1" borderRadius="default" p="12px" style={{ maxWidth: '106px' }}>
                    <Button
                      key={wallet.id}
                      variant="text"
                      height="auto"
                      width="100%"
                      as={AtomBox}
                      display="flex"
                      alignItems="center"
                      style={{ justifyContent: 'flex-start', letterSpacing: 'normal', padding: '0' }}
                      flexDirection="column"
                      onClick={() => onClick(wallet)}
                    >
                      <AtomBox borderRadius="12px" mb="4px">
                        <AtomBox
                          bgc="dropdown"
                          display="flex"
                          position="relative"
                          justifyContent="center"
                          alignItems="center"
                          className={walletIconClass}
                          style={{ borderRadius: '13px' }}
                          overflow="hidden"
                        >
                          {isImage ? (
                            <Image src={Icon as string} width={48} height={48} />
                          ) : (
                            <Icon width={24} height={24} color="textSubtle" />
                          )}
                        </AtomBox>
                      </AtomBox>
                      <Row gap="2px">
                        {wallet.MEVSupported ? (
                          <ShieldCheckIcon width={17} height={17} color={theme.colors.positive60} />
                        ) : null}
                        <Text fontSize="12px" textAlign="center" width="100%" ellipsis>
                          {wallet.title}
                        </Text>
                      </Row>
                    </Button>
                  </AtomBox>
                )
              })}
              {isMore && !showMore && wallets.length > walletDisplayCount && (
                <AtomBox display="flex" justifyContent="center" alignItems="center" flexDirection="column">
                  <Button
                    height="auto"
                    variant="text"
                    as={AtomBox}
                    flexDirection="column"
                    onClick={() => setShowMore(true)}
                  >
                    <AtomBox
                      className={walletIconClass}
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                      bgc="dropdown"
                    >
                      <MoreHorizontalIcon color="text" />
                    </AtomBox>
                    <Text fontSize="12px" textAlign="center" mt="4px">
                      {t('More')}
                    </Text>
                  </Button>
                </AtomBox>
              )}
            </AtomBox>
          </Column>
        ) : null,
      )}
    </Column>
  )
}

function sortWallets<T>(wallets: WalletConfigV2<T>[], lastUsedWalletName: string | null) {
  const sorted = [...wallets].sort((a, b) => {
    if (a.installed === b.installed) return 0
    return a.installed === true ? -1 : 1
  })

  if (!lastUsedWalletName) {
    return sorted
  }
  const foundLastUsedWallet = wallets.find((w) => w.title === lastUsedWalletName)
  if (!foundLastUsedWallet) return sorted
  return [foundLastUsedWallet, ...sorted.filter((w) => w.id !== foundLastUsedWallet.id)]
}

const MEVSection = ({ mevDocLink }: { mevDocLink: string }) => {
  const { t } = useTranslation()
  const { theme, isDark } = useTheme()
  return (
    <Row
      color="textSubtle"
      fontSize="12px"
      gap="4px"
      width="100%"
      padding="8px"
      justifyContent="center"
      alignItems="center"
      style={{ borderRadius: '16px', background: isDark ? '#18171A' : theme.colors.background }}
    >
      <ShieldCheckIcon width={17} height={17} color={theme.colors.positive60} />
      {t('Wallets with MEV Protection')}
      <LinkExternal showExternalIcon={false} color="primary60" href={mevDocLink} fontSize="12px" fontWeight="400">
        {t('Learn More')}
      </LinkExternal>
    </Row>
  )
}

function DesktopModal<T>({
  wallets: wallets_,
  topWallets: topWallets_,
  previouslyUsedWallets,
  connectWallet,
  onWalletConnected,
  docLink,
  docText,
  mevDocLink,
  onOpenSocialLoginModal,
}: Pick<WalletModalV2Props<T>, 'wallets' | 'topWallets' | 'docLink' | 'docText' | 'mevDocLink'> & {
  connectWallet: (wallet: WalletConfigV2<T>) => void
  onWalletConnected: (wallet: WalletConfigV2<T>, connectData?: ConnectData) => void
  previouslyUsedWallets: WalletConfigV2<T>[]
  onOpenSocialLoginModal?: () => void
}) {
  const wallets: WalletConfigV2<T>[] = useMemo(
    () =>
      wallets_.filter((w) => {
        return w.installed !== false || (!w.installed && (w.guide || w.downloadLink || w.qrCode))
      }),
    [wallets_],
  )

  const topWallets: WalletConfigV2<T>[] = useMemo(
    () =>
      topWallets_.filter((w) => {
        return w.installed !== false || (!w.installed && (w.guide || w.downloadLink || w.qrCode))
      }),
    [topWallets_],
  )

  const preWallets: WalletConfigV2<T>[] = useMemo(
    () =>
      previouslyUsedWallets.filter((w) => {
        return w.installed !== false || (!w.installed && (w.guide || w.downloadLink || w.qrCode))
      }),
    [previouslyUsedWallets],
  )

  const [selected] = useSelectedWallet<T>()
  const [error] = useAtom(errorAtom)
  const [qrCode, setQrCode] = useState<string | undefined>(undefined)
  const { t } = useTranslation()

  const onWalletSelected = useCallback(
    (w: WalletConfigV2<T>) => {
      connectWallet(w)
      setQrCode(undefined)
      if (w.qrCode) {
        w.qrCode(() => onWalletConnected(w)).then(
          (uri) => {
            setQrCode(uri)
          },
          () => {
            // do nothing.
          },
        )
      }
    },
    [connectWallet, onWalletConnected],
  )

  return (
    <>
      <AtomBox
        display="flex"
        flexDirection="column"
        bg="backgroundAlt"
        py="32px"
        px="48px"
        zIndex="modal"
        borderRadius="card"
        className={desktopWalletSelectionClass}
        gap="20px"
      >
        <Heading color="color" as="h4">
          {t('Connect Wallet')}
        </Heading>

        {onOpenSocialLoginModal ? <SocialLoginButton onClick={onOpenSocialLoginModal} assetCdn={ASSET_CDN} /> : null}

        <WalletSelect
          wallets={wallets}
          topWallets={topWallets}
          previouslyUsedWallets={preWallets}
          displayCount="all"
          onClick={onWalletSelected}
        />
        {mevDocLink ? <MEVSection mevDocLink={mevDocLink} /> : null}
      </AtomBox>
      <AtomBox
        flex={1}
        mx="24px"
        display={{
          xs: 'none',
          sm: 'flex',
        }}
        justifyContent="center"
        flexDirection="column"
        alignItems="center"
      >
        <AtomBox display="flex" flexDirection="column" alignItems="center" style={{ gap: '24px' }} textAlign="center">
          {!selected && <Intro docLink={docLink} docText={docText} />}
          {selected && selected.installed !== false && (
            <>
              {typeof selected.icon === 'string' && <Image src={selected.icon} width={108} height={108} />}
              <Heading as="h1" fontSize="20px" color="secondary">
                {t('Opening')} {selected.title}
              </Heading>
              {error ? (
                <ErrorContent message={error} onRetry={() => connectWallet(selected)} />
              ) : (
                <Text>{t('Please confirm in %wallet%', { wallet: selected.title })}</Text>
              )}
            </>
          )}
          {selected && selected.installed === false && <NotInstalled qrCode={qrCode} wallet={selected} />}
        </AtomBox>
      </AtomBox>
    </>
  )
}

export function WalletModalV2<T = unknown>(props: WalletModalV2Props<T>) {
  const {
    wallets: wallets_,
    topWallets: topWallets_,
    login,
    docLink,
    docText,
    onWalletConnectCallBack,
    fullSize,
    mevDocLink,
    ...rest
  } = props

  const [isSocialLoginModalOpen, setIsSocialLoginModalOpen] = useState(false)

  const { isMobile } = useMatchBreakpoints()
  const [previouslyUsedWalletsId] = useAtom(previouslyUsedWalletsAtom)
  const previouslyUsedWallets = useMemo(
    () =>
      previouslyUsedWalletsId
        .map((id) => wallets_.find((w) => w.id === id))
        .filter<WalletConfigV2<T>>((w): w is WalletConfigV2<T> => Boolean(w)),
    [wallets_, previouslyUsedWalletsId],
  )

  const topWallets = useMemo(
    () => topWallets_.filter((w) => !previouslyUsedWalletsId.includes(w.id)),
    [previouslyUsedWalletsId, topWallets_],
  )

  const wallets = useMemo(
    () =>
      sortWallets(
        wallets_.filter((i) => !topWallets.some((t) => t.id === i.id) && !previouslyUsedWalletsId.includes(i.id)),
        null,
      ),
    [wallets_, topWallets, previouslyUsedWalletsId],
  )

  const [, setSelected] = useSelectedWallet()
  const [, setLastUsedWallet] = useAtom(lastUsedWalletNameAtom)
  const [, setError] = useAtom(errorAtom)
  const { t } = useTranslation()

  const imageSources = useMemo(
    () =>
      wallets
        .map((w) => w.icon)
        .filter((icon) => typeof icon === 'string')
        .concat('https://cdn.pancakeswap.com/wallets/wallet_intro.png') as string[],
    [wallets],
  )

  usePreloadImages(imageSources.slice(0, MOBILE_DEFAULT_DISPLAY_COUNT))

  const handleWalletConnected = useCallback(
    (wallet: WalletConfigV2<T>, connectData?: ConnectData) => {
      setLastUsedWallet(wallet.id)
      try {
        onWalletConnectCallBack?.(wallet.title, connectData?.accounts?.[0])
      } catch (e) {
        console.error(wallet.title, e)
      }
    },
    [onWalletConnectCallBack, setLastUsedWallet],
  )

  const connectWallet = useCallback(
    (wallet: WalletConfigV2<T>) => {
      setSelected(wallet)
      setError('')
      if (wallet.installed !== false) {
        login(wallet)
          .then((v) => {
            if (v) {
              handleWalletConnected(wallet, v)
            }
          })
          .catch((err) => {
            if (err instanceof WalletConnectorNotFoundError) {
              setError(t('no provider found'))
            } else if (err instanceof WalletSwitchChainError) {
              setError(err.message)
            } else {
              setError(t('Error connecting, please authorize wallet to access.'))
            }
          })
      }
    },
    [handleWalletConnected, login, setError, setSelected, t],
  )

  const mobileContainerStyle: React.CSSProperties = isMobile ? { height: '100%', borderRadius: 0 } : {}

  const handleOpenSocialLoginModal = useCallback(() => {
    if (props.onGoogleLogin || props.onXLogin || props.onTelegramLogin || props.onDiscordLogin) {
      setIsSocialLoginModalOpen(true)
    }
  }, [props.onGoogleLogin, props.onXLogin, props.onTelegramLogin, props.onDiscordLogin])

  const openSocialLoginModal =
    props.onGoogleLogin || props.onXLogin || props.onTelegramLogin || props.onDiscordLogin
      ? handleOpenSocialLoginModal
      : undefined

  const handleCloseSocialLoginModal = useCallback(() => {
    setIsSocialLoginModalOpen(false)
    // Main modal content will automatically show again due to conditional display: none
    // This maintains the BodyLock properly
  }, [])

  const handleBackToWeb3Wallet = useCallback(() => {
    // Close social login modal to return to wallet modal
    setIsSocialLoginModalOpen(false)
  }, [])

  // Wrap social login callbacks to ensure proper modal cleanup
  const handleSocialLoginWithCleanup = (originalCallback?: () => void) => {
    return () => {
      // Close both modals when social login is initiated
      setIsSocialLoginModalOpen(false)
      props.onDismiss?.()

      // Execute the original callback
      originalCallback?.()
    }
  }

  return (
    <>
      <Suspense>
        <SocialLoginModal
          isOpen={isSocialLoginModalOpen}
          onDismiss={handleCloseSocialLoginModal}
          onGoogleLogin={handleSocialLoginWithCleanup(props.onGoogleLogin)}
          onXLogin={handleSocialLoginWithCleanup(props.onXLogin)}
          onTelegramLogin={handleSocialLoginWithCleanup(props.onTelegramLogin)}
          onDiscordLogin={handleSocialLoginWithCleanup(props.onDiscordLogin)}
          onBackToWeb3Wallet={handleBackToWeb3Wallet}
        />
      </Suspense>
      <ModalV2 closeOnOverlayClick disableOutsidePointerEvents={false} {...rest}>
        <ModalWrapper
          onDismiss={props.onDismiss}
          containerStyle={{ border: 'none', ...mobileContainerStyle }}
          style={{
            overflow: 'visible',
            border: 'none',
            ...mobileContainerStyle,
            ...(isSocialLoginModalOpen ? { display: 'none' } : {}),
          }}
        >
          <AtomBox position="relative">
            <TabContainer docLink={docLink} docText={docText} fullSize={fullSize} onDismiss={props.onDismiss}>
              {isMobile ? (
                <MobileModal
                  mevDocLink={mevDocLink}
                  connectWallet={connectWallet}
                  topWallets={topWallets}
                  previouslyUsedWallets={previouslyUsedWallets}
                  wallets={wallets}
                  docLink={docLink}
                  docText={docText}
                  onOpenSocialLoginModal={openSocialLoginModal}
                />
              ) : (
                <DesktopModal
                  mevDocLink={mevDocLink}
                  connectWallet={connectWallet}
                  onWalletConnected={handleWalletConnected}
                  topWallets={topWallets}
                  previouslyUsedWallets={previouslyUsedWallets}
                  wallets={wallets}
                  docLink={docLink}
                  docText={docText}
                  onOpenSocialLoginModal={openSocialLoginModal}
                />
              )}
            </TabContainer>
          </AtomBox>
        </ModalWrapper>
      </ModalV2>
    </>
  )
}

const Intro = ({ docLink, docText }: { docLink: string; docText: string }) => {
  const { t } = useTranslation()
  return (
    <>
      <Heading as="h1" fontSize="20px" color="secondary">
        {t('Haven’t got a wallet yet?')}
      </Heading>
      <Image src="https://cdn.pancakeswap.com/wallets/wallet_intro.png" width={198} height={178} />
      <Button as={LinkExternal} color="backgroundAlt" variant="subtle" href={docLink}>
        {docText}
      </Button>
    </>
  )
}

const NotInstalled = ({ wallet, qrCode }: { wallet: WalletConfigV2; qrCode?: string }) => {
  const { t } = useTranslation()
  return (
    <>
      <Heading as="h1" fontSize="20px" color="secondary">
        {t('%wallet% is not installed', { wallet: wallet.title })}
      </Heading>
      {qrCode && (
        <Suspense>
          <AtomBox overflow="hidden" borderRadius="card" style={{ width: '288px', height: '288px' }}>
            <Qrcode url={qrCode} image={typeof wallet.icon === 'string' ? wallet.icon : undefined} />
          </AtomBox>
        </Suspense>
      )}
      {!qrCode && !wallet.isNotExtension && (
        <Text maxWidth="246px" m="auto">
          {t('Please install the %wallet% browser extension to connect the %wallet% wallet.', {
            wallet: wallet.title,
          })}
        </Text>
      )}
      {wallet.guide && (
        <Button variant="subtle" as="a" href={getDesktopLink(wallet.guide)} external>
          {getDesktopText(wallet.guide, t('Setup Guide'))}
        </Button>
      )}
      {wallet.downloadLink && (
        <Button variant="subtle" as="a" href={getDesktopLink(wallet.downloadLink)} external>
          {getDesktopText(wallet.downloadLink, t('Install'))}
        </Button>
      )}
    </>
  )
}

const ErrorMessage = ({ message }: { message: string }) => (
  <Text bold color="failure">
    <WarningIcon width="16px" color="failure" style={{ verticalAlign: 'middle' }} /> {message}
  </Text>
)

const ErrorContent = ({ onRetry, message }: { onRetry: () => void; message: string }) => {
  const { t } = useTranslation()
  return (
    <>
      <ErrorMessage message={message} />
      <Button variant="subtle" onClick={onRetry}>
        {t('Retry')}
      </Button>
    </>
  )
}

const getDesktopLink = (linkDevice: LinkOfDevice) =>
  typeof linkDevice === 'string'
    ? linkDevice
    : typeof linkDevice.desktop === 'string'
    ? linkDevice.desktop
    : linkDevice.desktop?.url

const getDesktopText = (linkDevice: LinkOfDevice, fallback: string) =>
  typeof linkDevice === 'string'
    ? fallback
    : typeof linkDevice.desktop === 'string'
    ? fallback
    : linkDevice.desktop?.text ?? fallback
