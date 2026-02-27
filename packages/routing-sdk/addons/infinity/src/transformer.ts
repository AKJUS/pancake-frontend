import { ChainId } from '@pancakeswap/chains'
import {
  parseCurrency,
  parseCurrencyAmount,
  toSerializableCurrency,
  toSerializableCurrencyAmount,
} from '@pancakeswap/routing-sdk'
import { Tick } from '@pancakeswap/v3-sdk'

import { createInfinityBinPool } from './createInfinityBinPool'
import { createInfinityCLPool } from './createInfinityCLPool'
import { createInfinityStablePool } from './createInfinityStablePool'
import {
  BinReserves,
  InfinityBinPool,
  InfinityBinPoolData,
  InfinityCLPool,
  InfinityCLPoolData,
  InfinityStablePool,
  InfinityStablePoolData,
  SerializableBinReserves,
  SerializableInfinityBinPool,
  SerializableInfinityCLPool,
  SerializableInfinityStablePool,
  SerializableTick,
} from './types'

export function toSerializableBinPoolReserveOfBin(
  reserveOfBin?: Record<number, BinReserves>,
): Record<string, SerializableBinReserves> | undefined {
  if (!reserveOfBin) return undefined
  const bins = Object.keys(reserveOfBin)
  const serialized: Record<string, SerializableBinReserves> = {}
  for (const bin of bins) {
    const reserves = reserveOfBin[Number(bin)]
    serialized[bin] = {
      reserveX: String(reserves.reserveX),
      reserveY: String(reserves.reserveY),
    }
  }
  return serialized
}

export function toSerializableTick(tick: Tick): SerializableTick {
  return {
    index: tick.index,
    liquidityNet: String(tick.liquidityNet),
    liquidityGross: String(tick.liquidityGross),
  }
}

export function toSerializableInfinityCLPool(infinityCLPool: InfinityCLPool): SerializableInfinityCLPool {
  const pool = infinityCLPool.getPoolData()
  return {
    ...pool,
    currency0: toSerializableCurrency(pool.currency0),
    currency1: toSerializableCurrency(pool.currency1),
    liquidity: pool.liquidity.toString(),
    sqrtRatioX96: pool.sqrtRatioX96.toString(),
    ticks: pool.ticks?.map(toSerializableTick),
    reserve0: pool.reserve0 && toSerializableCurrencyAmount(pool.reserve0),
    reserve1: pool.reserve1 && toSerializableCurrencyAmount(pool.reserve1),
  }
}

export function toSerializableInfinityStablePool(
  infinityStablePool: InfinityStablePool,
): SerializableInfinityStablePool {
  const pool = infinityStablePool.getPoolData()
  return {
    ...pool,
    id: pool.id,
    currency0: toSerializableCurrency(pool.currency0),
    currency1: toSerializableCurrency(pool.currency1),
    reserve0: pool.reserve0 && toSerializableCurrencyAmount(pool.reserve0),
    reserve1: pool.reserve1 && toSerializableCurrencyAmount(pool.reserve1),
  }
}

export function toSerializableInfinityBinPool(infinityBinPool: InfinityBinPool): SerializableInfinityBinPool {
  const pool = infinityBinPool.getPoolData()
  return {
    ...pool,
    currency0: toSerializableCurrency(pool.currency0),
    currency1: toSerializableCurrency(pool.currency1),
    reserveOfBin: toSerializableBinPoolReserveOfBin(pool.reserveOfBin),
    reserve0: pool.reserve0 && toSerializableCurrencyAmount(pool.reserve0),
    reserve1: pool.reserve1 && toSerializableCurrencyAmount(pool.reserve1),
  }
}

export function parseTick(tick: SerializableTick): Tick {
  return new Tick(tick)
}

export function parseInfinityCLPool(chainId: ChainId, pool: SerializableInfinityCLPool): InfinityCLPool {
  const poolData: InfinityCLPoolData = {
    ...pool,
    currency0: parseCurrency(chainId, pool.currency0),
    currency1: parseCurrency(chainId, pool.currency1),
    liquidity: BigInt(pool.liquidity),
    sqrtRatioX96: BigInt(pool.sqrtRatioX96),
    ticks: pool.ticks?.map(parseTick),
    reserve0: pool.reserve0 && parseCurrencyAmount(chainId, pool.reserve0),
    reserve1: pool.reserve1 && parseCurrencyAmount(chainId, pool.reserve1),
  }

  return createInfinityCLPool(poolData)
}

export function parseInfinityBinPoolReserveOfBins(
  reserveOfBin?: Record<string, SerializableBinReserves>,
): Record<number, BinReserves> | undefined {
  if (!reserveOfBin) return undefined
  const bins = Object.keys(reserveOfBin)
  const parsed: Record<number, BinReserves> = {}
  for (const bin of bins) {
    const reserves = reserveOfBin[bin]
    parsed[Number(bin)] = {
      reserveX: BigInt(reserves.reserveX),
      reserveY: BigInt(reserves.reserveY),
    }
  }
  return parsed
}

export function parseInfinityBinPool(chainId: ChainId, pool: SerializableInfinityBinPool): InfinityBinPool {
  const poolData: InfinityBinPoolData = {
    ...pool,
    currency0: parseCurrency(chainId, pool.currency0),
    currency1: parseCurrency(chainId, pool.currency1),
    reserveOfBin: parseInfinityBinPoolReserveOfBins(pool.reserveOfBin),
    reserve0: pool.reserve0 && parseCurrencyAmount(chainId, pool.reserve0),
    reserve1: pool.reserve1 && parseCurrencyAmount(chainId, pool.reserve1),
  }

  return createInfinityBinPool(poolData)
}

export function parseInfinityStablePool(chainId: ChainId, pool: SerializableInfinityStablePool): InfinityStablePool {
  const poolData: InfinityStablePoolData = {
    ...pool,
    currency0: parseCurrency(chainId, pool.currency0),
    currency1: parseCurrency(chainId, pool.currency1),
    reserve0: pool.reserve0 && parseCurrencyAmount(chainId, pool.reserve0),
    reserve1: pool.reserve1 && parseCurrencyAmount(chainId, pool.reserve1),
  }

  return createInfinityStablePool(poolData)
}
