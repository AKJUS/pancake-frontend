import { createListsAtom, createTokenListReducer, NEW_LIST_STATE } from '@pancakeswap/token-lists/react'
import { DEFAULT_ACTIVE_LIST_URLS, DEFAULT_LIST_OF_LISTS, UNSUPPORTED_LIST_URLS } from 'config/constants/lists'
import { useAtomValue, useAtom } from 'jotai'

export const initialState = {
  lastInitializedDefaultListOfLists: DEFAULT_LIST_OF_LISTS,
  byUrl: {
    ...DEFAULT_LIST_OF_LISTS.concat(...UNSUPPORTED_LIST_URLS).reduce((memo, listUrl) => {
      memo[listUrl] = NEW_LIST_STATE
      return memo
    }, {}),
  },
  activeListUrls: DEFAULT_ACTIVE_LIST_URLS,
}

const listReducer = createTokenListReducer(initialState, DEFAULT_LIST_OF_LISTS, DEFAULT_ACTIVE_LIST_URLS)

export const { listsAtom, updateListStateAtom, useListStateReady, fetchListAtom } = createListsAtom(
  'listv1',
  listReducer,
  initialState,
)

export function useListState() {
  const listState = useAtomValue(listsAtom)
  const [, dispatch] = useAtom(updateListStateAtom)
  return [listState, dispatch] as const
}
