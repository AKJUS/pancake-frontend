import { Protocol } from '@pancakeswap/farms'
import { Token } from '@pancakeswap/swap-sdk-core'
import { computePoolAddress, DEPLOYER_ADDRESSES, FeeAmount } from '@pancakeswap/v3-sdk'
import { useQuery } from '@tanstack/react-query'
import { isEvm, isSolana } from '@pancakeswap/chains'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import { useCurrencyByChainId } from 'hooks/Tokens'
import isEqual from 'lodash/isEqual'
import memoize from 'lodash/memoize'
import { useCallback, useMemo, useState } from 'react'
import { Address } from 'viem/accounts'
import { useSolanaPoolInfo } from 'views/PoolDetail/hooks/useSolanaPoolInfo'

import { safeGetAddress } from 'utils'
import { useLatestTxReceipt } from '../accountPositions/hooks/useLatestTxReceipt'
import type { PoolInfo } from '../type'
import { DEFAULT_QUERIES, ExtendPoolsQuery, FetchPoolsProps, useExtendPoolsAtom } from './atom'
import {
  fetchExplorerPoolInfo,
  fetchExplorerPoolsList,
  queryInfinityPoolInfoOnChain,
  queryV3PoolInfoOnChain,
} from './fetcher'

const RESET_QUERY_KEYS = ['protocols', 'orderBy', 'chains', 'pools', 'tokens'] as Array<keyof ExtendPoolsQuery>

export const useFetchPools = (queries: FetchPoolsProps, enabled = true) => {
  const { chains = [], tokens = [], protocols = [], pageNo } = queries
  const [hasNextPage, setHasNextPage] = useState(true)
  const { fetchPoolList, extendPools, paginator, resetExtendPools } = useExtendPools()
  const queryKey = useMemo(
    () => ['useFetchPools', ...chains, ...tokens, ...protocols, !hasNextPage ? paginator.size : pageNo],
    [chains, tokens, protocols, pageNo, hasNextPage, paginator.size],
  )
  const { isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const nextPage = await fetchPoolList({
        chains,
        tokens,
        protocols,
      })
      setHasNextPage(!!nextPage)
      return extendPools
    },
    enabled,
    retry: false,
    ...QUERY_SETTINGS_IMMUTABLE,
  })
  return {
    pageNo: paginator.size,
    data: extendPools,
    hasNextPage,
    isLoading,
    resetExtendPools,
  }
}

export const useExtendPools = () => {
  const [query, _setQuery] = useState<ExtendPoolsQuery>(DEFAULT_QUERIES)
  const { pools: extendPools, setPools } = useExtendPoolsAtom()
  const [pageEnd, setPageEnd] = useState(false)
  const paginator = useMemo(() => new Set(), [])
  const emptyList = useMemo(() => [] as PoolInfo[], [])

  const fetchPoolList = useCallback(
    async (newQuery: Partial<ExtendPoolsQuery>) => {
      const mergedQueries = {
        ...query,
        ...newQuery,
      } as Required<ExtendPoolsQuery>

      _setQuery(mergedQueries)

      const shouldReset = RESET_QUERY_KEYS.some((key) => !isEqual(mergedQueries[key], query[key]))

      if (pageEnd && !shouldReset) {
        return false
      }
      if (shouldReset) {
        setPageEnd(false)
        mergedQueries.after = ''
        paginator.clear()
      }

      const { pools, endCursor, hasNextPage } = await fetchExplorerPoolsList(mergedQueries)

      setPageEnd(!hasNextPage)
      paginator.add(endCursor)
      setPools(pools.length ? pools : emptyList, shouldReset)
      _setQuery({ ...mergedQueries, after: endCursor ?? '' })

      return hasNextPage
    },
    [_setQuery, pageEnd, query, setPools, emptyList, paginator],
  )

  const resetExtendPools = useCallback(
    (defaultQueries = DEFAULT_QUERIES) => {
      if (extendPools.length) {
        setPools([], true)
      }
      setPageEnd(false)
      _setQuery(defaultQueries)
    },
    [_setQuery, setPageEnd, setPools, extendPools],
  )

  return {
    extendPools,
    fetchPoolList,
    resetExtendPools,
    paginator,
    pageEnd,
  }
}

export function getKeyForPools({
  chainId,
  poolAddress,
  protocol,
  tokenId,
}: {
  chainId: number
  poolAddress?: Address | string
  protocol?: Protocol
  tokenId?: string | bigint
}) {
  return `${chainId}:${poolAddress}:${protocol ?? ''}:${tokenId ?? ''}`
}

export const getPoolAddressByToken = memoize(
  (chainId: number, token0Address: Address, token1Address: Address, fee: FeeAmount) => {
    const deployerAddress = DEPLOYER_ADDRESSES[chainId]
    const token0 = new Token(chainId, token0Address, 18, '')
    const token1 = new Token(chainId, token1Address, 18, '')
    if (!token0 || !token1) {
      return undefined
    }
    return computePoolAddress({
      deployerAddress,
      tokenA: token0,
      tokenB: token1,
      fee,
    })
  },
  (chainId: number, token0Address: Address, token1Address: Address, fee: FeeAmount) =>
    `${chainId}#${token0Address}#${token1Address}#${fee}`,
)

export const usePoolInfo = <TPoolType extends PoolInfo>({
  poolAddress: poolAddress_,
  chainId,
}: {
  poolAddress: string | undefined
  chainId: number | undefined
}): TPoolType | undefined | null => {
  const [latestTxReceipt] = useLatestTxReceipt()
  const isEvmChain = isEvm(chainId)
  const poolAddress = poolAddress_ && isEvmChain ? safeGetAddress(poolAddress_) ?? poolAddress_ : poolAddress_
  const { data: solanaPoolInfo } = useSolanaPoolInfo(poolAddress, chainId)

  const { data: evmPoolInfo } = useQuery({
    queryKey: ['poolInfo', chainId, poolAddress, latestTxReceipt?.blockHash],
    queryFn: async () => {
      let result
      if (!poolAddress || !chainId) {
        return result
      }
      try {
        result = await fetchExplorerPoolInfo(poolAddress ?? '', chainId)
      } catch (error) {
        console.warn('error fetch from api', error)

        // Check infinity poolId
        if (!safeGetAddress(poolAddress)) {
          result = await queryInfinityPoolInfoOnChain(poolAddress ?? '', chainId).catch((e) => {
            console.warn('error [usePoolInfo] queryInfinityPoolInfoOnChain', e)
            return null
          })
        } else {
          result = await queryV3PoolInfoOnChain(poolAddress ?? '', chainId).catch((e) => {
            console.warn('error [usePoolInfo] queryV3PoolInfoOnChain', e)
            return null
          })
        }
      }

      if (!result) {
        throw new Error('no pool found')
      }
      return result
    },
    enabled: !!poolAddress && !!chainId && isEvmChain,
    retryDelay: 1000,
    retry: 10,
    ...QUERY_SETTINGS_IMMUTABLE,
  })

  const token0 = useCurrencyByChainId(evmPoolInfo?.token0?.address, chainId) ?? undefined
  const token1 = useCurrencyByChainId(evmPoolInfo?.token1?.address, chainId) ?? undefined

  return useMemo(() => {
    if (evmPoolInfo && !evmPoolInfo.token0?.symbol && token0) {
      evmPoolInfo.token0 = token0
    }
    if (evmPoolInfo && !evmPoolInfo.token1?.symbol && token1) {
      evmPoolInfo.token1 = token1
    }

    return (isSolana(chainId) ? solanaPoolInfo : evmPoolInfo) as TPoolType | undefined | null
  }, [chainId, evmPoolInfo, solanaPoolInfo, token0, token1])
}
