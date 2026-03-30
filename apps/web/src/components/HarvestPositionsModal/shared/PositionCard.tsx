import { Protocol } from '@pancakeswap/farms'
import { UnifiedCurrency } from '@pancakeswap/sdk'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { FeeTier, FlexGap, Tag, Text } from '@pancakeswap/uikit'
import type { ReactNode } from 'react'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { DoubleCurrencyLogo } from '@pancakeswap/widgets-internal'
import styled from 'styled-components'
import { GreyBadge, TagV2 } from 'components/Liquidity/Badges'
import { HarvestTxStatus } from '../state/atoms'
import { HarvestStatusIndicator } from './HarvestStatusIndicator'

export interface RewardInfo {
  currency: Currency | UnifiedCurrency
  amount: number | string
}

interface PositionCardProps {
  currency0: Currency | UnifiedCurrency
  currency1: Currency | UnifiedCurrency
  tokenId?: string | number
  earningsUSD: number
  rewards: RewardInfo[]
  protocol?: Protocol
  status?: HarvestTxStatus
  children?: ReactNode
}

const CardRow = styled(FlexGap)`
  border-bottom: 1px solid ${({ theme }) => theme.colors.cardBorder};

  &:last-child {
    border-bottom: none;
  }
`

function getProtocolLabel(protocol: Protocol) {
  if (protocol === Protocol.V3) return 'V3'
  if (protocol === Protocol.V2) return 'V2'
  if (protocol === Protocol.STABLE) return 'StableSwap'
  if (protocol === Protocol.InfinityCLAMM)
    return (
      <>
        <span>Infinity</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>CLAMM</span>
      </>
    )
  if (protocol === Protocol.InfinityBIN)
    return (
      <>
        <span>Infinity</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>LBAMM</span>
      </>
    )
  if (protocol === Protocol.InfinitySTABLE)
    return (
      <>
        <span>Infinity</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span>SS</span>
      </>
    )
  return protocol
}

export function PositionCard({
  currency0,
  currency1,
  tokenId,
  earningsUSD,
  rewards,
  protocol,
  status,
  children,
}: PositionCardProps) {
  const showStatus = status && status !== HarvestTxStatus.Idle

  return (
    <CardRow flexDirection="column" py="8px" width="100%">
      <FlexGap flexDirection="row" justifyContent="space-between" alignItems="flex-start" gap="8px" width="100%">
        <FlexGap gap="8px" alignItems="center" flex="1" minWidth="0">
          {showStatus ? <HarvestStatusIndicator status={status} /> : null}
          <DoubleCurrencyLogo
            currency0={currency0}
            currency1={currency1}
            size={24}
            innerMargin="-4px"
            showChainLogoCurrency1
          />
          <FlexGap gap="4px" alignItems="center" flex="1" minWidth="0" flexWrap="wrap">
            <Text fontSize="14px" bold ellipsis minWidth="0" title={`${currency0.symbol} / ${currency1.symbol}`}>
              {`${currency0.symbol} / ${currency1.symbol}`}
            </Text>
            {tokenId ? (
              <Text fontSize="14px" color="textSubtle" style={{ flexShrink: 0 }}>
                #{String(tokenId)}
              </Text>
            ) : null}
            {protocol ? (
              <GreyBadge $withBorder style={{ padding: '0 8px' }}>
                <Text
                  color="textSubtle"
                  fontSize="12px"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  {getProtocolLabel(protocol)}
                </Text>
              </GreyBadge>
            ) : null}
          </FlexGap>
        </FlexGap>
        <Text fontSize="14px" bold style={{ flexShrink: 0 }} textAlign="right">
          {formatFiatNumber(earningsUSD, undefined, { maximumSignificantDigits: 6 })}
        </Text>
      </FlexGap>
      {rewards.length > 0 ? (
        <FlexGap justifyContent="flex-end" flexWrap="wrap" gap="4px" width="100%">
          <Text fontSize="12px" textAlign="right">
            {rewards.map((reward, idx) => (
              <span key={reward.currency.symbol ?? idx}>
                {idx > 0 && ' + '}
                {formatNumber(reward.amount, { maximumSignificantDigits: 8 })}{' '}
                <Text as="span" fontSize="12px" color="textSubtle">
                  {reward.currency.symbol}
                </Text>
              </span>
            ))}
          </Text>
        </FlexGap>
      ) : null}
      {children}
    </CardRow>
  )
}
