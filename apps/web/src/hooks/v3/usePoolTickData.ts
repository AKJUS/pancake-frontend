import { Protocol } from '@pancakeswap/farms'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { FeeAmount, Pool, TICK_SPACINGS, tickToPrice } from '@pancakeswap/v3-sdk'
import useAllTicksQuery, { TickData } from 'hooks/useAllTicksQuery'
import { useMemo } from 'react'

import { getActiveTick } from 'utils/getActiveTick'
import { isAddressEqual } from 'utils'
import { PoolState, TickProcessed } from './types'
import { usePool } from './usePools'
import computeSurroundingTicks from './utils/computeSurroundingTicks'

const PRICE_FIXED_DIGITS = 8

function useTicksFromSubgraph(
  currencyA: Currency | undefined | null,
  currencyB: Currency | undefined | null,
  feeAmount: FeeAmount | undefined,
  activeTick: number | undefined,
  enabled = true,
) {
  const poolChainId = currencyA?.wrapped.chainId

  const poolAddress = useMemo(
    () =>
      currencyA && currencyB && feeAmount
        ? Pool.getAddress(currencyA.wrapped, currencyB.wrapped, feeAmount)
        : undefined,
    [currencyA, currencyB, feeAmount],
  )

  return useAllTicksQuery({
    chainId: poolChainId,
    poolAddress,
    interval: 30000,
    enabled,
    protocol: Protocol.V3,
    activeTick,
  })
}

// Fetches all ticks for a given pool
export function useAllV3Ticks({
  currencyA,
  currencyB,
  feeAmount,
  activeTick,
  enabled = true,
}: {
  currencyA?: Currency | null
  currencyB?: Currency | null
  feeAmount?: FeeAmount
  activeTick?: number
  enabled?: boolean
}): {
  isLoading: boolean
  error: unknown
  ticks: TickData[] | undefined
} {
  const subgraphTickData = useTicksFromSubgraph(currencyA, currencyB, feeAmount, activeTick, enabled)

  return {
    isLoading: subgraphTickData.isLoading,
    error: subgraphTickData.error,
    ticks: subgraphTickData.data,
  }
}

export function usePoolActiveLiquidity(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  feeAmount: FeeAmount | undefined,
): {
  isLoading: boolean
  error: any
  activeTick: number | undefined
  data: TickProcessed[] | undefined
} {
  const [poolState, pool] = usePool(currencyA, currencyB, feeAmount)
  // Find nearest valid tick for pool in case tick is not initialized.
  const activeTick = useMemo(
    () => (feeAmount ? getActiveTick(pool?.tickCurrent, TICK_SPACINGS[feeAmount]) : undefined),
    [pool, feeAmount],
  )
  const { isLoading, error, ticks } = useAllV3Ticks({ currencyA, currencyB, feeAmount, activeTick })
  const { data } = useActiveLiquidityByPool({
    currencyA,
    currencyB,
    ticks,
    pool: {
      tickSpacing: feeAmount ? TICK_SPACINGS[feeAmount] : undefined,
      tickCurrent: pool?.tickCurrent,
      liquidity: pool?.liquidity,
    },
  })

  return useMemo(() => {
    if (
      !currencyA ||
      !currencyB ||
      activeTick === undefined ||
      poolState !== PoolState.EXISTS ||
      !ticks ||
      ticks.length === 0 ||
      isLoading
    ) {
      return {
        isLoading: isLoading || poolState === PoolState.LOADING,
        error,
        activeTick,
        data: undefined,
      }
    }
    return {
      isLoading,
      error,
      activeTick,
      data,
    }
  }, [activeTick, currencyA, currencyB, data, error, isLoading, poolState, ticks])
}

export function useActiveLiquidityByPool({
  currencyA,
  currencyB,
  ticks,
  pool: { tickSpacing, tickCurrent, liquidity },
}: {
  currencyA: Currency | undefined
  currencyB: Currency | undefined
  ticks: TickData[] | undefined
  pool: {
    tickSpacing: number | undefined
    tickCurrent: number | undefined
    liquidity: bigint | undefined
  }
}): {
  data: TickProcessed[] | undefined
  activeTick: number | undefined
} {
  const activeTick = useMemo(() => getActiveTick(tickCurrent, tickSpacing), [tickCurrent, tickSpacing])
  return useMemo(() => {
    if (!currencyA || !currencyB || !ticks || activeTick === undefined) {
      return {
        data: undefined,
        activeTick,
      }
    }

    const token0 = currencyA?.wrapped
    const token1 = currencyB?.wrapped

    if (!token0 || !token1 || isAddressEqual(token0.address, token1.address)) {
      return {
        data: undefined,
        activeTick,
      }
    }

    // find where the active tick would be to partition the array
    // if the active tick is initialized, the pivot will be an element
    // if not, take the previous tick as pivot
    const pivot = ticks.findIndex(({ tick }) => Number(tick) > activeTick) - 1

    if (pivot < 0) {
      // consider setting a local error
      console.error('TickData pivot not found')
      return {
        data: undefined,
        activeTick,
      }
    }

    const activeTickProcessed: TickProcessed = {
      liquidityActive: BigInt(liquidity ?? 0),
      tick: activeTick,
      liquidityNet: Number(ticks[pivot].tick) === activeTick ? BigInt(ticks[pivot].liquidityNet) : 0n,
      price0: tickToPrice(token0, token1, activeTick).toFixed(PRICE_FIXED_DIGITS),
    }

    const subsequentTicks = computeSurroundingTicks(token0, token1, activeTickProcessed, ticks, pivot, true)

    const previousTicks = computeSurroundingTicks(token0, token1, activeTickProcessed, ticks, pivot, false)

    const ticksProcessed = previousTicks.concat(activeTickProcessed).concat(subsequentTicks)

    return {
      data: ticksProcessed,
      activeTick,
    }
  }, [currencyA, currencyB, activeTick, liquidity, ticks])
}
