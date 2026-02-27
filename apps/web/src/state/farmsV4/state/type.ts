import { Protocol } from '@pancakeswap/farms'
import { HookData } from '@pancakeswap/infinity-sdk'
import { Currency, UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import { Address } from 'viem'
import { SolanaV3Pool } from 'state/pools/solana'
import { PublicKey } from '@solana/web3.js'
import { FarmInfo } from '../search/farm.util'

type Prettify<T> = {
  [K in keyof T]: T[K]
} & object

export type PoolInfo = Prettify<V2PoolInfo | StablePoolInfo | V3PoolInfo | InfinityPoolInfo>

export type UnifiedPoolInfo = Prettify<V2PoolInfo | StablePoolInfo | V3PoolInfo | InfinityPoolInfo | SolanaV3PoolInfo>

export type BasePoolInfo = {
  pid?: number
  chainId: number
  lpAddress?: Address
  stableSwapAddress?: string
  protocol: Protocol
  token0: UnifiedCurrency
  token1: UnifiedCurrency
  token0Price?: `${number}`
  token1Price?: `${number}`
  tvlToken0?: `${number}`
  tvlToken1?: `${number}`
  lpApr?: `${number}`
  tvlUsd?: `${number}`
  tvlUsd24h?: `${number}`
  vol24hUsd?: `${number}`
  vol48hUsd?: `${number}`
  vol7dUsd?: `${number}`
  fee24hUsd?: `${number}`
  lpFee24hUsd?: `${number}`
  liquidity?: bigint
  feeTier: number
  feeTierBase: number
  totalFeeUSD?: `${number}`
  isFarming: boolean
  isActiveFarm?: boolean
  isDynamicFee?: boolean
  farm?: FarmInfo
  poolId?: Address
}

export type SolanaV3PoolInfo = Omit<BasePoolInfo, 'lpAddress' | 'poolId'> & {
  protocol: Protocol.V3
  lpAddress: string
  nftMint: PublicKey
  rawPool: SolanaV3Pool
  poolId: string
}

export type V3PoolInfo = BasePoolInfo & {
  protocol: Protocol.V3
  lpAddress: Address
  token0: Currency
  token1: Currency
}

export type V2PoolInfo = BasePoolInfo & {
  protocol: Protocol.V2
  // V2 farming pools should have a bCakeWrapperAddress
  bCakeWrapperAddress?: Address
  token0: Currency
  token1: Currency
}

export type StablePoolInfo = BasePoolInfo & {
  protocol: Protocol.STABLE
  // Stable farming pools should have a bCakeWrapperAddress
  bCakeWrapperAddress?: Address
  token0: Currency
  token1: Currency
}

export type InfinityPoolInfo = InfinityBinPoolInfo | InfinityCLPoolInfo | InfinityStablePoolInfo

type InfinityAdditionalPoolInfo = {
  /** @deprecated use poolId instead */
  lpAddress: string
  poolId: Address
  hookData?: HookData
  hookAddress?: Address
  dynamic?: boolean
  token0: Currency
  token1: Currency
}

export type InfinityBinPoolInfo = Prettify<
  BasePoolInfo &
    InfinityAdditionalPoolInfo & {
      protocol: Protocol.InfinityBIN
      feeAmount?: number
    }
>

export type InfinityCLPoolInfo = Prettify<
  BasePoolInfo &
    InfinityAdditionalPoolInfo & {
      protocol: Protocol.InfinityCLAMM
    }
>

export type ChainIdAddressKey = `${number}:${string}`

export type InfinityStablePoolInfo = Prettify<
  BasePoolInfo &
    InfinityAdditionalPoolInfo & {
      protocol: Protocol.InfinitySTABLE
    }
>
