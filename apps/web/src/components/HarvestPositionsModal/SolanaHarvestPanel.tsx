import { useTranslation } from '@pancakeswap/localization'
import { Button, CircleLoader, Dots, FlexGap, Message, MessageText, PreTitle, Text } from '@pancakeswap/uikit'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import type { SolanaHarvestTarget } from 'hooks/solana/useSolanaClmmHarvestAllRewards'
import { HarvestTxStatus, harvestTxMapAtom } from './state/atoms'
import { useSolanaHarvestPosition } from './hooks/useSolanaHarvestPosition'
import { PositionCard, type RewardInfo } from './shared/PositionCard'
import { VerticalList } from './shared/styles'

export interface SolanaPositionItem {
  key: string
  currency0: any
  currency1: any
  tokenId?: string
  earningsUSD: number
  rewards: RewardInfo[]
}

interface SolanaHarvestPanelProps {
  positions: SolanaPositionItem[]
  totalEarningsUSD: number
  harvestTargets: SolanaHarvestTarget[]
  initialLoading?: boolean
  refreshing?: boolean
}

export function SolanaHarvestPanel({
  positions,
  totalEarningsUSD,
  harvestTargets,
  initialLoading = false,
  refreshing = false,
}: SolanaHarvestPanelProps) {
  const { t } = useTranslation()

  const targetsMap = useMemo(() => new Map(harvestTargets.map((tgt) => [tgt.key, tgt])), [harvestTargets])

  const noRewards = positions.length === 0

  if (initialLoading) {
    return (
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>
        <FlexGap justifyContent="space-between" alignItems="center" mb="12px">
          <PreTitle color="secondary">
            {t('SOLANA POSITIONS')}
            {refreshing ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}>
                <CircleLoader size="12px" />
              </span>
            ) : null}
          </PreTitle>
          <Text bold fontSize="16px" color="textDisabled">
            —
          </Text>
        </FlexGap>
        <FlexGap alignItems="center" gap="12px" justifyContent="center" py="24px">
          <CircleLoader size="20px" />
          <Text color="textSubtle" fontSize="14px">
            <Dots>{t('Loading positions')}</Dots>
          </Text>
        </FlexGap>
      </div>
    )
  }

  return (
    <div style={{ fontVariantNumeric: 'tabular-nums' }}>
      <FlexGap justifyContent="space-between" alignItems="center" mb="12px">
        <PreTitle color="secondary">
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span>
              {t('SOLANA POSITIONS')}
              {!noRewards ? ` (${positions.length})` : ''}
            </span>
            {refreshing ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}>
                <CircleLoader size="12px" />
              </span>
            ) : null}
          </span>
        </PreTitle>
        <Text bold fontSize="16px">
          {formatFiatNumber(totalEarningsUSD)}
        </Text>
      </FlexGap>

      {noRewards ? (
        <Text color="textSubtle" textAlign="center" py="16px" fontSize="14px">
          {t('No farm rewards to harvest')}
        </Text>
      ) : (
        <VerticalList $maxHeight="400px">
          {positions.map((pos) => (
            <SolanaPositionRow key={pos.key} position={pos} target={targetsMap.get(pos.key)} />
          ))}
        </VerticalList>
      )}
    </div>
  )
}

function SolanaPositionRow({
  position,
  target,
}: {
  position: SolanaPositionItem
  target: SolanaHarvestTarget | undefined
}) {
  const { t } = useTranslation()
  const txMap = useAtomValue(harvestTxMapAtom)
  const { harvest } = useSolanaHarvestPosition(target)

  const txState = txMap[position.key]
  const status = txState?.status
  const isPending = status === HarvestTxStatus.Pending
  const isSuccess = status === HarvestTxStatus.Success
  const isFailed = status === HarvestTxStatus.Failed

  return (
    <PositionCard
      currency0={position.currency0}
      currency1={position.currency1}
      tokenId={position.tokenId}
      earningsUSD={position.earningsUSD}
      rewards={position.rewards}
      status={status}
    >
      {!status && (
        <Button width="100%" scale="sm" variant="primary60Outline" onClick={harvest}>
          {t('Harvest')}
        </Button>
      )}

      {isPending && (
        <Button width="100%" scale="sm" variant="primary60Outline" disabled>
          <Dots>{t('Harvesting')}</Dots>
        </Button>
      )}

      {isSuccess && (
        <Button width="100%" scale="sm" variant="primary60Outline" disabled>
          {t('Harvested')}
        </Button>
      )}

      {isFailed && (
        <>
          <Button width="100%" scale="sm" variant="primary60Outline" onClick={harvest}>
            {t('Retry')}
          </Button>
          <Message variant="warning" mt="4px">
            <MessageText fontSize="12px">
              {position.tokenId
                ? t('An error occurred during the harvest of pool #%id%, please try again', {
                    id: position.tokenId,
                  })
                : t('An error occurred during the harvest, please try again')}
            </MessageText>
          </Message>
        </>
      )}
    </PositionCard>
  )
}
