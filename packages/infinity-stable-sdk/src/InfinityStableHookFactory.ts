import { Address, PublicClient } from 'viem'
import { ChainId } from '@pancakeswap/chains'
import { infinityStableHookFactoryABI } from './abis/infinityStableHookFactoryABI'
import { HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS } from './constants'
import { isInfinityStableSupported } from './utils'

/**
 * Hook Factory for Stable Swap
 * Utility for fetching pools from the hook factory contract
 */
export class InfinityStableHookFactory {
  private static instance: InfinityStableHookFactory | null = null

  /**
   * Get the singleton instance
   */
  static getInstance(): InfinityStableHookFactory {
    if (!InfinityStableHookFactory.instance) {
      InfinityStableHookFactory.instance = new InfinityStableHookFactory()
    }
    return InfinityStableHookFactory.instance
  }

  /**
   * Get the hook factory address for a specific chain
   */
  static getHookFactoryAddress(chainId: ChainId): Address {
    if (!isInfinityStableSupported(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}`)
    }
    const address =
      HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[chainId as keyof typeof HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS]

    if (!address) {
      throw new Error(`HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS not found for chainId: ${chainId}`)
    }
    return address
  }

  /**
   * Get the number of pools from the hook factory contract
   * @param publicClient The viem public client for making contract calls
   * @param chainId The chain ID
   * @returns Number of pools in the factory
   */
  static async getPoolCount(publicClient: PublicClient, chainId: ChainId): Promise<number> {
    if (!isInfinityStableSupported(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}`)
    }

    const hookFactoryAddress = InfinityStableHookFactory.getHookFactoryAddress(chainId)

    try {
      const poolCountResult = await publicClient.readContract({
        address: hookFactoryAddress,
        abi: infinityStableHookFactoryABI,
        functionName: 'pool_count',
      })

      return Number(poolCountResult?.toString())
    } catch (error) {
      throw new Error(`pool_count() call failed: ${error}`)
    }
  }

  /**
   * Get pool addresses in batch using multicall
   * @param publicClient The viem public client for making contract calls
   * @param chainId The chain ID
   * @param poolCount Number of pools to fetch
   * @returns Array of pool addresses
   */
  static async getPoolAddressesBatch(
    publicClient: PublicClient,
    chainId: ChainId,
    poolCount: number,
  ): Promise<Address[]> {
    if (!isInfinityStableSupported(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}`)
    }

    if (poolCount === 0) {
      return []
    }

    const hookFactoryAddress = InfinityStableHookFactory.getHookFactoryAddress(chainId)

    const poolCalls = Array.from({ length: poolCount }, (_, i) => ({
      abi: infinityStableHookFactoryABI,
      address: hookFactoryAddress,
      functionName: 'pool_list' as const,
      args: [BigInt(i)] as const,
    }))

    const poolResults = await publicClient.multicall({
      contracts: poolCalls,
      allowFailure: true,
    })

    const pools: Address[] = poolResults
      .map((result) => result.result as Address | undefined)
      .filter((address): address is Address => address !== undefined)

    return pools
  }

  /**
   * Get all pools from the hook factory contract
   * @param publicClient The viem public client for making contract calls
   * @param chainId The chain ID
   * @returns Array of pool addresses
   */
  static async getPools(publicClient: PublicClient, chainId: ChainId): Promise<Address[]> {
    if (!isInfinityStableSupported(chainId)) {
      throw new Error(`Unsupported chainId: ${chainId}`)
    }

    const hookFactoryAddress = InfinityStableHookFactory.getHookFactoryAddress(chainId)

    try {
      let poolCount = 0
      try {
        const poolCountResult = await publicClient.readContract({
          address: hookFactoryAddress,
          abi: infinityStableHookFactoryABI,
          functionName: 'pool_count',
        })

        poolCount = Number(poolCountResult?.toString())
      } catch (error) {
        throw new Error(`pool_count() call failed: ${error}`)
      }

      if (poolCount === 0) {
        return []
      }

      // Fetch all pools
      const pools: Address[] = []
      for (let i = 0; i < poolCount; i++) {
        // eslint-disable-next-line no-await-in-loop
        const pool = await publicClient.readContract({
          address: hookFactoryAddress,
          abi: infinityStableHookFactoryABI,
          functionName: 'pool_list',
          args: [BigInt(i)],
        })
        pools.push(pool as Address)
      }

      return pools
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('InfinityStableHookFactory Error: getPools() call failed', error)
      return []
    }
  }
}
