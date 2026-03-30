import { Box, FlexGap, Tag } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { RangeTag } from 'components/RangeTag'
import { MerklTagV2 } from 'components/Merkl/MerklTag'
import { IncentraTagV2 } from 'components/Incentra/IncentraTag'
import { useTranslation } from '@pancakeswap/localization'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { StableLPDetail, V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { FeeTierTooltip } from '@pancakeswap/widgets-internal'
import { Percent } from '@pancakeswap/sdk'
import { LegacyStableSwapPair } from '@pancakeswap/smart-router/legacy-router'
import { V2PoolPositionAprButton } from 'views/universalFarms/components/PoolAprButton'
import { Protocol } from '@pancakeswap/farms'
import { useMemo } from 'react'
import { StablePoolInfo, V2PoolInfo } from 'state/farmsV4/state/type'
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'
import { PositionTabType } from '../types'
import { V2PositionAdd } from './Add/V2PositionAdd'
import { SSPositionAdd } from './Add/SSPositionAdd'
import { V2PositionRemove } from './Remove/V2PositionRemove'
import { SSPositionRemove } from './Remove/SSPositionRemove'
import { V2OrSSPositionHarvest } from './Harvest/V2OrSSPositionHarvest'

interface V2PositionModalContentProps {
  poolId?: Hex
  chainId?: number
  tab?: PositionTabType
  position?: V2LPDetail | StableLPDetail
  protocol: Protocol
}
export const V2OrSSPositionModalContent = ({
  poolId,
  chainId,
  position,
  protocol,
  tab = 'Add',
}: V2PositionModalContentProps) => {
  const { t } = useTranslation()

  const poolInfo = usePoolInfo({ poolAddress: poolId, chainId })

  const derivedPoolInfo = useMemo<V2PoolInfo | StablePoolInfo | null>(() => {
    if (poolInfo || !position || !chainId) return null
    if (protocol === Protocol.V2 && 'pair' in position) {
      const { pair } = position as V2LPDetail
      return {
        chainId,
        protocol: Protocol.V2,
        lpAddress: pair.liquidityToken.address,
        token0: pair.token0,
        token1: pair.token1,
        feeTier: 2500,
        feeTierBase: 1e6,
        isFarming: !!position.isStaked,
      } satisfies V2PoolInfo
    }
    if (protocol === Protocol.STABLE && 'pair' in position) {
      const { pair } = position as StableLPDetail
      const stablePair = pair as LegacyStableSwapPair
      return {
        chainId,
        protocol: Protocol.STABLE,
        lpAddress: stablePair.lpAddress,
        token0: pair.token0,
        token1: pair.token1,
        feeTier: Math.round(stablePair.stableTotalFee * 1e6),
        feeTierBase: 1e6,
        isFarming: !!position.isStaked,
      } satisfies StablePoolInfo
    }
    return null
  }, [poolInfo, position, chainId, protocol])

  const resolvedPoolInfo = poolInfo ?? derivedPoolInfo

  if (!resolvedPoolInfo) return 'Unable to fetch pool info, or pool does not exist'

  return (
    <Box>
      <PoolInfoDisplay
        currency0={resolvedPoolInfo.token0}
        currency1={resolvedPoolInfo.token1}
        feeTierDisplay={
          <FeeTierTooltip
            type={resolvedPoolInfo.protocol}
            percent={new Percent(resolvedPoolInfo?.feeTier ?? 0n, resolvedPoolInfo?.feeTierBase)}
          />
        }
        rangeTags={
          <FlexGap alignItems="center">
            <FlexGap gap="4px">
              <RangeTag outOfRange={false} lowContrast />
              {resolvedPoolInfo?.isFarming && <Tag variant="primary60">{t('Farming')}</Tag>}
            </FlexGap>
            <MerklTagV2 poolAddress={resolvedPoolInfo.lpAddress} />
            <IncentraTagV2 poolAddress={resolvedPoolInfo.lpAddress} />
          </FlexGap>
        }
        aprDisplay={
          position ? (
            <V2PoolPositionAprButton pool={resolvedPoolInfo} userPosition={position} textProps={{ fontSize: '16px' }} />
          ) : null
        }
      />

      <Box mt="16px">
        {tab === 'Harvest' ? (
          <V2OrSSPositionHarvest position={position as V2LPDetail | StableLPDetail} poolInfo={resolvedPoolInfo} />
        ) : protocol === Protocol.V2 ? (
          tab === 'Add' ? (
            <V2PositionAdd position={position as V2LPDetail} poolInfo={resolvedPoolInfo} />
          ) : tab === 'Remove' ? (
            <V2PositionRemove position={position as V2LPDetail} poolInfo={resolvedPoolInfo} />
          ) : null
        ) : protocol === Protocol.STABLE ? (
          tab === 'Add' ? (
            <SSPositionAdd position={position as StableLPDetail} poolInfo={resolvedPoolInfo} />
          ) : tab === 'Remove' ? (
            <SSPositionRemove position={position as StableLPDetail} poolInfo={resolvedPoolInfo} />
          ) : null
        ) : null}
      </Box>
    </Box>
  )
}
