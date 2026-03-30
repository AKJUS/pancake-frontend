import { getPoolId } from '@pancakeswap/infinity-sdk'
import { Protocol } from '@pancakeswap/farms'
import { Box, Button, Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { useOpenHarvestModal } from 'components/HarvestPositionsModal'
import { bscTokens } from '@pancakeswap/tokens'
import { InfinityBinPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useFarmInfinityPositionActions } from 'views/universalFarms/hooks/useFarmInfinityPositionActions'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { FarmingRewardsDisplay } from '../../shared/FarmingRewardsDisplay'
import { MerklRewardsDisplay } from '../../shared/MerklRewardsDisplay'
import { IncentraRewardsDisplay } from '../../shared/IncentraRewardsDisplay'

interface InfinityBinPositionHarvestProps {
  position: InfinityBinPositionDetail
  poolInfo: PoolInfo
}

export const InfinityBinPositionHarvest = ({ position, poolInfo }: InfinityBinPositionHarvestProps) => {
  const { t } = useTranslation()
  const { chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const openHarvestModal = useOpenHarvestModal()

  const chainId = position.chainId ?? poolInfo.chainId
  const needsSwitchNetwork = activeChainId !== chainId
  const poolId = position.poolKey ? getPoolId(position.poolKey) : position.poolId

  const { rewardsCurrencyAmount, totalRewardsAmount, totalRewardsUSD, hasUnclaimedRewards } =
    useFarmInfinityPositionActions({
      chainId,
      poolId,
      position,
    })

  const hasFarmRewards = hasUnclaimedRewards && totalRewardsAmount.isGreaterThan(0)

  return (
    <Box>
      <Text color="textSubtle" fontSize="14px" mb="16px" lineHeight="1.5">
        {t('Open Harvest for farming rewards from your positions.')}
      </Text>
      {hasFarmRewards ? (
        <FarmingRewardsDisplay
          rewardToken={bscTokens.cake}
          rewardsAmount={rewardsCurrencyAmount?.toSignificant(6) ?? totalRewardsAmount.toFixed(6)}
          rewardsUSD={totalRewardsUSD}
          onHarvest={() => openHarvestModal?.()}
          harvesting={false}
          disabled={!openHarvestModal}
          hideButton={needsSwitchNetwork}
        />
      ) : needsSwitchNetwork ? null : (
        <Button width="100%" onClick={() => openHarvestModal?.()} disabled={!openHarvestModal}>
          {t('Harvest')}
        </Button>
      )}

      <MerklRewardsDisplay
        poolAddress={poolId}
        poolProtocol={Protocol.InfinityBIN}
        chainId={chainId}
        disabled={needsSwitchNetwork}
        hideButton={needsSwitchNetwork}
      />

      <IncentraRewardsDisplay poolAddress={poolId} chainId={chainId} />

      {needsSwitchNetwork && (
        <Button
          mt="16px"
          width="100%"
          onClick={() => (chainId ? switchNetworkIfNecessary(chainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      )}
    </Box>
  )
}
