import { ChainId } from '@pancakeswap/chains'
import { PoolKey, encodeCLPositionManagerDecreaseLiquidityCalldata } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { usePublicNodeWaitForTransaction } from 'hooks/usePublicNodeWaitForTransaction'
import { useCallback, useState } from 'react'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { useTransactionAdder } from 'state/transactions/hooks'
import { calculateGasMargin } from 'utils'
import { getInfinityPositionManagerAddress } from 'utils/addressHelpers'
import { isUserRejected } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { getViemClients } from 'utils/viem'
import type { Address, Hex } from 'viem'
import { type UseSendTransactionReturnType, useSendTransaction } from 'wagmi'

export type RemoveClLiquidityParam = {
  tokenId: bigint
  poolKey: PoolKey<'CL'>
  liquidity: bigint
  wrapAddress?: Address
  amount0Min: bigint
  amount1Min: bigint
  deadline: bigint
  hookData?: Hex
}

export const removeClLiquidity = async (
  sendTransactionAsync: UseSendTransactionReturnType['sendTransactionAsync'],
  params: RemoveClLiquidityParam,
  to: Address,
  chainId: ChainId,
  account: Address,
  onDone?: (response: Hex) => void,
  onError?: (error: any) => void,
  setAttemptingTx?: (attemptingTx: boolean) => void,
) => {
  console.debug('debug removeLiquidity', params)
  const data = encodeCLPositionManagerDecreaseLiquidityCalldata({
    tokenId: params.tokenId,
    poolKey: params.poolKey,
    liquidity: params.liquidity,
    amount0Min: params.amount0Min,
    amount1Min: params.amount1Min,
    wrapAddress: params.wrapAddress,
    recipient: account,
    hookData: params.hookData,
    deadline: params.deadline,
  })

  getViemClients({ chainId })
    ?.estimateGas({
      account,
      to,
      data,
    })
    .then((gasLimit) => {
      setAttemptingTx?.(true)
      return sendTransactionAsync({
        account,
        to,
        data,
        gas: calculateGasMargin(gasLimit),
        chainId,
      })
    })
    .then((response) => {
      onDone?.(response)
    })
    .catch((err) => {
      onError?.(err)
      // we only care if the error is something _other_ than the user rejected the tx
      // if (!isUserRejected(err)) {
      //   setTxnErrorMessage(transactionErrorToUserReadableMessage(err, t))
      // }
    })
}

export const useRemoveClLiquidity = (
  chainId: ChainId | undefined,
  account: Address | undefined,
  onDone?: (response: Hex) => void,
  onError?: (error: any) => void,
) => {
  const addTransaction = useTransactionAdder()
  const [txHash, setTxHash] = useState<Address | null>(null)
  const [attemptingTx, setAttemptingTx] = useState<boolean>(false)
  const [txnErrorMessage, setTxnErrorMessage] = useState<string | undefined>()
  const { t } = useTranslation()
  const positionManagerAddress = getInfinityPositionManagerAddress('CL', chainId)
  const { sendTransactionAsync } = useSendTransaction()
  const [, setLatestTxReceipt] = useLatestTxReceipt()
  const { waitForTransaction } = usePublicNodeWaitForTransaction(chainId)

  const removeLiquidity = useCallback(
    async (params: RemoveClLiquidityParam) => {
      if (!chainId || !account) return
      const onTxDone = async (response: Hex) => {
        setTxHash(response)
        addTransaction(
          { hash: response },
          {
            type: 'remove-liquidity-infinity-cl',
            summary: `Remove liquidity from ${params.tokenId}`,
          },
        )
        const receipt = await waitForTransaction({
          hash: response,
        })
        // waiting for transaction receipt
        setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
        setAttemptingTx?.(false)
        onDone?.(response)
      }

      const onTxError = (error: any) => {
        setAttemptingTx?.(false)
        console.error(error)

        if (!isUserRejected(error)) {
          setTxnErrorMessage(transactionErrorToUserReadableMessage(error, t))
        }
        onError?.(error)
      }

      await removeClLiquidity(
        sendTransactionAsync,
        params,
        positionManagerAddress,
        chainId,
        account,
        onTxDone,
        onTxError,
        setAttemptingTx,
      )
    },
    [
      positionManagerAddress,
      sendTransactionAsync,
      chainId,
      account,
      onDone,
      addTransaction,
      onError,
      t,
      waitForTransaction,
      setLatestTxReceipt,
    ],
  )
  return { removeLiquidity, txHash, attemptingTx, txnErrorMessage }
}
