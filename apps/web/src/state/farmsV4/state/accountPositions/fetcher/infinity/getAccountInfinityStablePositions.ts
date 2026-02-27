import { Protocol } from '@pancakeswap/farms'
import {
  InfinityStableHook,
  InfinityStableHookFactory,
  INFINITY_STABLE_POOL_FEE_DENOMINATOR,
} from '@pancakeswap/infinity-stable-sdk'
import { CurrencyAmount, ERC20Token, Percent, Price } from '@pancakeswap/sdk'
import { LegacyStableSwapPair } from '@pancakeswap/smart-router/legacy-router'
import { publicClient } from 'utils/viem'
import { Address, erc20Abi, zeroAddress } from 'viem'
import { StableLPDetail } from '../../type'

/**
 * Get Infinity Stable positions for an account
 * @param chainId - Chain ID
 * @param account - Account address
 * @param hookAddress - Optional: specific hook address to fetch. If provided, only fetches this single pool
 * @returns Array of positions with non-zero balances
 */
export const getAccountInfinityStablePositions = async (
  chainId: number,
  account: Address,
  hookAddress?: Address,
): Promise<Array<{ hookAddress: Address; lpBalance: bigint }>> => {
  const client = publicClient({ chainId })

  if (!client || !account || !chainId) {
    return []
  }

  try {
    if (hookAddress) {
      // Single pool case: fetch balance for specific hook only
      const hook = new InfinityStableHook(hookAddress, client)
      const balance = await hook.balanceOf(account)

      if (balance === 0n) return []

      return [{ hookAddress, lpBalance: balance }]
    }

    // Multi-pool case: fetch all pools
    const hookAddresses = await InfinityStableHookFactory.getPools(client, chainId)

    if (!hookAddresses || hookAddresses.length === 0) {
      return []
    }

    // Use SDK's static method to get balances for all hooks in a single multicall
    // Returns only hooks with balance > 0
    const balances = await InfinityStableHook.getBalancesOfMany(client, hookAddresses, account)

    return balances.map(({ hookAddress, balance }) => ({
      hookAddress,
      lpBalance: balance,
    }))
  } catch (error) {
    console.error('Error fetching Infinity Stable positions:', error)
    return []
  }
}

// NOTE: this function need to be optimized
/**
 * Get detailed Infinity Stable pair information for positions
 * Fetches token info, reserves, and calculates user's share
 * @param chainId - Chain ID
 * @param account - Account address
 * @param positions - Array of positions with hook addresses and balances
 * @returns Array of detailed stable LP information
 */
export const getInfinityStablePairDetails = async (
  chainId: number,
  account: Address,
  positions: Array<{ hookAddress: Address; lpBalance: bigint }>,
): Promise<StableLPDetail[]> => {
  const client = publicClient({ chainId })

  if (!account || !client || !positions.length) return []

  // Get token addresses and fees using SDK batch methods
  const hookAddresses = positions.map((pos) => pos.hookAddress)
  const [coinsData, feesData] = await Promise.all([
    InfinityStableHook.getCoinsMany(client, hookAddresses),
    Promise.all(
      positions.map(async (pos) => {
        try {
          const hook = new InfinityStableHook(pos.hookAddress, client)
          return await hook.fee()
        } catch {
          return 0n
        }
      }),
    ),
  ])

  const tokenAddressesResults: Address[] = []
  const fees: bigint[] = []

  coinsData.forEach((coinInfo) => {
    tokenAddressesResults.push(coinInfo.coin0, coinInfo.coin1)
  })

  fees.push(...feesData)

  // Get token info (decimals, symbol, name) for all unique token addresses
  const uniqueTokenAddresses = Array.from(new Set(tokenAddressesResults.filter((addr) => addr !== zeroAddress)))
  const tokenInfoCalls = uniqueTokenAddresses.flatMap((address) => [
    {
      abi: erc20Abi,
      address,
      functionName: 'decimals',
      args: [],
    },
    {
      abi: erc20Abi,
      address,
      functionName: 'symbol',
      args: [],
    },
    {
      abi: erc20Abi,
      address,
      functionName: 'name',
      args: [],
    },
  ])

  const tokenInfoResults = await client
    .multicall({
      contracts: tokenInfoCalls,
      allowFailure: true,
    })
    .then((res) => {
      const results: Record<Address, { decimals: number; symbol: string; name: string }> = {}
      uniqueTokenAddresses.forEach((address, index) => {
        const baseIndex = index * 3
        const decimals = tokenInfoCalls[baseIndex]?.functionName === 'decimals' ? res[baseIndex]?.result : undefined
        const symbol = tokenInfoCalls[baseIndex + 1]?.functionName === 'symbol' ? res[baseIndex + 1]?.result : undefined
        const name = tokenInfoCalls[baseIndex + 2]?.functionName === 'name' ? res[baseIndex + 2]?.result : undefined

        if (decimals && symbol && name) {
          results[address] = {
            decimals: Number(decimals),
            symbol: symbol as string,
            name: name as string,
          }
        }
      })
      return results
    })

  // Create token objects
  const createToken = (address: Address): ERC20Token | null => {
    if (address === zeroAddress) return null
    const info = tokenInfoResults[address]
    if (!info) return null
    return new ERC20Token(chainId, address, info.decimals, info.symbol, info.name)
  }

  // Build stable pairs
  const stablePairs: LegacyStableSwapPair[] = []
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    const token0Address = tokenAddressesResults[i * 2]
    const token1Address = tokenAddressesResults[i * 2 + 1]
    const fee = fees[i] ?? 0n

    const token0 = createToken(token0Address)
    const token1 = createToken(token1Address)

    if (!token0 || !token1) continue

    const feePercent = new Percent(fee, INFINITY_STABLE_POOL_FEE_DENOMINATOR)

    // Create LegacyStableSwapPair manually (createStableSwapPair is not exported from package)
    const pair: LegacyStableSwapPair = {
      token0,
      token1,
      reserve0: CurrencyAmount.fromRawAmount(token0, '0'),
      reserve1: CurrencyAmount.fromRawAmount(token1, '0'),
      stableSwapAddress: pos.hookAddress,
      lpAddress: pos.hookAddress, // hook is the LP token
      infoStableSwapAddress: pos.hookAddress,
      liquidityToken: new ERC20Token(chainId, pos.hookAddress, 18, 'Stable-LP', 'Pancake StableSwap LPs'),
      // NOTE: Compatibility placeholder only; use a non-zero denominator to avoid Fraction divide-by-zero errors.
      price: new Price(token0, token1, '1', '1'),
      fee: feePercent,
      adminFee: new Percent(0),
      involvesToken: (token) => token.equals(token0) || token.equals(token1),
      stableLpFee: 0,
      // Why divide 100?
      // So it will be compatible with StableSwap pool.
      // In presentation, fee={stableTotalFee * 10000}
      stableTotalFee: Number(feePercent.toSignificant(2)) / 100,
      stableLpFeeRateOfTotalFee: 0,
    }

    stablePairs.push(pair)
  }

  if (!stablePairs.length) return []

  // Get balances, total supplies, and farming info
  const balanceCalls = stablePairs.map((pair) => ({
    abi: erc20Abi,
    address: pair.liquidityToken.address,
    functionName: 'balanceOf',
    args: [account] as const,
  }))

  const totalSupplyCalls = stablePairs.map((pair) => ({
    abi: erc20Abi,
    address: pair.liquidityToken.address,
    functionName: 'totalSupply',
    args: [],
  }))

  const poolReservesData = await InfinityStableHook.getPoolBalancesMany(
    client,
    stablePairs.map((pair) => pair.stableSwapAddress),
  )

  const [balances, totalSupplies] = await Promise.all([
    client
      .multicall({
        contracts: balanceCalls,
        allowFailure: true,
      })
      .then((res) => res.map((item) => item.result ?? 0n)),
    client
      .multicall({
        contracts: totalSupplyCalls,
        allowFailure: true,
      })
      .then((res) => res.map((item) => item.result ?? 0n)),
  ])

  const reserves = poolReservesData.map((data) => data.balances)

  const result = stablePairs.map((pair, index) => {
    const nativeBalance = CurrencyAmount.fromRawAmount(pair.liquidityToken, balances[index])
    const farmingBalance = CurrencyAmount.fromRawAmount(pair.liquidityToken, '0')
    const farmingBoosterMultiplier = 0
    const farmingBoostedAmount = CurrencyAmount.fromRawAmount(pair.liquidityToken, '0')

    const { token0, token1 } = pair
    const totalSupply = CurrencyAmount.fromRawAmount(pair.liquidityToken, totalSupplies[index].toString())

    // Calculate proportional amounts: nativeTokenAmount = reserve * userLp / totalSupply
    const userLp = BigInt(balances[index])
    const supply = BigInt(totalSupplies[index])
    const [reserve0Raw, reserve1Raw] = reserves[index]

    // NOTE: token0 and token1 are always sorted in Pool Creation.
    // so it's safe to use reserve0Raw and reserve1Raw directly without sorting
    const nativeToken0Raw = supply > 0n ? (BigInt(reserve0Raw) * userLp) / supply : 0n
    const nativeToken1Raw = supply > 0n ? (BigInt(reserve1Raw) * userLp) / supply : 0n

    const nativeDeposited0 = CurrencyAmount.fromRawAmount(token0.wrapped, nativeToken0Raw.toString())
    const nativeDeposited1 = CurrencyAmount.fromRawAmount(token1.wrapped, nativeToken1Raw.toString())

    // NOTE: Infinity Stable is not supported in the farming API yet
    // so we set the farming deposited amounts to 0
    const farmingDeposited0 = CurrencyAmount.fromRawAmount(token0.wrapped, '0')
    const farmingDeposited1 = CurrencyAmount.fromRawAmount(token1.wrapped, '0')

    return {
      nativeBalance,
      farmingBalance,
      pair,
      totalSupply,
      nativeDeposited0,
      farmingDeposited0,
      nativeDeposited1,
      farmingDeposited1,
      farmingBoostedAmount,
      farmingBoosterMultiplier,
      isStaked: false,
      protocol: Protocol.InfinitySTABLE as Protocol.InfinitySTABLE,
    }
  })

  return result
}

export const getAccountInfinityStablePositionDetails = async (
  chainId: number,
  account: Address,
  hookAddress?: Address,
): Promise<StableLPDetail[]> => {
  const positions = await getAccountInfinityStablePositions(chainId, account, hookAddress)
  if (!positions.length) return []
  return getInfinityStablePairDetails(chainId, account, positions)
}
