import { PublicClient, Address, Hex, encodeFunctionData } from 'viem'
import { infinityStableHookABI } from './abis/infinityStableHookABI'

export interface Calldata {
  address: Address
  calldata: Hex
  value?: Hex
}

export class InfinityStableHook {
  static readonly ABI = infinityStableHookABI

  private contractAddress: string

  private publicClient: PublicClient

  constructor(contractAddress: string, publicClient: PublicClient) {
    this.contractAddress = contractAddress
    this.publicClient = publicClient
  }

  /**
   * Get LP token balances for multiple hook addresses in a single multicall
   * @param publicClient The public client to use for the multicall
   * @param hookAddresses Array of hook addresses to check
   * @param account The account address to check balances for
   * @returns Promise<Array<{ hookAddress: Address; balance: bigint }>> Array of hook addresses with non-zero balances
   */
  static async getBalancesOfMany(
    publicClient: PublicClient,
    hookAddresses: Address[],
    account: Address,
  ): Promise<Array<{ hookAddress: Address; balance: bigint }>> {
    if (!hookAddresses.length) {
      return []
    }

    try {
      const balanceResults = await publicClient.multicall({
        contracts: hookAddresses.map((hookAddress) => ({
          abi: infinityStableHookABI,
          address: hookAddress,
          functionName: 'balanceOf' as const,
          args: [account] as const,
        })),
        allowFailure: true,
      })

      // Filter to only hooks with balance > 0
      return hookAddresses
        .map((hookAddress, index) => {
          const result = balanceResults[index]
          const balance = result.status === 'success' && result.result ? (result.result as bigint) : 0n
          return { hookAddress, balance }
        })
        .filter((position) => position.balance > 0n)
    } catch (error) {
      console.error('Error fetching balances for multiple hooks:', error)
      throw error
    }
  }

  /**
   * Get token addresses for multiple hook addresses in a single multicall
   * @param publicClient The public client to use for the multicall
   * @param hookAddresses Array of hook addresses to query
   * @returns Promise<Array<{ hookAddress: Address; coin0: Address; coin1: Address }>> Array of hook addresses with their token pairs
   */
  static async getCoinsMany(
    publicClient: PublicClient,
    hookAddresses: Address[],
  ): Promise<Array<{ hookAddress: Address; coin0: Address; coin1: Address }>> {
    if (!hookAddresses.length) {
      return []
    }

    try {
      const coinResults = await publicClient.multicall({
        contracts: hookAddresses.flatMap((hookAddress) => [
          {
            abi: infinityStableHookABI,
            address: hookAddress,
            functionName: 'coins' as const,
            args: [0n] as const,
          },
          {
            abi: infinityStableHookABI,
            address: hookAddress,
            functionName: 'coins' as const,
            args: [1n] as const,
          },
        ]),
        allowFailure: true,
      })

      return hookAddresses.map((hookAddress, index) => {
        const coin0Result = coinResults[index * 2]
        const coin1Result = coinResults[index * 2 + 1]

        const coin0 =
          coin0Result && coin0Result.status === 'success' && coin0Result.result
            ? (coin0Result.result as Address)
            : ('0x0000000000000000000000000000000000000000' as Address)
        const coin1 =
          coin1Result && coin1Result.status === 'success' && coin1Result.result
            ? (coin1Result.result as Address)
            : ('0x0000000000000000000000000000000000000000' as Address)

        return { hookAddress, coin0, coin1 }
      })
    } catch (error) {
      console.error('Error fetching coins for multiple hooks:', error)
      throw error
    }
  }

  /**
   * Get pool balances (reserves) for multiple hook addresses in a single multicall
   * @param publicClient The public client to use for the multicall
   * @param hookAddresses Array of hook addresses to query
   * @returns Promise<Array<{ hookAddress: Address; balances: bigint[] }>> Array of hook addresses with their pool balances
   */
  static async getPoolBalancesMany(
    publicClient: PublicClient,
    hookAddresses: Address[],
  ): Promise<Array<{ hookAddress: Address; balances: bigint[] }>> {
    if (!hookAddresses.length) {
      return []
    }

    try {
      const balanceResults = await publicClient.multicall({
        contracts: hookAddresses.map((hookAddress) => ({
          abi: infinityStableHookABI,
          address: hookAddress,
          functionName: 'get_balances' as const,
          args: [] as const,
        })),
        allowFailure: true,
      })

      return hookAddresses.map((hookAddress, index) => {
        const result = balanceResults[index]
        const balances = result && result.status === 'success' && result.result ? (result.result as bigint[]) : [0n, 0n]
        return { hookAddress, balances }
      })
    } catch (error) {
      console.error('Error fetching pool balances for multiple hooks:', error)
      throw error
    }
  }

  /**
   * Calculate the amount of LP tokens to be minted for given token amounts
   * @param amounts Array of token amounts [amount0, amount1]
   * @param deposit True for adding liquidity, false for removing
   * @returns Promise<bigint> LP token amount
   */
  async calcTokenAmount(amounts: [bigint, bigint], deposit: boolean = true): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: infinityStableHookABI,
        functionName: 'calc_token_amount',
        args: [amounts, deposit],
      })
      return result as bigint
    } catch (error) {
      console.error('Error calculating token amount:', error)
      throw error
    }
  }

  /**
   * Get the total supply of LP tokens
   * @returns Promise<bigint> Total supply of LP tokens
   */
  async totalSupply(): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: infinityStableHookABI,
        functionName: 'totalSupply',
        args: [],
      })
      return result as bigint
    } catch (error) {
      console.error('Error getting total supply:', error)
      throw error
    }
  }

  /**
   * Get the fee of the stable swap pool
   * @returns Promise<bigint> Fee value
   */
  async fee(): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: infinityStableHookABI,
        functionName: 'fee',
        args: [],
      })
      return result as bigint
    } catch (error) {
      console.error('Error getting fee:', error)
      throw error
    }
  }

  /**
   * Get calldata for adding liquidity to the stable swap pool
   * @param amount0 Amount of token0 to add
   * @param amount1 Amount of token1 to add
   * @param minMintAmount Minimum amount of LP tokens to mint
   * @returns Calldata object with address and encoded function data
   */
  getAddLiquidityCalldata(amount0: bigint, amount1: bigint, minMintAmount: bigint): Calldata {
    return {
      address: this.contractAddress as `0x${string}`,
      calldata: encodeFunctionData({
        abi: infinityStableHookABI,
        functionName: 'add_liquidity',
        args: [amount0, amount1, minMintAmount],
      }),
    }
  }

  /**
   * Get the LP token balance of an account
   * @param account The account address to check
   * @returns Promise<bigint> LP token balance
   */
  async balanceOf(account: `0x${string}`): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: infinityStableHookABI,
        functionName: 'balanceOf',
        args: [account],
      })
      return result as bigint
    } catch (error) {
      console.error('Error getting balance:', error)
      throw error
    }
  }

  /**
   * Get the pool balance for a specific token
   * @param index The token index (0 or 1)
   * @returns Promise<bigint> Pool balance for the token
   */
  async balances(index: number): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: infinityStableHookABI,
        functionName: 'balances',
        args: [BigInt(index)],
      })
      return result as bigint
    } catch (error) {
      console.error('Error getting pool balance:', error)
      throw error
    }
  }

  /**
   * Get all pool balances (reserves) for both tokens
   * @returns Promise<bigint[]> Array of pool balances [balance0, balance1]
   */
  async getPoolBalances(): Promise<bigint[]> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: infinityStableHookABI,
        functionName: 'get_balances',
        args: [],
      })
      return result as bigint[]
    } catch (error) {
      console.error('Error getting pool balances:', error)
      throw error
    }
  }

  /**
   * Get both pool coin addresses
   * @returns Promise<[Address, Address]> Tuple of coin addresses [coin0, coin1]
   */
  async getCoins(): Promise<[Address, Address]> {
    try {
      const [coin0, coin1] = await this.publicClient.multicall({
        allowFailure: false,
        contracts: [
          {
            address: this.contractAddress as `0x${string}`,
            abi: infinityStableHookABI,
            functionName: 'coins' as const,
            args: [0n] as const,
          },
          {
            address: this.contractAddress as `0x${string}`,
            abi: infinityStableHookABI,
            functionName: 'coins' as const,
            args: [1n] as const,
          },
        ],
      })

      return [coin0 as Address, coin1 as Address]
    } catch (error) {
      console.error('Error getting coins:', error)
      throw error
    }
  }

  /**
   * Get calldata for removing liquidity from the stable swap pool
   * @param burnAmount Amount of LP tokens to burn
   * @param minAmount0 Minimum amount of token0 to receive
   * @param minAmount1 Minimum amount of token1 to receive
   * @param recipient Address to receive the tokens
   * @returns Calldata object with address and encoded function data
   */
  getRemoveLiquidityCalldata(
    burnAmount: bigint,
    minAmount0: bigint,
    minAmount1: bigint,
    recipient: `0x${string}`,
  ): Calldata {
    return {
      address: this.contractAddress as `0x${string}`,
      calldata: encodeFunctionData({
        abi: infinityStableHookABI,
        functionName: 'remove_liquidity',
        args: [burnAmount, minAmount0, minAmount1, recipient, false],
      }),
    }
  }

  /**
   * Calculate the amount of a single token that will be received when burning LP tokens
   * @param burnAmount Amount of LP tokens to burn
   * @param index Token index (0 or 1)
   * @returns Promise<bigint> Amount of tokens that will be received
   */
  async calcWithdrawOneCoin(burnAmount: bigint, index: number): Promise<bigint> {
    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: infinityStableHookABI,
        functionName: 'calc_withdraw_one_coin',
        args: [burnAmount, BigInt(index)],
      })
      return result as bigint
    } catch (error) {
      console.error('Error calculating withdraw one coin:', error)
      throw error
    }
  }

  /**
   * Get calldata for removing liquidity and receiving only one token
   * @param burnAmount Amount of LP tokens to burn
   * @param zeroOrOne True for token0, false for token1
   * @param minReceived Minimum amount of tokens to receive
   * @returns Calldata object with address and encoded function data
   */
  getRemoveLiquidityOneCoinCalldata(burnAmount: bigint, zeroOrOne: boolean, minReceived: bigint): Calldata {
    return {
      address: this.contractAddress as `0x${string}`,
      calldata: encodeFunctionData({
        abi: infinityStableHookABI,
        functionName: 'remove_liquidity_one_coin',
        args: [burnAmount, zeroOrOne, minReceived],
      }),
    }
  }

  /**
   * Get calldata for removing liquidity with imbalanced token amounts
   * @param amount0 Amount of token0 to withdraw
   * @param amount1 Amount of token1 to withdraw
   * @param maxBurnAmount Maximum amount of LP tokens to burn
   * @returns Calldata object with address and encoded function data
   */
  getRemoveLiquidityImbalanceCalldata(amount0: bigint, amount1: bigint, maxBurnAmount: bigint): Calldata {
    return {
      address: this.contractAddress as `0x${string}`,
      calldata: encodeFunctionData({
        abi: infinityStableHookABI,
        functionName: 'remove_liquidity_imbalance',
        args: [amount0, amount1, maxBurnAmount],
      }),
    }
  }
}
