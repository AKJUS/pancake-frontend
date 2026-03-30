import { Box, FlexGap } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { RangeTag } from 'components/RangeTag'
import { MerklTagV2 } from 'components/Merkl/MerklTag'
import { IncentraTagV2 } from 'components/Incentra/IncentraTag'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { StableLPDetail } from 'state/farmsV4/state/accountPositions/type'
import { FeeTierTooltip } from '@pancakeswap/widgets-internal'
import { Percent } from '@pancakeswap/sdk'
import { V2PoolPositionAprButton } from 'views/universalFarms/components/PoolAprButton'
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'
import { PositionTabType } from '../types'
import { InfinitySSPositionAdd } from './Add/InfinitySSPositionAdd'
import { InfinitySSPositionRemove } from './Remove/InfinitySSPositionRemove'

interface InfinitySSPositionModalContentProps {
  poolId?: Hex
  chainId?: number
  tab?: PositionTabType
  position?: StableLPDetail
}

export const InfinitySSPositionModalContent = ({
  poolId,
  chainId,
  position,
  tab = 'Add',
}: InfinitySSPositionModalContentProps) => {
  const poolInfo = usePoolInfo({ poolAddress: poolId, chainId })

  if (!poolInfo) return 'Unable to fetch pool info, or pool does not exist'

  return (
    <Box>
      <PoolInfoDisplay
        currency0={poolInfo.token0}
        currency1={poolInfo.token1}
        feeTierDisplay={
          <FeeTierTooltip
            type={poolInfo.protocol}
            percent={new Percent(poolInfo?.feeTier ?? 0n, poolInfo?.feeTierBase)}
          />
        }
        rangeTags={
          <FlexGap alignItems="center">
            <FlexGap gap="4px">
              <RangeTag outOfRange={false} lowContrast />
            </FlexGap>
            <MerklTagV2 poolAddress={poolInfo.lpAddress} />
            <IncentraTagV2 poolAddress={poolInfo.lpAddress} />
          </FlexGap>
        }
        aprDisplay={
          position ? (
            <V2PoolPositionAprButton pool={poolInfo} userPosition={position} textProps={{ fontSize: '16px' }} />
          ) : null
        }
      />

      <Box mt="16px">
        {tab === 'Add' ? (
          <InfinitySSPositionAdd poolInfo={poolInfo} />
        ) : tab === 'Remove' ? (
          <InfinitySSPositionRemove position={position} poolInfo={poolInfo} />
        ) : null}
      </Box>
    </Box>
  )
}
