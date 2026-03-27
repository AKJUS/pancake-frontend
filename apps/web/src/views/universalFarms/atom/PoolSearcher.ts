/* eslint-disable class-methods-use-this */
import { isTestnetChainId } from '@pancakeswap/chains'
import edgeFarmQueries, { FarmQuery } from 'state/farmsV4/search/edgeFarmQueries'
import { FarmV4SupportedChainId, Protocol } from '@pancakeswap/farms'
import { FarmInfo, farmToPoolInfo, getFarmKey } from 'state/farmsV4/search/farm.util'
import uniqBy from '@pancakeswap/utils/uniqBy'
import { getHashKey } from 'utils/hash'
import {
  fillOnchainPoolData,
  batchGetCakeApr,
  batchGetIncentraAprData,
  batchGetLpAprData,
  batchGetMerklAprData,
} from 'state/farmsV4/search/batchFarmDataFiller'
import { PoolInfo } from 'state/farmsV4/state/type'
import keyBy from 'lodash/keyBy'
import { Emitter } from '@pancakeswap/utils/Emitter'
import { CakeAprValue } from 'state/farmsV4/atom'
import { TokenInfo } from '@pancakeswap/token-lists'
import { INFINITY_STABLE_POOL_FEE_DENOMINATOR } from '@pancakeswap/infinity-stable-sdk'
import { farmFilters, isInWhitelist } from './farmSearch.filter'
import { parseExtendSearchParams } from './farmSearch.parser'

export enum PoolSearcherState {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
}

export enum PoolSearchEvent {
  POOLS_UPDATED = 'POOLS_UPDATED',
  STATE_UPDATED = 'STATE_UPDATED',
}
export interface BuildQueriesResult {
  extend: boolean
  query: FarmQuery
}

function buildFarmList(list: FarmInfo[]) {
  return list.map((farm) => {
    const { pool, chainId, ...rest } = farm
    const farmInfo = {
      chainId,
      tvlUsd: Number(farm.tvlUSD) || 0,
      ...rest,
      feeTierBase: farm.protocol === Protocol.InfinitySTABLE ? INFINITY_STABLE_POOL_FEE_DENOMINATOR : 1e6,
      vol24hUsd: farm.vol24hUsd,
      pool,
    } as FarmInfo

    return farmInfo
  })
}

interface Apr {
  cakeApr?: CakeAprValue
  lpApr: string
  merklApr?: string
  incentraApr?: number
}
export class PoolSearcher extends Emitter<PoolSearchEvent> {
  private state: PoolSearcherState = PoolSearcherState.SEARCHING

  private all: FarmInfo[] = []

  private currentQuery?: FarmQuery

  private currentHash?: string

  private aprs: Record<string, Apr> = {}

  private tokensMap: Record<string, TokenInfo> = {}

  private abortController?: AbortController

  private checkQuery(query: FarmQuery) {
    const newHash = getHashKey({ ...query, page: 0, abort: false })
    const queryUpdated = this.currentHash !== newHash
    const pageUpdated = this.currentQuery?.page !== query.page

    // Set abort flag on the previous query and cancel in-flight requests if a new search is starting
    if (this.currentQuery && queryUpdated) {
      this.currentQuery.abort = true
      this.abortController?.abort()
      this.abortController = new AbortController()
    }

    this.currentQuery = query
    this.currentHash = newHash
    return {
      queryUpdated,
      pageUpdated,
    }
  }

  private clearStates() {
    this.all = []
    this.aprs = {}
    // Check if current query is aborted before emitting
    if (!this.currentQuery?.abort) {
      this.emit(PoolSearchEvent.POOLS_UPDATED, [])
    }
    // State is intentionally NOT set to IDLE here — callers manage state transitions
  }

  public async search(query: FarmQuery, tokensMap: Record<string, TokenInfo>, useShowTestnet: boolean = false) {
    const { queryUpdated, pageUpdated } = this.checkQuery(query)
    this.tokensMap = tokensMap
    if (!queryUpdated && !pageUpdated) {
      return
    }
    if (!queryUpdated && this.state === PoolSearcherState.SEARCHING) {
      return
    }

    try {
      const page = query.page || 0
      if (queryUpdated) {
        // Set SEARCHING before clearing so state never flickers to IDLE mid-query
        this.setState(PoolSearcherState.SEARCHING)
        this.clearStates()
        await wait(100)
        await this.updatePools(query, useShowTestnet, this.abortController?.signal)
      } else {
        const total = this.all.slice(0, 20 * (page + 1))
        if (total.length === this.all.length) {
          return
        }
        this.setState(PoolSearcherState.SEARCHING)
      }

      // Step 1: Paging - slice by page (20 items per page)
      const sliced = this.all.slice(0, 20 * (page + 1))

      // Step 2: Fill onchain pool data
      const filled = await Promise.all(sliced.map(fillOnchainPoolData))

      // Step 3: Convert to PoolInfo
      const poolInfos = filled.map(farmToPoolInfo)

      // Step 4: Enrihment - get APR data
      this.enrichAndSortPools(poolInfos, query)

      this.updateAprs(poolInfos).then(() => {
        // Check if query is aborted before enriching and sorting
        if (!query.abort) {
          this.enrichAndSortPools(poolInfos, query)
        }
      })
    } finally {
      // Check if query is aborted before setting state
      if (!query.abort) {
        this.setState(PoolSearcherState.IDLE)
      }
    }
  }

  private async updatePools(query: FarmQuery, useShowTestnet: boolean, signal?: AbortSignal) {
    const checkWhiteList = isInWhitelist(this.tokensMap)
    const allResults = await this.fetch(query, useShowTestnet, signal)
    const filtered = this.filter(allResults, query)

    for (const farm of filtered) {
      farm.inWhitelist = checkWhiteList(farm)
    }

    const presort = farmFilters.sortFunction(filtered, query.sortBy!, query.activeChainId, query.sortOrder)
    this.all = presort
  }

  private setState(state: PoolSearcherState) {
    this.state = state
    // Check if current query is aborted before emitting state update
    if (!this.currentQuery?.abort) {
      this.emit(PoolSearchEvent.STATE_UPDATED, state)
    }
  }

  private async updateAprs(poolInfos: PoolInfo[]) {
    const [_cakeAprs, _lpAprs, _merklAprs, _incentraAprs] = await Promise.allSettled([
      batchGetCakeApr(poolInfos),
      batchGetLpAprData(poolInfos),
      batchGetMerklAprData(poolInfos),
      batchGetIncentraAprData(poolInfos),
    ])

    const aprsMap = {
      cakeAprs: keyBy(_cakeAprs.status === 'fulfilled' ? _cakeAprs.value : [], (x) => x.id),
      lpAprs: keyBy(_lpAprs.status === 'fulfilled' ? _lpAprs.value : [], (x) => x.id),
      merklAprs: keyBy(_merklAprs.status === 'fulfilled' ? _merklAprs.value : [], (x) => x.id),
      incentraAprs: keyBy(_incentraAprs.status === 'fulfilled' ? _incentraAprs.value : [], (x) => x.id),
    }

    const { cakeAprs, lpAprs, merklAprs, incentraAprs } = aprsMap

    const aprs: Record<string, Apr> = {}
    for (const pool of poolInfos) {
      const { farm } = pool
      const id = getFarmKey(farm!)
      const cakeApr = cakeAprs[id]?.value || '0'
      const lpApr = `${lpAprs[id]?.value || farm?.apr24h || '0'}`
      const merklApr = merklAprs[id]?.value || '0'
      const incentraApr = incentraAprs[id]?.value || '0'
      const apr: Apr = {
        cakeApr,
        lpApr,
        merklApr,
        incentraApr,
      }
      aprs[id] = apr
    }
    this.aprs = aprs
  }

  public getState() {
    return this.state
  }

  private enrichAndSortPools(poolInfos: PoolInfo[], query: FarmQuery) {
    // Check if query is aborted before processing
    if (this.currentQuery?.abort) {
      return
    }

    // Enrich pools with APR data
    const pools = poolInfos.map((poolInfo) => {
      const { farm, ...others } = poolInfo
      if (!farm) return poolInfo

      const id = getFarmKey(farm)
      const apr = this.aprs[id]

      return {
        ...others,
        farm: {
          ...farm,
          ...(apr || {}),
          aprLoading: !apr,
        },
        lpApr: apr?.lpApr,
      } as PoolInfo
    })

    const result = farmFilters.sortFunction(pools, query.sortBy!, query.activeChainId, query.sortOrder)

    // Check again before emitting in case query was aborted during processing
    if (!this.currentQuery?.abort) {
      this.emit(PoolSearchEvent.POOLS_UPDATED, result)
    }
  }

  private async fetch(query: FarmQuery, useShowTestnet: boolean = false, signal?: AbortSignal): Promise<FarmInfo[]> {
    // Build queries using the existing buildQueries method
    const queries = this.buildQueries(query, useShowTestnet)

    // Fetch base results
    const baseQuery = queries.find((q) => !q.extend)?.query
    if (!baseQuery) {
      throw new Error('No base query found')
    }

    const baseResults = await this.fetchFarmList(baseQuery, false, signal)

    // Fetch extend results if there are extend queries
    const extendQueries = queries.filter((q) => q.extend)
    const _extendResults = await Promise.allSettled(extendQueries.map((q) => this.fetchFarmList(q.query, true, signal)))
    const extendResults = _extendResults.flatMap((r) => {
      if (r.status === 'fulfilled') {
        return r.value
      }
      return []
    })

    // Combine and deduplicate results
    const allResults = uniqBy([...baseResults, ...extendResults.flat()], (farm) => `${farm.chainId}-${farm.id}`)

    return allResults
  }

  private filter(allResults: FarmInfo[], query: FarmQuery): FarmInfo[] {
    // Apply search filters
    const filter01 = allResults
      .filter(farmFilters.chainFilter(query.chains))
      .filter(farmFilters.protocolFilter(query.protocols))

    const filtered = farmFilters.search(filter01, query.keywords || '')

    return filtered
  }

  private async fetchFarmList(query: FarmQuery, extend: boolean, signal?: AbortSignal): Promise<FarmInfo[]> {
    const pools = await edgeFarmQueries.queryFarms(query, extend, signal)
    return buildFarmList(pools)
  }

  private buildQueries(query: FarmQuery, useShowTestnet: boolean = false): BuildQueriesResult[] {
    const { protocols, chains: _chains, sortBy, activeChainId, keywords } = query

    // Filter chains based on testnet visibility
    const queryChains = _chains.filter((chain) => {
      if (isTestnetChainId(chain) && !useShowTestnet) {
        return false
      }
      return true
    }) as FarmV4SupportedChainId[]

    // If no chains after filtering, use activeChainId if available
    if (queryChains.length === 0 && activeChainId) {
      queryChains.push(activeChainId as FarmV4SupportedChainId)
    }

    const results: BuildQueriesResult[] = []

    // Add base query (non-extend)
    results.push({
      extend: false,
      query: {
        protocols,
        chains: queryChains,
        sortBy,
        activeChainId,
        keywords,
      },
    })

    // Add extend queries if keywords exist
    if (keywords && keywords.trim().length > 0) {
      const extendSearchList = parseExtendSearchParams(keywords, protocols, queryChains, sortBy)

      extendSearchList.forEach((extendQuery) => {
        results.push({
          extend: true,
          query: extendQuery,
        })
      })
    }

    return results
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
