import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { Column, Skeleton, Text } from '@pancakeswap/uikit'
import React, { useMemo } from 'react'
import { usePoolApr } from 'state/farmsV4/hooks'
import { useAccountV3Position } from 'state/farmsV4/state/accountPositions/hooks/useAccountV3Position'
import { PoolInfo } from 'state/farmsV4/state/type'
import { PoolGlobalAprButton, V3PoolPositionAprButton } from 'views/universalFarms/components'
import { V3PoolDerivedAprButton } from 'views/universalFarms/components/PoolAprButtonV3'

interface AprCalculatorV2Props {
  pool?: PoolInfo | null
  tokenId?: bigint
  derived?: boolean
  inverted?: boolean
  showTitle?: boolean
  showApyText?: boolean
  showApyButton?: boolean
  fontSize?: string
}

const WithTitle = ({ children, pool }: { children: React.ReactNode; pool: PoolInfo }) => {
  const { t } = useTranslation()
  const key = useMemo(() => `${pool.chainId}:${pool.lpAddress}` as const, [pool.chainId, pool.lpAddress])
  const { cakeApr } = usePoolApr(key, pool)
  const hasFarmApr = cakeApr?.value !== '0'
  return (
    <Column gap="8px" alignItems="flex-end">
      <Text color="textSubtle" fontSize="12px">
        {hasFarmApr ? t('APR (with farming)') : t('APR')}
      </Text>
      {children}
    </Column>
  )
}

export function AprCalculatorV2({
  pool,
  tokenId,
  showTitle = true,
  derived,
  inverted,
  showApyText,
  showApyButton,
  fontSize,
}: AprCalculatorV2Props) {
  if (derived) {
    return (
      <DerivedAprCalculator
        pool={pool}
        showTitle={showTitle}
        inverted={inverted}
        showApyText={showApyText}
        showApyButton={showApyButton}
        fontSize={fontSize}
      />
    )
  }

  if (tokenId) {
    return <PositionAprCalculator pool={pool} tokenId={tokenId} showTitle={showTitle} />
  }
  return <GlobalAprCalculator pool={pool} showTitle={showTitle} />
}

const GlobalAprCalculator: React.FC<AprCalculatorV2Props> = ({ pool, showTitle }) => {
  if (!pool) {
    return <Skeleton height="40px" />
  }

  return showTitle ? (
    <WithTitle pool={pool}>
      <PoolGlobalAprButton pool={pool} />
    </WithTitle>
  ) : (
    <PoolGlobalAprButton pool={pool} />
  )
}

const DerivedAprCalculator: React.FC<AprCalculatorV2Props> = ({
  pool,
  inverted,
  showTitle,
  showApyText,
  showApyButton,
  fontSize,
}) => {
  if (!pool) {
    return <Skeleton height="40px" />
  }

  if (pool.protocol !== Protocol.V3) {
    return <GlobalAprCalculator pool={pool} showTitle={showTitle} />
  }

  return showTitle ? (
    <WithTitle pool={pool}>
      <V3PoolDerivedAprButton
        pool={pool}
        inverted={inverted}
        showApyText={showApyText}
        showApyButton={showApyButton}
        fontSize={fontSize}
      />
    </WithTitle>
  ) : (
    <V3PoolDerivedAprButton
      pool={pool}
      inverted={inverted}
      showApyText={showApyText}
      showApyButton={showApyButton}
      fontSize={fontSize}
    />
  )
}

const PositionAprCalculator: React.FC<AprCalculatorV2Props & { tokenId: bigint }> = ({ pool, tokenId, showTitle }) => {
  const { data: userPosition } = useAccountV3Position(pool?.chainId, tokenId)

  if (!pool || !userPosition) {
    return <Skeleton height="40px" />
  }

  if (!pool || !userPosition) {
    return <Skeleton height="40px" />
  }

  return showTitle ? (
    <WithTitle pool={pool}>
      <V3PoolPositionAprButton userPosition={userPosition} pool={pool} />
    </WithTitle>
  ) : (
    <V3PoolPositionAprButton userPosition={userPosition} pool={pool} />
  )
}
