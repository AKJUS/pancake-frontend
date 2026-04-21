import { useTranslation } from '@pancakeswap/localization'
import { FeeOptions } from '@pancakeswap/v3-sdk'
import { useMemo } from 'react'

import { useSwapState } from 'state/swap/hooks'
import { basisPointsToPercent } from 'utils/exchange'

import { ClassicOrder } from '@pancakeswap/price-api-sdk'
import { Permit2Signature } from '@pancakeswap/universal-router-sdk'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import { Address } from 'viem'
import { ChainId as EvmChainId } from '@pancakeswap/chains'
import { getAggregatorQuoteData } from 'quoter/utils/aggregatorOrder'
import useSendSwapTransaction from './useSendSwapTransaction'
import { useSwapCallArguments, SwapCall } from './useSwapCallArguments'
import { useAggregatorSwapCallback } from './useAggregatorSwapCallback'
import type { TWallchainMasterInput, WallchainStatus } from './useWallchain'

export enum SwapCallbackState {
  INVALID,
  LOADING,
  VALID,
  REVERTED,
}

interface UseSwapCallbackReturns {
  state: SwapCallbackState
  callback?: () => Promise<{ hash: Address }>
  swapCalls?: SwapCall[]
  error?: string
  reason?: string
}

interface UseSwapCallbackArgs {
  order: ClassicOrder | undefined | null // classic order to execute; trade is derived from it
  deadline?: bigint
  permitSignature: Permit2Signature | undefined
  feeOptions?: FeeOptions
  onWallchainDrop?: () => void
  statusWallchain?: WallchainStatus
  wallchainMasterInput?: TWallchainMasterInput
}

// returns a function that will execute a swap, if the parameters are all valid
// and the user has approved the slippage adjusted input amount for the trade
export function useSwapCallback({
  order,
  deadline,
  permitSignature,
  feeOptions,
}: UseSwapCallbackArgs): UseSwapCallbackReturns {
  const trade = order?.trade
  const { t } = useTranslation()
  const { account, chainId } = useAccountActiveChain()
  const { slippageTolerance: allowedSlippageRaw } = useAutoSlippageWithFallback()
  const { recipient: recipientAddress } = useSwapState()
  const recipient = recipientAddress === null ? account : recipientAddress

  // Classification comes directly off the order — not from a module-level Map.
  const quoteData = getAggregatorQuoteData(order)

  // --- Aggregator path ---
  const { callback: aggregatorCallback } = useAggregatorSwapCallback({
    trade,
    quoteData: quoteData!,
    recipient: recipient ?? '',
    chainId: chainId ?? 0,
    account: account!,
    slippageBps: allowedSlippageRaw,
    deadline,
  })

  // --- On-chain path ---
  // Pass null for aggregator trades so useSwapCallArguments never attempts to build
  // Universal Router calldata from aggregator stub pools.
  const swapCalls = useSwapCallArguments(
    quoteData ? null : trade,
    basisPointsToPercent(allowedSlippageRaw),
    recipientAddress,
    permitSignature,
    deadline,
    feeOptions,
  )
  const { callback: onChainCallback } = useSendSwapTransaction(
    account,
    chainId,
    trade ?? undefined,
    swapCalls,
    'UniversalRouter',
  )

  const callback = quoteData ? aggregatorCallback : onChainCallback ?? undefined

  return useMemo(() => {
    if (!trade || !account || !chainId || !callback || !(chainId in EvmChainId)) {
      return { state: SwapCallbackState.INVALID, error: t('Missing dependencies') }
    }
    if (!recipient) {
      if (recipientAddress !== null) {
        return { state: SwapCallbackState.INVALID, error: t('Invalid recipient') }
      }
      return { state: SwapCallbackState.LOADING }
    }

    return {
      state: SwapCallbackState.VALID,
      callback,
      swapCalls,
    }
  }, [swapCalls, trade, account, chainId, callback, recipient, recipientAddress, t])
}
