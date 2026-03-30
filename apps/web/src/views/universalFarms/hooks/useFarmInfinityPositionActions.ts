import { Protocol } from '@pancakeswap/farms'
import dayjs from 'dayjs'
import { useAccount } from 'wagmi'
import type { TransactionReceipt } from 'viem'
import type { InfinityBinPositionDetail, InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'

import { useUnclaimedFarmRewardsUSDByTokenId, useUnclaimedFarmRewardsUSDByPoolId } from 'hooks/infinity/useFarmReward'
import { useMemo } from 'react'
import BigNumber from 'bignumber.js'
import useFarmInfinityActions from './useFarmInfinityActions'

export interface UseFarmInfinityPositionActionsParams {
  chainId: number
  poolId: string | undefined
  position: InfinityCLPositionDetail | InfinityBinPositionDetail
  onDone?: (receipt: TransactionReceipt | null) => void
}

/**
 * Reusable hook for harvesting a single Infinity position.
 * Fetches and displays rewards for the given position only.
 * Harvest action claims all Infinity rewards on the chain (contract limitation).
 */
export function useFarmInfinityPositionActions({
  chainId,
  poolId,
  position,
  onDone,
}: UseFarmInfinityPositionActionsParams) {
  const { address } = useAccount()
  const timestamp = useMemo(() => dayjs().startOf('hour').unix(), [])

  const isCL = position.protocol === Protocol.InfinityCLAMM
  const tokenId = isCL ? (position as InfinityCLPositionDetail).tokenId : undefined

  const { data: positionRewardsCL, isLoading: isLoadingCL } = useUnclaimedFarmRewardsUSDByTokenId({
    chainId,
    address,
    poolId,
    tokenId,
    timestamp,
  })

  const { data: positionRewardsBIN, isLoading: isLoadingBIN } = useUnclaimedFarmRewardsUSDByPoolId({
    chainId,
    address,
    poolId,
    timestamp,
  })

  const rewardsCurrencyAmount = useMemo(
    () => (isCL ? positionRewardsCL?.rewardsAmount : positionRewardsBIN?.rewardsAmount),
    [isCL, positionRewardsCL, positionRewardsBIN],
  )

  const totalRewardsAmount = useMemo(() => {
    const exact = rewardsCurrencyAmount?.toExact()
    return exact ? new BigNumber(exact) : new BigNumber(0)
  }, [rewardsCurrencyAmount])

  const totalRewardsUSD = useMemo(() => {
    if (isCL) return positionRewardsCL?.rewardsUSD ?? 0
    return positionRewardsBIN?.rewardsUSD ?? 0
  }, [isCL, positionRewardsCL, positionRewardsBIN])

  const hasUnclaimedRewards = totalRewardsAmount.isGreaterThan(0)

  const { onHarvest, attemptingTx } = useFarmInfinityActions({
    chainId,
    onDone,
  })

  return {
    rewardsCurrencyAmount,
    totalRewardsAmount,
    totalRewardsUSD,
    hasUnclaimedRewards,
    onHarvest,
    attemptingTx,
    isLoading: isCL ? isLoadingCL : isLoadingBIN,
  }
}
