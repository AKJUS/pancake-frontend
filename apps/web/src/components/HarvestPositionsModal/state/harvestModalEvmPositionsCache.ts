import { isSolana } from '@pancakeswap/chains'
import { atom } from 'jotai'
import { SLOW_INTERVAL } from 'config/constants'

import type {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  PositionDetail,
  StableLPDetail,
  V2LPDetail,
} from 'state/farmsV4/state/accountPositions/type'

/** Aligns with account-position React Query `staleTime` so cached slices match fetch freshness. */
export const HARVEST_MODAL_EVM_POSITIONS_TTL_MS = SLOW_INTERVAL

export type HarvestModalEvmCachedSlices = {
  infinityCL: InfinityCLPositionDetail[]
  infinityBin: InfinityBinPositionDetail[]
  v3: PositionDetail[]
  v2: V2LPDetail[]
  stable: StableLPDetail[]
  infinityStable: StableLPDetail[]
}

export type HarvestModalEvmPositionsCache = {
  accountKey: string | null
  chains: Record<
    number,
    {
      expiresAt: number
    } & Partial<HarvestModalEvmCachedSlices>
  >
}

const emptyCache: HarvestModalEvmPositionsCache = { accountKey: null, chains: {} }

export const harvestModalEvmPositionsCacheAtom = atom<HarvestModalEvmPositionsCache>(emptyCache)

export type HarvestModalEvmCacheFlushArgs = {
  account: string | undefined
  chainId: number | undefined
  current: {
    p1c: boolean
    p2c: boolean
    p3c: boolean
    p4c: boolean
    p5c: boolean
    p6c: boolean
    infinityCL: InfinityCLPositionDetail[] | undefined
    infinityBin: InfinityBinPositionDetail[] | undefined
    v3: PositionDetail[] | undefined
    v2: V2LPDetail[] | undefined
    stable: StableLPDetail[] | undefined
    infinityStable: StableLPDetail[] | undefined
  }
  otherChainIds: readonly number[]
  other: {
    p1o: boolean
    p2o: boolean
    p3o: boolean
    infinityCL: InfinityCLPositionDetail[] | undefined
    infinityBin: InfinityBinPositionDetail[] | undefined
    v3: PositionDetail[] | undefined
  }
}

/**
 * Single reducer: account switch, current-chain slices, and other-chain scan results in one immutable update.
 * Returns `prev` when nothing changed (avoids redundant subscriptions).
 */
export function flushHarvestModalEvmPositionsCache(
  prev: HarvestModalEvmPositionsCache,
  args: HarvestModalEvmCacheFlushArgs,
): HarvestModalEvmPositionsCache {
  if (!args.account) {
    if (prev.accountKey === null && Object.keys(prev.chains).length === 0) return prev
    return emptyCache
  }

  const accountKey = args.account.toLowerCase()
  const accountChanged = prev.accountKey !== accountKey
  let chains = accountChanged ? ({} as HarvestModalEvmPositionsCache['chains']) : prev.chains
  let didWrite = accountChanged
  const expiresAt = Date.now() + HARVEST_MODAL_EVM_POSITIONS_TTL_MS

  const ensureChainsCopy = () => {
    if (!accountChanged && chains === prev.chains) {
      chains = { ...prev.chains }
    }
  }

  const mergeChain = (cid: number, partial: Partial<HarvestModalEvmCachedSlices>) => {
    if (Object.keys(partial).length === 0) return
    ensureChainsCopy()
    const prevEntry = chains[cid] ?? { expiresAt }
    chains[cid] = { ...prevEntry, ...partial, expiresAt }
    didWrite = true
  }

  const { chainId, current, otherChainIds, other } = args

  if (chainId !== undefined && !isSolana(chainId)) {
    const partial: Partial<HarvestModalEvmCachedSlices> = {}
    if (!current.p1c) partial.infinityCL = current.infinityCL ?? []
    if (!current.p2c) partial.infinityBin = current.infinityBin ?? []
    if (!current.p3c) partial.v3 = current.v3 ?? []
    if (!current.p4c) partial.v2 = current.v2 ?? []
    if (!current.p5c) partial.stable = current.stable ?? []
    if (!current.p6c) partial.infinityStable = current.infinityStable ?? []
    mergeChain(chainId, partial)
  }

  if (otherChainIds.length > 0 && (!other.p1o || !other.p2o || !other.p3o)) {
    const perChain: Record<number, Partial<HarvestModalEvmCachedSlices>> = {}
    for (const id of otherChainIds) perChain[id] = {}

    if (!other.p1o) {
      const grouped = groupPositionsByChainId(other.infinityCL ?? [])
      for (const id of otherChainIds) perChain[id].infinityCL = grouped[id] ?? []
    }
    if (!other.p2o) {
      const grouped = groupPositionsByChainId(other.infinityBin ?? [])
      for (const id of otherChainIds) perChain[id].infinityBin = grouped[id] ?? []
    }
    if (!other.p3o) {
      const grouped = groupPositionsByChainId(other.v3 ?? [])
      for (const id of otherChainIds) perChain[id].v3 = grouped[id] ?? []
    }

    for (const id of otherChainIds) {
      const partial = perChain[id]
      if (Object.keys(partial).length > 0) mergeChain(id, partial)
    }
  }

  if (!didWrite) return prev
  return { accountKey, chains }
}

export function groupPositionsByChainId<T extends { chainId: number }>(rows: T[]): Record<number, T[]> {
  const out: Record<number, T[]> = {}
  for (const row of rows) {
    if (!out[row.chainId]) out[row.chainId] = []
    out[row.chainId].push(row)
  }
  return out
}

function readFreshChainEntry(cache: HarvestModalEvmPositionsCache, chainId: number) {
  const e = cache.chains[chainId]
  if (!e || Date.now() > e.expiresAt) return undefined
  return e
}

/** While `pending`, prefer a non-expired cached slice for `chainId` so chain switches reuse prior fetches. */
export function mergeHarvestModalChainSlice<K extends keyof HarvestModalEvmCachedSlices>(
  account: string | undefined,
  cache: HarvestModalEvmPositionsCache,
  chainId: number | undefined,
  pending: boolean,
  live: HarvestModalEvmCachedSlices[K] | undefined,
  slice: K,
): HarvestModalEvmCachedSlices[K] {
  if (!pending) return (live ?? []) as HarvestModalEvmCachedSlices[K]
  if (!account || !chainId) return (live ?? []) as HarvestModalEvmCachedSlices[K]
  const ak = account.toLowerCase()
  if (cache.accountKey !== ak) return (live ?? []) as HarvestModalEvmCachedSlices[K]
  const entry = readFreshChainEntry(cache, chainId)
  const cached = entry?.[slice]
  if (cached !== undefined) return cached as HarvestModalEvmCachedSlices[K]
  return (live ?? []) as HarvestModalEvmCachedSlices[K]
}

export function mergeHarvestModalOtherChainsSlice<T extends { chainId: number }>(
  account: string | undefined,
  cache: HarvestModalEvmPositionsCache,
  otherChainIds: number[],
  pending: boolean,
  live: T[] | undefined,
  slice: 'infinityCL' | 'infinityBin' | 'v3',
): T[] {
  if (!pending) return live ?? []
  if (!account) return live ?? []
  const ak = account.toLowerCase()
  if (cache.accountKey !== ak) return live ?? []

  const liveRows = live ?? []
  const liveByChain = liveRows.length ? groupPositionsByChainId(liveRows) : undefined
  const now = Date.now()
  return otherChainIds.flatMap((id) => {
    const fromLive = liveByChain?.[id]
    if (fromLive?.length) return fromLive
    const e = cache.chains[id]
    if (!e || now > e.expiresAt) return []
    const c = e[slice] as T[] | undefined
    return c ?? []
  })
}

export function harvestModalOtherChainsScanSatisfied(
  account: string | undefined,
  cache: HarvestModalEvmPositionsCache,
  otherChainIds: number[],
): boolean {
  if (!account) return false
  const ak = account.toLowerCase()
  if (cache.accountKey !== ak) return false
  const now = Date.now()
  for (const id of otherChainIds) {
    const e = cache.chains[id]
    if (!e || now > e.expiresAt) return false
    if (e.v3 === undefined || e.infinityCL === undefined || e.infinityBin === undefined) return false
  }
  return true
}

function harvestModalHasCachedSlice(
  account: string | undefined,
  cache: HarvestModalEvmPositionsCache,
  chainId: number | undefined,
  slice: keyof HarvestModalEvmCachedSlices,
): boolean {
  if (!account || chainId === undefined) return false
  if (cache.accountKey !== account.toLowerCase()) return false
  const e = readFreshChainEntry(cache, chainId)
  return e?.[slice] !== undefined
}

const CURRENT_PENDING_SLICES: (keyof HarvestModalEvmCachedSlices)[] = [
  'infinityCL',
  'infinityBin',
  'v3',
  'v2',
  'stable',
  'infinityStable',
]

export function harvestModalCurrentChainEvmPositionsPending(
  account: string | undefined,
  cache: HarvestModalEvmPositionsCache,
  chainId: number | undefined,
  pending: {
    p1c: boolean
    p2c: boolean
    p3c: boolean
    p4c: boolean
    p5c: boolean
    p6c: boolean
  },
): boolean {
  const flags = [pending.p1c, pending.p2c, pending.p3c, pending.p4c, pending.p5c, pending.p6c]
  return flags.some(
    (isPending, i) => isPending && !harvestModalHasCachedSlice(account, cache, chainId, CURRENT_PENDING_SLICES[i]),
  )
}
