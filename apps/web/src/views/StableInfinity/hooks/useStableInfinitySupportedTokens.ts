import { useQuery } from '@tanstack/react-query'
import { ChainId } from '@pancakeswap/chains'
import {
  InfinityStableHookFactory,
  InfinityStableHook,
  isInfinityStableSupported,
} from '@pancakeswap/infinity-stable-sdk'
import { Native } from '@pancakeswap/sdk'
import { Token } from '@pancakeswap/swap-sdk-core'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { usePublicClient } from 'wagmi'
import { isAddressEqual } from 'utils'
import { Address, erc20Abi, zeroAddress } from 'viem'

export function useStableInfinitySupportedTokens(chainId?: ChainId, token?: Token) {
  const { chainId: activeChainId } = useActiveChainId()
  const finalChainId = chainId ?? activeChainId
  const publicClient = usePublicClient({ chainId: finalChainId })

  return useQuery({
    queryKey: ['stable-infinity-supported-tokens', finalChainId, token?.address],
    queryFn: async () => {
      if (!finalChainId || !publicClient) {
        return []
      }

      if (!isInfinityStableSupported(finalChainId as unknown as ChainId)) {
        return []
      }

      const hookAddresses = await InfinityStableHookFactory.getPools(publicClient, finalChainId as unknown as ChainId)

      if (!hookAddresses?.length) {
        return []
      }

      // Fetch coin addresses for each hook pool using SDK batch method
      const coinsData = await InfinityStableHook.getCoinsMany(publicClient, hookAddresses)

      const tokenMap = new Map<Address, Token>()
      const matchingTokenAddresses = new Set<Address>()

      // Build a list of all unique token addresses and track pairs containing the base token
      for (const coinInfo of coinsData) {
        const addr0 = coinInfo.coin0
        const addr1 = coinInfo.coin1

        // If filtering by token, only add the OTHER token in pairs that contain the base token
        if (token) {
          const tokenAddr = token.address as Address
          if (isAddressEqual(addr0, tokenAddr)) {
            matchingTokenAddresses.add(addr1)
          } else if (isAddressEqual(addr1, tokenAddr)) {
            matchingTokenAddresses.add(addr0)
          }
        }
      }

      // If filtering by token, collect and return only matching tokens
      if (token) {
        // Set wrapped native in token map
        tokenMap.set(zeroAddress, Native.onChain(finalChainId).wrapped as unknown as Token)

        const nonNativeAddresses = Array.from(matchingTokenAddresses).filter(
          (addr) => !isAddressEqual(addr, zeroAddress),
        )

        if (nonNativeAddresses.length) {
          const metaResults = await publicClient.multicall({
            allowFailure: true,
            contracts: nonNativeAddresses.flatMap((address) => [
              { address, abi: erc20Abi, functionName: 'decimals' as const },
              { address, abi: erc20Abi, functionName: 'symbol' as const },
              { address, abi: erc20Abi, functionName: 'name' as const },
            ]),
          })

          for (let i = 0; i < nonNativeAddresses.length; i++) {
            const address = nonNativeAddresses[i]!
            const decimalsRes = metaResults[i * 3]
            const symbolRes = metaResults[i * 3 + 1]
            const nameRes = metaResults[i * 3 + 2]

            const decimals =
              decimalsRes?.status === 'success' && typeof decimalsRes.result === 'number' ? decimalsRes.result : 18
            const symbol =
              symbolRes?.status === 'success' && typeof symbolRes.result === 'string' ? symbolRes.result : ''
            const name = nameRes?.status === 'success' && typeof nameRes.result === 'string' ? nameRes.result : ''

            tokenMap.set(address, new Token(finalChainId, address, decimals, symbol, name))
          }
        }

        return Array.from(matchingTokenAddresses)
          .map((addr) => tokenMap.get(addr))
          .filter((t): t is Token => Boolean(t))
      }

      // If no token filter, return all unique tokens from existing pairs
      const allTokenAddresses = new Set<Address>()

      for (const coinInfo of coinsData) {
        allTokenAddresses.add(coinInfo.coin0)
        allTokenAddresses.add(coinInfo.coin1)
      }

      const nonNativeTokenAddresses = Array.from(allTokenAddresses).filter((addr) => !isAddressEqual(addr, zeroAddress))

      // Resolve tokens (native is represented as zeroAddress by the hook)
      tokenMap.set(zeroAddress, Native.onChain(finalChainId).wrapped as unknown as Token)

      if (nonNativeTokenAddresses.length) {
        const metaResults = await publicClient.multicall({
          allowFailure: true,
          contracts: nonNativeTokenAddresses.flatMap((address) => [
            { address, abi: erc20Abi, functionName: 'decimals' as const },
            { address, abi: erc20Abi, functionName: 'symbol' as const },
            { address, abi: erc20Abi, functionName: 'name' as const },
          ]),
        })

        for (let i = 0; i < nonNativeTokenAddresses.length; i++) {
          const address = nonNativeTokenAddresses[i]!
          const decimalsRes = metaResults[i * 3]
          const symbolRes = metaResults[i * 3 + 1]
          const nameRes = metaResults[i * 3 + 2]

          const decimals =
            decimalsRes?.status === 'success' && typeof decimalsRes.result === 'number' ? decimalsRes.result : 18
          const symbol = symbolRes?.status === 'success' && typeof symbolRes.result === 'string' ? symbolRes.result : ''
          const name = nameRes?.status === 'success' && typeof nameRes.result === 'string' ? nameRes.result : ''

          tokenMap.set(address, new Token(finalChainId, address, decimals, symbol, name))
        }
      }

      // Return all unique tokens from existing pairs
      return Array.from(allTokenAddresses)
        .map((addr) => tokenMap.get(addr))
        .filter((t): t is Token => Boolean(t))
    },
    enabled: !!finalChainId && !!publicClient,
    ...QUERY_SETTINGS_IMMUTABLE,
  })
}
