import { useEffect, useMemo, useState } from 'react'
import { PoolInfo } from 'state/farmsV4/state/type'
import { getHashKey } from 'utils/hash'
import { useAtomValue, useSetAtom } from 'jotai'
import { useUserShowTestnet } from 'state/user/hooks/useUserShowTestnet'
import { DEFAULT_ACTIVE_LIST_URLS } from 'config/constants/lists'
import { useTokenListPrepared } from 'hooks/useTokenListPrepared'
import { PoolSearcher, PoolSearcherState, PoolSearchEvent } from '../atom/PoolSearcher'
import { tokensMapAtom } from '../atom/tokensMapAtom'
import { searchQueryAtom, setPageAtom } from '../atom/searchQueryAtom'

export const useFarmSearch = () => {
  const listPrepared = useTokenListPrepared(DEFAULT_ACTIVE_LIST_URLS)
  const query = useAtomValue(searchQueryAtom)
  const setPage = useSetAtom(setPageAtom)

  const searcher = useMemo(() => new PoolSearcher(), [])
  const [pools, setPools] = useState<PoolInfo[]>([])
  const [state, setState] = useState<PoolSearcherState>(searcher.getState())
  const hash = useMemo(() => getHashKey(query), [query])
  const { tokensMap } = useAtomValue(tokensMapAtom)
  const [showTestnet] = useUserShowTestnet()

  useEffect(() => {
    if (listPrepared.isPending()) {
      return
    }
    const isReady = listPrepared.unwrap()
    if (isReady) {
      console.log(`[farm] search with token list`, Object.keys(tokensMap).length)
      searcher.search(query, tokensMap, showTestnet)
    }
  }, [hash, searcher, listPrepared, tokensMap, showTestnet])

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

  return {
    pools,
    state,
    setPage,
    query,
  }
}
