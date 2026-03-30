import { useMemo, useCallback } from 'react'
import { usePublicClient, useSendTransaction, useAccount } from 'wagmi'
import { calculateGasMargin } from 'utils'
import { InfinityStableHook } from '@pancakeswap/infinity-stable-sdk'

interface UseRemoveLiquidityInfinityStablePoolParams {
  poolAddress: string
  chainId?: number
}

export const useRemoveLiquidityInfinityStablePool = ({
  poolAddress,
  chainId,
}: UseRemoveLiquidityInfinityStablePoolParams) => {
  const publicClient = usePublicClient({ chainId })
  const { sendTransactionAsync } = useSendTransaction()
  const { address: account } = useAccount()

  const infinityStableHook = useMemo(() => {
    if (!publicClient || !poolAddress) return null
    return new InfinityStableHook(poolAddress, publicClient)
  }, [poolAddress, publicClient])

  // Estimate gas only (for preflight checks)
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

  const sendTransactionWithGasEstimate = useCallback(
    async (to: `0x${string}`, data: `0x${string}`, value?: bigint) => {
      if (!publicClient) throw new Error('Public client not available')
      if (!account) throw new Error('Account not connected')

      return publicClient
        .estimateGas({
          account,
          to,
          data,
          value,
        })
        .then((gasLimit) => {
          console.log('success estimate gas: ', { to, data, value })
          return sendTransactionAsync({
            to,
            data,
            value,
            gas: calculateGasMargin(gasLimit),
          })
        })
    },
    [publicClient, account, sendTransactionAsync],
  )

  const removeLiquidityInfinityStablePool = useCallback(
    async (burnAmount: bigint, minAmount0: bigint, minAmount1: bigint) => {
      if (!infinityStableHook) throw new Error('InfinityStableHook not initialized')
      if (!account) throw new Error('Account not connected')

      const calldata = infinityStableHook.getRemoveLiquidityCalldata(burnAmount, minAmount0, minAmount1, account)

      const hash = await sendTransactionWithGasEstimate(
        calldata.address,
        calldata.calldata,
        calldata.value ? BigInt(calldata.value) : undefined,
      )

      return hash
    },
    [infinityStableHook, account, sendTransactionWithGasEstimate],
  )

  const removeLiquidityOneCoin = useCallback(
    async (burnAmount: bigint, zeroOrOne: boolean, minReceived: bigint) => {
      if (!infinityStableHook) throw new Error('InfinityStableHook not initialized')
      if (!account) throw new Error('Account not connected')

      const calldata = infinityStableHook.getRemoveLiquidityOneCoinCalldata(burnAmount, zeroOrOne, minReceived)

      const hash = await sendTransactionWithGasEstimate(
        calldata.address,
        calldata.calldata,
        calldata.value ? BigInt(calldata.value) : undefined,
      )

      return hash
    },
    [infinityStableHook, account, sendTransactionWithGasEstimate],
  )

  const removeLiquidityImbalance = useCallback(
    async (amount0: bigint, amount1: bigint, maxBurnAmount: bigint) => {
      if (!infinityStableHook) throw new Error('InfinityStableHook not initialized')
      if (!account) throw new Error('Account not connected')

      const calldata = infinityStableHook.getRemoveLiquidityImbalanceCalldata(amount0, amount1, maxBurnAmount)

      const hash = await sendTransactionWithGasEstimate(
        calldata.address,
        calldata.calldata,
        calldata.value ? BigInt(calldata.value) : undefined,
      )

      return hash
    },
    [infinityStableHook, account, sendTransactionWithGasEstimate],
  )

  // Preflight estimation methods (for gas checks before user submits)
  const estimateRemoveLiquidityInfinityStablePool = useCallback(
    async (burnAmount: bigint, minAmount0: bigint, minAmount1: bigint) => {
      if (!infinityStableHook) throw new Error('InfinityStableHook not initialized')
      if (!account) throw new Error('Account not connected')

      const calldata = infinityStableHook.getRemoveLiquidityCalldata(burnAmount, minAmount0, minAmount1, account)

      return estimateGasOnly(calldata.address, calldata.calldata, calldata.value ? BigInt(calldata.value) : undefined)
    },
    [infinityStableHook, account, estimateGasOnly],
  )

  const estimateRemoveLiquidityOneCoin = useCallback(
    async (burnAmount: bigint, zeroOrOne: boolean, minReceived: bigint) => {
      if (!infinityStableHook) throw new Error('InfinityStableHook not initialized')
      if (!account) throw new Error('Account not connected')

      const calldata = infinityStableHook.getRemoveLiquidityOneCoinCalldata(burnAmount, zeroOrOne, minReceived)

      return estimateGasOnly(calldata.address, calldata.calldata, calldata.value ? BigInt(calldata.value) : undefined)
    },
    [infinityStableHook, account, estimateGasOnly],
  )

  const estimateRemoveLiquidityImbalance = useCallback(
    async (amount0: bigint, amount1: bigint, maxBurnAmount: bigint) => {
      if (!infinityStableHook) throw new Error('InfinityStableHook not initialized')
      if (!account) throw new Error('Account not connected')

      const calldata = infinityStableHook.getRemoveLiquidityImbalanceCalldata(amount0, amount1, maxBurnAmount)

      return estimateGasOnly(calldata.address, calldata.calldata, calldata.value ? BigInt(calldata.value) : undefined)
    },
    [infinityStableHook, account, estimateGasOnly],
  )

  return useMemo(
    () => ({
      removeLiquidityInfinityStablePool,
      removeLiquidityOneCoin,
      removeLiquidityImbalance,
      estimateRemoveLiquidityInfinityStablePool,
      estimateRemoveLiquidityOneCoin,
      estimateRemoveLiquidityImbalance,
      isReady: !!infinityStableHook,
    }),
    [
      removeLiquidityInfinityStablePool,
      removeLiquidityOneCoin,
      removeLiquidityImbalance,
      estimateRemoveLiquidityInfinityStablePool,
      estimateRemoveLiquidityOneCoin,
      estimateRemoveLiquidityImbalance,
      infinityStableHook,
    ],
  )
}
