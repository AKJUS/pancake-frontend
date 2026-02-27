import { Protocol } from '@pancakeswap/farms'
import { getPoolId } from '@pancakeswap/infinity-sdk'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { usePositionsWithFarming } from 'hooks/infinity/useIsFarming'
import { useCallback, useMemo } from 'react'
import { getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import { isAddressEqual } from 'utils'
import { isInfinityProtocol } from 'utils/protocols'
import { Address, Hex } from 'viem'

import { SLOW_INTERVAL } from 'config/constants'
import { InfinityCLPoolInfo, PoolInfo } from '../../type'
import { getAccountV2LpDetails, getStablePairDetails } from '../fetcher'
import { getAccountInfinityCLPositionsWithFallback, getAccountInfinityStablePositionDetails } from '../fetcher/infinity'
import { getAccountInfinityBinPositionByPoolId } from '../fetcher/infinity/getAccountInfinityBinPositionByPoolId'
import { getAccountV3Positions } from '../fetcher/v3'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  PositionDetail,
  StableLPDetail,
  V2LPDetail,
} from '../type'
import { useLatestTxReceipt } from './useLatestTxReceipt'
import { useStableSwapPairsByChainId } from './useStableSwapPairsByChainId'

type PoolPositionDetail = {
  [Protocol.STABLE]: StableLPDetail
  [Protocol.V2]: V2LPDetail
  [Protocol.InfinitySTABLE]: StableLPDetail
  [Protocol.V3]: PositionDetail[]
  [Protocol.InfinityCLAMM]: InfinityCLPositionDetail[]
  [Protocol.InfinityBIN]: InfinityBinPositionDetail[]
}

type InfinityPositionDetails = (InfinityCLPositionDetail | InfinityBinPositionDetail)[]

export const useAccountPositionDetailByPool = <TProtocol extends keyof PoolPositionDetail>(
  chainId: number,
  account?: Address | null,
  poolInfo?: PoolInfo,
): UseQueryResult<PoolPositionDetail[TProtocol]> => {
  const [currency0, currency1] = useMemo(() => {
    if (!poolInfo) return [undefined, undefined]
    const { token0, token1 } = poolInfo
    return [token0.wrapped, token1.wrapped]
  }, [poolInfo])
  const pairs = useStableSwapPairsByChainId(chainId, poolInfo?.protocol === 'stable')
  const [latestTxReceipt] = useLatestTxReceipt()

  const result: UseQueryResult<PoolPositionDetail[TProtocol]> = useQuery({
    queryKey: [
      'accountPosition',
      account,
      chainId,
      poolInfo?.lpAddress,
      poolInfo?.protocol,
      latestTxReceipt?.blockHash,
    ],
    queryFn: async () => {
      if (poolInfo?.protocol === Protocol.V2) {
        return getAccountV2LpDetails(
          chainId,
          account!,
          currency0 && currency1 ? [[currency0.wrapped, currency1.wrapped]] : [],
        )
      }
      if (poolInfo?.protocol === Protocol.STABLE) {
        const stablePair = pairs.find((pair) => {
          return isAddressEqual(pair.stableSwapAddress, poolInfo?.stableSwapAddress as Address)
        })
        return getStablePairDetails(chainId, account!, stablePair ? [stablePair] : [])
      }

      if (poolInfo?.protocol === Protocol.InfinitySTABLE) {
        return getAccountInfinityStablePositionDetails(chainId, account!, poolInfo.lpAddress as Address)
      }

      if (poolInfo?.protocol === Protocol.V3) {
        return getAccountV3Positions(chainId, account!)
      }
      if (poolInfo?.protocol === Protocol.InfinityCLAMM) {
        return getAccountInfinityCLPositionsWithFallback(chainId, account!)
      }

      if (poolInfo?.protocol === Protocol.InfinityBIN) {
        return getAccountInfinityBinPositionByPoolId({
          chainId,
          account: account as Address,
          poolId: poolInfo?.lpAddress as Hex,
        })
      }
      return Promise.resolve([])
    },
    enabled: Boolean(
      account &&
        poolInfo &&
        poolInfo.lpAddress &&
        poolInfo.protocol &&
        (poolInfo.protocol === 'stable' ? pairs.length : true),
    ),
    select: useCallback(
      (data) => {
        if (poolInfo?.protocol === 'v3') {
          // v3
          const d = data.filter((position) => {
            const { token0, token1, fee } = position as PositionDetail
            return (
              poolInfo?.token0 &&
              isAddressEqual(token0, getCurrencyAddress(poolInfo.token0) as Address) &&
              poolInfo?.token1 &&
              isAddressEqual(token1, getCurrencyAddress(poolInfo.token1) as Address) &&
              fee === poolInfo?.feeTier
            )
          })
          return d as PositionDetail[]
        }
        if (poolInfo?.protocol === Protocol.InfinityCLAMM) {
          return (data as InfinityCLPositionDetail[]).filter((position) => {
            return (poolInfo as InfinityCLPoolInfo)?.poolId === getPoolId(position.poolKey)
          })
        }

        if (poolInfo?.protocol === Protocol.InfinityBIN) {
          return [data] as InfinityBinPositionDetail[]
        }

        return data?.[0] && (data[0].nativeBalance.greaterThan('0') || data[0].farmingBalance.greaterThan('0'))
          ? data[0]
          : undefined
      },
      [poolInfo],
    ),
    refetchInterval: (prevData) => (!prevData ? 1000 : SLOW_INTERVAL),
  })

  const positionsWithFarming = usePositionsWithFarming({
    positions: isInfinityProtocol(poolInfo?.protocol) ? (result.data as InfinityPositionDetails) : undefined,
  })

  if (isInfinityProtocol(poolInfo?.protocol)) {
    return {
      ...result,
      data: positionsWithFarming,
    } as unknown as UseQueryResult<PoolPositionDetail[TProtocol]>
  }

  return result
}
