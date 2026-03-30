import type { QueryClient } from '@tanstack/react-query'

/** Refetches reward / pending data used by the harvest modal after a successful harvest (no global hook changes). */
export function invalidateHarvestRewardQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['poolFarmRewards'] }),
    queryClient.invalidateQueries({ queryKey: ['userAllFarmRewards'] }),
    queryClient.invalidateQueries({ queryKey: ['userAllClaimedRewards'] }),
    queryClient.invalidateQueries({ queryKey: ['mcv3-harvest'] }),
    queryClient.invalidateQueries({ queryKey: ['harvestModalV2StablePendingCake'] }),
  ])
}
