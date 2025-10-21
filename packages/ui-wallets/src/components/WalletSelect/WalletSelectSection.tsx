import {
  Column,
  Text,
  AtomBox,
  Button,
  Row,
  Image,
  Card,
  CardBody,
  FlexGap,
  ShieldCheckIcon,
  useTooltip,
  Link,
} from '@pancakeswap/uikit'
import { StyledCardInner } from '@pancakeswap/uikit/components/Card/StyledCard'
import React from 'react'
import styled, { useTheme } from 'styled-components'
import { Trans } from '@pancakeswap/localization'
import { WalletAdaptedNetwork, WalletConfigV3 } from '../../types'
import { walletIconClass } from '../WalletModal.css'
import { ASSET_CDN } from '../../config/url'

export type WalletSelectSectionProps = React.PropsWithChildren<{
  label: React.ReactNode
}>

const StyledItemGrid = styled(AtomBox)`
  overflow-y: auto;
  overflow-x: hidden;

  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  row-gap: 8px;
  column-gap: 8px;

  & > :nth-child(1) {
    justify-self: left;
  }

  & > :nth-child(2) {
    justify-self: center;
  }

  & > :nth-child(3) {
    justify-self: right;
  }

  ${({ theme }) => theme.mediaQueries.sm} {
    grid-template-columns: 1fr 1fr;
    row-gap: 5px;
    column-gap: 8px;

    & > :nth-child(1) {
      justify-self: center;
    }

    & > :nth-child(2) {
      justify-self: center;
    }

    & > :nth-child(3) {
      justify-self: center;
    }
  }

  ${({ theme }) => theme.mediaQueries.md} {
    grid-template-columns: 1fr 1fr 1fr;
  }
`

export const WalletSelectSection: React.FC<WalletSelectSectionProps> = ({ label, children }) => {
  return (
    <Column gap="6px">
      <Text textTransform="uppercase" fontSize="12px" fontWeight="600" color="textSubtle" lineHeight={1.5}>
        {label}
      </Text>
      <StyledItemGrid>{children}</StyledItemGrid>
    </Column>
  )
}

export type WalletSelectItemProps<T> = {
  wallet: WalletConfigV3<T>
  onClick: (wallet: WalletConfigV3<T>, network: WalletAdaptedNetwork) => void
}

export const WalletSelectItem = <T,>({ wallet, onClick }: WalletSelectItemProps<T>) => {
  const isImage = typeof wallet.icon === 'string'
  const Icon = wallet.icon
  const theme = useTheme()
  const { targetRef, tooltipVisible, tooltip } = useTooltip(
    <Trans
      i18nKey="This wallet on PancakeSwap offers <0>MEV protection</0> against front-running and sandwich attacks on EVM chains."
      style={{ display: 'inline' }}
      components={[
        <Link
          ml="4px"
          style={{ display: 'inline' }}
          fontWeight="normal !important"
          external
          href="https://docs.pancakeswap.finance/trading-tools/pancakeswap-mev-guard"
        />,
      ]}
    />,
    {
      avoidToStopPropagation: true,
      placement: 'bottom',
    },
  )

  return (
    <AtomBox
      border="1"
      borderRadius="default"
      p="8px"
      style={{ maxWidth: '106px', width: '100%', borderBottomWidth: '2px' }}
      background="backgroundAlt"
    >
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
        onClick={() => onClick(wallet, wallet.networks[0])}
      >
        <AtomBox borderRadius="12px" mb="4px" position="relative">
          <AtomBox
            bgc="dropdown"
            display="flex"
            position="relative"
            justifyContent="center"
            alignItems="center"
            className={walletIconClass}
            style={{ borderRadius: '12px' }}
            overflow="hidden"
          >
            {isImage ? (
              <Image src={Icon as string} width={40} height={40} />
            ) : (
              <Icon width={24} height={24} color="textSubtle" />
            )}
          </AtomBox>
          {wallet.MEVSupported ? (
            <AtomBox
              position="absolute"
              style={{ bottom: '-4px', right: '-4px', borderRadius: '4px' }}
              width="16px"
              height="16px"
              background="positive10"
              ref={targetRef}
            >
              <ShieldCheckIcon width={12} height={12} color={theme.colors.positive60} />
            </AtomBox>
          ) : null}
          {tooltipVisible && tooltip}
        </AtomBox>
        {wallet.networks.length > 0 && (
          <NetworkTag>
            <CardBody p={['0px 4px', '0px 4px', '0 4px']}>
              <FlexGap gap="4px">
                {wallet.networks.includes(WalletAdaptedNetwork.EVM) && (
                  <img
                    src={`${ASSET_CDN}/web/wallet-ui/network-tag-evm.svg`}
                    width={16}
                    height={16}
                    alt="EVM network"
                    style={{ display: 'block' }}
                  />
                )}
                {wallet.networks.includes(WalletAdaptedNetwork.Solana) && (
                  <img
                    src={`${ASSET_CDN}/web/wallet-ui/network-tag-solana.png`}
                    width={16}
                    height={16}
                    alt="Solana network"
                    style={{ display: 'block' }}
                  />
                )}
              </FlexGap>
            </CardBody>
          </NetworkTag>
        )}
        <Row gap="2px">
          {/* {wallet.MEVSupported ? <ShieldCheckIcon width={17} height={17} color={theme.colors.positive60} /> : null} */}
          <Text color="textSubtle" fontSize="12px" textAlign="center" width="100%" ellipsis>
            {wallet.title}
          </Text>
        </Row>
      </Button>
    </AtomBox>
  )
}

const NetworkTag = styled(Card)`
  border-radius: 5px;
  padding: 0.5px 0.5px 1px 0.5px;

  ${StyledCardInner} {
    border-radius: 5px;
  }
`
