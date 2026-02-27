import { type Pool, type Route, type Trade, toSerializableTrade } from '@pancakeswap/routing-sdk'
import {
  createInfinityBinPool,
  createInfinityCLPool,
  createInfinityStablePool,
  isInfinityBinPool,
  isInfinityCLPool,
  isInfinityStablePool,
  toSerializableInfinityBinPool,
  toSerializableInfinityCLPool,
  toSerializableInfinityStablePool,
} from '@pancakeswap/routing-sdk-addon-infinity'
import { createStablePool, isStablePool, toSerializableStablePool } from '@pancakeswap/routing-sdk-addon-stable-swap'
import { createV2Pool, isV2Pool, toSerializableV2Pool } from '@pancakeswap/routing-sdk-addon-v2'
import { createV3Pool, isV3Pool, toSerializableV3Pool } from '@pancakeswap/routing-sdk-addon-v3'
import {
  type InfinityRouter,
  getRouteTypeByPools,
  PoolType,
  SmartRouter,
  Pool as SmartRouterPool,
} from '@pancakeswap/smart-router'
import type { TradeType } from '@pancakeswap/swap-sdk-core'

export function toRoutingSDKPool(p: SmartRouterPool): Pool {
  if (SmartRouter.isV3Pool(p)) {
    return createV3Pool(p)
  }
  if (SmartRouter.isV2Pool(p)) {
    return createV2Pool(p)
  }
  if (SmartRouter.isStablePool(p)) {
    return createStablePool(p)
  }
  if (SmartRouter.isInfinityClPool(p)) {
    return createInfinityCLPool(p)
  }
  if (SmartRouter.isInfinityBinPool(p)) {
    return createInfinityBinPool(p)
  }

  if (SmartRouter.isInfinityStablePool(p)) {
    return createInfinityStablePool(p)
  }

  throw new Error(`Unsupported pool type: ${p}`)
}

export function toSmartRouterPool(p: any): SmartRouterPool {
  if (isV3Pool(p)) {
    return {
      ...p.getPoolData(),
      type: PoolType.V3,
    }
  }
  if (isV2Pool(p)) {
    return {
      ...p.getPoolData(),
      type: PoolType.V2,
    }
  }
  if (isStablePool(p)) {
    return {
      ...p.getPoolData(),
      type: PoolType.STABLE,
    }
  }
  if (isInfinityCLPool(p)) {
    return {
      ...p.getPoolData(),
      type: PoolType.InfinityCL,
    }
  }
  if (isInfinityBinPool(p)) {
    return {
      ...p.getPoolData(),
      type: PoolType.InfinityBIN,
    }
  }

  if (isInfinityStablePool(p)) {
    return {
      ...p.getPoolData(),
      type: PoolType.InfinityStable,
    }
  }

  throw new Error('Unrecognized pool type')
}

export function toRoutingSDKTrade(
  infinityTrade: InfinityRouter.InfinityTradeWithoutGraph<TradeType>,
): Trade<TradeType> {
  return {
    ...infinityTrade,
    routes: infinityTrade.routes.map((r) => ({
      ...r,
      pools: r.pools.map(toRoutingSDKPool),
    })),
  }
}

export function toInfinityTrade(trade: Trade<TradeType>): InfinityRouter.InfinityTradeWithoutGraph<TradeType> {
  return {
    ...trade,
    routes: trade.routes.map(toInfinityRoute),
  }
}

export function toInfinityRoute(route: Route): InfinityRouter.InfinityRoute {
  const pools = route.pools.map(toSmartRouterPool)
  return {
    ...route,
    pools,
    type: getRouteTypeByPools(pools),
  }
}

export function toSerializableInfinityTrade(
  trade: Trade<TradeType>,
): InfinityRouter.Transformer.SerializedInfinityTrade {
  const serializableTrade = toSerializableTrade(trade, {
    toSerializablePool: (p) => {
      if (isV3Pool(p)) {
        return {
          ...toSerializableV3Pool(p),
          type: PoolType.V3,
        }
      }
      if (isV2Pool(p)) {
        return {
          ...toSerializableV2Pool(p),
          type: PoolType.V2,
        }
      }
      if (isStablePool(p)) {
        return {
          ...toSerializableStablePool(p),
          type: PoolType.STABLE,
        }
      }
      if (isInfinityCLPool(p)) {
        return {
          ...toSerializableInfinityCLPool(p),
          type: PoolType.InfinityCL,
        }
      }
      if (isInfinityBinPool(p)) {
        return {
          ...toSerializableInfinityBinPool(p),
          type: PoolType.InfinityBIN,
        }
      }

      if (isInfinityStablePool(p)) {
        return {
          ...toSerializableInfinityStablePool(p),
          type: PoolType.InfinityStable,
        }
      }

      throw new Error('[toSerializableInfinityTrade]: Unknown pool type')
    },
  })
  return {
    ...serializableTrade,
    routes: serializableTrade.routes.map((r) => ({
      ...r,
      type: getRouteTypeByPools(r.pools),
    })),
  }
}
