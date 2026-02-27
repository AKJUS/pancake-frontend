import { InfinityStableHook, isInfinityStableSupported } from '@pancakeswap/infinity-stable-sdk'
import { useQuery } from '@tanstack/react-query'
import { type Address, type Hex } from 'viem'
import { useIsFarmSearchContext } from 'views/universalFarms/hooks/useFarmSearchContext'
import { usePublicClient } from 'wagmi'

export const useCurrenciesByHookAddress = (hookAddress: Hex | Address | undefined, chainId: number | undefined) => {
  const publicClient = usePublicClient({ chainId })
  const isFarmContext = useIsFarmSearchContext()
  return useQuery({
    queryKey: ['currenciesByHookAddress', chainId, hookAddress],
    queryFn: async () => {
      if (!publicClient || !hookAddress) return null

      const hook = new InfinityStableHook(hookAddress, publicClient)
      const [currency0, currency1] = await hook.getCoins()

      return {
        currency0,
        currency1,
      }
    },
    enabled: !isFarmContext && !!chainId && !!hookAddress && isInfinityStableSupported(chainId) && !!publicClient,
  })
}
