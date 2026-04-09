/* eslint-disable @typescript-eslint/no-unused-vars */
import { Percent } from '@pancakeswap/sdk'
import {
  PancakeSwapUniversalRouter,
  Permit2Signature,
  getUniversalRouterAddress,
} from '@pancakeswap/universal-router-sdk'
import { FeeOptions } from '@pancakeswap/v3-sdk'
import { useMemo } from 'react'
import { ChainId as EvmChainId } from '@pancakeswap/chains'

import { useGetENSAddressByName } from 'hooks/useGetENSAddressByName'

import { ClassicOrder } from '@pancakeswap/price-api-sdk'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { safeGetAddress } from 'utils'
import { Address, Hex } from 'viem'
import { appendDataSuffix, buildBuilderCodeDataSuffix } from 'utils/erc8021'

export interface SwapCall {
  address: Address
  calldata: Hex
  value: Hex
}

/**
 * Returns the swap calls that can be used to make the trade
 * @param trade trade to execute
 * @param allowedSlippage user allowed slippage
 * @param recipientAddressOrName the ENS name or address of the recipient of the swap output
 * @param deadline the deadline for executing the trade
 * @param feeOptions the fee options to be applied to the trade.
 */
export function useSwapCallArguments(
  trade: ClassicOrder['trade'] | undefined | null,
  allowedSlippage: Percent,
  recipientAddressOrName: string | null | undefined,
  permitSignature: Permit2Signature | undefined,
  deadline: bigint | undefined,
  feeOptions: FeeOptions | undefined,
): SwapCall[] {
  const { account, chainId } = useAccountActiveChain()
  const recipientENSAddress = useGetENSAddressByName(recipientAddressOrName ?? undefined)
  const recipient = (
    recipientAddressOrName === null || recipientAddressOrName === undefined
      ? account
      : safeGetAddress(recipientAddressOrName)
      ? recipientAddressOrName
      : safeGetAddress(recipientENSAddress)
      ? recipientENSAddress
      : null
  ) as Address | null

  return useMemo(() => {
    if (!trade || !recipient || !account || !chainId || !(chainId in EvmChainId)) return []

    const options = {
      fee: feeOptions,
      recipient,
      inputTokenPermit: permitSignature,
      slippageTolerance: allowedSlippage,
      deadlineOrPreviousBlockhash: deadline?.toString(),
    }
    const methodParameters = PancakeSwapUniversalRouter.swapERC20CallParameters(trade, options)
    const swapRouterAddress = getUniversalRouterAddress(chainId)
    if (!swapRouterAddress) return []
    let calldata = methodParameters.calldata as `0x${string}`

    if (chainId === EvmChainId.BASE) {
      const builderCode = 'bc_l4vqaa9e'
      if (builderCode) {
        try {
          const suffix = buildBuilderCodeDataSuffix(builderCode)
          calldata = appendDataSuffix(calldata, suffix)
        } catch (error) {
          console.warn('[BuilderCode] Invalid builder code, skipping suffix:', error)
        }
      }
    }

    return [
      {
        address: swapRouterAddress,
        calldata,
        value: methodParameters.value as `0x${string}`,
      },
    ]
  }, [account, allowedSlippage, chainId, deadline, feeOptions, recipient, permitSignature, trade])
}
