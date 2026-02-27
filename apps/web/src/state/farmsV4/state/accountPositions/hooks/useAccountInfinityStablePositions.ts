import { useQuery } from '@tanstack/react-query'
import { SLOW_INTERVAL } from 'config/constants'
import { useMemo } from 'react'
import { Address } from 'viem'
import { getAccountInfinityStablePositionDetails } from '../fetcher/infinity'
import { StableLPDetail } from '../type'
import { useLatestTxReceipt } from './useLatestTxReceipt'

export const useAccountInfinityStablePositions = (
  chainIds: number[],
  account?: Address | null,
): {
  data: StableLPDetail[]
  pending: boolean
} => {
  const [latestTxReceipt] = useLatestTxReceipt()

  const { data, isPending } = useQuery<StableLPDetail[], Error>({
    queryKey: ['accountInfinityStablePositions', account, chainIds.join(','), latestTxReceipt?.blockHash],
    queryFn: async () => {
      if (!account) return []
      const results = await Promise.all(
        chainIds.map(async (chainId) => {
          try {
            const details = await getAccountInfinityStablePositionDetails(chainId, account)
            return details.filter((d) => d.nativeBalance.greaterThan('0') || d.farmingBalance.greaterThan('0'))
          } catch (error) {
            console.error(`Error fetching Infinity Stable positions for chainId ${chainId}:`, error)
            return []
          }
        }),
      )
      return results.flat()
    },
    enabled: Boolean(account),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: SLOW_INTERVAL,
    staleTime: SLOW_INTERVAL,
  })

  return useMemo(() => {
    if (!account) {
      return { data: [] as StableLPDetail[], pending: false }
    }
    if (!data) {
      return { data: [] as StableLPDetail[], pending: isPending }
    }

    return {
      data,
      pending: isPending,
    }
  }, [data, isPending, account])
}
