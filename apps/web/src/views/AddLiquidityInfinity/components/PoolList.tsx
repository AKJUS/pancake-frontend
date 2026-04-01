import { useIntersectionObserver } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import { AddIcon, Button, Grid, Heading, IColumnsType, TableView, useMatchBreakpoints } from '@pancakeswap/uikit'
import {
  fromSelectedNodes,
  getCurrencyAddress,
  PoolTypeFilter,
  toSelectedNodes,
  toTokenValue,
} from '@pancakeswap/widgets-internal'
import { CurrencySelectV2 } from 'components/CurrencySelectV2'
import { NetworkSelector } from 'components/NetworkSelector'
import { CommonBasesType } from 'components/SearchModal/types'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { getCreateInfinityPoolPageURL } from 'config/constants/liquidity'
import { INFINITY_PROTOCOLS } from 'config/constants/protocols'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { useCurrencyByChainId } from 'hooks/Tokens'
import flatMap from 'lodash/flatMap'
import groupBy from 'lodash/groupBy'
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FetchPoolsProps, PoolSortBy } from 'state/farmsV4/atom'
import { useFetchPools } from 'state/farmsV4/hooks'
import type { InfinityPoolInfo, StablePoolInfo } from 'state/farmsV4/state/type'
import styled from 'styled-components'
import { getHookByAddress } from 'utils/getHookByAddress'
import { Address, zeroAddress } from 'viem'
import { usePoolFeatureAndType, usePoolTypeQuery } from 'views/AddLiquiditySelector/hooks/usePoolTypeQuery'
import {
  STABLE_POOL_OPTIONS,
  STABLE_POOL_TYPE,
  useStablePoolTypeQuery,
} from 'views/AddLiquiditySelector/hooks/useStablePoolTypeQuery'
import { Card, CardBody, CardHeader, ListView, useColumnConfig } from 'views/universalFarms/components'
import { getPoolDetailPageLink } from 'utils/getPoolLink'
import { usePoolTypes } from 'views/universalFarms/hooks'
import { useOrderChainIds } from 'views/universalFarms/hooks/useMultiChains'
import { Chain, ChainId } from '@pancakeswap/chains'

import { ALL_PROTOCOLS, Protocol } from '@pancakeswap/farms'
import { HOOK_CATEGORY } from '@pancakeswap/infinity-sdk'
import { isAddressEqual } from 'utils'
import { LiquidityType } from 'utils/types'
import { TokenFilterContainer } from './styles'

const PoolsContent = styled.div`
  min-height: calc(100vh - 64px - 56px);
`

const PoolsHead = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 16px;

  ${Heading} {
    margin-bottom: 16px;
  }

  ${({ theme }) => theme.mediaQueries.sm} {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;

    ${Heading} {
      margin-bottom: 0;
    }
  }

  ${({ theme }) => theme.mediaQueries.md} {
    margin-top: 40px;
  }
`

const FilterContainer = styled(Grid)``

const NUMBER_OF_FARMS_VISIBLE = 10

const useColumns = (onSelect: (pool: InfinityPoolInfo | StablePoolInfo) => void) => {
  const { t } = useTranslation()
  const [all, feeTier, APR, TVL, vol, poolType, poolFeature] = useColumnConfig<InfinityPoolInfo>()
  return useMemo(
    () => [
      all,
      feeTier,
      {
        ...APR,
        minWidth: '100px',
        sorter: false,
      },
      {
        ...TVL,
        sorter: false,
      },
      {
        ...vol,
        sorter: false,
      },
      poolType,
      poolFeature,
      {
        title: '',
        render: (item: InfinityPoolInfo | StablePoolInfo) => (
          <Button scale="sm" onClick={() => onSelect(item)}>
            {t('select')}
          </Button>
        ),
        dataIndex: null,
        key: 'action',
        clickable: false,
      } as IColumnsType<InfinityPoolInfo | StablePoolInfo>,
    ],
    [APR, TVL, all, feeTier, onSelect, poolType, poolFeature, t, vol],
  )
}

export const PoolList = () => {
  const nextRouter = useRouter()
  const { isMobile } = useMatchBreakpoints()
  const { t } = useTranslation()
  const handleSelect = useCallback(
    async (pool: InfinityPoolInfo | StablePoolInfo) => {
      const link = await getPoolDetailPageLink(pool as any)
      nextRouter.push(link)
    },
    [nextRouter],
  )
  const columns = useColumns(handleSelect)
  const { poolType, setPoolType, poolTypeQuery } = usePoolTypeQuery()
  const { stablePoolTypeQuery, setStablePoolType } = useStablePoolTypeQuery()

  const {
    chainId,
    protocol,
    currencyIdA: currencyIdAFromQuery,
    currencyIdB: currencyIdBFromQuery,
    updateParams,
  } = useSelectIdRouteParams()
  const isStableMode = protocol === LiquidityType.StableSwap
  const selectedTokenA = useCurrencyByChainId(currencyIdAFromQuery, chainId)
  const selectedTokenB = useCurrencyByChainId(currencyIdBFromQuery, chainId)
  const currencyIdA = getCurrencyAddress(selectedTokenA)
  const currencyIdB = getCurrencyAddress(selectedTokenB)
  const { observerRef, isIntersecting } = useIntersectionObserver()
  const [cursorVisible, setCursorVisible] = useState(NUMBER_OF_FARMS_VISIBLE)
  const [nextPage, setNextPage] = useState(1)
  const poolTypeData = usePoolTypes()
  const stablePoolTypeData = useMemo(
    () => [
      {
        key: '0',
        label: t('Pool Type'),
        data: 'stableSwapPoolType',
        children: STABLE_POOL_OPTIONS.map((option, index) => ({
          key: `0-${index}`,
          label: t(option.label),
          data: option.value,
        })),
      },
    ],
    [t],
  )
  const stablePoolTypeSelectedValues = useMemo(() => {
    const childValues = STABLE_POOL_OPTIONS.map((option) => option.value)
    const allChildrenSelected =
      childValues.length > 0 && childValues.every((value) => stablePoolTypeQuery.includes(value))
    return allChildrenSelected ? ['stableSwapPoolType', ...stablePoolTypeQuery] : stablePoolTypeQuery
  }, [stablePoolTypeQuery])
  const stablePoolType = useMemo(
    () => fromSelectedNodes(stablePoolTypeData, stablePoolTypeSelectedValues),
    [stablePoolTypeData, stablePoolTypeSelectedValues],
  )

  const [clOnly, binOnly] = useMemo(() => {
    const queries = (Array.isArray(poolTypeQuery) ? poolTypeQuery : [poolTypeQuery]).filter(
      (p) => typeof p === 'string',
    )
    const protocols = queries.filter((p) => ALL_PROTOCOLS.includes(p as Protocol))

    if (protocols.length !== 1) {
      return [false, false]
    }
    return [protocols[0] === Protocol.InfinityCLAMM, protocols[0] === Protocol.InfinityBIN]
  }, [poolTypeQuery])

  const fetchQueries = useMemo(() => {
    if (!chainId) {
      return {}
    }

    let protocols = isStableMode
      ? [Protocol.STABLE, Protocol.InfinitySTABLE]
      : [...INFINITY_PROTOCOLS, Protocol.InfinitySTABLE]
    if (isStableMode) {
      protocols = []
      if (stablePoolTypeQuery.includes(STABLE_POOL_TYPE.classic)) {
        protocols.push(Protocol.STABLE)
      }
    } else {
      if (clOnly) {
        protocols = [Protocol.InfinityCLAMM]
      }
      if (binOnly) {
        protocols = [Protocol.InfinityBIN]
      }
    }
    return {
      tokens: [toTokenValue({ chainId, address: currencyIdA }), toTokenValue({ chainId, address: currencyIdB })],
      chains: [chainId],
      orderBy: PoolSortBy.VOL,
      protocols,
      pageNo: nextPage,
    } as FetchPoolsProps
  }, [binOnly, chainId, clOnly, currencyIdA, currencyIdB, isStableMode, nextPage, stablePoolTypeQuery])

  const { isLoading, data: poolList, pageNo, resetExtendPools, hasNextPage } = useFetchPools(fetchQueries, !!chainId)

  useEffect(() => {
    resetExtendPools()
    // NOTE: ignore exhaustive-deps, we just reset on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNetworkChange = useCallback(
    (chain: Chain) => {
      updateParams({ chainId: chain.id })
    },
    [updateParams],
  )

  const handleToken0Change = useCallback(
    (currency: UnifiedCurrency) => {
      const newCurrencyIdA = getCurrencyAddress(currency)
      if (newCurrencyIdA === currencyIdB) {
        updateParams({ currencyIdA: currencyIdB, currencyIdB: currencyIdA })
      } else {
        updateParams({ currencyIdA: newCurrencyIdA })
      }
    },
    [updateParams, currencyIdA, currencyIdB],
  )

  const handleToken1Change = useCallback(
    (currency: UnifiedCurrency) => {
      const newCurrencyIdB = getCurrencyAddress(currency)
      if (newCurrencyIdB === currencyIdA) {
        updateParams({ currencyIdA: currencyIdB, currencyIdB: currencyIdA })
      } else {
        updateParams({ currencyIdB: newCurrencyIdB })
      }
    },
    [updateParams, currencyIdA, currencyIdB],
  )

  const handleRowClick = useCallback(
    async (pool: InfinityPoolInfo) => {
      const poolProtocol = pool.protocol as Protocol | string
      if (poolProtocol === Protocol.STABLE) {
        const baseToken = getCurrencyAddress((pool as any).token0)
        const quoteToken = getCurrencyAddress((pool as any).token1)
        const queryParams = new URLSearchParams({
          chain: CHAIN_QUERY_NAME[(pool as any).chainId],
          persistChain: '1',
        })
        nextRouter.push(`/stable/add/${baseToken}/${quoteToken}?${queryParams.toString()}`)
        return
      }
      if (pool.protocol === Protocol.InfinitySTABLE) {
        const infinityStableHookAddress = pool.hookAddress ?? pool.poolId
        nextRouter.push(
          `/infinityStable/add/${infinityStableHookAddress}?chain=${CHAIN_QUERY_NAME[pool.chainId]}&persistChain=1`,
        )
        return
      }
      const link = await getPoolDetailPageLink(pool)
      nextRouter.push(link)
    },
    [nextRouter],
  )

  const handleStablePoolTypeChange = useCallback(
    (e) => {
      if (!e.value || Object.keys(e.value).length === 0) {
        setStablePoolType([])
        return
      }
      const values = toSelectedNodes(stablePoolTypeData, e.value)
        .map((node) => node.data)
        .filter((v): v is string => v === STABLE_POOL_TYPE.classic)
      setStablePoolType(values)
    },
    [setStablePoolType, stablePoolTypeData],
  )

  const getRowKey = useCallback((item: InfinityPoolInfo) => {
    return [item.chainId, item.protocol, item.pid, item.poolId].join(':')
  }, [])

  const { features, protocols, isSelectAllFeatures, isSelectAllProtocols } = usePoolFeatureAndType()

  const filteredData = useMemo(
    () =>
      (poolList as InfinityPoolInfo[]).filter((pool) => {
        const isMatchedChain = pool.chainId === chainId

        const isMatchedCurrency =
          (currencyIdA === getCurrencyAddress(pool.token0) && currencyIdB === getCurrencyAddress(pool.token1)) ||
          (currencyIdA === getCurrencyAddress(pool.token1) && currencyIdB === getCurrencyAddress(pool.token0))

        let isMatchedProtocol = protocols.length === 0 || isSelectAllProtocols

        if (!isMatchedProtocol && protocols.includes(pool.protocol)) {
          isMatchedProtocol = true
        }

        const hookData = getHookByAddress(chainId, pool.hookAddress)
        const hasWhitelistHook = !pool.hookAddress || isAddressEqual(pool.hookAddress, zeroAddress) ? true : !!hookData

        if (features.length === 0 || isSelectAllFeatures) {
          return isMatchedChain && isMatchedCurrency && isMatchedProtocol && hasWhitelistHook
        }

        const isMatchedPoolFeatures = hookData && features.some((q) => hookData.category?.includes(q as HOOK_CATEGORY))

        return isMatchedChain && isMatchedCurrency && isMatchedProtocol && isMatchedPoolFeatures
      }),
    [poolList, currencyIdA, currencyIdB, chainId, features, protocols, isSelectAllFeatures, isSelectAllProtocols],
  )

  useEffect(() => {
    if (isIntersecting) {
      setCursorVisible((numberCurrentlyVisible) => {
        if (hasNextPage && filteredData.length < cursorVisible) {
          return filteredData.length
        }
        if (numberCurrentlyVisible <= filteredData.length) {
          return Math.min(numberCurrentlyVisible + NUMBER_OF_FARMS_VISIBLE, filteredData.length)
        }
        return numberCurrentlyVisible
      })
    }
  }, [isIntersecting, filteredData.length])

  useEffect(() => {
    if (isLoading) {
      return
    }
    setNextPage(cursorVisible >= filteredData.length ? pageNo + 1 : pageNo)
  }, [cursorVisible, filteredData.length, pageNo, isLoading])

  const dataByChain = useMemo(() => {
    return groupBy(filteredData, 'chainId')
  }, [filteredData])

  const { orderedChainIds, activeChainId, othersChains } = useOrderChainIds()

  // default sorting logic: https://linear.app/pancakeswap/issue/PAN-3669/default-sorting-logic-update-for-pair-list
  const sortedData = useMemo(() => {
    // active Farms: current chain -> other chains
    // ordered by farm config list
    const activeFarms = flatMap(orderedChainIds, (_chainId) =>
      dataByChain[_chainId]?.filter((pool) => !!pool.isActiveFarm),
    )
    // inactive Farms: current chain
    // ordered by tvlUsd
    const inactiveFarmsOfActiveChain =
      dataByChain[activeChainId]
        ?.filter((pool) => !pool.isActiveFarm)
        .sort((a, b) =>
          'tvlUsd' in a && 'tvlUsd' in b && b.tvlUsd && a.tvlUsd ? Number(b.tvlUsd) - Number(a.tvlUsd) : 1,
        ) ?? []
    // inactive Farms: other chains
    // ordered by tvlUsd
    const inactiveFarmsOfOthers = flatMap(othersChains, (_chainId) =>
      dataByChain[_chainId]?.filter((pool) => !pool.isActiveFarm),
    ).sort((a, b) => ('tvlUsd' in a && 'tvlUsd' in b && b.tvlUsd && a.tvlUsd ? Number(b.tvlUsd) - Number(a.tvlUsd) : 1))

    return [...activeFarms, ...inactiveFarmsOfActiveChain, ...inactiveFarmsOfOthers].filter(Boolean)
  }, [orderedChainIds, activeChainId, othersChains, dataByChain])

  const renderData = useMemo(() => sortedData.slice(0, cursorVisible), [cursorVisible, sortedData])
  const createInfinityPoolUrl = useMemo(
    () =>
      getCreateInfinityPoolPageURL({
        chainId,
        token0: currencyIdA as Address,
        token1: currencyIdB as Address,
      }),
    [chainId, currencyIdA, currencyIdB],
  )
  const createInfinityStablePoolUrl = useMemo(() => {
    if (!chainId || !currencyIdA || !currencyIdB) {
      return '/liquidity/create'
    }
    const chainName = CHAIN_QUERY_NAME[chainId]
    return `/liquidity/create/${chainName}/stableSwap/${currencyIdA}/${currencyIdB}?chain=${chainName}&persistChain=1`
  }, [chainId, currencyIdA, currencyIdB])

  return (
    <>
      <PoolsHead>
        <Heading as="h3">{isStableMode ? t('Add Stable Liquidity') : t('Add Infinity Liquidity')}</Heading>
        {isStableMode && chainId === ChainId.BSC ? (
          <NextLink href={createInfinityStablePoolUrl}>
            <Button variant="secondary" scale="md">
              {t('Create Infinity Stable Pool')}
            </Button>
          </NextLink>
        ) : !isStableMode ? (
          <NextLink href={createInfinityPoolUrl}>
            <Button variant="secondary" scale="md">
              {t('Create Infinity Pool')}
            </Button>
          </NextLink>
        ) : null}
      </PoolsHead>
      <Card marginTop={['16px', '24px']}>
        <CardHeader>
          <FilterContainer gridGap={24} gridTemplateColumns={['1fr', '1fr', '1fr', '1fr 1fr 1fr']}>
            <NetworkSelector
              version={isStableMode ? LiquidityType.StableSwap : LiquidityType.Infinity}
              chainId={chainId}
              onChange={handleNetworkChange}
            />
            <TokenFilterContainer>
              <CurrencySelectV2
                id="add-liquidity-select-tokenA"
                chainId={chainId}
                selectedCurrency={selectedTokenA}
                onCurrencySelect={handleToken0Change}
                showCommonBases
                commonBasesType={CommonBasesType.LIQUIDITY}
                hideBalance
                showNative
              />
              <AddIcon color="textSubtle" />
              <CurrencySelectV2
                id="add-liquidity-select-tokenB"
                chainId={chainId}
                selectedCurrency={selectedTokenB}
                onCurrencySelect={handleToken1Change}
                showCommonBases
                commonBasesType={CommonBasesType.LIQUIDITY}
                hideBalance
                showNative
              />
            </TokenFilterContainer>
            {isStableMode ? (
              <PoolTypeFilter data={stablePoolTypeData} value={stablePoolType} onChange={handleStablePoolTypeChange} />
            ) : (
              <PoolTypeFilter data={poolTypeData} value={poolType} onChange={(e) => setPoolType(e.value)} />
            )}
          </FilterContainer>
        </CardHeader>
        <CardBody>
          <PoolsContent>
            {isMobile ? (
              <ListView data={renderData} getItemKey={getRowKey} />
            ) : (
              <TableView getRowKey={getRowKey} columns={columns} data={renderData} onRowClick={handleRowClick} />
            )}
          </PoolsContent>
          {poolList.length > 0 && <div ref={observerRef} />}
        </CardBody>
      </Card>
    </>
  )
}
