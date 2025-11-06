import { useCallback, useMemo } from 'react'
import styled from 'styled-components'

import { Protocol } from '@pancakeswap/farms'
import { PoolKey } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { Button, Flex, useModalV2 } from '@pancakeswap/uikit'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import type { InfinityBinPositionDetail, InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import useFarmInfinityActions from 'views/universalFarms/hooks/useFarmInfinityActions'
import useInfinityCollectFeeAction from 'views/universalFarms/hooks/useInfinityCollectFeeAction'

import { InfinityHarvestModal, type InfinityHarvestProps } from '../Modals/InfinityHarvestModal'
import { StopPropagation } from '../StopPropagation'

type ActionPanelProps = Omit<InfinityHarvestProps, 'currency0' | 'currency1'>

const ActionPanelContainer = styled(Flex)`
  flex-direction: row;
  gap: 8px;
  height: 48px;

  & button {
    flex: 1;
  }
`

export const InfinityPositionActions = ({
  pos: pos_,
  positionList = [],
  showPositionFees = true,
  chainId: chainId_,
}: ActionPanelProps) => {
  const { t } = useTranslation()
  const [, setLatestTxReceipt] = useLatestTxReceipt()
  const modalState = useModalV2()

  const pos = useMemo(
    () =>
      pos_ ??
      positionList?.find((x) => x.chainId === chainId_) ??
      ({} as InfinityCLPositionDetail | InfinityBinPositionDetail),
    [pos_, positionList, chainId_],
  )

  const { chainId: chainIdPos, poolKey } = pos

  const chainId = chainId_ ?? chainIdPos

  const {
    onHarvest,
    attemptingTx: harvestAttemptingTxn,
    isMerkleRootMismatch,
    hasRewards,
    hasUnclaimedRewards,
  } = useFarmInfinityActions({
    chainId,
    onDone: setLatestTxReceipt,
  })
  const { onCollect, attemptingTx: collectAttemptingTxn } = useInfinityCollectFeeAction({ chainId })

  const currency0 = useCurrencyByChainId(pos?.poolKey?.currency0, chainId) ?? undefined
  const currency1 = useCurrencyByChainId(pos?.poolKey?.currency1, chainId) ?? undefined

  const harvestList = useMemo(() => {
    const isSamePosition = (p: InfinityCLPositionDetail | InfinityBinPositionDetail) => {
      if (!pos) return false
      if (p.chainId !== pos.chainId || p.protocol !== pos.protocol) return false
      return p.protocol === Protocol.InfinityCLAMM
        ? p.tokenId === (pos as InfinityCLPositionDetail).tokenId
        : (p as InfinityBinPositionDetail).activeId === (pos as InfinityBinPositionDetail).activeId
    }

    const filtered = positionList
      .filter((p) => p.chainId === chainId) // Filter by chainId
      .filter((p) => p !== pos && !isSamePosition(p)) // Exclude the current position and same position

    if (pos) {
      filtered.unshift(pos)
    }

    return filtered
  }, [positionList, pos, chainId])

  const handleCollect = useCallback(() => {
    if (pos?.protocol !== Protocol.InfinityCLAMM) {
      return
    }
    onCollect({
      tokenId: pos?.tokenId,
      poolKey: poolKey as PoolKey<'CL'>,
    })
  }, [poolKey, onCollect, pos])

  const isAttemptingTx = collectAttemptingTxn || harvestAttemptingTxn

  if (!currency0 || !currency1) {
    return null
  }

  return (
    <StopPropagation>
      <ActionPanelContainer>
        <Button
          width={['100px']}
          scale="md"
          disabled={isAttemptingTx || isMerkleRootMismatch || !hasRewards || !hasUnclaimedRewards}
          onClick={modalState.onOpen}
        >
          {isAttemptingTx ? t('Harvesting') : t('Harvest')}
        </Button>
      </ActionPanelContainer>
      {modalState.isOpen ? (
        <InfinityHarvestModal
          {...modalState}
          positionList={harvestList}
          currency0={currency0}
          currency1={currency1}
          chainId={chainId}
          onHarvest={onHarvest}
          onCollect={handleCollect}
          pos={pos}
          showPositionFees={showPositionFees}
          closeOnOverlayClick
        />
      ) : null}
    </StopPropagation>
  )
}
