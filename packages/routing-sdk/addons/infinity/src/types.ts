import type { Pool, SerializableCurrency, SerializableCurrencyAmount } from '@pancakeswap/routing-sdk'
import type { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import type { Tick } from '@pancakeswap/v3-sdk'

import { INFI_BIN_POOL_TYPE, INFI_CL_POOL_TYPE, INFI_STABLE_POOL_TYPE } from './constants/poolType'

export type Address = `0x${string}`

export type InfinityCLPoolType = typeof INFI_CL_POOL_TYPE
export type InfinityBinPoolType = typeof INFI_BIN_POOL_TYPE
export type InfinityStablePoolType = typeof INFI_STABLE_POOL_TYPE
export type InfinityPoolType = InfinityCLPoolType | InfinityBinPoolType

export type InfinityPoolDataBase = {
  hooks?: Address
  hooksRegistrationBitmap?: Address | number
  poolManager: Address
}

export type InfinityStablePoolData = InfinityPoolDataBase & {
  id: `0x${string}`
  currency0: Currency
  currency1: Currency
  fee: number
  tickSpacing: number
  reserve0?: CurrencyAmount<Currency>
  reserve1?: CurrencyAmount<Currency>
  amplifier: number
  stableFee: number
}

export type InfinityCLPoolData = InfinityPoolDataBase & {
  currency0: Currency
  currency1: Currency
  // Different fee tier
  fee: number
  protocolFee?: number
  tickSpacing: number
  liquidity: bigint
  sqrtRatioX96: bigint
  tick: number
  id: `0x${string}`

  // Allow pool with no ticks data provided
  ticks?: Tick[]

  reserve0?: CurrencyAmount<Currency>
  reserve1?: CurrencyAmount<Currency>
}

export type BinReserves = {
  reserveX: bigint
  reserveY: bigint
}

export type InfinityBinPoolData = InfinityPoolDataBase & {
  currency0: Currency
  currency1: Currency
  // Different fee tier
  fee: number
  protocolFee?: number
  activeId: number
  binStep: number
  id: `0x${string}`

  reserveOfBin?: Record<number, BinReserves>

  reserve0?: CurrencyAmount<Currency>
  reserve1?: CurrencyAmount<Currency>
}

export type InfinityCLPool = Pool<InfinityCLPoolType, InfinityCLPoolData>

export type InfinityBinPool = Pool<InfinityBinPoolType, InfinityBinPoolData>

export type InfinityStablePool = Pool<InfinityStablePoolType, InfinityStablePoolData>

export type SerializableInfinityStablePool = InfinityPoolDataBase & {
  id: `0x${string}`
  currency0: SerializableCurrency
  currency1: SerializableCurrency
  fee: number
  tickSpacing: number
  reserve0?: SerializableCurrencyAmount
  reserve1?: SerializableCurrencyAmount
  amplifier: number
  stableFee: number
}

export type SerializableInfinityCLPool = InfinityPoolDataBase & {
  currency0: SerializableCurrency
  currency1: SerializableCurrency
  fee: number
  protocolFee?: number
  tickSpacing: number
  liquidity: string
  sqrtRatioX96: string
  tick: number
  id: `0x${string}`

  ticks?: SerializableTick[]

  reserve0?: SerializableCurrencyAmount
  reserve1?: SerializableCurrencyAmount
}

export type SerializableTick = {
  index: number
  liquidityGross: string
  liquidityNet: string
}

export type SerializableBinReserves = {
  reserveX: string
  reserveY: string
}

export type SerializableInfinityBinPool = InfinityPoolDataBase & {
  currency0: SerializableCurrency
  currency1: SerializableCurrency

  fee: number
  protocolFee?: number
  activeId: number
  binStep: number
  id: `0x${string}`

  reserveOfBin?: Record<string, SerializableBinReserves>

  reserve0?: SerializableCurrencyAmount
  reserve1?: SerializableCurrencyAmount
}
