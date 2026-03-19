import { useTranslation } from '@pancakeswap/localization'
import { Box, Button, Flex, Text, getPortalRoot, useMatchBreakpoints } from '@pancakeswap/uikit'
import { sdk } from '@farcaster/miniapp-sdk'
import { useAtomValue, useSetAtom } from 'jotai'
import { QRCodeSVG } from 'qrcode.react'
import React, { createContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { styled } from 'styled-components'
import { ASSET_CDN } from 'config/constants/endpoints'
import { baseMiniAppAutoConnectRetryAtom, baseMiniAppAutoConnectStatusAtom } from 'state/wallet/atom'

const QRCodeWrapper = styled(Box)`
  padding: 0px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
`

const QRCodeBox = styled(Box)`
  width: 100%;
  height: auto;
  background-color: white;
  border-radius: 24px;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  overflow: hidden;
`

const Overlay = styled(Box)`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`

const Card = styled(Box)`
  width: 100%;
  max-width: 420px;
  background: ${({ theme }) => theme.colors.backgroundAlt};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: 24px;
  padding: 24px;
  text-align: center;
`

const CHECK_DELAY_MS = 100
const CHECK_ATTEMPTS = 3
const MINI_APP_QR_URL = 'https://base.app/app/https://cakepad.pancakeswap.finance/cakepad-base'

export const BaseMiniAppContext = createContext<{ isInMiniApp: boolean | null } | null>(null)

const BaseMiniAppProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  const isDev = process.env.NODE_ENV !== 'production'
  const autoConnectStatus = useAtomValue(baseMiniAppAutoConnectStatusAtom)
  const retryBaseWallet = useSetAtom(baseMiniAppAutoConnectRetryAtom)
  const [isInMiniApp, setIsInMiniApp] = useState<boolean | null>(isDev ? true : null)
  const contextValue = useMemo(() => ({ isInMiniApp }), [isInMiniApp])
  const portal = useMemo(() => (typeof window === 'undefined' ? null : getPortalRoot()), [])

  useEffect(() => {
    if (isDev) {
      setIsInMiniApp(true)
      return undefined
    }
    if (typeof window === 'undefined') return undefined
    let cancelled = false

    const init = async () => {
      try {
        try {
          sdk.actions.ready()
        } catch (error) {
          console.warn('[base-miniapp] ready() failed', error)
        }

        const checkIsInMiniApp = async (attemptsLeft: number): Promise<boolean> => {
          const result = await sdk.isInMiniApp()
          if (cancelled || result || attemptsLeft <= 1) {
            return result
          }
          await new Promise((resolve) => setTimeout(resolve, CHECK_DELAY_MS))
          return checkIsInMiniApp(attemptsLeft - 1)
        }

        const result = await checkIsInMiniApp(CHECK_ATTEMPTS)
        if (cancelled) return
        setIsInMiniApp(result)
      } catch (error) {
        if (cancelled) return
        console.warn('[base-miniapp] isInMiniApp() failed', error)
        setIsInMiniApp(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [isDev])

  if (isDev) {
    return <BaseMiniAppContext.Provider value={contextValue}>{children}</BaseMiniAppContext.Provider>
  }

  if (isInMiniApp === null) {
    return <BaseMiniAppContext.Provider value={contextValue}>{null}</BaseMiniAppContext.Provider>
  }

  return (
    <BaseMiniAppContext.Provider value={contextValue}>
      {isInMiniApp !== false ? children : null}
      {isInMiniApp === true && autoConnectStatus === 'failed' ? (
        portal ? (
          createPortal(
            <Overlay>
              <Card>
                <Flex flexDirection="column" alignItems="center" justifyContent="center">
                  <Text fontSize="20px" bold mb="8px">
                    {t('Unable to connect Base wallet')}
                  </Text>
                  <Text color="textSubtle" textAlign="center" mb="16px">
                    {t('Retry connecting your Base wallet to continue using Cakepad.')}
                  </Text>
                  <Flex width="100%" flexDirection="column" style={{ gap: '12px' }}>
                    <Button width="100%" onClick={() => retryBaseWallet((count) => count + 1)}>
                      {t('Retry Base Wallet')}
                    </Button>
                    <Button as="a" variant="secondary" href={MINI_APP_QR_URL} width="100%">
                      {t('Reopen Cakepad')}
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            </Overlay>,
            portal,
          )
        ) : (
          <Overlay>
            <Card>
              <Flex flexDirection="column" alignItems="center" justifyContent="center">
                <Text fontSize="20px" bold mb="8px">
                  {t('Unable to connect Base wallet')}
                </Text>
                <Text color="textSubtle" textAlign="center" mb="16px">
                  {t('Retry connecting your Base wallet to continue using Cakepad.')}
                </Text>
                <Flex width="100%" flexDirection="column" style={{ gap: '12px' }}>
                  <Button width="100%" onClick={() => retryBaseWallet((count) => count + 1)}>
                    {t('Retry Base Wallet')}
                  </Button>
                  <Button as="a" variant="secondary" href={MINI_APP_QR_URL} width="100%">
                    {t('Reopen Cakepad')}
                  </Button>
                </Flex>
              </Flex>
            </Card>
          </Overlay>
        )
      ) : null}
      {isInMiniApp === false ? (
        portal ? (
          createPortal(
            <Overlay>
              <Card>
                <Flex flexDirection="column" alignItems="center" justifyContent="center">
                  <Text fontSize="20px" bold mb="8px">
                    {t('Use Cakepad on Base App')}
                  </Text>
                  <Text color="textSubtle" textAlign="center" mb="16px">
                    {isMobile
                      ? t('Open the Base app to use Cakepad.')
                      : t('Scan the QR code to open this mini app on Base')}
                  </Text>
                  {isMobile ? (
                    <Button as="a" href="https://join.base.app/" width="100%">
                      {t('Go')}
                    </Button>
                  ) : (
                    <QRCodeWrapper>
                      <QRCodeBox>
                        <QRCodeSVG
                          value={MINI_APP_QR_URL}
                          size={280}
                          level="H"
                          includeMargin
                          imageSettings={{
                            src: `${ASSET_CDN}/web/chains/8453.png`,
                            x: undefined,
                            y: undefined,
                            height: 48,
                            width: 48,
                            excavate: true,
                          }}
                        />
                      </QRCodeBox>
                    </QRCodeWrapper>
                  )}
                </Flex>
              </Card>
            </Overlay>,
            portal,
          )
        ) : (
          <Overlay>
            <Card>
              <Flex flexDirection="column" alignItems="center" justifyContent="center">
                <Text fontSize="20px" bold mb="8px">
                  {t('Use Cakepad on Base App')}
                </Text>
                <Text color="textSubtle" textAlign="center" mb="16px">
                  {isMobile
                    ? t('Open the Base app to use Cakepad.')
                    : t('Scan the QR code to open this mini app on Base')}
                </Text>
                {isMobile ? (
                  <Button as="a" href="https://join.base.app/" width="100%">
                    {t('Go')}
                  </Button>
                ) : (
                  <QRCodeWrapper>
                    <QRCodeBox>
                      <QRCodeSVG
                        value={MINI_APP_QR_URL}
                        size={280}
                        level="H"
                        includeMargin
                        imageSettings={{
                          src: `${ASSET_CDN}/web/chains/8453.png`,
                          x: undefined,
                          y: undefined,
                          height: 48,
                          width: 48,
                          excavate: true,
                        }}
                      />
                    </QRCodeBox>
                  </QRCodeWrapper>
                )}
              </Flex>
            </Card>
          </Overlay>
        )
      ) : null}
    </BaseMiniAppContext.Provider>
  )
}

export default BaseMiniAppProvider
