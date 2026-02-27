import { Protocol, fetchAllUniversalFarms, fetchAllUniversalFarmsMap, getFarmConfigKey } from '@pancakeswap/farms'
import {
  BinPoolManagerAbi,
  CLPoolManagerAbi,
  DYNAMIC_FEE_FLAG,
  PoolKey,
  decodeBinPoolParameters,
  decodeCLPoolParameters,
} from '@pancakeswap/infinity-sdk'
import { Native } from '@pancakeswap/sdk'
import { Token } from '@pancakeswap/swap-sdk-core'
import set from 'lodash/set'
import { chainIdToExplorerInfoChainName, explorerApiClient } from 'state/info/api/client'
import { getPoolManagerAddress } from 'utils/addressHelpers'
import { publicClient } from 'utils/viem'
import { isAddressEqual } from 'utils'
import { Hex, zeroAddress } from 'viem'
import { InfinityBinPoolInfo, InfinityCLPoolInfo, PoolInfo, StablePoolInfo, V2PoolInfo } from '../type'
import { parseFarmPools } from '../utils'
import { ExtendPoolsQuery } from './atom'

/** @TODO: patch isDynamic for Infinity pools */
export const fetchExplorerPoolsList = async (query: Required<ExtendPoolsQuery>, signal?: AbortSignal) => {
  const resp = await explorerApiClient.GET('/cached/pools/list', {
    signal,
    params: {
      query: {
        chains: query.chains.map((chain) => chainIdToExplorerInfoChainName[chain]),
        protocols: query.protocols,
        orderBy: query.orderBy,
        pools: query.pools,
        tokens: query.tokens,
        before: query.before,
        after: query.after,
      },
    },
  })

  if (!resp.data) {
    return {
      pools: [],
      endCursor: '',
      startCursor: '',
      hasNextPage: false,
      hasPrevPage: false,
    }
  }

  const { rows, endCursor, startCursor, hasNextPage, hasPrevPage } = resp.data
  const pools = await parseFarmPools(rows)

  return {
    pools,
    endCursor,
    startCursor,
    hasNextPage,
    hasPrevPage,
  }
}

const composeFarmConfig = async (farm: PoolInfo) => {
  if (farm.protocol !== 'stable' && farm.protocol !== 'v2' && farm.protocol !== 'infinityStable') return farm

  const farmConfig = await fetchAllUniversalFarmsMap()
  if (!farm.lpAddress) {
    return farm
  }
  const localFarm = farmConfig[getFarmConfigKey({ lpAddress: farm.lpAddress, chainId: farm.chainId })] as
    | V2PoolInfo
    | StablePoolInfo
    | undefined

  if (!localFarm) {
    return farm
  }

  set(farm, 'bCakeWrapperAddress', localFarm.bCakeWrapperAddress)

  return farm
}

export const fetchExplorerPoolInfo = async <TPoolType extends PoolInfo>(
  poolAddress: string,
  chainId: number,
  signal?: AbortSignal,
): Promise<TPoolType | null> => {
  const chainName = chainIdToExplorerInfoChainName[chainId]
  const resp = await explorerApiClient.GET('/cached/pools/{chainName}/{id}', {
    signal,
    params: {
      path: {
        chainName,
        id: poolAddress,
      },
    },
  })

  if (!resp.data) {
    return null
  }

  try {
    // @ts-ignore
    resp.data.chainId = chainId
    const farmConfig = await fetchAllUniversalFarms()

    const isFarming = farmConfig.some((farm) => farm.lpAddress?.toLowerCase() === poolAddress.toLowerCase())

    const farm = await parseFarmPools([resp.data], { isFarming })

    const data = await composeFarmConfig(farm[0])

    return data as TPoolType
  } catch (e) {
    console.error(e)
    return null
  }
}

// NOTE: queryInfinityPoolInfoOnChain is only supported for Infinity CL and BIN pools
export const queryInfinityPoolInfoOnChain = async (
  poolId: string,
  chainId: number,
): Promise<InfinityCLPoolInfo | InfinityBinPoolInfo | null> => {
  const client = publicClient({ chainId })
  const clPoolManagerAddress = getPoolManagerAddress('CL', chainId)
  const binPoolManagerAddress = getPoolManagerAddress('Bin', chainId)

  if (!client || !clPoolManagerAddress || !binPoolManagerAddress) {
    return null
  }
  const poolIdCalls = [
    {
      abi: CLPoolManagerAbi,
      address: clPoolManagerAddress,
      functionName: 'poolIdToPoolKey',
      args: [poolId],
    } as const,
    {
      abi: BinPoolManagerAbi,
      address: binPoolManagerAddress,
      functionName: 'poolIdToPoolKey',
      args: [poolId],
    } as const,
  ]

  const slot0Calls = [
    {
      abi: CLPoolManagerAbi,
      address: clPoolManagerAddress,
      functionName: 'getSlot0',
      args: [poolId],
    },
    {
      abi: BinPoolManagerAbi,
      address: binPoolManagerAddress,
      functionName: 'getSlot0',
      args: [poolId],
    },
  ]

  const [clPoolKey_, binPoolKey_, clSlot0_, binSlot0_] = await client.multicall({
    allowFailure: false,
    contracts: [...poolIdCalls, ...slot0Calls],
  })

  const clPoolManager = clPoolKey_[3]

  if (!isAddressEqual(clPoolManager, zeroAddress)) {
    const clPoolKey: PoolKey = {
      currency0: clPoolKey_[0],
      currency1: clPoolKey_[1],
      hooks: clPoolKey_[2],
      poolManager: clPoolKey_[3],
      fee: clPoolKey_[4],
      parameters: decodeCLPoolParameters(clPoolKey_[5]),
    }
    return {
      chainId,
      lpAddress: poolId as Hex,
      poolId: poolId as Hex,
      protocol: Protocol.InfinityCLAMM,
      feeTier: clSlot0_[2],
      feeTierBase: 1e6,
      token0: isAddressEqual(clPoolKey.currency0, zeroAddress)
        ? Native.onChain(chainId)
        : new Token(chainId, clPoolKey.currency0, 18, ''),
      token1: new Token(chainId, clPoolKey.currency1, 18, ''),
      // @todo: @Chef-Jerry check if it's farming
      isFarming: false,
      dynamic: clPoolKey.fee === DYNAMIC_FEE_FLAG,
    } satisfies InfinityCLPoolInfo
  }

  const binPoolManager = binPoolKey_[3]
  if (!isAddressEqual(binPoolManager, zeroAddress)) {
    const binPoolKey: PoolKey = {
      currency0: binPoolKey_[0],
      currency1: binPoolKey_[1],
      hooks: binPoolKey_[2],
      poolManager: binPoolKey_[3],
      fee: binPoolKey_[4],
      parameters: decodeBinPoolParameters(binPoolKey_[5]),
    }
    return {
      chainId,
      lpAddress: poolId as Hex,
      poolId: poolId as Hex,
      protocol: Protocol.InfinityBIN,
      feeTier: binSlot0_[2],
      feeTierBase: 1e6,
      token0: isAddressEqual(binPoolKey.currency0, zeroAddress)
        ? Native.onChain(chainId)
        : new Token(chainId, binPoolKey.currency0, 18, ''),
      token1: new Token(chainId, binPoolKey.currency1, 18, ''),
      // @todo: @Chef-Jerry check if it's farming
      isFarming: false,
      dynamic: binPoolKey.fee === DYNAMIC_FEE_FLAG,
      feeAmount: binPoolKey.fee,
    } satisfies InfinityBinPoolInfo
  }

  return null
}
