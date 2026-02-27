import { useMemo, useCallback } from 'react'
import { usePublicClient, useSendTransaction, useAccount } from 'wagmi'
import { calculateGasMargin } from 'utils'
import { InfinityStableHook } from '@pancakeswap/infinity-stable-sdk'

interface UseAddLiquidityInfinityStablePoolParams {
  poolAddress: string
}

export const useAddLiquidityInfinityStablePool = ({ poolAddress }: UseAddLiquidityInfinityStablePoolParams) => {
  const publicClient = usePublicClient()
  const { sendTransactionAsync } = useSendTransaction()
  const { address: account } = useAccount()

  const infinityStableHook = useMemo(() => {
    if (!publicClient || !poolAddress) return null
    return new InfinityStableHook(poolAddress, publicClient)
  }, [poolAddress, publicClient])

  const estimateGasOnly = useCallback(
    async (to: `0x${string}`, data: `0x${string}`, value?: bigint) => {
      if (!publicClient) throw new Error('Public client not available')
      if (!account) throw new Error('Account not connected')

      return publicClient.estimateGas({
        account,
        to,
        data,
        value,
      })
    },
    [publicClient, account],
  )

  const addLiquidityInfinityStablePool = useCallback(
    async (amount0: bigint, amount1: bigint, minMintAmount: bigint) => {
      if (!infinityStableHook) throw new Error('InfinityStableHook not initialized')
      if (!account) throw new Error('Account not connected')

      const calldata = infinityStableHook.getAddLiquidityCalldata(amount0, amount1, minMintAmount)
      const value = calldata.value ? BigInt(calldata.value) : undefined

      const gasLimit = await publicClient!.estimateGas({
        account,
        to: calldata.address,
        data: calldata.calldata,
        value,
      })

      const hash = await sendTransactionAsync({
        to: calldata.address,
        data: calldata.calldata,
        value,
        gas: calculateGasMargin(gasLimit),
      })

      return hash
    },
    [infinityStableHook, account, publicClient, sendTransactionAsync],
  )

  const estimateAddLiquidityInfinityStablePool = useCallback(
    async (amount0: bigint, amount1: bigint, minMintAmount: bigint) => {
      if (!infinityStableHook) throw new Error('InfinityStableHook not initialized')
      if (!account) throw new Error('Account not connected')

      const calldata = infinityStableHook.getAddLiquidityCalldata(amount0, amount1, minMintAmount)

      return estimateGasOnly(calldata.address, calldata.calldata, calldata.value ? BigInt(calldata.value) : undefined)
    },
    [infinityStableHook, account, estimateGasOnly],
  )

  return useMemo(
    () => ({
      addLiquidityInfinityStablePool,
      estimateAddLiquidityInfinityStablePool,
      isReady: !!infinityStableHook,
    }),
    [addLiquidityInfinityStablePool, estimateAddLiquidityInfinityStablePool, infinityStableHook],
  )
}
