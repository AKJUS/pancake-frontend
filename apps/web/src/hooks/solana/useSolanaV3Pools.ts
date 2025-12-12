import { useQuery } from '@tanstack/react-query'
import { SLOW_INTERVAL } from 'config/constants'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { addSolanaV3PoolAtom, allSolanaV3PoolsAtom, SolanaV3Pool, solanaV3PoolIdsAtom } from 'state/pools/solana'

async function fetchSolanaPoolsData(poolIds: (string | undefined)[]): Promise<(SolanaV3Pool | null)[]> {
  const validPoolIds = poolIds.filter(Boolean) as string[]
  const timestamp = Date.now()

  if (validPoolIds.length === 0) {
    return poolIds.map(() => null)
  }

  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_SOL_EXPLORE_API_ENDPOINT!
    const searchUrl = '/cached/v1/pools/info/ids'
    const response = await fetch(`${apiBaseUrl}${searchUrl}?ids=${validPoolIds.join(',')}`)

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const responseData = await response.json()
    const poolsData = responseData.data || responseData || []

    const poolDataMap = new Map<string, SolanaV3Pool>()
    poolsData.forEach((pool: SolanaV3Pool) => {
      if (pool && pool.id) {
        let isFarming = false
        if (pool.rewardDefaultInfos && pool.rewardDefaultInfos.length > 0) {
          isFarming = pool.rewardDefaultInfos.some(
            (reward) => Number(reward.endTime ?? 0) * 1000 > timestamp && reward.perSecond > 0,
          )
        }
        poolDataMap.set(pool.id, { ...pool, isFarming } as SolanaV3Pool)
      }
    })

    return poolIds.map((poolId) => {
      if (!poolId) {
        return null
      }
      return poolDataMap.get(poolId) || null
    })
  } catch (error) {
    console.error('Error fetching Solana pools data:', error)
    return poolIds.map(() => null)
  }
}

export function useSolanaV3Pools(poolIds: (string | undefined)[]): (SolanaV3Pool | null)[] {
  const addSolanaV3Pool = useSetAtom(addSolanaV3PoolAtom)
  const allSolanaV3Pools = useAtomValue(allSolanaV3PoolsAtom)
  const allSolanaV3PoolsId = useAtomValue(solanaV3PoolIdsAtom)
  const poolsNotFetched = useMemo(() => {
    return poolIds.filter((poolId) => poolId !== undefined && !allSolanaV3PoolsId.includes(poolId))
  }, [poolIds, allSolanaV3PoolsId])
  const poolIdsString = useMemo(() => JSON.stringify(poolsNotFetched), [poolsNotFetched])
  const [latestTxReceipt] = useLatestTxReceipt()

  useQuery({
    queryKey: ['solanaV3Pools', poolIdsString, latestTxReceipt?.blockHash],
    queryFn: async () => {
      const pools = await fetchSolanaPoolsData(poolsNotFetched)
      pools.forEach(addSolanaV3Pool)
      return true
    },
    enabled: poolsNotFetched.length > 0,
    refetchInterval: SLOW_INTERVAL,
  })

  return allSolanaV3Pools
}

export function useSolanaV3Pool(poolId: string | undefined): SolanaV3Pool | null {
  const poolIds = useMemo(() => [poolId], [poolId])
  const pools = useSolanaV3Pools(poolIds)

  return useMemo(() => {
    if (!poolId) return null
    return pools.find((pool) => pool?.id === poolId) || null
  }, [poolId, pools])
}
