import { Currency, CurrencyAmount, Percent } from '@pancakeswap/sdk'
import { FeeAmount, Tick } from '@pancakeswap/v3-sdk'
import { Address, Hex } from 'viem'

export enum PoolType {
  V2,
  V3,
  STABLE,
  InfinityCL,
  InfinityBIN,
  InfinityStable,
  SVM,
}

export interface BasePool {
  type: PoolType
}

// NOTE: Should not put SVM pool in Smart Router evm
// but don't know how to put it so leave it here for now
export interface SVMPool extends BasePool {
  type: PoolType.SVM
  id: string
  fee?: number
  feeAmount?: string
  feeMintAddress?: string
}

export interface V2Pool extends BasePool {
  type: PoolType.V2
  reserve0: CurrencyAmount<Currency>
  reserve1: CurrencyAmount<Currency>
}

export interface StablePool extends BasePool {
  address: Address
  type: PoolType.STABLE
  // Could be 2 token pool or more
  balances: CurrencyAmount<Currency>[]
  amplifier: bigint
  // Swap fee
  fee: Percent
}

export interface V3Pool extends BasePool {
  type: PoolType.V3
  token0: Currency
  token1: Currency
  // Different fee tier
  fee: FeeAmount
  liquidity: bigint
  sqrtRatioX96: bigint
  tick: number
  address: Address
  token0ProtocolFee: Percent
  token1ProtocolFee: Percent

  // Allow pool with no ticks data provided
  ticks?: Tick[]

  reserve0?: CurrencyAmount<Currency>
  reserve1?: CurrencyAmount<Currency>
}
export type BaseInfinityPool = BasePool & {
  id: `0x${string}`
  currency0: Currency
  currency1: Currency
  fee: number
  protocolFee?: number
  hooks?: Address
  hooksRegistrationBitmap?: Hex | number
  poolManager: Address

  reserve0?: CurrencyAmount<Currency>
  reserve1?: CurrencyAmount<Currency>
}

export type InfinityClPool = BaseInfinityPool & {
  type: PoolType.InfinityCL
  tickSpacing: number
  liquidity: bigint
  sqrtRatioX96: bigint
  tick: number

  // Allow pool with no ticks data provided
  ticks?: Tick[]
}

export type InfinityStablePool = BaseInfinityPool & {
  type: PoolType.InfinityStable
  tickSpacing: number
  amplifier: number
  stableFee: number
}

type ActiveId = number
type Reserve = {
  reserveX: bigint
  reserveY: bigint
}

export type InfinityBinPool = BaseInfinityPool & {
  type: PoolType.InfinityBIN
  binStep: number
  activeId: ActiveId

  reserveOfBin?: Record<ActiveId, Reserve>
}

export type Pool = V2Pool | V3Pool | StablePool | InfinityBinPool | InfinityClPool | SVMPool | InfinityStablePool

export interface WithTvl {
  tvlUSD: bigint
}

export type V3PoolWithTvl = V3Pool & WithTvl

export type V2PoolWithTvl = V2Pool & WithTvl

export type StablePoolWithTvl = StablePool & WithTvl

export type InfinityPoolWithTvl = (InfinityClPool | InfinityBinPool) & WithTvl
