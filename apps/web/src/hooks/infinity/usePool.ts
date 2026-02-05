import { UnifiedChainId } from '@pancakeswap/chains'
import { BinPool, Pool as CLPool, findHook, PoolType } from '@pancakeswap/infinity-sdk'
import { Token } from '@pancakeswap/swap-sdk-core'
import { useQuery } from '@tanstack/react-query'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { PoolState } from 'hooks/v3/types'
import { useMemo } from 'react'
import { fetchPoolInfo } from 'state/farmsV4/state/accountPositions/fetcher/infinity/getPoolInfo'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { Address } from 'viem'
import { getBinPoolWithCache, getClPoolWithCache } from './getPool'
import { isPoolId } from './utils/pool'

export const usePoolById = <
  TPoolType extends PoolType = PoolType,
  TPool = TPoolType extends 'CL' ? CLPool : TPoolType extends 'Bin' ? BinPool : CLPool | BinPool,
>(
  poolId?: Address,
  overrideChainId?: UnifiedChainId,
  enabled: boolean = true,
): [PoolState, TPool | null] => {
  const { chainId: activeChainId } = useActiveChainId()
  const chainId = overrideChainId || activeChainId
  const [latestTxReceipt] = useLatestTxReceipt()

  const { data } = useQuery({
    queryKey: ['poolInfo', poolId, chainId, latestTxReceipt?.blockHash],
    queryFn: () => fetchPoolInfo(poolId!, chainId),
    enabled: isPoolId(poolId) && !!chainId && enabled,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    staleTime: 5 * 1000,
  })

  const currencyA = useCurrencyByChainId(data?.currency0, chainId) ?? undefined
  const currencyB = useCurrencyByChainId(data?.currency1, chainId) ?? undefined

  return useMemo((): [PoolState, TPool | null] => {
    if (!poolId || !data || !currencyA || !currencyB || (!data.dynamic && data.fee >= 1e6)) {
      return [PoolState.NOT_EXISTS, null]
    }

    try {
      if (data.poolType === 'CL') {
        const { poolType, parameters, fee, sqrtPriceX96, liquidity, tick, protocolFee, lpFee, hooks } = data
        const dynamicHook = hooks ? findHook(hooks, chainId) : undefined
        const pool = getClPoolWithCache({
          chainId,
          poolId,
          tokenA: currencyA as Token,
          tokenB: currencyB as Token,
          lpFee: dynamicHook?.defaultFee ?? lpFee,
          fee,
          sqrtRatioX96: sqrtPriceX96,
          liquidity,
          tick,
          protocolFee,
          poolType,
          tickSpacing: parameters.tickSpacing,
        })
        return [PoolState.EXISTS, pool as TPool]
      }

      if (data.poolType === 'Bin') {
        const pool = getBinPoolWithCache({
          chainId,
          poolId,
          currencyA,
          currencyB,
          rawPoolInfo: data,
        })
        return [PoolState.EXISTS, pool as TPool]
      }
    } catch (error) {
      console.error('Error constructing Infinity pool:', error)
      return [PoolState.INVALID, null]
    }

    return [PoolState.NOT_EXISTS, null]
  }, [chainId, currencyA, currencyB, data, poolId])
}
