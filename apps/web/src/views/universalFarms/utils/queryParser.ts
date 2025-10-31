import { Protocol } from '@pancakeswap/farms'
import { SORT_ORDER } from '@pancakeswap/uikit'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { FarmQuery } from 'state/farmsV4/search/edgeFarmQueries'
import { DEFAULT_CHAINS, DEFAULT_PROTOCOLS } from 'state/farmsV4/state/farmPools/fetcher'
import { PoolInfo } from 'state/farmsV4/state/type'

export function getProtocolsByIndex(index?: number): Protocol[] {
  if (!index || index === 0) return DEFAULT_PROTOCOLS
  if (index === 1) return [Protocol.InfinityCLAMM, Protocol.InfinityBIN]
  if (index === 2) return [Protocol.V3]
  if (index === 3) return [Protocol.V2]
  if (index === 4) return [Protocol.STABLE]
  return Object.values(Protocol)
}

export function getIndexByProtocols(protocols: Protocol[]): number {
  if (protocols.length === 2 && (protocols[0] === Protocol.InfinityCLAMM || protocols[0] === Protocol.InfinityBIN)) {
    return 1
  }
  if (protocols.length === 1 && protocols[0] === Protocol.V3) return 2
  if (protocols.length === 1 && protocols[0] === Protocol.V2) return 3
  if (protocols.length === 1 && protocols[0] === Protocol.STABLE) return 4
  return 0
}

export function parseUrlToSearchQuery(): FarmQuery {
  const url = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const selectedProtocolIndex = (() => {
    const type = url.get('type')
    return type ? Number(type) : 0
  })()

  const chains = (() => {
    const nets = url.getAll('network').map((n) => Number(n))
    return nets.length ? nets : DEFAULT_CHAINS
  })()

  const [sortOrder, sortBy] = (() => {
    const sort = url.get('sort')
    if (!sort) {
      return [SORT_ORDER.NULL, null] as [SORT_ORDER, null | keyof PoolInfo]
    }
    const [field, order] = sort.split(':')
    return [Number(order) as SORT_ORDER, field as keyof PoolInfo]
  })()

  return {
    keywords: url.get('search') || '',
    chains,
    protocols: getProtocolsByIndex(selectedProtocolIndex),
    sortBy: sortBy || '',
    sortOrder,
    page: 0,
  }
}

export function farmQueryToUrlParams(query: FarmQuery): { [key: string]: string | string[] } {
  const params: { [key: string]: string | string[] } = {}
  const protocolIndex = getIndexByProtocols(query.protocols)
  if (query.activeChainId && CHAIN_QUERY_NAME[query.activeChainId]) {
    params.chain = CHAIN_QUERY_NAME[query.activeChainId]
  }
  if (protocolIndex !== 0) {
    params.type = protocolIndex.toString()
  }
  if (query.chains.length && query.chains.length !== DEFAULT_CHAINS.length) {
    if (query.chains.length === 1) {
      params.network = query.chains[0].toString()
    } else {
      params.network = query.chains.map((c) => c.toString())
    }
  }
  if (query.sortBy && query.sortOrder) {
    params.sort = `${query.sortBy}:${query.sortOrder}`
  }
  if (query.keywords) {
    params.search = query.keywords
  }
  return params
}
