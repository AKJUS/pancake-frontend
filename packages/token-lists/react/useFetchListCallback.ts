import { nanoid } from '@reduxjs/toolkit'
import { useCallback } from 'react'
import { TokenList } from '../src/types'
import { fetchTokenList } from './actions'
import { getTokenList } from './getTokenList'

function useFetchListCallback(
  dispatch: (action?: unknown) => void,
): (listUrl: string, sendDispatch?: boolean) => Promise<TokenList> {
  // note: prevent dispatch if using for list search or unsupported list
  return useCallback(
    async (listUrl: string, sendDispatch = true) => {
      const requestId = nanoid()
      if (sendDispatch) {
        dispatch(fetchTokenList.pending({ requestId, url: listUrl }))
      }
      return getTokenList(listUrl)
        .then((tokenList) => {
          if (!tokenList) {
            throw new Error('Token list not found')
          }

          if (sendDispatch) {
            dispatch(fetchTokenList.fulfilled({ url: listUrl, tokenList, requestId }))
          }
          return tokenList
        })
        .catch((error) => {
          console.warn(`Failed to get list at url ${listUrl}`, error)
          if (sendDispatch) {
            dispatch(fetchTokenList.rejected({ url: listUrl, requestId, errorMessage: error.message }))
          }
          throw error
        })
    },
    [dispatch],
  )
}

export default useFetchListCallback
