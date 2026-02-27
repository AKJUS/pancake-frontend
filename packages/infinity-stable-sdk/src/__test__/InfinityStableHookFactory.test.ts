import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Address, PublicClient } from 'viem'
import { ChainId } from '@pancakeswap/chains'
import { InfinityStableHookFactory } from '../InfinityStableHookFactory'
import { HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS } from '../constants'

describe('InfinityStableHookFactory', () => {
  let mockPublicClient: PublicClient

  beforeEach(() => {
    mockPublicClient = {
      readContract: vi.fn(),
      multicall: vi.fn(),
    } as unknown as PublicClient
  })

  describe('getInstance - singleton pattern for factory instance', () => {
    it('should return the same instance on subsequent calls', () => {
      const instance1 = InfinityStableHookFactory.getInstance()
      const instance2 = InfinityStableHookFactory.getInstance()

      expect(instance1).toBe(instance2)
      expect(instance1).toBeInstanceOf(InfinityStableHookFactory)
    })
  })

  describe('getHookFactoryAddress - retrieving factory contract address by chain', () => {
    it('should return correct BSC mainnet factory address', () => {
      const address = InfinityStableHookFactory.getHookFactoryAddress(ChainId.BSC)

      expect(address).toBe(HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC])
      expect(address).toBe('0x44de03599d1088b205D959b09A842448A0a63173')
    })

    it('should return correct BSC testnet factory address', () => {
      const address = InfinityStableHookFactory.getHookFactoryAddress(ChainId.BSC_TESTNET)

      expect(address).toBe(HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC_TESTNET])
      expect(address).toBe('0x9188584835110FB6e0eB3BAE10ef1459Acf99edB')
    })

    it('should throw error for unsupported chain like Ethereum mainnet', () => {
      expect(() => {
        InfinityStableHookFactory.getHookFactoryAddress(ChainId.ETHEREUM)
      }).toThrow('Unsupported chainId: 1')
    })

    it('should throw error for unsupported chain like Arbitrum', () => {
      expect(() => {
        InfinityStableHookFactory.getHookFactoryAddress(ChainId.ARBITRUM_ONE)
      }).toThrow('Unsupported chainId: 42161')
    })
  })

  describe('getPoolCount - fetching number of pools for cache invalidation', () => {
    it('should return pool count from factory contract on BSC mainnet', async () => {
      const mockPoolCount = 5n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(mockPoolCount)

      const poolCount = await InfinityStableHookFactory.getPoolCount(mockPublicClient, ChainId.BSC)

      expect(poolCount).toBe(5)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC],
        abi: expect.any(Array),
        functionName: 'pool_count',
      })
    })

    it('should return zero when factory has no pools', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n)

      const poolCount = await InfinityStableHookFactory.getPoolCount(mockPublicClient, ChainId.BSC_TESTNET)

      expect(poolCount).toBe(0)
    })

    it('should return large pool count correctly', async () => {
      const mockPoolCount = 1000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(mockPoolCount)

      const poolCount = await InfinityStableHookFactory.getPoolCount(mockPublicClient, ChainId.BSC)

      expect(poolCount).toBe(1000)
    })

    it('should throw meaningful error when RPC node is unreachable', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Network timeout'))

      await expect(InfinityStableHookFactory.getPoolCount(mockPublicClient, ChainId.BSC)).rejects.toThrow(
        'pool_count() call failed: Error: Network timeout',
      )
    })

    it('should throw meaningful error when contract call reverts', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('execution reverted'))

      await expect(InfinityStableHookFactory.getPoolCount(mockPublicClient, ChainId.BSC)).rejects.toThrow(
        'pool_count() call failed',
      )
    })

    it('should throw error for unsupported chain before making RPC call', async () => {
      await expect(InfinityStableHookFactory.getPoolCount(mockPublicClient, ChainId.ETHEREUM)).rejects.toThrow(
        'Unsupported chainId: 1',
      )

      expect(mockPublicClient.readContract).not.toHaveBeenCalled()
    })
  })

  describe('getPoolAddressesBatch - batch fetching pool addresses via multicall', () => {
    it('should fetch all pool addresses via multicall for factory with multiple pools', async () => {
      const mockPoolAddresses: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
      ]

      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: mockPoolAddresses[0] },
        { status: 'success', result: mockPoolAddresses[1] },
        { status: 'success', result: mockPoolAddresses[2] },
      ])

      const pools = await InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.BSC, 3)

      expect(pools).toEqual(mockPoolAddresses)
      expect(mockPublicClient.multicall).toHaveBeenCalledWith({
        contracts: expect.arrayContaining([
          expect.objectContaining({
            address: HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC],
            functionName: 'pool_list',
            args: [0n],
          }),
          expect.objectContaining({
            address: HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC],
            functionName: 'pool_list',
            args: [1n],
          }),
          expect.objectContaining({
            address: HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC],
            functionName: 'pool_list',
            args: [2n],
          }),
        ]),
        allowFailure: true,
      })
    })

    it('should return empty array when poolCount is 0 without making RPC call', async () => {
      const pools = await InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.BSC, 0)

      expect(pools).toEqual([])
      expect(mockPublicClient.multicall).not.toHaveBeenCalled()
    })

    it('should filter out failed multicall results when some pools fail to load', async () => {
      const mockPoolAddresses: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x3333333333333333333333333333333333333333',
      ]

      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: mockPoolAddresses[0] },
        { status: 'failure', error: new Error('Invalid pool index') },
        { status: 'success', result: mockPoolAddresses[1] },
      ])

      const pools = await InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.BSC, 3)

      expect(pools).toEqual(mockPoolAddresses)
      expect(pools).toHaveLength(2)
    })

    it('should handle all failed multicall results by returning empty array', async () => {
      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'failure', error: new Error('RPC error 1') },
        { status: 'failure', error: new Error('RPC error 2') },
      ])

      const pools = await InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.BSC, 2)

      expect(pools).toEqual([])
    })

    it('should throw error for unsupported chain before making RPC call', async () => {
      await expect(
        InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.POLYGON_ZKEVM, 5),
      ).rejects.toThrow('Unsupported chainId')

      expect(mockPublicClient.multicall).not.toHaveBeenCalled()
    })

    it('should handle large number of pools efficiently via single multicall', async () => {
      const poolCount = 100
      const mockPools = Array.from({ length: poolCount }, (_, i) => `0x${i.toString(16).padStart(40, '0')}` as Address)

      vi.mocked(mockPublicClient.multicall).mockResolvedValue(
        mockPools.map((address) => ({ status: 'success' as const, result: address })),
      )

      const pools = await InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.BSC, poolCount)

      expect(pools).toHaveLength(poolCount)
      expect(pools).toEqual(mockPools)
      expect(mockPublicClient.multicall).toHaveBeenCalledTimes(1)
    })

    it('should throw when entire multicall operation fails', async () => {
      vi.mocked(mockPublicClient.multicall).mockRejectedValue(new Error('RPC node down'))

      await expect(InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.BSC, 3)).rejects.toThrow(
        'RPC node down',
      )
    })
  })

  describe('getPools - existing sequential method for backward compatibility', () => {
    it('should return all pool addresses for factory with multiple pools', async () => {
      const mockPoolAddresses: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ]

      vi.mocked(mockPublicClient.readContract)
        .mockResolvedValueOnce(2n)
        .mockResolvedValueOnce(mockPoolAddresses[0])
        .mockResolvedValueOnce(mockPoolAddresses[1])

      const pools = await InfinityStableHookFactory.getPools(mockPublicClient, ChainId.BSC)

      expect(pools).toEqual(mockPoolAddresses)
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(3)
    })

    it('should return empty array when pool count is zero', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n)

      const pools = await InfinityStableHookFactory.getPools(mockPublicClient, ChainId.BSC)

      expect(pools).toEqual([])
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(1)
    })

    it('should return empty array and log error when pool_count RPC call fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Connection refused'))

      const pools = await InfinityStableHookFactory.getPools(mockPublicClient, ChainId.BSC)

      expect(pools).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'InfinityStableHookFactory Error: getPools() call failed',
        expect.any(Error),
      )

      consoleErrorSpy.mockRestore()
    })

    it('should return empty array when pool_list calls fail', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(mockPublicClient.readContract)
        .mockResolvedValueOnce(2n)
        .mockRejectedValueOnce(new Error('Invalid pool index'))

      const pools = await InfinityStableHookFactory.getPools(mockPublicClient, ChainId.BSC)

      expect(pools).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should throw error for unsupported chain', async () => {
      await expect(InfinityStableHookFactory.getPools(mockPublicClient, ChainId.BASE)).rejects.toThrow(
        'Unsupported chainId',
      )

      expect(mockPublicClient.readContract).not.toHaveBeenCalled()
    })

    it('should fetch pools sequentially with correct indices', async () => {
      const mockPoolAddresses: Address[] = [
        '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
        '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
      ]

      vi.mocked(mockPublicClient.readContract)
        .mockResolvedValueOnce(3n)
        .mockResolvedValueOnce(mockPoolAddresses[0])
        .mockResolvedValueOnce(mockPoolAddresses[1])
        .mockResolvedValueOnce(mockPoolAddresses[2])

      const pools = await InfinityStableHookFactory.getPools(mockPublicClient, ChainId.BSC_TESTNET)

      expect(pools).toEqual(mockPoolAddresses)
      expect(mockPublicClient.readContract).toHaveBeenNthCalledWith(2, {
        address: HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC_TESTNET],
        abi: expect.any(Array),
        functionName: 'pool_list',
        args: [0n],
      })
      expect(mockPublicClient.readContract).toHaveBeenNthCalledWith(3, {
        address: HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC_TESTNET],
        abi: expect.any(Array),
        functionName: 'pool_list',
        args: [1n],
      })
      expect(mockPublicClient.readContract).toHaveBeenNthCalledWith(4, {
        address: HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS[ChainId.BSC_TESTNET],
        abi: expect.any(Array),
        functionName: 'pool_list',
        args: [2n],
      })
    })
  })

  describe('Integration scenarios - real-world usage patterns', () => {
    it('should handle cache invalidation flow: check count, then fetch if changed', async () => {
      const currentCachedPoolCount = 2
      const newPoolCount = 3n
      const mockNewPool: Address = '0x3333333333333333333333333333333333333333'

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(newPoolCount)
      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: '0x1111111111111111111111111111111111111111' },
        { status: 'success', result: '0x2222222222222222222222222222222222222222' },
        { status: 'success', result: mockNewPool },
      ])

      const poolCount = await InfinityStableHookFactory.getPoolCount(mockPublicClient, ChainId.BSC)

      if (poolCount !== currentCachedPoolCount) {
        const pools = await InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.BSC, poolCount)
        expect(pools).toHaveLength(3)
        expect(pools[2]).toBe(mockNewPool)
      }
    })

    it('should handle empty factory state correctly', async () => {
      vi.mocked(mockPublicClient.readContract).mockResolvedValue(0n)

      const poolCount = await InfinityStableHookFactory.getPoolCount(mockPublicClient, ChainId.BSC)
      const pools = await InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, ChainId.BSC, poolCount)

      expect(poolCount).toBe(0)
      expect(pools).toEqual([])
      expect(mockPublicClient.multicall).not.toHaveBeenCalled()
    })

    it('should throw chain validation error before any network calls', async () => {
      const unsupportedChain = ChainId.ETHEREUM

      await expect(InfinityStableHookFactory.getPoolCount(mockPublicClient, unsupportedChain)).rejects.toThrow(
        'Unsupported chainId',
      )

      await expect(
        InfinityStableHookFactory.getPoolAddressesBatch(mockPublicClient, unsupportedChain, 5),
      ).rejects.toThrow('Unsupported chainId')

      expect(() => {
        InfinityStableHookFactory.getHookFactoryAddress(unsupportedChain)
      }).toThrow('Unsupported chainId')

      expect(mockPublicClient.readContract).not.toHaveBeenCalled()
      expect(mockPublicClient.multicall).not.toHaveBeenCalled()
    })
  })
})
