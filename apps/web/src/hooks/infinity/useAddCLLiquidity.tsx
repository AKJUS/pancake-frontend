import type { ChainId } from '@pancakeswap/chains'
import {
  type CLPositionConfig,
  type PoolKey,
  addCLLiquidityMulticall,
  getIsInitializedByPoolKey,
} from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import type { Currency } from '@pancakeswap/swap-sdk-core'
import { Modal, useModal } from '@pancakeswap/uikit'
import type { Permit2Signature } from '@pancakeswap/universal-router-sdk'
import {
  TickMath,
  maxLiquidityForAmount0Precise,
  maxLiquidityForAmount1,
  maxLiquidityForAmounts,
} from '@pancakeswap/v3-sdk'
import { ConfirmationPendingContent } from '@pancakeswap/widgets-internal'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { useInfinityCLPositionManagerContract } from 'hooks/useContract'
import { usePublicNodeWaitForTransaction } from 'hooks/usePublicNodeWaitForTransaction'
import { useSafeTxHashTransformer } from 'hooks/useSafeTxHashTransformer'
import { useCallback, useState } from 'react'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { useTransactionAdder } from 'state/transactions/hooks'
import { calculateGasMargin } from 'utils'
import { formatRawAmount } from 'utils/formatCurrencyAmount'
import { isUserRejected } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { getViemClients } from 'utils/viem'
import { type Address, type Hex } from 'viem'
import { ErrorModal } from 'views/AddLiquidityInfinity/components/ErrorModal'
import { type UseSendTransactionReturnType, useSendTransaction } from 'wagmi'

export type AddLiquidityParams = {
  tokenId?: bigint | undefined
  poolKey: PoolKey<'CL'>
  tickUpper: number
  tickLower: number
  sqrtPriceX96: bigint
  amount0Desired: bigint
  amount1Desired: bigint
  lastEditCurrency: 0 | 1
  amount0Max: bigint
  amount1Max: bigint
  recipient: Hex
  deadline: bigint
  modifyPositionHookData?: Hex
  currency0: Currency
  currency1: Currency
  token0Permit2Signature?: Permit2Signature | undefined
  token1Permit2Signature?: Permit2Signature | undefined
}

export const addCLiquidity = async (
  sendTransactionAsync: UseSendTransactionReturnType['sendTransactionAsync'],
  params: AddLiquidityParams,
  to: Address,
  chainId: ChainId,
  account: Address,
  onDone?: (response: Hex) => void,
  onError?: (error: any) => void,
  setAttemptingTx?: (attemptingTx: boolean) => void,
) => {
  let liquidity = 0n
  let isInitialized = true
  const publicClient = getViemClients({ chainId })
  try {
    if (params.amount0Desired === 0n || params.amount1Desired === 0n) {
      liquidity = maxLiquidityForAmounts(
        params.sqrtPriceX96,
        TickMath.getSqrtRatioAtTick(params.tickLower),
        TickMath.getSqrtRatioAtTick(params.tickUpper),
        params.amount0Desired,
        params.amount1Desired,
        true,
      )
    } else {
      const getLiquidity = params.lastEditCurrency === 0 ? maxLiquidityForAmount0Precise : maxLiquidityForAmount1
      const liquidityFromAmount = params.lastEditCurrency === 0 ? params.amount0Desired : params.amount1Desired
      liquidity = getLiquidity(
        params.sqrtPriceX96,
        params.lastEditCurrency === 0
          ? TickMath.getSqrtRatioAtTick(params.tickUpper)
          : TickMath.getSqrtRatioAtTick(params.tickLower),
        liquidityFromAmount,
      )
    }
    isInitialized = await getIsInitializedByPoolKey(publicClient, params.poolKey)
  } catch (error) {
    console.error(error)
  }
  const positionConfig: CLPositionConfig = {
    poolKey: params.poolKey,
    tickLower: params.tickLower,
    tickUpper: params.tickUpper,
  }
  const data = addCLLiquidityMulticall({
    isInitialized,
    sqrtPriceX96: params.sqrtPriceX96,
    tokenId: params.tokenId,
    positionConfig,
    liquidity,
    owner: account,
    recipient: params.recipient,
    amount0Max: params.amount0Max,
    amount1Max: params.amount1Max,
    deadline: params.deadline,
    modifyPositionHookData: params.modifyPositionHookData ?? '0x',
    token0Permit2Signature: params.token0Permit2Signature,
    token1Permit2Signature: params.token1Permit2Signature,
  })

  const value = params.currency0.isNative ? params.amount0Desired : 0n

  return publicClient
    ?.estimateGas({
      account,
      to,
      data,
      value,
    })
    .then((gasLimit) => {
      setAttemptingTx?.(true)
      try {
        return sendTransactionAsync({
          account,
          to,
          data,
          value,
          gas: calculateGasMargin(gasLimit),
          chainId,
        })
      } catch (error) {
        console.error('send tx error')
        console.trace(error)
        throw error
      }
    })
    .then(async (response) => {
      await onDone?.(response)
    })
    .catch((err) => {
      console.error(err)
      onError?.(err)
    })
    .finally(() => {
      setAttemptingTx?.(false)
    })
}

const ConfirmModal: React.FC<React.PropsWithChildren> = (props) => {
  return (
    <Modal title="" headerBackground="transparent" headerBorderColor="transparent" hideCloseButton {...props}>
      <ConfirmationPendingContent />
    </Modal>
  )
}

export const useAddCLPoolAndPosition = (
  chainId: ChainId,
  account: Address,
  baseCurrencyAddress: Address,
  quoteCurrencyAddress: Address,
  onDone?: () => void,
  onError?: (error: any) => void,
) => {
  const addTransaction = useTransactionAdder()
  const [txHash, setTxHash] = useState<Address | null>(null)
  const [attemptingTx, setAttemptingTx] = useState<boolean>(false)
  const [txnErrorMessage, setTxnErrorMessage] = useState<string | undefined>()
  const { t } = useTranslation()
  const baseCurrency = useCurrencyByChainId(baseCurrencyAddress, chainId)
  const positionManagerContract = useInfinityCLPositionManagerContract(chainId)
  const quoteCurrency = useCurrencyByChainId(quoteCurrencyAddress, chainId)
  const { sendTransactionAsync } = useSendTransaction()
  const [, setLatestTxReceipt] = useLatestTxReceipt()
  const { waitForTransaction } = usePublicNodeWaitForTransaction(chainId)
  const safeTxHashTransformer = useSafeTxHashTransformer()
  const [onPresentConfirmationModal, onDismissConfirmationModal] = useModal(
    <ConfirmModal />,
    true,
    true,
    'infinity-cl-add-liquidity-modal',
  )
  const [onPresentErrorModal] = useModal(
    <ErrorModal title={t('Add Liquidity')} subTitle={txnErrorMessage} />,
    true,
    true,
    'infinity-cl-add-liquidity-error-modal',
  )

  const addCLLiquidity = useCallback(
    (params: AddLiquidityParams) => {
      onPresentConfirmationModal()
      const onTxDone = async (response: Hex) => {
        onDismissConfirmationModal()
        setTxHash(response)
        if (baseCurrency && quoteCurrency) {
          const baseAmount = formatRawAmount(params.amount0Desired?.toString() ?? '0', baseCurrency?.decimals, 4)
          const quoteAmount = formatRawAmount(params.amount1Desired?.toString() ?? '0', quoteCurrency.decimals, 4)
          addTransaction(
            { hash: response },
            {
              type: 'add-liquidity-infinity-cl',
              summary: `Increase ${baseAmount} ${baseCurrency?.symbol} and ${quoteAmount} ${quoteCurrency?.symbol}`,
            },
          )
        }
        const realHash = await safeTxHashTransformer(response)
        const receipt = await waitForTransaction({ hash: realHash })
        setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
        onDone?.()
      }

      const onTxError = (error: any) => {
        console.error(error)
        onDismissConfirmationModal()
        if (!isUserRejected(error)) {
          setTxnErrorMessage(transactionErrorToUserReadableMessage(error, t))
          onPresentErrorModal()
        }
        onError?.(error)
      }

      return addCLiquidity(
        sendTransactionAsync,
        params,
        positionManagerContract.address,
        chainId,
        account,
        onTxDone,
        onTxError,
        setAttemptingTx,
      )
    },
    [
      onPresentConfirmationModal,
      onPresentErrorModal,
      sendTransactionAsync,
      positionManagerContract.address,
      chainId,
      account,
      onDismissConfirmationModal,
      baseCurrency,
      quoteCurrency,
      setLatestTxReceipt,
      waitForTransaction,
      safeTxHashTransformer,
      onDone,
      addTransaction,
      onError,
      t,
    ],
  )
  return { addCLLiquidity, txHash, attemptingTx, txnErrorMessage }
}
