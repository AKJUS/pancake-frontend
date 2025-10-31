import { useIntersectionObserver } from '@pancakeswap/hooks'
import { Flex, Loading, TableView, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useRouter } from 'next/router'
import { memo, useCallback, useEffect, useMemo } from 'react'
import styled from 'styled-components'
import isEqual from 'lodash/isEqual'

import { useTranslation } from '@pancakeswap/localization'
import { useAtomValue, useSetAtom } from 'jotai'
import { getFarmKey } from 'state/farmsV4/search/farm.util'
import { PoolInfo } from 'state/farmsV4/state/type'
import { getPoolDetailPageLink } from 'utils/getPoolLink'
import { searchQueryAtom, updateFilterAtom, updateSortAtom } from './atom/searchQueryAtom'
import {
  Card,
  CardBody,
  CardHeader,
  IPoolsFilterPanelProps,
  ListView,
  PoolsFilterPanel,
  useColumnConfig,
} from './components'
import { AddLiquidityButton } from './components/AddLiquidityButton'
import { FarmSearchContextProvider } from './hooks/useFarmSearchContext'
import { farmQueryToUrlParams, getIndexByProtocols } from './utils/queryParser'
import { CreatePoolButton } from './components/CreatePoolButton'
import { useFarmSearch } from './hooks/useFarmSearch'
import { PoolSearcherState } from './atom/PoolSearcher'

const PoolsContent = styled.div`
  min-height: calc(100vh - 64px - 56px);
`

export const PoolsPage = memo(() => {
  const { query: nextQuery, replace, pathname } = useRouter()
  const { isMobile, isMd } = useMatchBreakpoints()

  const updateFilter = useSetAtom(updateFilterAtom)
  const query = useAtomValue(searchQueryAtom)

  useEffect(() => {
    const params = farmQueryToUrlParams(query)
    if (isEqual(params, nextQuery)) {
      return
    }
    replace(
      {
        pathname,
        query: params,
      },
      undefined,
      {
        shallow: true,
      },
    )
  }, [query, nextQuery, replace, pathname])

  const handleFilterChange: IPoolsFilterPanelProps['onChange'] = useCallback(
    (newFilters) => {
      updateFilter(newFilters)
    },
    [updateFilter],
  )

  const poolsFilter = useMemo(
    () => ({
      selectedProtocolIndex: getIndexByProtocols(query.protocols),
      selectedNetwork: query.chains,
      search: query.keywords,
    }),
    [query],
  )

  return (
    <FarmSearchContextProvider>
      <Card>
        <CardHeader p={isMobile ? '16px' : undefined}>
          <PoolsFilterPanel onChange={handleFilterChange} value={poolsFilter} includeSolana>
            {(isMobile || isMd) && (
              <>
                <CreatePoolButton scale="sm" width="100%" height="40px" />
                <AddLiquidityButton height="40px" scale="sm" width="100%" />
              </>
            )}
          </PoolsFilterPanel>
        </CardHeader>
        <CardBody>
          <List />
        </CardBody>
      </Card>
    </FarmSearchContextProvider>
  )
})

const List = () => {
  const { push } = useRouter()
  const { isMobile } = useMatchBreakpoints()

  const columns = useColumnConfig()

  const updateSort = useSetAtom(updateSortAtom)
  const { observerRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
  })

  const handleRowClick = useCallback(
    async (pool: PoolInfo) => {
      const data = await getPoolDetailPageLink(pool)
      push(data)
    },
    [push],
  )

  const getRowKey = useCallback((item: PoolInfo) => {
    const farm = item.farm!
    return getFarmKey(farm)
  }, [])

  const { pools: list, state, setPage, query } = useFarmSearch()
  const handleSort = useCallback(
    ({ order, dataIndex }) => {
      updateSort({
        order,
        dataIndex,
      })
    },
    [updateSort],
  )

  useEffect(() => {
    if (isIntersecting) {
      setPage((v) => v + 1)
    }
  }, [isIntersecting, setPage])

  const pending = state === PoolSearcherState.SEARCHING
  const { t } = useTranslation()
  const noResults = list.length === 0 && !pending
  return (
    <>
      <Flex
        justifyContent="center"
        alignItems="center"
        width="100%"
        style={{ height: '40px', display: noResults ? 'block' : 'none', textAlign: 'center' }}
      >
        {t('No results found')}
      </Flex>
      <PoolsContent>
        <>
          {isMobile ? (
            <ListView data={list} onRowClick={handleRowClick} />
          ) : (
            <TableView
              getRowKey={getRowKey}
              columns={columns}
              data={list}
              onSort={handleSort}
              sortOrder={query.sortOrder}
              sortField={query.sortBy as any}
              onRowClick={handleRowClick}
            />
          )}
        </>
        {pending && (
          <StyledLoadingTable justifyContent="center" alignItems="center">
            <Loading
              style={{
                marginTop: '10px',
                marginBottom: '10px',
              }}
            />
          </StyledLoadingTable>
        )}
      </PoolsContent>

      {!pending && list.length > 0 && <div ref={observerRef} />}
    </>
  )
}

const StyledLoadingTable = styled(Flex)`
  padding-top: 40px
  maxheight: 100%;
`
