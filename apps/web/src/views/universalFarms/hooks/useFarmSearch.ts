import { useCallback, useEffect, useMemo, useState } from 'react'
import { PoolInfo } from 'state/farmsV4/state/type'
import { getHashKey } from 'utils/hash'
import { useAtomValue, useSetAtom } from 'jotai'
import { useUserShowTestnet } from 'state/user/hooks/useUserShowTestnet'
import { DEFAULT_ACTIVE_LIST_URLS } from 'config/constants/lists'
import { useTokenListPrepared } from 'hooks/useTokenListPrepared'
import { FarmQuery } from 'state/farmsV4/search/edgeFarmQueries'
import { PoolSearcher, PoolSearcherState, PoolSearchEvent } from '../atom/PoolSearcher'
import { tokensMapAtom } from '../atom/tokensMapAtom'
import { searchQueryAtom, setPageAtom } from '../atom/searchQueryAtom'

type FarmSearchParams = {
  enabled: boolean
  queries?: Partial<FarmQuery>
}

export const useFarmSearch = (params?: FarmSearchParams) => {
  const listPrepared = useTokenListPrepared(DEFAULT_ACTIVE_LIST_URLS)
  const atomQuery = useAtomValue(searchQueryAtom)
  const setAtomPage = useSetAtom(setPageAtom)
  const [localPage, setLocalPage] = useState(0)

  // undefined → uncontrolled / farms-page mode — use global atomQuery
  // { enabled: false } → disabled (e.g. NavbarSearch closed) — no fetching
  // { enabled: true, queries } → controlled mode — use provided queries
  const isEnabled = params === undefined || params.enabled
  const isControlled = params !== undefined

  // When params are provided, merge over atomQuery so defaults (activeChainId, protocols, etc.) still apply
  const query = useMemo<FarmQuery>(() => {
    if (!isControlled) return atomQuery
    return { ...atomQuery, ...params.queries, page: localPage, abort: false }
  }, [isControlled, atomQuery, params?.queries, localPage])

  // Reset local page whenever the caller's queries change
  useEffect(() => {
    if (isControlled) setLocalPage(0)
  }, [isControlled, params?.queries?.keywords, params?.queries?.chains])

  const setPage = isControlled ? setLocalPage : setAtomPage

  const searcher = useMemo(() => new PoolSearcher(), [])
  const [pools, setPools] = useState<PoolInfo[]>([])
  const [state, setState] = useState<PoolSearcherState>(searcher.getState())
  const hash = useMemo(() => getHashKey(query), [query])
  const { tokensMap } = useAtomValue(tokensMapAtom)
  const [showTestnet] = useUserShowTestnet()

  useEffect(() => {
    if (!isEnabled || listPrepared.isPending()) {
      return
    }
    const isReady = listPrepared.unwrap()
    if (isReady) {
      searcher.search(query, tokensMap, showTestnet)
    }
  }, [isEnabled, hash, searcher, listPrepared, tokensMap, showTestnet])

  useEffect(() => {
    const s1 = searcher.on(PoolSearchEvent.POOLS_UPDATED, (pools: PoolInfo[]) => {
      setPools(pools)
    })

    const s2 = searcher.on(PoolSearchEvent.STATE_UPDATED, (state: PoolSearcherState) => {
      setState(state)
    })

    return () => {
      s1()
      s2()
    }
  }, [searcher])

  const isFetching = state === PoolSearcherState.SEARCHING
  const hasNextPage = pools.length > 0 && pools.length >= 20 * ((query.page ?? 0) + 1)

  const fetchNextPage = useCallback(() => {
    if (hasNextPage && !isFetching) {
      setPage((p) => p + 1)
    }
  }, [hasNextPage, isFetching, setPage])

  return {
    pools,
    state,
    setPage,
    query,
    isFetching,
    hasNextPage,
    fetchNextPage,
  }
}
