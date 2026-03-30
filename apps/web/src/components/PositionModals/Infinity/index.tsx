import { Box, FlexGap, Tag } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { useMemo } from 'react'
import { InfinityFeeTierBreakdown } from 'components/FeeTierBreakdown'
import { RangeTag } from 'components/RangeTag'
import { MerklTagV2 } from 'components/Merkl/MerklTag'
import { IncentraTagV2 } from 'components/Incentra/IncentraTag'
import { useTranslation } from '@pancakeswap/localization'
import {
  InfinityCLPoolPositionAprButton,
  InfinityBinPoolPositionAprButton,
} from 'views/universalFarms/components/PoolAprButton'
import { usePositionIsFarming } from 'hooks/infinity/useIsFarming'
import { useExtraInfinityPositionInfo, usePoolInfo } from 'state/farmsV4/hooks'
import { Protocol } from '@pancakeswap/farms'
import { InfinityBinPositionDetail, InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { InfinityPoolInfo } from 'state/farmsV4/state/type'
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'
import { PositionTabType } from '../types'
import { InfinityCLPositionAdd } from './Add'
import { InfinityBinPositionAdd } from './Add/InfinityBinPositionAdd'
import { InfinityCLPositionRemove } from './Remove/InfinityCLPositionRemove'
import { InfinityBinPositionRemove } from './Remove/InfinityBinPositionRemove'
import { InfinityCLPositionHarvest } from './Harvest/InfinityCLPositionHarvest'
import { InfinityBinPositionHarvest } from './Harvest/InfinityBinPositionHarvest'

interface InfinityPositionModalContentProps {
  poolId?: Hex
  chainId?: number
  tab?: PositionTabType
  position?: InfinityCLPositionDetail | InfinityBinPositionDetail
}
export const InfinityPositionModalContent = ({
  poolId,
  chainId,
  position,
  tab = 'Add',
}: InfinityPositionModalContentProps) => {
  const { t } = useTranslation()

  const poolInfo = usePoolInfo({ poolAddress: poolId, chainId })
  const poolIdForCampaign = poolInfo?.poolId ?? poolId
  const campaignFarmingActive = usePositionIsFarming({
    chainId,
    poolId: poolIdForCampaign ? String(poolIdForCampaign) : undefined,
  })

  const isCL = position?.protocol === Protocol.InfinityCLAMM
  const clPosition = isCL ? (position as InfinityCLPositionDetail) : undefined
  const binPosition = !isCL ? (position as InfinityBinPositionDetail | undefined) : undefined

  const { outOfRange: clOutOfRange, removed: clRemoved } = useExtraInfinityPositionInfo(clPosition)

  const binOutOfRange = useMemo(() => {
    if (!binPosition || binPosition.minBinId === null || binPosition.maxBinId === null) return false
    return binPosition.activeId < binPosition.minBinId || binPosition.activeId > binPosition.maxBinId
  }, [binPosition])

  const binRemoved = useMemo(() => (binPosition ? binPosition.liquidity === 0n : false), [binPosition])

  const outOfRange = isCL ? clOutOfRange : binOutOfRange
  const removed = isCL ? clRemoved : binRemoved

  if (!poolInfo) return 'Unable to fetch pool info, or pool does not exist'

  const showFarmingTag = Boolean(
    poolInfo.isFarming || campaignFarmingActive || (position && 'isStaked' in position && position.isStaked),
  )

  return (
    <Box>
      <PoolInfoDisplay
        currency0={poolInfo.token0}
        currency1={poolInfo.token1}
        feeTierDisplay={<InfinityFeeTierBreakdown poolId={poolId} poolInfo={poolInfo ?? undefined} chainId={chainId} />}
        rangeTags={
          <FlexGap alignItems="center">
            <FlexGap gap="4px">
              <RangeTag removed={removed} outOfRange={outOfRange} protocol={poolInfo.protocol} lowContrast />
              {showFarmingTag && <Tag variant="primary60">{t('Farming')}</Tag>}
            </FlexGap>
            <MerklTagV2 poolAddress={poolInfo.lpAddress} />
            <IncentraTagV2 poolAddress={poolInfo.lpAddress} />
          </FlexGap>
        }
        aprDisplay={
          poolInfo && position ? (
            poolInfo.protocol === Protocol.InfinityBIN ? (
              <InfinityBinPoolPositionAprButton
                pool={poolInfo as InfinityPoolInfo}
                userPosition={position as InfinityBinPositionDetail}
                textProps={{ fontSize: '16px' }}
              />
            ) : (
              <InfinityCLPoolPositionAprButton
                pool={poolInfo as InfinityPoolInfo}
                userPosition={position as InfinityCLPositionDetail}
                textProps={{ fontSize: '16px' }}
              />
            )
          ) : null
        }
      />

      <Box mt="16px">
        {tab === 'Add' && poolInfo.protocol === Protocol.InfinityCLAMM ? (
          <InfinityCLPositionAdd position={position as InfinityCLPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Add' && poolInfo.protocol === Protocol.InfinityBIN ? (
          <InfinityBinPositionAdd position={position as InfinityBinPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Remove' && poolInfo.protocol === Protocol.InfinityCLAMM ? (
          <InfinityCLPositionRemove position={position as InfinityCLPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Remove' && poolInfo.protocol === Protocol.InfinityBIN ? (
          <InfinityBinPositionRemove position={position as InfinityBinPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Harvest' && poolInfo.protocol === Protocol.InfinityCLAMM ? (
          <InfinityCLPositionHarvest position={position as InfinityCLPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Harvest' && poolInfo.protocol === Protocol.InfinityBIN ? (
          <InfinityBinPositionHarvest position={position as InfinityBinPositionDetail} poolInfo={poolInfo} />
        ) : null}
      </Box>
    </Box>
  )
}
