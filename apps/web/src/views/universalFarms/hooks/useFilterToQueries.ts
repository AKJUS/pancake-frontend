import { SORT_ORDER } from '@pancakeswap/uikit'
import intersection from 'lodash/intersection'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo } from 'react'
import { getHashKey } from 'utils/hash'
import { POSITION_STATUS } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { isAddress } from 'viem'
import { IPoolsFilterPanelProps } from '../components'
import { usePoolProtocols } from './usePoolProtocols'
import { useAllChainIds } from './useMultiChains'

type filtersParams = Partial<
  IPoolsFilterPanelProps['value'] & {
    sortOrder: SORT_ORDER
    sortField: keyof PoolInfo | null
    positionStatus: POSITION_STATUS
    farmsOnly: boolean
    search: string
  }
>

export const useFilterToQueries = () => {
  const nextRouter = useRouter()
  const allChainIds = useAllChainIds()
  const urlQuery = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const {
    type: _type,
    network,
    token: queryTokenParams,
    sort,
    status,
    farmsOnly: queryFarmsOnly,
    search,
    ...restQueries
  } = nextRouter.query
  const type = _type || urlQuery.get('type')

  // Memoize othersQueries to prevent unstable reference that would cause
  // replaceURLQueriesByFilter to be recreated on every render
  const restQueriesHash = getHashKey(restQueries)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const othersQueries = useMemo(() => {
    return restQueries
  }, [restQueriesHash])

  const positionStatus = useMemo(
    () => (status ? Number(Array.isArray(status) ? status[0] : status) : POSITION_STATUS.ACTIVE),
    [status],
  )

  const farmsOnly = useMemo(
    () => (queryFarmsOnly ? !!Number(Array.isArray(queryFarmsOnly) ? queryFarmsOnly[0] : queryFarmsOnly) : false),
    [queryFarmsOnly],
  )

  const selectedProtocolIndex = useMemo(() => (type ? Number(Array.isArray(type) ? type[0] : type) : 0), [type])
  const allProtocols = usePoolProtocols()

  const selectedNetwork = useMemo(
    () => (network ? (Array.isArray(network) ? network : [network]).map((i) => Number(i)) : allChainIds),
    [network, allChainIds],
  )
  const selectedTokens = useMemo(() => {
    const queryTokens = queryTokenParams
      ? Array.isArray(queryTokenParams)
        ? queryTokenParams
        : [queryTokenParams]
      : []
    return queryTokens.filter((t) => {
      const [, tokenAddress] = t.split(':')
      return isAddress(tokenAddress)
    })
  }, [queryTokenParams])
  const [sortOrder, sortField] = useMemo(() => {
    if (!sort) {
      return [SORT_ORDER.NULL, null]
    }
    const [field, order] = (Array.isArray(sort) ? sort[0] : sort).split(':')
    return [Number(order), field as keyof PoolInfo | null]
  }, [sort])

  const replaceURLQueriesByFilter = useCallback(
    (filters: filtersParams) => {
      const params: { [key: string]: string | string[] } = {}
      if (typeof filters.positionStatus !== 'undefined' && filters.positionStatus !== POSITION_STATUS.ACTIVE) {
        params.status = filters.positionStatus.toString()
      }
      if (filters.selectedProtocolIndex && filters.selectedProtocolIndex !== 0) {
        params.type = filters.selectedProtocolIndex.toString()
      }
      if (filters.farmsOnly) {
        params.farmsOnly = '1'
      }
      if (filters.sortOrder && filters.sortField) {
        params.sort = `${filters.sortField}:${filters.sortOrder}`
      }
      if (filters.selectedNetwork && filters.selectedNetwork.length !== allChainIds.length) {
        params.network = filters.selectedNetwork.map((i) => i.toString())
      }
      if (filters.search) {
        params.search = filters.search
      }
      const newQuery = {
        ...othersQueries,
        ...params,
      }
      // Tokens might be too long, so keep them at the end to prevent other queries from being cut off by the browser.
      nextRouter.replace(
        {
          query: newQuery,
        },
        undefined,
        {
          shallow: true,
          scroll: false,
        },
      )
    },
    [othersQueries, nextRouter, allChainIds.length],
  )

  useEffect(() => {
    const queriesReset: filtersParams = {}
    if (Array.isArray(status)) {
      queriesReset.positionStatus = positionStatus
    }
    if (!Object.values(POSITION_STATUS).includes(positionStatus)) {
      queriesReset.positionStatus = POSITION_STATUS.ACTIVE
    }

    if (Array.isArray(type)) {
      queriesReset.selectedProtocolIndex = selectedProtocolIndex
    }
    if (selectedProtocolIndex >= allProtocols.length) {
      queriesReset.selectedProtocolIndex = 0
    }

    if (!selectedNetwork.every((i) => allChainIds.includes(i))) {
      queriesReset.selectedNetwork = intersection(allChainIds, selectedNetwork)
    }

    if (Array.isArray(sort)) {
      queriesReset.sortOrder = sortOrder
      queriesReset.sortField = sortField
    }
    if (!Object.values(SORT_ORDER).includes(sortOrder)) {
      queriesReset.sortOrder = SORT_ORDER.NULL
      queriesReset.sortField = null
    }

    if (Array.isArray(queryFarmsOnly)) {
      queriesReset.farmsOnly = farmsOnly
    }

    if (Object.keys(queriesReset).length) {
      replaceURLQueriesByFilter({
        selectedProtocolIndex,
        selectedNetwork,
        sortOrder,
        sortField,
        positionStatus,
        farmsOnly,
        ...queriesReset,
      })
    }
  }, [
    queryFarmsOnly,
    sort,
    status,
    type,
    positionStatus,
    replaceURLQueriesByFilter,
    selectedProtocolIndex,
    selectedNetwork,
    selectedTokens,
    sortOrder,
    sortField,
    farmsOnly,
    allChainIds,
    queryTokenParams,
    allProtocols.length,
  ])

  return {
    selectedProtocolIndex,
    selectedNetwork,
    selectedTokens,
    sortOrder,
    sortField,
    positionStatus,
    farmsOnly,
    search: search as string,
    replaceURLQueriesByFilter,
  }
}
