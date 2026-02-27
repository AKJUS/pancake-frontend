import { ChainId } from '@pancakeswap/chains'
import {
  InfinityStableHookFactory,
  InfinityStableHook,
  isInfinityStableSupported,
} from '@pancakeswap/infinity-stable-sdk'
import { Token } from '@pancakeswap/swap-sdk-core'
import { useQuery } from '@tanstack/react-query'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import { usePublicClient } from 'wagmi'
import { isAddressEqual } from 'utils'
import { Address } from 'viem'
import BigNumber from 'bignumber.js'

export function useInfinityStablePoolByPair(chainId?: ChainId, token0?: Token, token1?: Token) {
  const publicClient = usePublicClient({ chainId })

  return useQuery({
    queryKey: ['infinity-stable-pool-by-pair', chainId, token0?.address, token1?.address],
    queryFn: async () => {
      if (!chainId || !publicClient || !token0 || !token1) {
        return null
      }

      if (!isInfinityStableSupported(chainId)) {
        return null
      }

      const hookAddresses = await InfinityStableHookFactory.getPools(publicClient, chainId)

      if (!hookAddresses?.length) {
        return null
      }

      // Fetch coin addresses for each hook pool using SDK batch method
      const coinsData = await InfinityStableHook.getCoinsMany(publicClient, hookAddresses)

      // Filter to pools matching the token pair
      const matchingPools: Address[] = []
      const token0Addr = token0.address as Address
      const token1Addr = token1.address as Address

      for (const coinInfo of coinsData) {
        const addr0 = coinInfo.coin0
        const addr1 = coinInfo.coin1

        const matches =
          (isAddressEqual(addr0, token0Addr) && isAddressEqual(addr1, token1Addr)) ||
          (isAddressEqual(addr0, token1Addr) && isAddressEqual(addr1, token0Addr))

        if (matches) {
          matchingPools.push(coinInfo.hookAddress)
        }
      }

      if (matchingPools.length === 0) {
        return null
      }

      // If only one pool, return it immediately (optimization: no TVL calculation needed)
      if (matchingPools.length === 1) {
        return matchingPools[0]
      }

      // Multiple pools: return pool with highest combined balance
      const poolBalancesData = await InfinityStableHook.getPoolBalancesMany(publicClient, matchingPools)

      let highestBalance = new BigNumber(0)
      let bestPool: Address | null = null

      for (let i = 0; i < matchingPools.length; i++) {
        const poolBalances = poolBalancesData[i]?.balances
        if (poolBalances && poolBalances.length >= 2) {
          const balance0 = new BigNumber(poolBalances[0].toString()).div(new BigNumber(10).pow(token0.decimals))
          const balance1 = new BigNumber(poolBalances[1].toString()).div(new BigNumber(10).pow(token1.decimals))

          const totalBalance = balance0.plus(balance1)

          if (totalBalance.gt(highestBalance)) {
            highestBalance = totalBalance
            bestPool = matchingPools[i]
          }
        }
      }

      return bestPool
    },
    enabled: !!chainId && !!publicClient && !!token0 && !!token1,
    ...QUERY_SETTINGS_IMMUTABLE,
  })
}
