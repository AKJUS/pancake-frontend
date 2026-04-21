import {
  decodeBinPoolParameters,
  decodeCLPoolParameters,
  DYNAMIC_FEE_FLAG,
  isDynamicFeeHook,
} from '@pancakeswap/infinity-sdk'
import { OrderType } from '@pancakeswap/price-api-sdk'
import type { ClassicOrder } from '@pancakeswap/price-api-sdk'
import { BIPS_BASE, PoolType, RouteType } from '@pancakeswap/smart-router'
import { Currency, CurrencyAmount, Percent, Token, TradeType } from '@pancakeswap/swap-sdk-core'

import type { AggregatorPool, AggregatorPoolType, AggregatorQuoteResponse } from './types'

const POOL_TYPE_MAP: Record<AggregatorPoolType, PoolType> = {
  v2: PoolType.V2,
  v3: PoolType.V3,
  infinityCl: PoolType.InfinityCL,
  infinityBin: PoolType.InfinityBIN,
  stableswap: PoolType.STABLE,
}

const ROUTE_TYPE_MAP: Record<AggregatorPoolType, RouteType> = {
  v2: RouteType.V2,
  v3: RouteType.V3,
  infinityCl: RouteType.InfinityCL,
  infinityBin: RouteType.InfinityBIN,
  stableswap: RouteType.STABLE,
}

function toPoolType(type: AggregatorPoolType): PoolType {
  return POOL_TYPE_MAP[type] ?? PoolType.V3
}

function toRouteType(pools: AggregatorPool[]): RouteType {
  if (pools.length === 0) return RouteType.V3
  if (pools.length === 1) return ROUTE_TYPE_MAP[pools[0].type] ?? RouteType.V3
  const types = new Set(pools.map((p) => p.type))
  return types.size === 1 ? ROUTE_TYPE_MAP[pools[0].type] ?? RouteType.V3 : RouteType.MIXED
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`

function safeDecodeCLTickSpacing(parameters: string | null | undefined): number | undefined {
  if (!parameters) return undefined
  try {
    return decodeCLPoolParameters(parameters as `0x${string}`).tickSpacing
  } catch {
    return undefined
  }
}

function safeDecodeBinStep(parameters: string | null | undefined): number | undefined {
  if (!parameters) return undefined
  try {
    return decodeBinPoolParameters(parameters as `0x${string}`).binStep
  } catch {
    return undefined
  }
}

// Returns the raw last-2-bytes bitmap (not the decoded flag object) because
// `encodeInfinityMixedRouteParams` re-decodes it downstream. The bitmap is
// part of the PoolKey hash — dropping it breaks on-chain pool lookup.
function safeDecodeHooksRegistrationBitmap(parameters: string | null | undefined): `0x${string}` | undefined {
  if (!parameters) return undefined
  return `0x${parameters.slice(-4)}` as `0x${string}`
}

function toPool(p: AggregatorPool, tokenA: Token, tokenB: Token, chainId: number) {
  const poolType = toPoolType(p.type)
  const address = p.address as `0x${string}`
  let fee = p.fee ?? 0
  const displayFee = p.resolvedFee ?? p.protocolFee ?? p.fee

  if (p.token0 === undefined || p.token1 === undefined) {
    throw new Error(`Aggregator pool ${address} missing required token0/token1`)
  }

  const [token0, token1] =
    tokenA.address.toLowerCase() === p.token0?.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA]

  if (poolType === PoolType.V2) {
    return {
      address,
      type: poolType as PoolType.V2,
      fee,
      ...(displayFee !== undefined ? { displayFee } : {}),
      token0,
      token1,
      reserve0: CurrencyAmount.fromRawAmount(token0, 0),
      reserve1: CurrencyAmount.fromRawAmount(token1, 0),
    }
  }

  if (poolType === PoolType.STABLE) {
    // Aggregator returns stable fee in basis points (e.g. 25 = 0.25%).
    return {
      address,
      type: poolType as PoolType.STABLE,
      fee: new Percent(fee, BIPS_BASE),
      ...(displayFee !== undefined ? { displayFee } : {}),
      token0,
      token1,
      balances: [CurrencyAmount.fromRawAmount(token0, 0), CurrencyAmount.fromRawAmount(token1, 0)],
      amplifier: 0n,
    }
  }

  if (poolType === PoolType.InfinityCL || poolType === PoolType.InfinityBIN) {
    const hooks = (p.hooks as `0x${string}` | null | undefined) ?? ZERO_ADDR
    // Fail fast: a missing poolManager would otherwise surface downstream as
    // an opaque `UnexpectedRevertBytes` from the on-chain mixed quoter.
    if (typeof p.poolManager !== 'string' || p.poolManager.length === 0) {
      throw new Error(`Aggregator pool ${address} missing required poolManager`)
    }
    const poolManager = p.poolManager as `0x${string}`

    if (isDynamicFeeHook(chainId as any, hooks)) {
      fee = DYNAMIC_FEE_FLAG as any
    }

    const base = {
      id: address,
      address,
      type: poolType,
      // Keep the raw LP fee on the pool for execution/pool-key purposes.
      fee,
      ...(displayFee !== undefined ? { displayFee } : {}),
      token0,
      token1,
      currency0: token0,
      currency1: token1,
      hooks,
      poolManager,
    }
    const hooksRegistrationBitmap = safeDecodeHooksRegistrationBitmap(p.parameters)
    const withHooksBitmap = hooksRegistrationBitmap !== undefined ? { ...base, hooksRegistrationBitmap } : base

    if (poolType === PoolType.InfinityBIN) {
      const binStep = safeDecodeBinStep(p.parameters)
      return binStep !== undefined ? { ...withHooksBitmap, binStep } : withHooksBitmap
    }
    // tickSpacing is required — createInfinityCLPool falls back to
    // TICK_SPACINGS[fee] which has no entry for non-standard fees.
    const tickSpacing = safeDecodeCLTickSpacing(p.parameters)
    return tickSpacing !== undefined ? { ...withHooksBitmap, tickSpacing } : withHooksBitmap
  }

  return {
    address,
    type: poolType,
    fee,
    ...(displayFee !== undefined ? { displayFee } : {}),
    token0,
    token1,
  }
}

export function deserializeAggregatorResponse(
  json: AggregatorQuoteResponse,
  chainId: number,
  tradeType: TradeType,
  inputCurrency?: Currency,
  outputCurrency?: Currency,
): ClassicOrder | undefined {
  if (!json.data?.routes?.length) return undefined

  const { data } = json

  for (const route of data.routes) {
    if (route.path.length < 2 || route.pools.length !== route.path.length - 1) {
      return undefined
    }
  }

  const firstRoute = data.routes[0]
  const firstPath = firstRoute.path[0]
  const lastPath = firstRoute.path[firstRoute.path.length - 1]

  const inputToken =
    inputCurrency ?? new Token(chainId, firstPath.address as `0x${string}`, firstPath.decimals, firstPath.symbol)
  const outputToken =
    outputCurrency ?? new Token(chainId, lastPath.address as `0x${string}`, lastPath.decimals, lastPath.symbol)

  const inputAmount = CurrencyAmount.fromRawAmount(inputToken, data.inputAmount)
  const outputAmount = CurrencyAmount.fromRawAmount(outputToken, data.outputAmount)

  const routes = data.routes.map((route) => {
    const routeTokens = route.path.map((t) => new Token(chainId, t.address as `0x${string}`, t.decimals, t.symbol))
    const baseToken = routeTokens[0]
    const quoteToken = routeTokens[routeTokens.length - 1]
    const routeInputAmount = CurrencyAmount.fromRawAmount(baseToken, route.inputAmount)
    const routeOutputAmount = CurrencyAmount.fromRawAmount(quoteToken, route.outputAmount)

    // gasUseEstimateBase/Quote are required by getVerifiedTrade's
    // reviseGasUseEstimate — omitting them throws when gasUseEstimate is 0n.
    return {
      type: toRouteType(route.pools),
      pools: route.pools.map((p, i) => toPool(p, routeTokens[i], routeTokens[i + 1], chainId)),
      path: routeTokens,
      percent: route.percent,
      inputAmount: routeInputAmount,
      outputAmount: routeOutputAmount,
      gasUseEstimate: 0n,
      gasUseEstimateBase: CurrencyAmount.fromRawAmount(baseToken, 0),
      gasUseEstimateQuote: CurrencyAmount.fromRawAmount(quoteToken, 0),
      inputAmountWithGasAdjusted: routeInputAmount,
      outputAmountWithGasAdjusted: routeOutputAmount,
    }
  })

  const gasUseEstimate = BigInt(data.gasUseEstimate ?? '0')

  const trade = {
    tradeType,
    inputAmount,
    outputAmount,
    routes,
    gasUseEstimate,
    gasUseEstimateBase: CurrencyAmount.fromRawAmount(inputToken, 0),
    gasUseEstimateQuote: CurrencyAmount.fromRawAmount(outputToken, 0),
    inputAmountWithGasAdjusted: inputAmount,
    outputAmountWithGasAdjusted: outputAmount,
    priceImpactBps: data.priceImpactBps,
  }

  return {
    type: OrderType.PCS_CLASSIC as const,
    // Pools carry no on-chain state (liquidity, sqrtRatio, ticks) — execution
    // goes through the Calldata API, not the FE's route calc.
    trade: trade as unknown as ClassicOrder['trade'],
  }
}
