import { useTranslation } from '@pancakeswap/localization'
import { Box, Button, Flex, Text, getPortalRoot, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useAtomValue, useSetAtom } from 'jotai'
import { QRCodeSVG } from 'qrcode.react'
import React, { createContext, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { styled } from 'styled-components'
import { WalletIds } from '@pancakeswap/ui-wallets'
import { ASSET_CDN } from 'config/constants/endpoints'
import { baseMiniAppAutoConnectRetryAtom, baseMiniAppAutoConnectStatusAtom } from 'state/wallet/atom'
import { useWalletRuntime } from 'wallet/hook/useWalletEnv'

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

const MINI_APP_QR_URL = 'https://base.app/app/https://cakepad.pancakeswap.finance'

export const BaseMiniAppContext = createContext<{ isInMiniApp: boolean | null } | null>(null)

const BaseMiniAppProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  const autoConnectStatus = useAtomValue(baseMiniAppAutoConnectStatusAtom)
  const retryBaseWallet = useSetAtom(baseMiniAppAutoConnectRetryAtom)
  const { env, wallet } = useWalletRuntime()
  const isInMiniApp = env === 'wallet_app' && wallet === WalletIds.BaseApp
  const contextValue = useMemo(() => ({ isInMiniApp }), [isInMiniApp])
  const portal = useMemo(() => (typeof window === 'undefined' ? null : getPortalRoot()), [])

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
