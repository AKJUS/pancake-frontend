import { ChainId, isEvm, NonEVMChainId } from '@pancakeswap/chains'
import { FarmV4SupportedChainId, Protocol } from '@pancakeswap/farms'
import { Currency, getCurrencyAddress, Native } from '@pancakeswap/sdk'
import { PoolType, SmartRouter } from '@pancakeswap/smart-router'
import { SORT_ORDER } from '@pancakeswap/uikit'
import latinise from '@pancakeswap/utils/latinise'
import { TokenInfo } from '@pancakeswap/token-lists'

import { FarmInfo } from 'state/farmsV4/search/farm.util'
import { PoolInfo } from 'state/farmsV4/state/type'
import { getCurrencySymbol } from 'utils/getTokenAlias'
import { isAddressKeyword } from './farmSearch.parser'

type SortableFarm = FarmInfo | PoolInfo

const isPoolInfo = (farm: SortableFarm): farm is PoolInfo => {
  return 'tvlUsd' in farm
}

const toFiniteNumber = (value: number | `${number}` | undefined | null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

type SortMetrics = {
  chainId: number
  apr: number
  tvl: number
  vol: number
}

const extractSortMetrics = (farm: SortableFarm): SortMetrics => {
  if (isPoolInfo(farm)) {
    const underlying = farm.farm
    const lpApr = Number(farm.lpApr ?? underlying?.lpApr ?? underlying?.apr24h ?? 0)
    const cakeApr = Number(underlying?.cakeApr?.value ?? 0)
    const totalApr = lpApr + cakeApr
    const aprSource = totalApr
    const tvlSource = farm.tvlUsd ?? underlying?.tvlUSD
    const volSource = farm.vol24hUsd ?? underlying?.vol24hUsd

    return {
      chainId: farm.chainId,
      apr: toFiniteNumber(aprSource ?? 0),
      tvl: toFiniteNumber(tvlSource ?? 0),
      vol: toFiniteNumber(volSource ?? 0),
    }
  }

  const aprSource = farm.lpApr ?? farm.apr24h

  return {
    chainId: farm.chainId,
    apr: toFiniteNumber(aprSource ?? 0),
    tvl: toFiniteNumber(farm.tvlUSD ?? 0),
    vol: toFiniteNumber(farm.vol24hUsd ?? 0),
  }
}

export const filterTokens = (tokensMap: Record<string, TokenInfo>) => {
  return (farm: FarmInfo) => {
    return isFarmWhitelisted(farm, tokensMap)
  }
}

function isTokenWhitelisted(token: Currency, tokensMap: Record<string, TokenInfo>) {
  if (token.chainId === NonEVMChainId.SOLANA) {
    return true
  }
  const key = `${token.chainId}:${getCurrencyAddress(token)}`.toLowerCase()
  return Boolean(token.isNative || tokensMap[key])
}

function isFarmWhitelisted(farm: FarmInfo, tokensMap: Record<string, TokenInfo>) {
  const [token0, token1] = SmartRouter.getCurrenciesOfPool(farm.pool)
  if (!token0 || !token1) return false
  return isTokenWhitelisted(token0, tokensMap) && isTokenWhitelisted(token1, tokensMap)
}

export const isInWhitelist = (tokensMap: Record<string, TokenInfo>) => {
  return (farm: FarmInfo) => {
    if (farm.chainId === NonEVMChainId.SOLANA) {
      return true
    }
    return isFarmWhitelisted(farm, tokensMap)
  }
}

export const getUnwhitelistedToken = (farm: FarmInfo, tokensMap: Record<string, TokenInfo>): Currency | null => {
  if (!farm) {
    return null
  }
  const [token0, token1] = SmartRouter.getCurrenciesOfPool(farm.pool)
  if (!token0 || !token1) return null
  if (!isTokenWhitelisted(token0, tokensMap)) return token0
  if (!isTokenWhitelisted(token1, tokensMap)) return token1
  return null
}

const chainFilter = (chains: FarmV4SupportedChainId[]) => {
  return (farm: FarmInfo): boolean => {
    if (!chains || chains.length === 0) return true
    const { chainId } = farm
    if (chains.indexOf(chainId) === -1) {
      return false
    }
    return true
  }
}

const protocolFilter = (protocols: Protocol[]) => {
  return (farm: FarmInfo): boolean => {
    if (!protocols || protocols.length === 0) return true
    if (protocols.indexOf(farm.protocol as Protocol) !== -1) {
      return true
    }
    return false
  }
}

function getAllPairs(A: string[], B: string[]): [string, string][] {
  const pairs: [string, string][] = []

  A.forEach((a) => {
    B.forEach((b) => {
      pairs.push([a, b], [b, a])
    })
  })

  return pairs
}

const search = (farms: FarmInfo[], searchValue: string): FarmInfo[] => {
  if (!searchValue) {
    return farms
  }
  const filter = searchFilter(searchValue)

  const filterResults = farms.map((x) => filter(x))
  const fullMatches = filterResults.filter((x) => x.full).map((x) => x.farm)
  if (fullMatches.length > 0) {
    return fullMatches
  }
  const partialMatch = filterResults.filter((x) => x.partial).map((x) => x.farm)
  return partialMatch
}

const searchFilter = (_search: string) => {
  return (
    farm: FarmInfo,
  ): {
    full: boolean
    partial: boolean
    farm: FarmInfo
  } => {
    if (!_search || _search.trim() === '')
      return {
        full: false,
        partial: false,
        farm,
      }
    const search = _search.toLowerCase().trim()

    const [token0, token1] = SmartRouter.getCurrenciesOfPool(farm.pool)

    if (isAddressKeyword(search)) {
      const list = [
        farm.id.toLowerCase(),
        getCurrencyAddress(token0).toLowerCase(),
        getCurrencyAddress(token1).toLowerCase(),
      ]
      return {
        full: list.some((item) => item.startsWith(search)),
        partial: false,
        farm,
      }
    }

    const { pool } = farm

    const symbol0List = tokenSearchTags(token0)
    const symbol1List = tokenSearchTags(token1)
    const pairs = getAllPairs(symbol0List, symbol1List)

    const clamm = pool.type === PoolType.InfinityCL ? 'clamm' : ''
    const lbamm = pool.type === PoolType.InfinityBIN ? 'lbamm' : ''
    const isInfinity =
      pool.type === PoolType.InfinityCL || pool.type === PoolType.InfinityBIN || pool.type === PoolType.InfinityStable
    const dynamic = (pool.type === PoolType.InfinityCL || pool.type === PoolType.InfinityBIN) && farm.isDynamicFee
    const infinity = isInfinity ? 'infinity' : ''
    const stable = pool.type === PoolType.STABLE || pool.type === PoolType.InfinityStable ? 'stable' : ''
    const v2 = pool.type === PoolType.V2 ? 'v2' : ''
    const v3 = pool.type === PoolType.V3 ? 'v3' : ''

    const tags = [
      ...symbol0List,
      ...symbol1List,
      ...pairs.map((x) => {
        return `${x[0]}/${x[1]}`
      }),
      clamm,
      lbamm,
      dynamic ? 'dynamic' : '',
      infinity,
      stable,
      v2,
      v3,
    ]
      .filter((x) => x)
      .map((x) => latinise(x))
      .map((x) => x.toLowerCase())
    const prts = search
      .split(/[\s,]/g)
      .filter((x) => x.trim())
      .filter((x) => x)

    const erveryMatched = prts.every((prt) => {
      return tags.some((tag) => tag.startsWith(prt))
    })
    const someMatched = prts.some((prt) => {
      return tags.some((tag) => tag.startsWith(prt))
    })
    return {
      full: erveryMatched,
      partial: someMatched,
      farm,
    }
  }
}

function tokenSearchTags(token: Currency) {
  const { chainId } = token
  const tags: string[] = []

  tags.push(getCurrencySymbol(token).toLowerCase())
  // If native token
  if (token.isNative && token.wrapped?.symbol) {
    tags.push(getCurrencySymbol(token.wrapped).toLowerCase())
  } else if (isEvm(chainId) && Native.onChain(chainId as ChainId).wrapped.equals(token)) {
    tags.push(getCurrencySymbol(Native.onChain(chainId as ChainId)).toLowerCase())
  }

  // If native wrapped token
  if (isEvm(chainId)) {
    const native = Native.onChain(chainId as ChainId)
    if (native.wrapped.equals(token)) {
      // add native
      tags.push(getCurrencySymbol(native).toLowerCase())
    }
  }
  return tags
}

function createSigmoid(k: number = 0.1) {
  return function sigmoidNormalize(value: number, avg: number): number {
    const exp = Math.exp(-k * (value - avg))
    return 100 / (1 + exp)
  }
}

const sigmoidTvl = createSigmoid(0.00001)
const sigmoidApr = createSigmoid(0.1)
const sigmoidVol = createSigmoid(0.0001)

interface Weighted<T> {
  item: T
  weight: number
}

const sortFunction = <T extends SortableFarm>(
  farms: T[],
  sortField: string,
  activeChainId?: ChainId,
  sortOrder: SORT_ORDER = SORT_ORDER.DESC,
): T[] => {
  if (farms.length === 0) return []

  const direction = sortOrder === SORT_ORDER.ASC ? 1 : -1
  const items = [...farms]
  const metricsCache = new WeakMap<SortableFarm, SortMetrics>()

  const getMetrics = (farm: SortableFarm) => {
    const cached = metricsCache.get(farm)
    if (cached) {
      return cached
    }
    const metrics = extractSortMetrics(farm)
    metricsCache.set(farm, metrics)
    return metrics
  }

  const compareBy = (selector: (metrics: SortMetrics) => number) => {
    return (a: T, b: T) => {
      const aMetrics = getMetrics(a)
      const bMetrics = getMetrics(b)
      return (selector(aMetrics) - selector(bMetrics)) * direction
    }
  }

  switch (sortField) {
    case 'tvlUsd':
      return items.sort(compareBy((metrics) => metrics.tvl))
    case 'lpApr':
      return items.sort(compareBy((metrics) => metrics.apr))
    case 'vol24hUsd':
      return items.sort(compareBy((metrics) => metrics.vol))
    default:
  }

  const metricsList = items.map((farm) => getMetrics(farm))
  const avgTvl = metricsList.reduce((sum, metric) => sum + metric.tvl, 0) / metricsList.length
  const avgApr = metricsList.reduce((sum, metric) => sum + metric.apr, 0) / metricsList.length
  const avgVol = metricsList.reduce((sum, metric) => sum + metric.vol, 0) / metricsList.length

  const weightedFarms: Weighted<T>[] = items.map((farm) => {
    const metrics = getMetrics(farm)
    const tvlWeight = sigmoidTvl(metrics.tvl, avgTvl)
    const aprWeight = sigmoidApr(metrics.apr, avgApr)
    const volWeight = sigmoidVol(metrics.vol, avgVol)
    const sameChain = activeChainId !== undefined && metrics.chainId === activeChainId ? 1 : 0
    const weight = aprWeight * 0.1 + tvlWeight * 0.3 + volWeight * 0.6
    // @ts-ignore
    const isWhitelist = Boolean(farm.inWhitelist || farm.farm?.inWhitelist)
    const whitelistBoost = isWhitelist ? 100 : 0

    return {
      item: farm,
      weight: weight * 0.9 + sameChain * 10 + whitelistBoost,
    }
  })

  weightedFarms.sort((a, b) => b.weight - a.weight)
  return weightedFarms.map((x) => x.item)
}

export const farmFilters = {
  chainFilter,
  protocolFilter,
  sortFunction,
  search,
}
