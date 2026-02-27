import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Address, PublicClient, encodeFunctionData } from 'viem'
import { InfinityStableHook } from '../InfinityStableHook'
import { infinityStableHookABI } from '../abis/infinityStableHookABI'

describe('InfinityStableHook', () => {
  const mockHookAddress: Address = '0x1234567890123456789012345678901234567890'
  const mockAccount: Address = '0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD'
  const mockCoin0: Address = '0x0000000000000000000000000000000000000001'
  const mockCoin1: Address = '0x0000000000000000000000000000000000000002'

  let mockPublicClient: PublicClient

  beforeEach(() => {
    mockPublicClient = {
      readContract: vi.fn(),
      multicall: vi.fn(),
    } as unknown as PublicClient
  })

  describe('static ABI property', () => {
    it('should expose the ABI for factory pattern usage', () => {
      expect(InfinityStableHook.ABI).toBe(infinityStableHookABI)
      expect(InfinityStableHook.ABI).toBeDefined()
      expect(Array.isArray(InfinityStableHook.ABI)).toBe(true)
    })
  })

  describe('getBalancesOfMany - fetching user LP positions across multiple pools', () => {
    it('should return only pools where user has non-zero LP balance', async () => {
      const hooks: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
      ]

      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: 1000000n },
        { status: 'success', result: 0n },
        { status: 'success', result: 500000n },
      ])

      const result = await InfinityStableHook.getBalancesOfMany(mockPublicClient, hooks, mockAccount)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ hookAddress: hooks[0], balance: 1000000n })
      expect(result[1]).toEqual({ hookAddress: hooks[2], balance: 500000n })
    })

    it('should return empty array when no hooks provided', async () => {
      const result = await InfinityStableHook.getBalancesOfMany(mockPublicClient, [], mockAccount)

      expect(result).toEqual([])
      expect(mockPublicClient.multicall).not.toHaveBeenCalled()
    })

    it('should treat failed multicall results as zero balance and exclude them', async () => {
      const hooks: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ]

      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: 1000000n },
        { status: 'failure', error: new Error('RPC error') },
      ])

      const result = await InfinityStableHook.getBalancesOfMany(mockPublicClient, hooks, mockAccount)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ hookAddress: hooks[0], balance: 1000000n })
    })

    it('should throw when overall multicall fails', async () => {
      const hooks: Address[] = ['0x1111111111111111111111111111111111111111']

      vi.mocked(mockPublicClient.multicall).mockRejectedValue(new Error('Network error'))

      await expect(InfinityStableHook.getBalancesOfMany(mockPublicClient, hooks, mockAccount)).rejects.toThrow(
        'Network error',
      )
    })
  })

  describe('getCoinsMany - batch fetching token pairs for pool discovery', () => {
    it('should fetch token addresses for multiple pools in single multicall', async () => {
      const hooks: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ]

      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: mockCoin0 },
        { status: 'success', result: mockCoin1 },
        { status: 'success', result: '0x0000000000000000000000000000000000000003' },
        { status: 'success', result: '0x0000000000000000000000000000000000000004' },
      ])

      const result = await InfinityStableHook.getCoinsMany(mockPublicClient, hooks)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ hookAddress: hooks[0], coin0: mockCoin0, coin1: mockCoin1 })
      expect(result[1]).toEqual({
        hookAddress: hooks[1],
        coin0: '0x0000000000000000000000000000000000000003',
        coin1: '0x0000000000000000000000000000000000000004',
      })
    })

    it('should return empty array when no hooks provided', async () => {
      const result = await InfinityStableHook.getCoinsMany(mockPublicClient, [])

      expect(result).toEqual([])
      expect(mockPublicClient.multicall).not.toHaveBeenCalled()
    })

    it('should use zero address for failed individual coin reads', async () => {
      const hooks: Address[] = ['0x1111111111111111111111111111111111111111']

      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: mockCoin0 },
        { status: 'failure', error: new Error('Invalid coin index') },
      ])

      const result = await InfinityStableHook.getCoinsMany(mockPublicClient, hooks)

      expect(result).toHaveLength(1)
      expect(result[0].coin0).toBe(mockCoin0)
      expect(result[0].coin1).toBe('0x0000000000000000000000000000000000000000')
    })

    it('should throw when overall multicall fails', async () => {
      const hooks: Address[] = ['0x1111111111111111111111111111111111111111']

      vi.mocked(mockPublicClient.multicall).mockRejectedValue(new Error('RPC timeout'))

      await expect(InfinityStableHook.getCoinsMany(mockPublicClient, hooks)).rejects.toThrow('RPC timeout')
    })
  })

  describe('getPoolBalancesMany - batch fetching pool reserves for TVL calculation', () => {
    it('should fetch pool reserves for multiple pools in single multicall', async () => {
      const hooks: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ]

      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: [1000000000n, 2000000000n] },
        { status: 'success', result: [5000000000n, 5000000000n] },
      ])

      const result = await InfinityStableHook.getPoolBalancesMany(mockPublicClient, hooks)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ hookAddress: hooks[0], balances: [1000000000n, 2000000000n] })
      expect(result[1]).toEqual({ hookAddress: hooks[1], balances: [5000000000n, 5000000000n] })
    })

    it('should return empty array when no hooks provided', async () => {
      const result = await InfinityStableHook.getPoolBalancesMany(mockPublicClient, [])

      expect(result).toEqual([])
      expect(mockPublicClient.multicall).not.toHaveBeenCalled()
    })

    it('should use zero balances for failed pool reads', async () => {
      const hooks: Address[] = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ]

      vi.mocked(mockPublicClient.multicall).mockResolvedValue([
        { status: 'success', result: [1000000000n, 2000000000n] },
        { status: 'failure', error: new Error('Pool not initialized') },
      ])

      const result = await InfinityStableHook.getPoolBalancesMany(mockPublicClient, hooks)

      expect(result).toHaveLength(2)
      expect(result[0].balances).toEqual([1000000000n, 2000000000n])
      expect(result[1].balances).toEqual([0n, 0n])
    })

    it('should throw when overall multicall fails', async () => {
      const hooks: Address[] = ['0x1111111111111111111111111111111111111111']

      vi.mocked(mockPublicClient.multicall).mockRejectedValue(new Error('Network failure'))

      await expect(InfinityStableHook.getPoolBalancesMany(mockPublicClient, hooks)).rejects.toThrow('Network failure')
    })
  })

  describe('getCoins - fetching token pair for pool info display', () => {
    it('should return both token addresses for a pool', async () => {
      vi.mocked(mockPublicClient.multicall).mockResolvedValue([mockCoin0, mockCoin1])

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.getCoins()

      expect(result).toEqual([mockCoin0, mockCoin1])
      expect(mockPublicClient.multicall).toHaveBeenCalledWith({
        allowFailure: false,
        contracts: expect.arrayContaining([
          expect.objectContaining({ functionName: 'coins', args: [0n] }),
          expect.objectContaining({ functionName: 'coins', args: [1n] }),
        ]),
      })
    })

    it('should throw when contract call fails', async () => {
      vi.mocked(mockPublicClient.multicall).mockRejectedValue(new Error('Contract not found'))

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)

      await expect(hook.getCoins()).rejects.toThrow('Contract not found')
    })
  })

  describe('fee - getting pool swap fee for display', () => {
    it('should return pool swap fee', async () => {
      const mockFee = 1000000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(mockFee)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.fee()

      expect(result).toBe(mockFee)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'fee',
        args: [],
      })
    })

    it('should throw when contract call fails', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Fee not initialized'))

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)

      await expect(hook.fee()).rejects.toThrow('Fee not initialized')
    })
  })

  describe('balanceOf - checking user LP balance for position display', () => {
    it('should return user LP token balance', async () => {
      const mockBalance = 500000000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(mockBalance)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.balanceOf(mockAccount)

      expect(result).toBe(mockBalance)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'balanceOf',
        args: [mockAccount],
      })
    })

    it('should throw when contract call fails', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Invalid account'))

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)

      await expect(hook.balanceOf(mockAccount)).rejects.toThrow('Invalid account')
    })
  })

  describe('totalSupply - calculating user share of pool', () => {
    it('should return total LP token supply for share calculation', async () => {
      const mockSupply = 10000000000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(mockSupply)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.totalSupply()

      expect(result).toBe(mockSupply)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'totalSupply',
        args: [],
      })
    })

    it('should throw when contract call fails', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Pool not initialized'))

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)

      await expect(hook.totalSupply()).rejects.toThrow('Pool not initialized')
    })
  })

  describe('getPoolBalances - fetching reserves for proportional withdrawal calculation', () => {
    it('should return both token reserves in pool', async () => {
      const mockBalances = [1000000000n, 2000000000n]

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(mockBalances)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.getPoolBalances()

      expect(result).toEqual(mockBalances)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'get_balances',
        args: [],
      })
    })

    it('should throw when contract call fails', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Reserves query failed'))

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)

      await expect(hook.getPoolBalances()).rejects.toThrow('Reserves query failed')
    })
  })

  describe('balances - fetching individual token reserve', () => {
    it('should return reserve for token0', async () => {
      const mockBalance = 1000000000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(mockBalance)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.balances(0)

      expect(result).toBe(mockBalance)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'balances',
        args: [0n],
      })
    })

    it('should return reserve for token1', async () => {
      const mockBalance = 2000000000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(mockBalance)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.balances(1)

      expect(result).toBe(mockBalance)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'balances',
        args: [1n],
      })
    })

    it('should throw when contract call fails', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Invalid token index'))

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)

      await expect(hook.balances(0)).rejects.toThrow('Invalid token index')
    })
  })

  describe('calcTokenAmount - previewing LP tokens for deposit', () => {
    it('should calculate LP tokens to mint when adding liquidity', async () => {
      const amounts: [bigint, bigint] = [1000000n, 1000000n]
      const expectedLPAmount = 1990000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(expectedLPAmount)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.calcTokenAmount(amounts, true)

      expect(result).toBe(expectedLPAmount)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'calc_token_amount',
        args: [amounts, true],
      })
    })

    it('should calculate LP tokens to burn when previewing withdrawal', async () => {
      const amounts: [bigint, bigint] = [500000n, 500000n]
      const expectedLPBurn = 495000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(expectedLPBurn)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.calcTokenAmount(amounts, false)

      expect(result).toBe(expectedLPBurn)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'calc_token_amount',
        args: [amounts, false],
      })
    })

    it('should throw when contract call fails', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Calculation failed'))

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)

      await expect(hook.calcTokenAmount([1000000n, 1000000n], true)).rejects.toThrow('Calculation failed')
    })
  })

  describe('calcWithdrawOneCoin - previewing single-token withdrawal amount', () => {
    it('should calculate token0 output when withdrawing to single token', async () => {
      const burnAmount = 1000000n
      const expectedOutput = 995000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(expectedOutput)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.calcWithdrawOneCoin(burnAmount, 0)

      expect(result).toBe(expectedOutput)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'calc_withdraw_one_coin',
        args: [burnAmount, 0n],
      })
    })

    it('should calculate token1 output when withdrawing to single token', async () => {
      const burnAmount = 1000000n
      const expectedOutput = 995000n

      vi.mocked(mockPublicClient.readContract).mockResolvedValue(expectedOutput)

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = await hook.calcWithdrawOneCoin(burnAmount, 1)

      expect(result).toBe(expectedOutput)
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockHookAddress,
        abi: infinityStableHookABI,
        functionName: 'calc_withdraw_one_coin',
        args: [burnAmount, 1n],
      })
    })

    it('should throw when contract call fails', async () => {
      vi.mocked(mockPublicClient.readContract).mockRejectedValue(new Error('Insufficient liquidity'))

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)

      await expect(hook.calcWithdrawOneCoin(1000000n, 0)).rejects.toThrow('Insufficient liquidity')
    })
  })

  describe('getAddLiquidityCalldata - encoding transaction for adding liquidity', () => {
    it('should encode add liquidity transaction with correct parameters', () => {
      const amount0 = 1000000n
      const amount1 = 1000000n
      const minMintAmount = 1990000n

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = hook.getAddLiquidityCalldata(amount0, amount1, minMintAmount)

      expect(result.address).toBe(mockHookAddress)
      expect(result.calldata).toBe(
        encodeFunctionData({
          abi: infinityStableHookABI,
          functionName: 'add_liquidity',
          args: [amount0, amount1, minMintAmount],
        }),
      )
      expect(result.value).toBeUndefined()
    })

    it('should encode calldata for imbalanced liquidity addition', () => {
      const amount0 = 2000000n
      const amount1 = 500000n
      const minMintAmount = 2450000n

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = hook.getAddLiquidityCalldata(amount0, amount1, minMintAmount)

      expect(result.address).toBe(mockHookAddress)
      expect(result.calldata).toContain('0x')
      expect(result.calldata.length).toBeGreaterThan(10)
    })
  })

  describe('getRemoveLiquidityCalldata - encoding balanced withdrawal transaction', () => {
    it('should encode remove liquidity with min amounts and recipient', () => {
      const burnAmount = 1000000n
      const minAmount0 = 495000n
      const minAmount1 = 495000n
      const recipient: Address = '0x9999999999999999999999999999999999999999'

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = hook.getRemoveLiquidityCalldata(burnAmount, minAmount0, minAmount1, recipient)

      expect(result.address).toBe(mockHookAddress)
      expect(result.calldata).toBe(
        encodeFunctionData({
          abi: infinityStableHookABI,
          functionName: 'remove_liquidity',
          args: [burnAmount, minAmount0, minAmount1, recipient, false],
        }),
      )
      expect(result.value).toBeUndefined()
    })

    it('should encode calldata with slippage protection via min amounts', () => {
      const burnAmount = 5000000n
      const minAmount0 = 2400000n
      const minAmount1 = 2400000n
      const recipient: Address = mockAccount

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = hook.getRemoveLiquidityCalldata(burnAmount, minAmount0, minAmount1, recipient)

      expect(result.address).toBe(mockHookAddress)
      expect(result.calldata).toContain('0x')
    })
  })

  describe('getRemoveLiquidityOneCoinCalldata - encoding single-token withdrawal', () => {
    it('should encode withdrawal to token0 only', () => {
      const burnAmount = 1000000n
      const minReceived = 990000n

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = hook.getRemoveLiquidityOneCoinCalldata(burnAmount, true, minReceived)

      expect(result.address).toBe(mockHookAddress)
      expect(result.calldata).toBe(
        encodeFunctionData({
          abi: infinityStableHookABI,
          functionName: 'remove_liquidity_one_coin',
          args: [burnAmount, true, minReceived],
        }),
      )
    })

    it('should encode withdrawal to token1 only', () => {
      const burnAmount = 1000000n
      const minReceived = 990000n

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = hook.getRemoveLiquidityOneCoinCalldata(burnAmount, false, minReceived)

      expect(result.address).toBe(mockHookAddress)
      expect(result.calldata).toBe(
        encodeFunctionData({
          abi: infinityStableHookABI,
          functionName: 'remove_liquidity_one_coin',
          args: [burnAmount, false, minReceived],
        }),
      )
    })
  })

  describe('getRemoveLiquidityImbalanceCalldata - encoding custom withdrawal amounts', () => {
    it('should encode imbalanced withdrawal with max burn cap', () => {
      const amount0 = 300000n
      const amount1 = 700000n
      const maxBurnAmount = 1050000n

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = hook.getRemoveLiquidityImbalanceCalldata(amount0, amount1, maxBurnAmount)

      expect(result.address).toBe(mockHookAddress)
      expect(result.calldata).toBe(
        encodeFunctionData({
          abi: infinityStableHookABI,
          functionName: 'remove_liquidity_imbalance',
          args: [amount0, amount1, maxBurnAmount],
        }),
      )
    })

    it('should encode calldata for asymmetric withdrawal protecting against excessive LP burn', () => {
      const amount0 = 1000000n
      const amount1 = 100000n
      const maxBurnAmount = 1200000n

      const hook = new InfinityStableHook(mockHookAddress, mockPublicClient)
      const result = hook.getRemoveLiquidityImbalanceCalldata(amount0, amount1, maxBurnAmount)

      expect(result.address).toBe(mockHookAddress)
      expect(result.calldata).toContain('0x')
      expect(result.calldata.length).toBeGreaterThan(10)
    })
  })
})
