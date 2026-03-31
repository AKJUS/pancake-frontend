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
import { Hex, Address, erc20Abi, zeroAddress } from 'viem'
import { v3PoolStateABI } from 'config/abi/v3PoolState'
import { InfinityBinPoolInfo, InfinityCLPoolInfo, PoolInfo, StablePoolInfo, V2PoolInfo, V3PoolInfo } from '../type'
import { parseFarmPools } from '../utils'
import { ExtendPoolsQuery } from './atom'

/** @TODO: patch isDynamic for Infinity pools */
export const fetchExplorerPoolsList = async (query: Required<ExtendPoolsQuery>, signal?: AbortSignal) => {
  // NOTE: Infinity Stable pools are no longer shown in the pool list
  const protocols = query.protocols.filter((p) => p !== Protocol.InfinitySTABLE)
  const resp = await explorerApiClient.GET('/cached/pools/list', {
    signal,
    params: {
      query: {
        chains: query.chains.map((chain) => chainIdToExplorerInfoChainName[chain]),
        protocols,
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

  /**
   * Fetch decimals + symbol for up to two currency addresses in a single multicall.
   * currency0 may be the zero address (native), in which case Native.onChain() is used directly.
   */
  const fetchInfinityTokens = async (currency0Addr: Address, currency1Addr: Address) => {
    const isNative0 = isAddressEqual(currency0Addr, zeroAddress)
    const nonNativeAddrs = isNative0 ? [currency1Addr] : [currency0Addr, currency1Addr]

    const metaResults = await client.multicall({
      allowFailure: false,
      contracts: nonNativeAddrs.flatMap((addr) => [
        { abi: erc20Abi, address: addr, functionName: 'decimals' as const },
        { abi: erc20Abi, address: addr, functionName: 'symbol' as const },
      ]),
    })

    if (isNative0) {
      // metaResults: [decimals1, symbol1]
      return {
        token0: Native.onChain(chainId),
        token1: new Token(chainId, currency1Addr, metaResults[0] as number, metaResults[1] as string),
      }
    }
    // metaResults: [decimals0, symbol0, decimals1, symbol1]
    return {
      token0: new Token(chainId, currency0Addr, metaResults[0] as number, metaResults[1] as string),
      token1: new Token(chainId, currency1Addr, metaResults[2] as number, metaResults[3] as string),
    }
  }

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
    const { token0, token1 } = await fetchInfinityTokens(clPoolKey.currency0, clPoolKey.currency1)
    return {
      chainId,
      lpAddress: poolId as Hex,
      poolId: poolId as Hex,
      protocol: Protocol.InfinityCLAMM,
      feeTier: clSlot0_[2],
      feeTierBase: 1e6,
      token0,
      token1,
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
    const { token0, token1 } = await fetchInfinityTokens(binPoolKey.currency0, binPoolKey.currency1)
    return {
      chainId,
      lpAddress: poolId as Hex,
      poolId: poolId as Hex,
      protocol: Protocol.InfinityBIN,
      feeTier: binSlot0_[2],
      feeTierBase: 1e6,
      token0,
      token1,
      // @todo: @Chef-Jerry check if it's farming
      isFarming: false,
      dynamic: binPoolKey.fee === DYNAMIC_FEE_FLAG,
      feeAmount: binPoolKey.fee,
    } satisfies InfinityBinPoolInfo
  }

  return null
}

export const queryV3PoolInfoOnChain = async (poolAddress: string, chainId: number): Promise<V3PoolInfo | null> => {
  const client = publicClient({ chainId })
  if (!client) return null

  try {
    const [token0Addr, token1Addr, fee] = await client.multicall({
      allowFailure: false,
      contracts: [
        { abi: v3PoolStateABI, address: poolAddress as Hex, functionName: 'token0' },
        { abi: v3PoolStateABI, address: poolAddress as Hex, functionName: 'token1' },
        { abi: v3PoolStateABI, address: poolAddress as Hex, functionName: 'fee' },
      ],
    })

    const [decimals0, decimals1, symbol0, symbol1] = await client.multicall({
      allowFailure: false,
      contracts: [
        { abi: erc20Abi, address: token0Addr, functionName: 'decimals' },
        { abi: erc20Abi, address: token1Addr, functionName: 'decimals' },
        { abi: erc20Abi, address: token0Addr, functionName: 'symbol' },
        { abi: erc20Abi, address: token1Addr, functionName: 'symbol' },
      ],
    })

    const token0 = new Token(chainId, token0Addr, decimals0, symbol0)
    const token1 = new Token(chainId, token1Addr, decimals1, symbol1)

    return {
      chainId,
      lpAddress: poolAddress as Hex,
      protocol: Protocol.V3,
      feeTier: fee,
      feeTierBase: 1e6,
      token0,
      token1,
      isFarming: false,
    } satisfies V3PoolInfo
  } catch (error) {
    console.error('[queryV3PoolInfoOnChain]', error)
    return null
  }
}
