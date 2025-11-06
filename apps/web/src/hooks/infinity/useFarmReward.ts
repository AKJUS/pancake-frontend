import { ChainId } from '@pancakeswap/chains'
import { FARMING_OFFCHAIN_ABI, INFI_FARMING_DISTRIBUTOR_ADDRESSES } from '@pancakeswap/infinity-sdk'
import { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { getTokenByAddress } from '@pancakeswap/tokens'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { useQuery } from '@tanstack/react-query'
import BN, { BigNumber } from 'bignumber.js'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import dayjs from 'dayjs'
import { useCakePrice } from 'hooks/useCakePrice'
import groupBy from 'lodash/groupBy'
import map from 'lodash/map'
import { useMemo } from 'react'
import { rewardApiClient } from 'state/farmsV4/api/client'
import { operations } from 'state/farmsV4/api/schema'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { chainIdToExplorerInfoChainName, explorerApiClient } from 'state/info/api/client'
import { getViemClients } from 'utils/viem'
import { Address } from 'viem'

const FETCH_OPTIONS = {
  ...QUERY_SETTINGS_IMMUTABLE,
  retry: 9,
  retryDelay: 1000,
}

interface PoolFarmRewardsProps {
  chainId?: number
  address?: Address
  poolId?: string
  timestamp?: number
  signal?: AbortSignal
}

const fetchUserFarmRewards = async ({ chainId, address, poolId, timestamp, signal }: PoolFarmRewardsProps) => {
  if (!(chainId && address)) {
    return []
  }
  const path: operations['getPoolFarmRewards']['parameters']['path'] = {
    chainId,
    address,
  }
  if (poolId && timestamp) {
    path.poolId = poolId
    path.timestamp = timestamp.toString()
  }
  const resp = await rewardApiClient.GET(
    poolId ? '/farms/user-rewards/{chainId}/{address}/{poolId}/{timestamp}' : '/farms/user-rewards/{chainId}/{address}',
    {
      // @todo @ChefJerry remove this after the backend is ready
      baseUrl:
        chainId === ChainId.BSC_TESTNET ? 'https://test.v4.pancakeswap.com/' : 'https://infinity.pancakeswap.com/',
      params: {
        path,
      },
      signal,
    },
  )

  return resp.data?.rewardsInfo ?? []
}

interface UserClaimedRewardsProps {
  chainId?: number
  address?: Address
  signal?: AbortSignal
}
const fetchUserClaimedRewards = async ({ chainId, address, signal }: UserClaimedRewardsProps) => {
  if (!(chainId && address)) {
    return []
  }
  const chainName = chainIdToExplorerInfoChainName[chainId]
  if (!chainName) {
    return []
  }
  const resp = await explorerApiClient.GET('/cached/pools/infinity/{chainName}/claim/{address}', {
    params: {
      path: {
        chainName,
        address,
      },
    },
    signal,
  })
  return resp.data ?? []
}

interface FetchMerkleRootByTimestampProps {
  chainId?: number
  timestamp?: string
  signal?: AbortSignal
}
const fetchMerkleRootByTimestamp = async ({ chainId, timestamp, signal }: FetchMerkleRootByTimestampProps) => {
  if (!(chainId && timestamp)) {
    return undefined
  }
  let resp = await rewardApiClient.GET('/farms/root/{chainId}/{timestamp}', {
    params: {
      path: {
        chainId,
        timestamp,
      },
    },
    signal,
  })
  if (!resp.data?.epochEndTimestamp) {
    resp = await rewardApiClient.GET('/farms/epoch-root/{chainId}/{timestamp}', {
      params: {
        path: {
          chainId,
          timestamp,
        },
      },
      signal,
    })
  }
  return resp.data ?? undefined
}

export const usePoolFarmRewardsFormAPI = ({ chainId, address, poolId, timestamp }: PoolFarmRewardsProps) => {
  return useQuery({
    queryKey: ['poolFarmRewards', chainId, address, poolId, timestamp],
    queryFn: ({ signal }) => fetchUserFarmRewards({ chainId, address, poolId, timestamp, signal }),
    enabled: !!(chainId && address && timestamp),
    ...FETCH_OPTIONS,
  })
}

const useClaimedRewardsFromAPI = ({ chainId, address }: UserClaimedRewardsProps) => {
  const [latestTxReceipt] = useLatestTxReceipt()
  const { data: claimedHistory } = useQuery({
    queryKey: ['ClaimedRewardsFromAPI', chainId, address, latestTxReceipt?.blockHash],
    queryFn: ({ signal }) => fetchUserClaimedRewards({ chainId, address, signal }),
    enabled: !!(chainId && address),
    ...FETCH_OPTIONS,
  })
  const latestClaimedTimestamp = claimedHistory?.[0]?.timestamp

  const { data: merkleRoot } = useQuery({
    queryKey: ['fetchMerkleRootByTimestamp', chainId, address, latestClaimedTimestamp],
    queryFn: ({ signal }) =>
      fetchMerkleRootByTimestamp({
        chainId,
        timestamp: (Math.floor(new Date(latestClaimedTimestamp!.toString()).getTime() / 1000) - 1).toString(),
        signal,
      }),
    enabled: !!(chainId && latestClaimedTimestamp),
    ...FETCH_OPTIONS,
  })

  return merkleRoot
}

type FarmRewardsFromAPIByChainsProps = {
  chainIds?: number[]
  address?: Address
}
export const useFarmRewardsFromAPIByChains = ({ chainIds = [], address }: FarmRewardsFromAPIByChainsProps) => {
  const [latestTxReceipt] = useLatestTxReceipt()
  const { data } = useQuery({
    queryKey: ['poolFarmRewards', ...chainIds, address, latestTxReceipt?.blockHash],
    queryFn: async ({ signal }) => {
      const result = await Promise.allSettled(
        chainIds.map((chainId) => fetchUserFarmRewards({ chainId, address, signal })),
      )
      return chainIds.reduce<Record<number, Awaited<ReturnType<typeof fetchUserFarmRewards>>>>((acc, id, idx) => {
        const rewards = result[idx]
        if (rewards.status === 'fulfilled') {
          // eslint-disable-next-line no-param-reassign
          acc[id] = rewards.value
        }
        return acc
      }, {})
    },
    enabled: !!(chainIds.length && address),
    ...FETCH_OPTIONS,
  })

  return data
}

const useUserAllClaimedRewardsFromChain = ({
  chainId,
  rewardTokens,
  user,
}: {
  chainId?: number
  rewardTokens?: Address[]
  user?: Address
}) => {
  const [latestTxReceipt] = useLatestTxReceipt()
  return useQuery<Record<Address, bigint>>({
    queryKey: ['userAllClaimedRewards', chainId, user, latestTxReceipt?.blockHash],
    queryFn: async () => {
      if (!(chainId && user && rewardTokens?.length)) {
        return 0n
      }
      const calls = rewardTokens.map(
        (token) =>
          ({
            abi: FARMING_OFFCHAIN_ABI,
            address: INFI_FARMING_DISTRIBUTOR_ADDRESSES[chainId] as Address,
            functionName: 'claimedAmounts',
            args: [token, user] as const,
          } as const),
      )
      const resp = await getViemClients({ chainId }).multicall({
        contracts: calls,
        allowFailure: true,
      })
      return rewardTokens.reduce((acc, token, idx) => {
        if (resp[idx]?.result) {
          Object.assign(acc, {
            [token]: resp[idx].result,
          })
        }
        return acc
      }, {})
    },
    enabled: !!(chainId && user && rewardTokens),
    ...FETCH_OPTIONS,
  })
}

const getRewardsMap = (data?: Awaited<ReturnType<typeof fetchUserFarmRewards>>, tokenId?: bigint) => {
  return data?.reduce<Record<string, string>>((acc, r) => {
    r.tokenIds.forEach((tId, idx) => {
      if (tokenId && tId !== tokenId?.toString()) {
        return
      }
      const key = `${r.poolId}-${r.campaignId}-${tId}`
      // eslint-disable-next-line no-param-reassign
      acc[key] = r.rewardAmounts[idx]
    })
    return acc
  }, {})
}

const useUnclaimedRewards = ({
  chainId,
  address,
  poolId,
  tokenId,
  timestamp,
}: PoolFarmRewardsProps & { tokenId?: bigint }) => {
  const { data: rewards, isLoading } = usePoolFarmRewardsFormAPI({ chainId, address, poolId, timestamp })
  const claimedHistory = useClaimedRewardsFromAPI({ chainId, address })
  const { data: rewardsBeforeLastClaimed, isLoading: isLoadingBLC } = usePoolFarmRewardsFormAPI({
    chainId,
    address,
    poolId,
    timestamp: claimedHistory?.epochEndTimestamp ? Number(claimedHistory?.epochEndTimestamp) : undefined,
  })

  const rewardsOfTokenId = useMemo(
    () => (tokenId ? rewards?.filter((item) => item.tokenIds.includes(tokenId.toString())) : rewards),
    [rewards, tokenId],
  )
  const rewardsMap = useMemo(() => getRewardsMap(rewardsOfTokenId, tokenId), [rewardsOfTokenId, tokenId])
  const rewardsBeforeLastClaimedMap = useMemo(
    () =>
      getRewardsMap(
        tokenId
          ? rewardsBeforeLastClaimed?.filter((item) => item.tokenIds.includes(tokenId.toString()))
          : rewardsBeforeLastClaimed,
        tokenId,
      ),
    [rewardsBeforeLastClaimed, tokenId],
  )

  const currency =
    chainId && rewardsOfTokenId?.[0]?.rewardTokenAddress
      ? getTokenByAddress(chainId, rewardsOfTokenId?.[0].rewardTokenAddress)
      : undefined

  return {
    rewardsMap,
    rewardsBeforeLastClaimedMap,
    currency,
    isLoading: isLoading || isLoadingBLC,
  }
}

const useUnclaimedFarmRewardsAmountByPoolId = ({ chainId, address, poolId, timestamp }: PoolFarmRewardsProps) => {
  const { currency, rewardsBeforeLastClaimedMap, rewardsMap, isLoading } = useUnclaimedRewards({
    chainId,
    address,
    poolId,
    timestamp,
  })

  return useMemo(() => {
    if (!currency || !rewardsMap) {
      return { data: undefined, isLoading }
    }

    return {
      data: CurrencyAmount.fromRawAmount(
        currency,
        Object.keys(rewardsMap)
          .reduce(
            (acc, key) => new BN(rewardsMap[key]).minus(rewardsBeforeLastClaimedMap?.[key] ?? 0).plus(acc),
            BIG_ZERO,
          )
          .toNumber(),
      ),
      isLoading,
    }
  }, [isLoading, currency, rewardsMap, rewardsBeforeLastClaimedMap])
}

const useUnclaimedFarmRewardsAmountByTokenId = ({
  chainId,
  address,
  poolId,
  tokenId,
  timestamp,
}: PoolFarmRewardsProps & { tokenId?: bigint }) => {
  const { currency, rewardsBeforeLastClaimedMap, rewardsMap, isLoading } = useUnclaimedRewards({
    chainId,
    address,
    poolId,
    tokenId,
    timestamp,
  })
  return useMemo(() => {
    if (!currency || !rewardsMap) {
      return { data: undefined, isLoading }
    }

    return {
      isLoading,
      data: CurrencyAmount.fromRawAmount<Currency>(
        currency,
        Object.keys(rewardsMap)
          .reduce((acc, key) => {
            return new BN(rewardsMap[key] ?? 0).minus(rewardsBeforeLastClaimedMap?.[key] ?? 0).plus(acc)
          }, BIG_ZERO)
          .toNumber(),
      ),
    }
  }, [currency, rewardsBeforeLastClaimedMap, rewardsMap, isLoading])
}

export const useUnclaimedFarmRewardsUSDByPoolId = ({ chainId, address, poolId, timestamp }: PoolFarmRewardsProps) => {
  const { data: rewardsAmount, isLoading } = useUnclaimedFarmRewardsAmountByPoolId({
    chainId,
    address,
    poolId,
    timestamp,
  })
  return { data: useFarmRewardsUSD(rewardsAmount), isLoading }
}

export const useUnclaimedFarmRewardsUSDByTokenId = ({
  chainId,
  address,
  poolId,
  tokenId,
  timestamp,
}: PoolFarmRewardsProps & { tokenId?: bigint }) => {
  const { data: rewardsAmount, isLoading } = useUnclaimedFarmRewardsAmountByTokenId({
    chainId,
    address,
    poolId,
    tokenId,
    timestamp,
  })
  return { isLoading, data: useFarmRewardsUSD(rewardsAmount) }
}

const useFarmRewardsUSD = (rewardsAmount?: CurrencyAmount<Currency>) => {
  const cakePrice = useCakePrice()
  return useMemo(() => {
    return {
      rewardsAmount,
      rewardsUSD: new BN(rewardsAmount?.toExact() ?? 0).times(cakePrice.toString()).toNumber(),
    }
  }, [cakePrice, rewardsAmount])
}

interface UserFarmRewardsProps {
  chainId?: number
  user?: Address
  timestamp?: number
}
export const useUserAllFarmRewardsByChainIdFromAPI = ({ chainId, user, timestamp }: UserFarmRewardsProps) => {
  const { data: allRewards } = useQuery({
    queryKey: ['userAllFarmRewards', chainId, user, timestamp],
    queryFn: async ({ signal }) => {
      if (!(chainId && user)) {
        return []
      }
      const resp = await rewardApiClient.GET('/farms/users/{chainId}/{address}/{timestamp}', {
        // @todo @ChefJerry remove this after the backend is ready
        baseUrl:
          chainId === ChainId.BSC_TESTNET ? 'https://test.v4.pancakeswap.com/' : 'https://infinity.pancakeswap.com/',
        params: {
          path: {
            chainId,
            address: user,
            timestamp: timestamp?.toString() ?? Math.floor(Date.now() / 1000).toString(),
          },
        },
        signal,
      })

      return resp.data?.rewards ?? []
    },
    enabled: !!(chainId && user),
    ...FETCH_OPTIONS,
  })

  const rewardTokens = useMemo(() => allRewards?.map((i) => i.rewardTokenAddress), [allRewards])

  const { data: claimedRewards } = useUserAllClaimedRewardsFromChain({
    chainId,
    user,
    rewardTokens,
  })

  const totalUnclaimedRewards = useMemo(
    () =>
      chainId
        ? map(groupBy(allRewards, 'rewardTokenAddress'), (items) => {
            const rewardTokenAddress = items[0]?.rewardTokenAddress
            const currency = getTokenByAddress(chainId, rewardTokenAddress)
            if (!currency) {
              return {
                rewardTokenAddress,
                totalReward: '0',
              }
            }
            const claimedAmount = CurrencyAmount.fromRawAmount(currency, claimedRewards?.[rewardTokenAddress] ?? 0n)
            const totalReward = items
              .reduce(
                (acc, item) =>
                  CurrencyAmount.fromRawAmount(currency, item.totalRewardAmount).add(acc).subtract(claimedAmount),
                CurrencyAmount.fromRawAmount(currency, 0),
              )
              .toExact()
            return {
              rewardTokenAddress: items[0].rewardTokenAddress,
              totalReward,
            }
          })
        : [],
    [chainId, allRewards, claimedRewards],
  )

  return useMemo(
    () => ({
      allRewards,
      totalUnclaimedRewards,
    }),
    [allRewards, totalUnclaimedRewards],
  )
}

const formatRewardsMap = (data?: Awaited<ReturnType<typeof fetchUserFarmRewards>>) => {
  return data?.reduce((acc, reward) => {
    reward.tokenIds.forEach((tokenId, index) => {
      const currentAmount = acc[tokenId] ? BigInt(acc[tokenId]) : BigInt(0)
      // eslint-disable-next-line no-param-reassign
      acc[tokenId] = (currentAmount + BigInt(reward.rewardAmounts[index])).toString()
    })
    return acc
  }, {} as Record<string, string>)
}

export const useFarmRewardsByPoolId = ({ chainId, address, poolId }: PoolFarmRewardsProps) => {
  const timestamp = dayjs().startOf('minute').unix()
  const { data: rewards } = usePoolFarmRewardsFormAPI({ chainId, address, poolId, timestamp })
  const { data: previousRewards } = usePoolFarmRewardsFormAPI({
    chainId,
    address,
    poolId,
    timestamp: rewards?.[0]?.epochEndTimestamp ? Number(rewards?.[0]?.epochEndTimestamp) - 1 : undefined,
  })
  const rewardsMap = useMemo(() => formatRewardsMap(rewards), [rewards])
  const previousRewardsMap = useMemo(() => formatRewardsMap(previousRewards), [previousRewards])
  return useMemo(() => {
    if (!(rewardsMap && Object.keys(rewardsMap).length)) {
      return undefined
    }
    return Object.keys(rewardsMap).reduce<{ [k: string]: BigNumber }>((acc, k) => {
      // eslint-disable-next-line no-param-reassign
      acc[k] = new BN(rewardsMap[k]).minus(previousRewardsMap?.[k] ?? 0)
      return acc
    }, {})
  }, [rewardsMap, previousRewardsMap])
}
