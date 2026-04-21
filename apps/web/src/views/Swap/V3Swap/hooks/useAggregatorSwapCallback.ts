import { ChainId } from '@pancakeswap/chains'
import { OrderType } from '@pancakeswap/price-api-sdk'
import { useCallback } from 'react'
import { Address, Hex, hexToBigInt } from 'viem'
import { useSendTransaction } from 'wagmi'
import { calculateGasMargin, getGasMarginByChain } from 'utils'
import { viemClients } from 'utils/viem'
import { InterfaceOrder } from 'views/Swap/utils'
import { aggregatorService } from 'quoter/atom/bestAggregatorQuoteAtom'
import type { AggregatorQuoteData } from '@pancakeswap/aggregator-sdk'
import type { ClassicOrder } from '@pancakeswap/price-api-sdk'
import { verifyAggregatorCalldata } from '../utils/verifyAggregatorCalldata'
import { isZero } from '../utils/isZero'
import useSwapRecordTransaction from './useSwapRecordTransaction'

interface UseAggregatorSwapCallbackArgs {
  trade: ClassicOrder['trade'] | undefined | null
  quoteData: AggregatorQuoteData
  recipient: string
  chainId: number
  account: Address
  slippageBps: number
  deadline?: bigint
}

export function useAggregatorSwapCallback({
  trade,
  quoteData,
  recipient,
  chainId,
  account,
  slippageBps,
  deadline,
}: UseAggregatorSwapCallbackArgs) {
  const { sendTransactionAsync } = useSendTransaction()
  const addSwapTransaction = useSwapRecordTransaction(chainId, account)

  const callback = useCallback(async (): Promise<{ hash: Address }> => {
    const calldataResult = await aggregatorService.getCalldata({
      chainId,
      quoteData,
      recipient,
      slippageBps,
      ...(deadline != null ? { deadline: Number(deadline) } : {}),
    })

    // Three independent pre-send checks against router/spender/recipient tampering.
    // See verifyAggregatorCalldata.ts + doc/aggregation-implementation/plan-19-04.md.
    const { txTo, txData } = verifyAggregatorCalldata({ chainId, quoteData, recipient, calldataResult })

    const txValue =
      calldataResult.value && !isZero(calldataResult.value as Hex) ? hexToBigInt(calldataResult.value as Hex) : 0n

    const publicClient = viemClients[chainId as ChainId]
    const gasEstimate = await publicClient.estimateGas({
      account,
      to: txTo,
      data: txData,
      value: txValue,
    })

    const hash = await sendTransactionAsync({
      account,
      chainId,
      to: txTo,
      data: txData,
      value: txValue,
      gas: calculateGasMargin(gasEstimate, getGasMarginByChain(chainId)),
    })

    addSwapTransaction({
      order: { type: OrderType.PCS_CLASSIC, trade } as InterfaceOrder,
      hash,
      type: 'Aggregator',
    })

    return { hash }
  }, [trade, quoteData, recipient, chainId, account, slippageBps, deadline, sendTransactionAsync, addSwapTransaction])

  return { callback }
}
