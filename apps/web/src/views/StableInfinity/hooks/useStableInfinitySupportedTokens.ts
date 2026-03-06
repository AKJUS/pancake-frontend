import { useQuery } from '@tanstack/react-query'
import { ChainId } from '@pancakeswap/chains'
import {
  InfinityStableHookFactory,
  InfinityStableHook,
  isInfinityStableSupported,
} from '@pancakeswap/infinity-stable-sdk'
import { Token } from '@pancakeswap/swap-sdk-core'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useAtomValue } from 'jotai'
import { usePublicClient } from 'wagmi'
import { isAddressEqual } from 'utils'
import { Address } from 'viem'
import { tokensMapAtom } from 'views/universalFarms/atom/tokensMapAtom'

function collectCandidateAddresses(
  coinsData: Awaited<ReturnType<typeof InfinityStableHook.getCoinsMany>>,
  token?: Token,
) {
  const candidateAddresses = new Set<Address>()

  for (const coinInfo of coinsData) {
    const addr0 = coinInfo.coin0
    const addr1 = coinInfo.coin1

    if (token) {
      const tokenAddr = token.address as Address
      if (isAddressEqual(addr0, tokenAddr)) {
        candidateAddresses.add(addr1)
      } else if (isAddressEqual(addr1, tokenAddr)) {
        candidateAddresses.add(addr0)
      }
      continue
    }

    candidateAddresses.add(addr0)
    candidateAddresses.add(addr1)
  }

  return candidateAddresses
}

export function useStableInfinitySupportedTokens(chainId?: ChainId, token?: Token) {
  const { chainId: activeChainId } = useActiveChainId()
  const finalChainId = chainId ?? activeChainId
  const publicClient = usePublicClient({ chainId: finalChainId })
  const { tokensMap } = useAtomValue(tokensMapAtom)

  return useQuery({
    queryKey: ['stable-infinity-supported-tokens', finalChainId, token?.address?.toLowerCase()],
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

      const candidateAddresses = collectCandidateAddresses(coinsData, token)

      const supportedTokens = Array.from(candidateAddresses)
        .map((address) => tokensMap[`${finalChainId}:${address}`.toLowerCase()])
        .filter((tokenInfo): tokenInfo is NonNullable<typeof tokenInfo> => Boolean(tokenInfo))
        .map(
          (tokenInfo) =>
            new Token(
              tokenInfo.chainId,
              tokenInfo.address as Address,
              tokenInfo.decimals,
              tokenInfo.symbol,
              tokenInfo.name,
            ),
        )

      return supportedTokens
    },
    enabled: !!finalChainId && !!publicClient,
    ...QUERY_SETTINGS_IMMUTABLE,
  })
}
