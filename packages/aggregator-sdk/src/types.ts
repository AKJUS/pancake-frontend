import type { TradeType } from '@pancakeswap/swap-sdk-core'

export interface AggregatorQuoteParams {
  chainId: number
  tokenIn: string
  tokenOut: string
  amount: string
  tradeType: TradeType
  protocol?: string
  provider?: string
}

export interface AggregatorTokenInfo {
  address: string
  decimals: number
  symbol: string
}

export type AggregatorPoolType = 'v2' | 'v3' | 'infinityCl' | 'infinityBin' | 'stableswap'

export interface AggregatorPool {
  address: string
  type: AggregatorPoolType
  // LP fee for infinity pools (goes into PoolKey.fee verbatim).
  fee?: number
  // Resolved fee metadata for the quoted route hop.
  // `resolvedFee` is the current `/v2/quote` field; `protocolFee` is kept as a fallback
  // for older responses until the BE rollout is fully complete.
  resolvedFee?: number
  // Packed uint24: lower 12 bits = token0 fee, upper 12 bits = token1 fee.
  protocolFee?: number
  // Required for infinity pools; deserializer throws if missing.
  poolManager?: string
  provider?: string
  hooks?: string | null
  // bytes32: tickSpacing (CL) or binStep (Bin) + hooksRegistrationBitmap.
  parameters?: string | null
  // BE-provided address-sorted pair (matches PoolKey on-chain).
  token0?: string
  token1?: string
}

export interface AggregatorRoute {
  percent: number
  inputAmount: string
  outputAmount: string
  priceImpactBps?: number
  path: AggregatorTokenInfo[]
  pools: AggregatorPool[]
}

export interface AggregatorQuoteData {
  srcToken: string
  dstToken: string
  tradeType: string
  inputAmount: string
  outputAmount: string
  gasUseEstimate: string
  gasUseEstimateUsd?: string
  priceImpactBps?: number
  routes: AggregatorRoute[]
  aggregatorAddress?: string // router contract to approve and send tx to; provided by BE
}

export interface AggregatorQuoteResponse {
  code: number
  msg: string
  data: AggregatorQuoteData
}

export interface AggregatorCalldataParams {
  chainId: number
  quoteData: AggregatorQuoteData
  recipient: string
  slippageBps: number
  deadline?: number
}

export interface AggregatorCalldataData {
  to: string
  value: string
  calldata: string
  gasUseEstimate: string
}

export interface AggregatorCalldataResponse {
  code: number
  msg: string
  data: AggregatorCalldataData
}

export interface AggregatorQuoteResult {
  order: import('@pancakeswap/price-api-sdk').ClassicOrder
  quoteData: AggregatorQuoteData
}
