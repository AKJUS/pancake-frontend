import { BinPool, Pool as CLPool, getCurrencyPriceFromId } from '@pancakeswap/infinity-sdk'
import { Price } from '@pancakeswap/swap-sdk-core'
import { useMemo } from 'react'

export const usePoolCurrentPrice = (pool: BinPool | CLPool | undefined | null) => {
  return useMemo(() => {
    if (!pool) return undefined
    try {
      if (pool.poolType === 'CL') {
        return new Price(pool.token0, pool.token1, 2n ** 192n, pool.sqrtRatioX96 * pool.sqrtRatioX96)
      }
      if (pool.poolType === 'Bin') {
        const pool_ = pool as BinPool
        return getCurrencyPriceFromId(pool_.activeId, pool_.binStep, pool_.token0, pool_.token1)
      }
    } catch (error) {
      console.error('Error computing pool current price:', error)
    }
    return undefined
  }, [pool])
}
