import React from 'react'
import { Trans, useTranslation } from '@pancakeswap/localization'
import {
  InfoIcon,
  ShieldCheckIcon,
  AtomBox,
  Button,
  Card,
  CardBody,
  Column,
  Flex,
  FlexGap,
  Heading,
  Image,
  Link,
  Row,
  RowBetween,
  Text,
  useTooltip,
  useMatchBreakpoints,
  Message,
  Checkbox,
  MessageText,
} from '@pancakeswap/uikit'
import styled from 'styled-components'
import { ChainId } from '@pancakeswap/chains'
import { useTheme } from '@pancakeswap/hooks'
import { WalletConfigV3, WalletAdaptedNetwork } from '../../types'
import { ASSET_CDN } from '../../config/url'
import { useMetamaskVersionWarning } from '../../hooks/useMetamaskVersionWarning'

export type WalletChainSelectProps = {
  wallet: WalletConfigV3<any> | null
  solanaAddress?: string
  evmAddress?: string
  onConnectEVM?: () => void
  onConnectSolana?: () => void
}

export const WalletChainSelect: React.FC<WalletChainSelectProps> = ({
  wallet,
  solanaAddress,
  evmAddress,
  onConnectEVM,
  onConnectSolana,
}) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { isMobile } = useMatchBreakpoints()

  const supportsEVM = wallet?.networks.includes(WalletAdaptedNetwork.EVM)
  const supportsSolana = wallet?.networks.includes(WalletAdaptedNetwork.Solana)

  const {
    targetRef: evmTooltipTargetRef,
    tooltip: evmTooltip,
    tooltipVisible: evmTooltipVisible,
  } = useTooltip(<EvmTooltipContent />, {
    placement: 'bottom',
    trigger: 'hover',
  })

  const {
    targetRef: mevTooltipTargetRef,
    tooltip: mevTooltip,
    tooltipVisible: mevTooltipVisible,
  } = useTooltip(
    <>
      <Trans
        i18nKey="This wallet on PancakeSwap offers <0>MEV protection</0> against front-running and sandwich attacks on EVM chains."
        components={[
          <Link
            style={{ display: 'inline' }}
            external
            href="https://docs.pancakeswap.finance/trading-tools/pancakeswap-mev-guard"
          />,
        ]}
      />
    </>,
    {
      placement: 'bottom',
      trigger: 'hover',
    },
  )

  const shouldShowMetamaskVersionWarning = useMetamaskVersionWarning()

  if (!wallet || wallet.networks.length <= 1) return null

  return (
    <Column gap="16px" style={{ width: '100%' }}>
      <Column gap="8px" alignItems="center">
        <AtomBox
          display="flex"
          justifyContent="center"
          alignItems="center"
          style={{ width: '56px', height: '56px', borderRadius: '12px' }}
          overflow="hidden"
          bg="backgroundAlt"
        >
          {typeof wallet.icon === 'string' ? (
            <Image src={wallet.icon} width={56} height={56} />
          ) : (
            <wallet.icon width={56} height={56} />
          )}
        </AtomBox>
        <Heading as="h2" fontSize="16px" fontWeight="600" color="text">
          {wallet.title}
        </Heading>
      </Column>
      <Card style={{ width: '100%' }}>
        <CardBody p="16px">
          <Column gap="8px">
            <Heading as="h3" fontSize="16px" fontWeight="600" color="text">
              {t('Select Chain')}
            </Heading>
            <Text fontSize="14px" color="textSubtle" lineHeight="1.4">
              {t('%Wallet% supports multiple ecosystems. Please select which chain(s) to connect to.', {
                Wallet: wallet.title,
              })}
            </Text>

            <Column gap="16px">
              {supportsEVM && (
                <RowBetween flexWrap="nowrap">
                  <FlexGap alignItems="center" gap="8px">
                    <SquareNetworkIcon>
                      <img src={`${ASSET_CDN}/web/wallet-ui/network-tag-evm.svg`} width={32} height={32} alt="EVM" />
                    </SquareNetworkIcon>

                    <Row gap="4px" alignItems="center" style={{ flexBasis: '0%' }}>
                      <Text fontSize="16px" fontWeight="600" color="text">
                        EVM
                      </Text>

                      <Flex alignItems="center" ref={evmTooltipTargetRef}>
                        <InfoIcon width={16} height={16} />
                        {evmTooltipVisible && evmTooltip}
                      </Flex>
                      {wallet.MEVSupported && (
                        <Flex alignItems="center" ref={mevTooltipTargetRef}>
                          <ShieldCheckIcon width={16} height={16} color={theme.colors.positive60} />
                          {mevTooltipVisible && mevTooltip}
                        </Flex>
                      )}
                    </Row>
                  </FlexGap>
                  {evmAddress ? (
                    <Checkbox checked disabled scale="sm" />
                  ) : (
                    <Button variant="primary" onClick={onConnectEVM} scale={isMobile ? 'sm' : 'md'}>
                      {t('Connect')}
                    </Button>
                  )}
                </RowBetween>
              )}

              {supportsSolana && (
                <>
                  <RowBetween flexWrap="nowrap">
                    <Row gap="8px" alignItems="center">
                      <SquareNetworkIcon>
                        <img
                          src={`${ASSET_CDN}/web/wallet-ui/network-tag-solana.png`}
                          width={32}
                          height={32}
                          alt="Solana"
                        />
                      </SquareNetworkIcon>

                      <Text fontSize="16px" fontWeight="600" color="text">
                        Solana
                      </Text>
                    </Row>
                    {solanaAddress ? (
                      <Checkbox checked disabled scale="sm" />
                    ) : (
                      <Button variant="primary" onClick={onConnectSolana} scale={isMobile ? 'sm' : 'md'}>
                        {t('Connect')}
                      </Button>
                    )}
                  </RowBetween>
                  {shouldShowMetamaskVersionWarning && (
                    <Message variant="warning">
                      <MessageText>
                        {t(`If you're having trouble connecting with MetaMask, try updating to the latest version.`)}
                      </MessageText>
                    </Message>
                  )}
                </>
              )}
            </Column>
          </Column>
        </CardBody>
      </Card>

      {isMobile && wallet.MEVSupported && <EvmMevSupportMessage />}
    </Column>
  )
}

const StyledMessage = styled(Message)`
  display: flex;
  align-items: center;
  padding: 8px 16px;
  margin-bottom: 16px;
  border-radius: 32px;
`

const EvmMevSupportMessage = () => {
  return (
    <StyledMessage variant="success" icon={<ShieldCheckIcon width="18px" height="18px" color="positive60" />}>
      <Flex alignItems="center" style={{ fontSize: '12px' }}>
        <Trans
          i18nKey="Wallets with <0>MEV Protection</0>."
          style={{ display: 'inline' }}
          components={[
            <Link
              ml="4px"
              fontWeight="normal !important"
              fontSize="12px"
              external
              href="https://docs.pancakeswap.finance/trading-tools/pancakeswap-mev-guard"
            />,
          ]}
        />
      </Flex>
    </StyledMessage>
  )
}

const EvmTooltipContent = () => {
  const { t } = useTranslation()
  return (
    <>
      <Text>
        {t(
          'EVM stands for Ethereum Virtual Machine and allows different blockchains to run Ethereum-based apps using the same wallet and address',
        )}
      </Text>

      <FlexGap gap="5px" flexWrap="wrap" mt="8px">
        <SquareChainIcon src={`${ASSET_CDN}/web/chains/square/${ChainId.BSC}.svg`} alt="bnb" />
        <SquareChainIcon src={`${ASSET_CDN}/web/chains/square/${ChainId.ETHEREUM}.svg`} alt="eth" />
        <SquareChainIcon src={`${ASSET_CDN}/web/chains/square/${ChainId.BASE}.svg`} alt="base" />
        <SquareChainIcon src={`${ASSET_CDN}/web/chains/square/${ChainId.ARBITRUM_ONE}.svg`} alt="arbitrum" />
        <SquareChainIcon src={`${ASSET_CDN}/web/chains/square/${ChainId.ZKSYNC}.svg`} alt="zksync" />
        <SquareChainIcon src={`${ASSET_CDN}/web/chains/square/${ChainId.LINEA}.svg`} alt="linea" />
        <SquareChainIcon src={`${ASSET_CDN}/web/chains/square/${ChainId.MONAD_TESTNET}.svg`} alt="monad" />
      </FlexGap>
    </>
  )
}

const SquareChainIcon = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 8px;
  object-fit: contain;
`

const SquareNetworkIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.cardSecondary};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-bottom-width: 2px;
  box-sizing: border-box;
  object-fit: contain;
`
