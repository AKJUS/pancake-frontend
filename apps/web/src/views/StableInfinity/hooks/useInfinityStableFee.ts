import { InfinityStableHook, INFINITY_STABLE_POOL_FEE_DENOMINATOR } from '@pancakeswap/infinity-stable-sdk'
import { Percent } from '@pancakeswap/swap-sdk-core'
import { useQuery } from '@tanstack/react-query'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'
import { usePublicClient } from 'wagmi'
import { Address } from 'viem'

type UseInfinityStableFeeParams = {
  chainId?: number
  hookAddress?: Address
  enabled?: boolean
}

export function useInfinityStableFee({
  chainId,
  hookAddress,
  enabled = false,
}: UseInfinityStableFeeParams): number | null {
  const publicClient = usePublicClient({ chainId })

  const { data } = useQuery({
    queryKey: ['infinity-stable-fee', chainId, hookAddress],
    queryFn: async () => {
      if (!publicClient || !hookAddress) return null
      const hook = new InfinityStableHook(hookAddress, publicClient)
      const rawFee = await hook.fee()
      const feePercent = new Percent(rawFee, INFINITY_STABLE_POOL_FEE_DENOMINATOR)
      return Number(feePercent.toSignificant(2)) / 100
    },
    enabled: enabled && !!hookAddress && !!chainId && !!publicClient,
    ...QUERY_SETTINGS_IMMUTABLE,
  })

  return data ?? null
}
