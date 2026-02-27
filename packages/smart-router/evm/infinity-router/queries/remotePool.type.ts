import type { Address } from 'viem/accounts'
import { SerializedBinReserves, SerializedTick } from '../../v3-router/utils/transformer'

export type RemotePoolBase = {
  id: Address
  chainId: number
  tvlUSD: string
  volumeUSD24h: string
  apr24h: string
  protocol: 'v2' | 'v3' | 'infinityBin' | 'infinityCl' | 'stable' | 'infinityStable'
  token0: RemoteToken
  token1: RemoteToken
  isDynamicFee?: boolean
  hookAddress?: Address | null
  feeTier: number
  lpAddress?: Address
}

export type RemoteCLProps = {
  liquidity: string
  feeTier: number
  sqrtPrice: string
  tick: number
  ticks?: SerializedTick[]
  tickSpacing: number
  protocolFee: number
}

export type RemoteBinProps = {
  binStep: number
  activeId: number
  reserveOfBin?: Record<number, SerializedBinReserves>
  protocolFee: number
  feeTier: number
}

export type RemoteV3Props = {
  feeTier: number
  liquidity: string
}

export type RemoteStableProps = {
  feeTier: number
}

export interface RemotePoolV2 extends RemotePoolBase {
  protocol: 'v2'
}

export interface RemotePoolStable extends RemotePoolBase, RemoteStableProps {
  protocol: 'stable'
}

export interface RemotePoolV3 extends RemotePoolBase, RemoteV3Props {
  protocol: 'v3'
}

export interface RemotePoolCL extends RemotePoolBase, RemoteCLProps {
  protocol: 'infinityCl'
}

export interface RemotePoolBIN extends RemotePoolBase, RemoteBinProps {
  protocol: 'infinityBin'
}

export interface RemotePoolInfinityStable extends RemotePoolBase {
  protocol: 'infinityStable'
}

export interface RemoteToken {
  id: Address
  decimals: number
  symbol: string
}

export type RemotePool =
  | RemotePoolV2
  | RemotePoolV3
  | RemotePoolCL
  | RemotePoolBIN
  | RemotePoolStable
  | RemotePoolInfinityStable
