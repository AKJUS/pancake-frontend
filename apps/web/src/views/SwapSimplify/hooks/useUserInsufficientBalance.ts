import { PriceOrder } from '@pancakeswap/price-api-sdk'
import { Currency, CurrencyAmount } from '@pancakeswap/sdk'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { useAllTypeBestTrade } from 'quoter/hook/useAllTypeBestTrade'
import { useMemo } from 'react'
import { Field } from 'state/swap/actions'
import { useCurrencyBalances } from 'state/wallet/hooks'
import { useAccount } from 'wagmi'
import { useSwapCurrency } from '../../Swap/V3Swap/hooks/useSwapCurrency'

export function useUserInsufficientBalance(order: PriceOrder | undefined): boolean {
  const [inputCurrency, outputCurrency] = useSwapCurrency()
  const { tradeLoaded } = useAllTypeBestTrade()
  const { address: account } = useAccount()
  const relevantTokenBalances = useCurrencyBalances(
    account ?? undefined,
    useMemo(() => [inputCurrency ?? undefined, outputCurrency ?? undefined], [inputCurrency, outputCurrency]),
  )

  const isInsufficientBalance = useMemo(() => {
    const currencyBalances = {
      [Field.INPUT]: relevantTokenBalances[0],
      [Field.OUTPUT]: relevantTokenBalances[1],
    }
    if (!account || !order || !tradeLoaded) {
      return false
    }

    // use the actual input amount instead of the slippage adjusted amount
    const balanceIn = currencyBalances[Field.INPUT]
    const actualInputAmount = order.trade?.inputAmount

    if (balanceIn && actualInputAmount && balanceIn.lessThan(actualInputAmount)) {
      return true
    }
    return false
  }, [account, relevantTokenBalances, order, tradeLoaded])

  return isInsufficientBalance
}

export function useUserInsufficientBalanceLight(
  token: Currency,
  userMaxAmount?: CurrencyAmount<Currency>,
  inputText?: string,
): boolean {
  const { address: account } = useAccount()

  const isInsufficientBalance = useMemo(() => {
    if (!account || !userMaxAmount || !inputText) {
      return false
    }

    const actualInputAmount = tryParseAmount(inputText, token)
    const balanceIn = userMaxAmount

    if (balanceIn && actualInputAmount && balanceIn.lessThan(actualInputAmount)) {
      return true
    }
    return false
  }, [account, userMaxAmount, inputText, token])

  return isInsufficientBalance
}
