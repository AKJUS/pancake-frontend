import type { Protocol } from '@pancakeswap/farms'
import type { PoolKey } from '@pancakeswap/infinity-sdk'
import type { ERC20Token, Pair } from '@pancakeswap/sdk'
import type { LegacyStableSwapPair } from '@pancakeswap/smart-router/legacy-router'
import { PositionInfoLayout } from '@pancakeswap/solana-core-sdk'
import type { CurrencyAmount, UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import type { Address, Hex } from 'viem'

export enum POSITION_STATUS {
  ALL,
  ACTIVE,
  INACTIVE,
  CLOSED,
}

export type LiquidityOfCLPosition = {
  tokenId: number
  liquidity: bigint
  lowerTick: number
  upperTick: number
}

export type InfinityCLPositionDetail = Omit<PositionDetail, 'protocol'> & {
  status: POSITION_STATUS
  poolKey: PoolKey
  poolId: Hex
  tickSpacing: number
  dynamic: boolean
  protocol: Protocol.InfinityCLAMM
}

export type ReserveOfBin = {
  binId: number
  reserveX: bigint
  reserveY: bigint
  userSharesOfBin: bigint
  nextBinId?: number | null
  binLiquidity: bigint
  totalShares: bigint
}

export type InfinityBinPositionDetail = {
  status: POSITION_STATUS
  chainId: number
  protocol: Protocol.InfinityBIN
  poolKey?: PoolKey<'Bin'>
  isStaked?: boolean

  poolId: Hex
  activeId: number
  reserveX: bigint
  reserveY: bigint
  maxBinId: number | null
  minBinId: number | null
  reserveOfBins: ReserveOfBin[]
  liquidity: bigint
  activeLiquidity: bigint
  poolLiquidity?: bigint
  poolActiveLiquidity?: bigint
}

export type SolanaV3PositionDetail = ReturnType<typeof PositionInfoLayout.decode> & {
  token0: UnifiedCurrency | undefined
  token1: UnifiedCurrency | undefined
  status: POSITION_STATUS
  protocol: Protocol.V3
  chainId: number
}

export type PositionDetail = {
  // detail read from contract
  nonce: bigint
  tokenId: bigint
  operator: string
  token0: Address
  token1: Address
  fee: number
  tickLower: number
  tickUpper: number
  liquidity: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint

  // additional detail
  isStaked?: boolean
  chainId: number
  protocol: Protocol.V3

  farmingMultiplier: number
  farmingLiquidity: bigint
}

export type UnifiedPositionDetail =
  | PositionDetail
  | InfinityBinPositionDetail
  | InfinityCLPositionDetail
  | V2LPDetail
  | StableLPDetail
  | SolanaV3PositionDetail

export type V2LPDetail = {
  nativeBalance: CurrencyAmount<ERC20Token>
  farmingBalance: CurrencyAmount<ERC20Token>
  pair: Pair
  totalSupply: CurrencyAmount<ERC20Token>
  nativeDeposited0: CurrencyAmount<ERC20Token>
  nativeDeposited1: CurrencyAmount<ERC20Token>
  farmingDeposited0: CurrencyAmount<ERC20Token>
  farmingDeposited1: CurrencyAmount<ERC20Token>
  farmingBoosterMultiplier: number
  farmingBoostedAmount: CurrencyAmount<ERC20Token>
  isStaked?: boolean
  protocol: Protocol.V2
}

export type StableLPDetail = {
  nativeBalance: CurrencyAmount<ERC20Token>
  farmingBalance: CurrencyAmount<ERC20Token>
  totalSupply: CurrencyAmount<ERC20Token>
  pair: LegacyStableSwapPair
  // fee: pair.stableTotalFee * 1000000
  // lpFee: pair.stableLpFee * 1000000
  nativeDeposited0: CurrencyAmount<ERC20Token>
  farmingDeposited0: CurrencyAmount<ERC20Token>
  nativeDeposited1: CurrencyAmount<ERC20Token>
  farmingDeposited1: CurrencyAmount<ERC20Token>
  farmingBoosterMultiplier: number
  farmingBoostedAmount: CurrencyAmount<ERC20Token>
  isStaked?: boolean
  protocol: Protocol.STABLE | Protocol.InfinitySTABLE
}

export type PairListType = PositionDetail | V2LPDetail | StableLPDetail
export type PoolKeyType = readonly [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, number, `0x${string}`]
export type Slot0Type = readonly [bigint, number, number, number]
