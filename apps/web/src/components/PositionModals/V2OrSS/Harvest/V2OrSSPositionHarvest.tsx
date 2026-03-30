import { useTranslation } from '@pancakeswap/localization'
import { Protocol } from '@pancakeswap/farms'
import { useToast, Box, Button, Text } from '@pancakeswap/uikit'
import { CAKE } from '@pancakeswap/tokens'
import { ToastDescriptionWithTx } from 'components/Toast'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import useCatchTxError from 'hooks/useCatchTxError'
import { useCallback, useMemo } from 'react'
import { StableLPDetail, V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo, StablePoolInfo, V2PoolInfo } from 'state/farmsV4/state/type'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { useV2CakeEarning } from 'views/universalFarms/hooks/useCakeEarning'
import { useV2FarmActions } from 'views/universalFarms/hooks/useV2FarmActions'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { Address } from 'viem'
import { FarmingRewardsDisplay } from '../../shared/FarmingRewardsDisplay'
import { MerklRewardsDisplay } from '../../shared/MerklRewardsDisplay'
import { IncentraRewardsDisplay } from '../../shared/IncentraRewardsDisplay'

interface V2OrSSPositionHarvestProps {
  position: V2LPDetail | StableLPDetail
  poolInfo: PoolInfo
}

export const V2OrSSPositionHarvest = ({ position, poolInfo }: V2OrSSPositionHarvestProps) => {
  const { t } = useTranslation()
  const { toastSuccess } = useToast()
  const { chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const [, setLatestTxReceipt] = useLatestTxReceipt()
  const { loading: pendingTx, fetchWithCatchTxError } = useCatchTxError()

  const { chainId } = poolInfo
  const needsSwitchNetwork = activeChainId !== chainId
  const lpAddress = poolInfo.lpAddress as Address
  const { bCakeWrapperAddress } = poolInfo as V2PoolInfo | StablePoolInfo

  const { onHarvest } = useV2FarmActions(lpAddress, bCakeWrapperAddress)
  const { earningsAmount, earningsBusd, hasEarnings, isLoading } = useV2CakeEarning(poolInfo)

  const handleHarvest = useCallback(async () => {
    const receipt = await fetchWithCatchTxError(() => onHarvest())
    if (receipt?.status) {
      setLatestTxReceipt(receipt)
      toastSuccess(
        `${t('Harvested')}!`,
        <ToastDescriptionWithTx txHash={receipt.transactionHash}>
          {t('Your %symbol% earnings have been sent to your wallet!', { symbol: 'CAKE' })}
        </ToastDescriptionWithTx>,
      )
    }
  }, [fetchWithCatchTxError, onHarvest, setLatestTxReceipt, t, toastSuccess])

  const rewardsPoolAddress = useMemo(
    () => (poolInfo.stableSwapAddress as string) || (poolInfo.lpAddress as string),
    [poolInfo.stableSwapAddress, poolInfo.lpAddress],
  )

  return (
    <Box>
      {hasEarnings || isLoading ? (
        <FarmingRewardsDisplay
          rewardToken={CAKE[chainId]}
          rewardsAmount={earningsAmount}
          rewardsUSD={earningsBusd}
          onHarvest={handleHarvest}
          harvesting={pendingTx}
          disabled={pendingTx || isLoading || !hasEarnings}
          hideButton={needsSwitchNetwork}
        />
      ) : (
        <Text color="textSubtle" textAlign="center" py="24px">
          {t('No farming rewards to harvest')}
        </Text>
      )}

      <MerklRewardsDisplay
        poolAddress={rewardsPoolAddress}
        poolProtocol={poolInfo.protocol as Protocol}
        chainId={chainId}
        disabled={needsSwitchNetwork}
        hideButton={needsSwitchNetwork}
      />

      <IncentraRewardsDisplay poolAddress={rewardsPoolAddress} chainId={chainId} />

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
