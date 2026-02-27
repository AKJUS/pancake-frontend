import { Currency, CurrencyAmount, Native } from '@pancakeswap/sdk'
import {
  decodeHooksRegistration,
  getPoolId,
  INFI_CL_POOL_MANAGER_ADDRESSES,
  isInfinitySupported,
} from '@pancakeswap/infinity-sdk'
import { InfinityStableHook, InfinityStableHookFactory } from '@pancakeswap/infinity-stable-sdk'
import { Address } from 'viem'
import { GetInfinityCandidatePoolsParams } from '../types'
import { getPairCombinations } from '../../v3-router/functions'
import { createOnChainPoolFactory } from '../../v3-router/providers'
import { InfinityStablePool, PoolType } from '../../v3-router/types'
import { PoolMeta } from '../../v3-router/providers/poolProviders/internalTypes'

// Module-level cache for pools data
const poolsCache = new Map<
  string,
  { data: Address[]; coins: Map<Address, [Address, Address]>; timestamp: number; poolCount: number }
>()
// Promise cache to prevent concurrent calls for the same cache key
const pendingRequests = new Map<string, Promise<{ addresses: Address[]; coins: Map<Address, [Address, Address]> }>>()
// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000
let cacheRequestSeq = 0

export async function getInfinityStableCandidatePools({
  currencyA,
  currencyB,
  clientProvider,
}: Omit<GetInfinityCandidatePoolsParams, 'gasLimit'>) {
  if (!currencyA || !currencyB) {
    throw new Error(`Invalid currencyA ${currencyA} or currencyB ${currencyB}`)
  }
  const native = Native.onChain(currencyA?.chainId)
  const wnative = native.wrapped
  const pairs = await getPairCombinations(currencyA, currencyB)
  const pairsWithNative = [...pairs]
  for (const pair of pairs) {
    const index = pair.findIndex((c) => c.wrapped.equals(wnative))
    if (index >= 0) {
      const pairWithNative = [...pair]
      pairWithNative[index] = native
      pairsWithNative.push(pairWithNative as [Currency, Currency])
    }
  }

  return getInfinityStablePools(pairsWithNative, clientProvider)
}

const getInfinityStablePools = createOnChainPoolFactory<InfinityStablePool, PoolMeta>({
  abi: InfinityStableHook.ABI,
  // NOTE: client is needed to get hook addresses by following steps:
  // 1. get hook factory address
  // 2. get ALL hook addresses
  // 3. get coins(0) and coins(1) for each hook via multicall
  // 4. build coins map
  // 5. cache the result with pool count and coins
  getPossiblePoolMetas: async ([currencyA, currencyB], client) => {
    const { chainId } = currencyA
    if (!isInfinitySupported(chainId))
      throw new Error(`Failed to get stable infinity pools. Stable Infinity not supported on chain ${chainId}`)

    if (!client) {
      throw new Error(`No client provided for getInfinitySSPools on chain ${chainId}`)
    }

    // Get hook addresses with caching
    const hookFactoryAddress = InfinityStableHookFactory.getHookFactoryAddress(chainId)
    const cacheKey = hookFactoryAddress
    const now = Date.now()
    const requestId = ++cacheRequestSeq
    const pairKey = `${currencyA.wrapped.symbol}/${currencyB.wrapped.symbol}`

    // Check if cache is valid
    const cachedData = poolsCache.get(cacheKey)
    let ssHookAddresses: Address[]
    let coinsMap: Map<Address, [Address, Address]>

    if (cachedData && now - cachedData.timestamp < CACHE_DURATION) {
      ssHookAddresses = cachedData.data
      coinsMap = cachedData.coins
    } else {
      // Check if there's already a pending request for this cache key
      const pendingRequest = pendingRequests.get(cacheKey)
      if (pendingRequest) {
        const result = await pendingRequest
        ssHookAddresses = result.addresses
        coinsMap = result.coins
      } else {
        // Create a new request promise
        const fetchStart = Date.now()
        const requestPromise = (async () => {
          try {
            let poolCount = 0
            try {
              poolCount = await InfinityStableHookFactory.getPoolCount(client, chainId)
            } catch (error) {
              throw new Error(`pool_count() call failed: ${error}`)
            }

            // If we have cached data and pool count hasn't changed, return cached data
            if (cachedData && cachedData.poolCount === poolCount) {
              // Update timestamp to extend cache validity
              const updatedCache = { ...cachedData, timestamp: now }
              poolsCache.set(cacheKey, updatedCache)
              return { addresses: updatedCache.data, coins: updatedCache.coins }
            }

            if (poolCount === 0) {
              // Cache empty result
              const emptyCache = { data: [], coins: new Map(), timestamp: now, poolCount }
              poolsCache.set(cacheKey, emptyCache)
              return { addresses: [], coins: new Map() }
            }

            // Fetch all pools using multicall
            const pools = await InfinityStableHookFactory.getPoolAddressesBatch(client, chainId, poolCount)

            // Fetch coins(0) and coins(1) for each hook via multicall
            const coinsCalls = pools.flatMap((hookAddress) => [
              {
                abi: InfinityStableHook.ABI,
                address: hookAddress,
                functionName: 'coins' as const,
                args: [0n] as const,
              },
              {
                abi: InfinityStableHook.ABI,
                address: hookAddress,
                functionName: 'coins' as const,
                args: [1n] as const,
              },
            ])

            const coinsResults = await client.multicall({
              contracts: coinsCalls,
              allowFailure: true,
            })

            // Build coins map
            const coinsMap = new Map<Address, [Address, Address]>()
            pools.forEach((hookAddress, i) => {
              const coin0 = coinsResults[i * 2]?.result as Address | undefined
              const coin1 = coinsResults[i * 2 + 1]?.result as Address | undefined
              if (coin0 && coin1) {
                coinsMap.set(hookAddress, [coin0, coin1])
              }
            })

            // Cache the result with pool count and coins
            const newCache = { data: pools, coins: coinsMap, timestamp: now, poolCount }
            poolsCache.set(cacheKey, newCache)
            return { addresses: pools, coins: coinsMap }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[smart-router][InfinityStableCache] getPools() call failed', {
              requestId,
              pairKey,
              error,
              elapsedMs: Date.now() - fetchStart,
            })
            return { addresses: [], coins: new Map() }
          }
        })()

        // Store the pending request
        pendingRequests.set(cacheKey, requestPromise)

        try {
          const result = await requestPromise
          ssHookAddresses = result.addresses
          coinsMap = result.coins
        } finally {
          // Remove the pending request when done
          pendingRequests.delete(cacheKey)
        }
      }
    }

    // Filter hooks by currency pair using cached coins data
    const addressA = currencyA.wrapped.address.toLowerCase()
    const addressB = currencyB.wrapped.address.toLowerCase()

    const ssHookAddressesMetas = ssHookAddresses
      .map((hookAddress) => {
        const coins = coinsMap.get(hookAddress)
        if (!coins) return null

        const [coin0, coin1] = coins
        const c0 = coin0.toLowerCase()
        const c1 = coin1.toLowerCase()
        const matches = (c0 === addressA && c1 === addressB) || (c0 === addressB && c1 === addressA)
        if (!matches) return null

        return { currencyA, currencyB, id: hookAddress }
      })
      .filter((meta): meta is NonNullable<typeof meta> => meta !== null)

    return ssHookAddressesMetas
  },
  buildPoolInfoCalls: ({ id: address }) => [
    {
      address,
      functionName: 'balances',
      args: [0],
    },
    {
      address,
      functionName: 'balances',
      args: [1],
    },
    {
      address,
      functionName: 'fee',
      args: [],
    },
    {
      address,
      functionName: 'A',
      args: [],
    },
  ],
  buildPool: ({ currencyA, currencyB, id }, [balance0, balance1, fee, amplifier]) => {
    if (!balance0 || !balance1) {
      return null
    }

    const [currency0, currency1] = currencyA.wrapped.sortsBefore(currencyB.wrapped)
      ? [currencyA, currencyB]
      : [currencyB, currencyA]

    const DEFAULT_INFINITY_STABLE_POOL = 0

    const DEFAULT_TICK_SPACING = 1

    const poolManager =
      INFI_CL_POOL_MANAGER_ADDRESSES[currencyA.wrapped.chainId as keyof typeof INFI_CL_POOL_MANAGER_ADDRESSES]

    const hooksRegistrationBitmap = '0x0455'

    const hooksRegistration = decodeHooksRegistration(hooksRegistrationBitmap)

    const parameters = {
      tickSpacing: DEFAULT_TICK_SPACING,
      hooksRegistration,
    }

    const poolId = getPoolId({
      currency0: currency0.wrapped.address,
      currency1: currency1.wrapped.address,
      hooks: id,
      fee: DEFAULT_INFINITY_STABLE_POOL,
      poolManager,
      parameters,
    })

    return {
      id: poolId,
      type: PoolType.InfinityStable,
      currency0,
      currency1,
      // NOTE: fee must be DEFAULT_INFINITY_STABLE_POOL
      // so PoolId can be generated correctly for Infinity Quoter
      fee: DEFAULT_INFINITY_STABLE_POOL,
      // NOTE: using stableFee for display in UI
      stableFee: fee ? Number(fee.toString()) : DEFAULT_INFINITY_STABLE_POOL,
      // fee: fee ? Number(fee.toString()) : DEFAULT_INFINITY_STABLE_POOL,
      protocolFee: DEFAULT_INFINITY_STABLE_POOL,
      // using hook balances (Stable ABI) as reserve0 (V4 ABI)
      reserve0: CurrencyAmount.fromRawAmount(currency0, balance0.toString()),
      reserve1: CurrencyAmount.fromRawAmount(currency1, balance1.toString()),
      tickSpacing: DEFAULT_TICK_SPACING,
      poolManager,
      hooks: id,
      hooksRegistrationBitmap,
      amplifier: amplifier ? Number(amplifier.toString()) : 0,
    }
  },
})
