import { Protocol } from '@pancakeswap/farms'
import { Box, Flex, FlexGap, Spinner, Tag } from '@pancakeswap/uikit'
import { isSolana, isEvm } from '@pancakeswap/chains'
import { Hex } from 'viem'
import { useIsFetching } from '@tanstack/react-query'
import { useMemo } from 'react'
import { safeGetAddress } from 'utils/safeGetAddress'
import { RangeTag } from 'components/RangeTag'
import { MerklTagV2 } from 'components/Merkl/MerklTag'
import { IncentraTagV2 } from 'components/Incentra/IncentraTag'
import { useTranslation } from '@pancakeswap/localization'
import { useExtraV3PositionInfo, usePoolInfo } from 'state/farmsV4/hooks'
import {
  PositionDetail,
  SolanaV3PositionDetail,
  UnifiedPositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import { SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { FeeTierTooltip } from '@pancakeswap/widgets-internal'
import { Percent } from '@pancakeswap/sdk'
import { V3PoolPositionAprButton, SolanaV3PoolPositionAprButton } from 'views/universalFarms/components/PoolAprButton'
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'
import { PositionTabType } from '../types'
import { V3PositionAdd } from './Add'
import { V3PositionRemove } from './Remove'
import { V3PositionHarvest } from './Harvest'

interface V3PositionModalContentProps {
  poolId?: Hex
  chainId?: number
  tab?: PositionTabType
  position?: UnifiedPositionDetail
}
export const V3PositionModalContent = ({ poolId, chainId, position, tab = 'Add' }: V3PositionModalContentProps) => {
  const { t } = useTranslation()

  const poolAddress = poolId && isEvm(chainId) ? safeGetAddress(poolId) ?? poolId : poolId
  const poolInfo = usePoolInfo({ poolAddress: poolId, chainId })
  const isFetchingPoolInfo = useIsFetching({ queryKey: ['poolInfo', chainId, poolAddress] })

  const resolvedChainId = chainId ?? (position && 'chainId' in position ? position.chainId : undefined)
  const evmV3Position =
    position?.protocol === Protocol.V3 && resolvedChainId !== undefined && !isSolana(resolvedChainId)
      ? (position as PositionDetail)
      : undefined
  const { outOfRange, removed } = useExtraV3PositionInfo(evmV3Position)

  // Match PositionsTable: EVM V3 = staked NFT only; Solana V3 = pool-level isFarming
  const showFarmingTag = useMemo(() => {
    if (!resolvedChainId) return false
    if (isSolana(resolvedChainId)) {
      return Boolean(poolInfo?.isFarming)
    }
    return Boolean(evmV3Position?.isStaked)
  }, [resolvedChainId, poolInfo?.isFarming, evmV3Position?.isStaked])

  if (!poolInfo) {
    if (isFetchingPoolInfo) {
      return (
        <Flex justifyContent="center" py="48px">
          <Spinner />
        </Flex>
      )
    }
    return 'Unable to fetch pool info, or pool does not exist'
  }

  return (
    <Box>
      <PoolInfoDisplay
        currency0={poolInfo.token0}
        currency1={poolInfo.token1}
        feeTierDisplay={
          <FeeTierTooltip
            type={poolInfo.protocol}
            percent={new Percent(poolInfo?.feeTier ?? 0n, poolInfo?.feeTierBase)}
            dynamic={poolInfo?.isDynamicFee}
            showType={false}
          />
        }
        rangeTags={
          <FlexGap alignItems="center">
            <FlexGap gap="4px">
              <RangeTag removed={removed} outOfRange={outOfRange} protocol={Protocol.V3} lowContrast />
              {showFarmingTag && <Tag variant="primary60">{t('Farming')}</Tag>}
            </FlexGap>
            <MerklTagV2 poolAddress={poolInfo.lpAddress} />
            <IncentraTagV2 poolAddress={poolInfo.lpAddress} />
          </FlexGap>
        }
        aprDisplay={
          evmV3Position ? (
            <V3PoolPositionAprButton pool={poolInfo} userPosition={evmV3Position} textProps={{ fontSize: '16px' }} />
          ) : (
            <SolanaV3PoolPositionAprButton
              pool={poolInfo as SolanaV3PoolInfo}
              userPosition={position as SolanaV3PositionDetail}
              textProps={{ fontSize: '16px' }}
            />
          )
        }
      />

      <Box mt="16px">
        {tab === 'Add' ? (
          <V3PositionAdd position={position as PositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Remove' ? (
          <V3PositionRemove position={position as PositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Harvest' ? (
          <V3PositionHarvest position={position as PositionDetail} poolInfo={poolInfo} />
        ) : null}
      </Box>
    </Box>
  )
}
