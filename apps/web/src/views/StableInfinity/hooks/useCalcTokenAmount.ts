import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { InfinityStableHook } from '@pancakeswap/infinity-stable-sdk'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'

interface UseCalcTokenAmountParams {
  poolAddress: string
  amounts: [bigint, bigint]
  deposit?: boolean
  enabled?: boolean
}

interface UseCalcTokenAmountReturn {
  tokenAmount: bigint | null
  isLoading: boolean
  error: Error | null
}

interface UseUserLPBalanceParams {
  poolAddress: string
  account?: `0x${string}`
}

export const useTotalSupply = ({ poolAddress }: { poolAddress: string }): bigint | null => {
  const publicClient = usePublicClient()

  const infinityStableHook = useMemo(() => {
    if (!publicClient || !poolAddress) return null
    return new InfinityStableHook(poolAddress, publicClient)
  }, [poolAddress, publicClient])

  const shouldQuery = !!infinityStableHook

  const { data } = useQuery({
    queryKey: ['infinity-stable-total-supply', poolAddress],
    queryFn: async () => {
      if (!infinityStableHook) return null
      return infinityStableHook.totalSupply()
    },
    enabled: shouldQuery,
    ...QUERY_SETTINGS_IMMUTABLE,
  })

  return shouldQuery ? data ?? null : null
}

export const useCalcTokenAmount = ({
  poolAddress,
  amounts,
  deposit = true,
  enabled = true,
}: UseCalcTokenAmountParams): UseCalcTokenAmountReturn => {
  const publicClient = usePublicClient()

  const infinityStableHook = useMemo(() => {
    if (!publicClient || !poolAddress) return null
    return new InfinityStableHook(poolAddress, publicClient)
  }, [poolAddress, publicClient])

  const shouldQuery = enabled && !!infinityStableHook && (amounts[0] > 0n || amounts[1] > 0n)

  const { data, isLoading, error } = useQuery({
    queryKey: ['infinity-stable-calc-token-amount', poolAddress, amounts[0].toString(), amounts[1].toString(), deposit],
    queryFn: async () => {
      if (!infinityStableHook) return null
      return infinityStableHook.calcTokenAmount(amounts, deposit)
    },
    enabled: shouldQuery,
    ...QUERY_SETTINGS_IMMUTABLE,
  })

  return useMemo(
    () => ({
      tokenAmount: shouldQuery ? data ?? null : null,
      isLoading: shouldQuery ? isLoading : false,
      error: shouldQuery ? (error as Error | null) ?? null : null,
    }),
    [shouldQuery, data, isLoading, error],
  )
}

export const useUserLPBalance = ({ poolAddress, account }: UseUserLPBalanceParams): bigint | null => {
  const publicClient = usePublicClient()

  const infinityStableHook = useMemo(() => {
    if (!publicClient || !poolAddress) return null
    return new InfinityStableHook(poolAddress, publicClient)
  }, [poolAddress, publicClient])

  const shouldQuery = !!infinityStableHook && !!account

  const { data } = useQuery({
    queryKey: ['infinity-stable-user-lp-balance', poolAddress, account],
    queryFn: async () => {
      if (!infinityStableHook || !account) return null
      return infinityStableHook.balanceOf(account)
    },
    enabled: shouldQuery,
    ...QUERY_SETTINGS_IMMUTABLE,
  })

  return shouldQuery ? data ?? null : null
}

interface UseCalcWithdrawOneCoinParams {
  poolAddress: string
  burnAmount: bigint
  index: number
  enabled?: boolean
}

interface UseCalcWithdrawOneCoinReturn {
  amount: bigint | null
  isLoading: boolean
  error: Error | null
}

export const useCalcWithdrawOneCoin = ({
  poolAddress,
  burnAmount,
  index,
  enabled = true,
}: UseCalcWithdrawOneCoinParams): UseCalcWithdrawOneCoinReturn => {
  const publicClient = usePublicClient()

  const infinityStableHook = useMemo(() => {
    if (!publicClient || !poolAddress) return null
    return new InfinityStableHook(poolAddress, publicClient)
  }, [poolAddress, publicClient])

  const shouldQuery = enabled && !!infinityStableHook && burnAmount > 0n

  const { data, isLoading, error } = useQuery({
    queryKey: ['infinity-stable-calc-withdraw-one-coin', poolAddress, burnAmount.toString(), index],
    queryFn: async () => {
      if (!infinityStableHook) return null
      return infinityStableHook.calcWithdrawOneCoin(burnAmount, index)
    },
    enabled: shouldQuery,
    ...QUERY_SETTINGS_IMMUTABLE,
  })

  return useMemo(
    () => ({
      amount: shouldQuery ? data ?? null : null,
      isLoading: shouldQuery ? isLoading : false,
      error: shouldQuery ? (error as Error | null) ?? null : null,
    }),
    [shouldQuery, data, isLoading, error],
  )
}

export const usePoolBalances = ({ poolAddress }: { poolAddress: string }): [bigint | null, bigint | null] => {
  const publicClient = usePublicClient()

  const infinityStableHook = useMemo(() => {
    if (!publicClient || !poolAddress) return null
    return new InfinityStableHook(poolAddress, publicClient)
  }, [poolAddress, publicClient])

  const shouldQuery = !!infinityStableHook

  const { data } = useQuery({
    queryKey: ['infinity-stable-pool-balances', poolAddress],
    queryFn: async (): Promise<[bigint, bigint] | null> => {
      if (!infinityStableHook) return null
      const [balance0, balance1] = await Promise.all([infinityStableHook.balances(0), infinityStableHook.balances(1)])
      return [balance0, balance1]
    },
    enabled: shouldQuery,
    ...QUERY_SETTINGS_IMMUTABLE,
  })

  if (!shouldQuery || !data) {
    return [null, null]
  }

  return data
}
