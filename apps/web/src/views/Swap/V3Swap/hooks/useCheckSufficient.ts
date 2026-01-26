import { useAccount } from 'wagmi'

import { useCurrency } from 'hooks/Tokens'
import first from 'lodash/first'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { useCurrencyBalances } from 'state/wallet/hooks'

import { InterfaceOrder } from 'views/Swap/utils'
import { useMemo } from 'react'
import { useSlippageAdjustedAmounts } from './useSlippageAdjustedAmounts'

export function useCheckInsufficientError(order?: InterfaceOrder | null | undefined) {
  const { address: account } = useAccount()

  const {
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
  } = useSwapState()

  const inputCurrency = useCurrency(inputCurrencyId, inputChainId)
  const outputCurrency = useCurrency(outputCurrencyId, outputChainId)

  const slippageAdjustedAmounts = useSlippageAdjustedAmounts(order)

  const currencyBalances = useCurrencyBalances(
    account ?? undefined,
    useMemo(() => [inputCurrency ?? undefined, outputCurrency ?? undefined], [inputCurrency, outputCurrency]),
  )

  const [balanceIn, amountIn] = [
    first(currencyBalances),
    slippageAdjustedAmounts ? slippageAdjustedAmounts[Field.INPUT] : null,
  ]

  return balanceIn && amountIn && balanceIn.lessThan(amountIn) ? inputCurrency : undefined
}
