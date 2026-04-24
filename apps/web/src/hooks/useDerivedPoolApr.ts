import { Protocol } from '@pancakeswap/farms'
import { useMemo } from 'react'
import { usePoolApr } from 'state/farmsV4/hooks'
import type { PoolInfo, StablePoolInfo, V2PoolInfo } from 'state/farmsV4/state/type'

type DerivedAprResult = {
  lpApr: number
  cakeAprValue: number
  merklApr: number
  incentraApr: number
}

/**
 * Derived APR for a prospective V2 / StableSwap Add Liquidity deposit. Matches the header's
 * PoolGlobalAprButton by summing the pool-wide APRs from `usePoolApr` with the same `has24Apr`
 * flag (true for V2, false for Stable).
 */
export const useV2DerivedApr = (poolInfo: V2PoolInfo | StablePoolInfo | undefined | null): DerivedAprResult => {
  const key = poolInfo ? (`${poolInfo.chainId}:${poolInfo.lpAddress}` as const) : null
  const has24Apr = poolInfo?.protocol !== Protocol.STABLE
  const { lpApr, cakeApr, merklApr, incentraApr } = usePoolApr(key, (poolInfo ?? null) as PoolInfo | null, has24Apr)

  return useMemo(
    () => ({
      lpApr: parseFloat(lpApr ?? '0') || 0,
      cakeAprValue: parseFloat(cakeApr?.value ?? '0') || 0,
      merklApr: parseFloat(merklApr ?? '0') || 0,
      incentraApr: parseFloat(incentraApr ?? '0') || 0,
    }),
    [lpApr, cakeApr?.value, merklApr, incentraApr],
  )
}
