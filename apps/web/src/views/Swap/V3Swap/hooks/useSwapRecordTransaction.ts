import { TradeType } from '@pancakeswap/sdk'
import { SmartRouter, SmartRouterTrade } from '@pancakeswap/smart-router'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import truncateHash from '@pancakeswap/utils/truncateHash'
import { useCallback } from 'react'
import { useSwapState } from 'state/swap/hooks'
import { useTransactionAdder } from 'state/transactions/hooks'
import { safeGetAddress } from 'utils'
import { basisPointsToPercent } from 'utils/exchange'
import { logSwap, LogTradeType, logTx } from 'utils/log'
import { Address } from 'viem'
import { useAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import { solanaUserSlippageAtomWithLocalStorage } from '@pancakeswap/utils/user'
import { useAtomValue } from 'jotai'
import { isSolana } from '@pancakeswap/chains'
import { InterfaceOrder } from 'views/Swap/utils'
import { SerializableTransactionReceipt } from 'state/transactions/actions'

export default function useSwapRecordTransaction(chainId?: number, account?: string) {
  const addTransaction = useTransactionAdder()
  const { recipient } = useSwapState()
  const recipientAddress = recipient === null ? account : recipient
  // @ts-ignore
  const { slippageTolerance: allowedSlippage } = useAutoSlippageWithFallback()
  const userSlippageTolerance = useAtomValue(solanaUserSlippageAtomWithLocalStorage)

  return useCallback(
    ({
      order,
      hash,
      type,
      receipt,
      isMultisig = false,
    }: {
      order: InterfaceOrder | undefined
      hash: Address
      type: LogTradeType
      receipt?: SerializableTransactionReceipt
      isMultisig?: boolean
    }) => {
      const trade = order?.trade
      if (!trade || !account || !chainId) return

      const pct = basisPointsToPercent(isSolana(chainId) ? userSlippageTolerance : allowedSlippage)

      const inputSymbol = trade.inputAmount.currency.symbol
      const outputSymbol = trade.outputAmount.currency.symbol

      let inputAmount: string | undefined
      let outputAmount: string | undefined

      if (isSolana(chainId)) {
        inputAmount = formatAmount(trade.inputAmount, 3)
        outputAmount = formatAmount(trade.outputAmount, 3)
      } else {
        inputAmount =
          trade.tradeType === TradeType.EXACT_INPUT
            ? formatAmount(trade.inputAmount, 3)
            : formatAmount(SmartRouter.maximumAmountIn(trade as SmartRouterTrade<TradeType.EXACT_INPUT>, pct), 3)
        outputAmount =
          trade.tradeType === TradeType.EXACT_OUTPUT
            ? formatAmount(trade.outputAmount, 3)
            : formatAmount(SmartRouter.minimumAmountOut(trade as SmartRouterTrade<TradeType.EXACT_OUTPUT>, pct), 3)
      }

      const base = `Swap ${
        trade.tradeType === TradeType.EXACT_OUTPUT ? 'max.' : ''
      } ${inputAmount} ${inputSymbol} for ${
        trade.tradeType === TradeType.EXACT_INPUT ? 'min.' : ''
      } ${outputAmount} ${outputSymbol}`

      const recipientAddressText =
        recipientAddress && safeGetAddress(recipientAddress) ? truncateHash(recipientAddress) : recipientAddress

      const withRecipient = recipientAddress === account ? base : `${base} to ${recipientAddressText}`

      const translatableWithRecipient =
        trade.tradeType === TradeType.EXACT_OUTPUT
          ? recipientAddress === account
            ? 'Swap max. %inputAmount% %inputSymbol% for %outputAmount% %outputSymbol%'
            : 'Swap max. %inputAmount% %inputSymbol% for %outputAmount% %outputSymbol% to %recipientAddress%'
          : recipientAddress === account
          ? 'Swap %inputAmount% %inputSymbol% for min. %outputAmount% %outputSymbol%'
          : 'Swap %inputAmount% %inputSymbol% for min. %outputAmount% %outputSymbol% to %recipientAddress%'

      if (!isMultisig) {
        addTransaction(
          { hash },
          {
            summary: withRecipient,
            translatableSummary: {
              text: translatableWithRecipient,
              data: {
                inputAmount,
                inputSymbol,
                outputAmount,
                outputSymbol,
                ...(recipientAddress !== account && { recipientAddress: recipientAddressText }),
              },
            },
            type: 'swap',
            receipt,
          },
        )
      }

      logSwap({
        tradeType: trade.tradeType,
        account,
        chainId,
        hash,
        inputAmount,
        outputAmount,
        input: trade.inputAmount.currency,
        output: trade.outputAmount.currency,
        type,
        isMultisig,
      })
      logTx({ account, chainId, hash })
    },
    [account, chainId, allowedSlippage, userSlippageTolerance, recipient, recipientAddress, addTransaction],
  )
}
