import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { FlexGap, ModalV2, MotionModal, PreTitle } from '@pancakeswap/uikit'
import { useQueryClient } from '@tanstack/react-query'
import { Hex } from 'viem'
import { isInfinityProtocol } from 'utils/protocols'
import { safeGetAddress } from 'utils/safeGetAddress'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  PositionDetail,
  StableLPDetail,
  UnifiedPositionDetail,
  V2LPDetail,
} from 'state/farmsV4/state/accountPositions/type'
import styled from 'styled-components'
import { InfinityPositionModalContent } from './Infinity'
import { InfinitySSPositionModalContent } from './InfinitySS'
import { PositionTabType } from './types'
import { V3PositionModalContent } from './V3'
import { V2OrSSPositionModalContent } from './V2OrSS'

const ClickablePreTitle = styled(PreTitle)<{ $active?: boolean }>`
  cursor: pointer;
  transition: scale, opacity 0.15s;
  user-select: none;
  ${({ $active }) =>
    !$active &&
    `
      &:hover {
        opacity: 0.7;
      }
    `}
  &:active {
    transform: translateY(1px);
  }
`

const TAB_LABELS: Record<PositionTabType, string> = {
  Add: 'Add Liquidity',
  Remove: 'Remove Liquidity',
  Harvest: 'Harvest',
}

interface PositionModalProps {
  isOpen?: boolean
  onDismiss?: () => void

  poolId: string | undefined
  protocol: Protocol | undefined
  position: UnifiedPositionDetail

  chainId?: number
  presetTab?: PositionTabType
}
export function PositionModal({
  isOpen,
  onDismiss,
  protocol,
  poolId,
  chainId,
  position,
  presetTab,
}: PositionModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isOpen && chainId && poolId) {
      queryClient.refetchQueries({ queryKey: ['poolInfo', chainId, safeGetAddress(poolId) ?? poolId] })
    }
  }, [isOpen, chainId, poolId, queryClient])

  const availableTabs = useMemo(() => {
    const tabs: PositionTabType[] = ['Add', 'Remove']

    if (!protocol) return tabs

    if (protocol === Protocol.InfinitySTABLE) return tabs

    if (protocol === Protocol.V3 || isInfinityProtocol(protocol)) {
      tabs.push('Harvest')
      return tabs
    }

    if (position && 'farmingBalance' in position && position.farmingBalance.greaterThan(0)) {
      tabs.push('Harvest')
    }

    return tabs
  }, [protocol, position])

  const [tab, setTab] = useState<PositionTabType>(presetTab ?? 'Add')

  useEffect(() => {
    if (isOpen && presetTab) {
      setTab(presetTab)
    }
  }, [isOpen, presetTab])

  useEffect(() => {
    if (!availableTabs.includes(tab)) {
      setTab('Add')
    }
  }, [availableTabs, tab])

  const handleTabSelect = useCallback(
    (tab: PositionTabType) => {
      setTab(tab)
    },
    [setTab],
  )

  if (!poolId || !protocol) return null

  return (
    <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
      <MotionModal
        title={t('Position Management')}
        headerBorderColor="transparent"
        bodyPadding="0 24px 16px"
        onDismiss={onDismiss}
        width={['100%', null, protocol === Protocol.InfinityBIN ? '520px' : '452px']}
      >
        <FlexGap gap="16px" mb="16px">
          {availableTabs.map((t_) => (
            <ClickablePreTitle
              key={t_}
              color={tab === t_ ? 'secondary' : 'textSubtle'}
              onClick={() => handleTabSelect(t_)}
              $active={tab === t_}
            >
              {t(TAB_LABELS[t_])}
            </ClickablePreTitle>
          ))}
        </FlexGap>
        {protocol === Protocol.InfinitySTABLE ? (
          <InfinitySSPositionModalContent
            poolId={poolId as Hex}
            chainId={chainId}
            tab={tab}
            position={position as StableLPDetail}
          />
        ) : isInfinityProtocol(protocol) ? (
          <InfinityPositionModalContent
            poolId={poolId as Hex}
            chainId={chainId}
            tab={tab}
            position={position as InfinityCLPositionDetail | InfinityBinPositionDetail}
          />
        ) : protocol === Protocol.V3 ? (
          <V3PositionModalContent
            poolId={poolId as Hex}
            chainId={chainId}
            tab={tab}
            position={position as PositionDetail}
          />
        ) : protocol === Protocol.V2 || protocol === Protocol.STABLE ? (
          <V2OrSSPositionModalContent
            poolId={poolId as Hex}
            chainId={chainId}
            tab={tab}
            position={position as V2LPDetail}
            protocol={protocol}
          />
        ) : (
          'protocol not supported (testing)'
        )}
      </MotionModal>
    </ModalV2>
  )
}
