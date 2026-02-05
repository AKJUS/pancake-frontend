import { ERC20Token } from '@pancakeswap/sdk'
import { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useMemo } from 'react'

export const useTotalPriceUSD = ({
  currency0,
  currency1,
  amount0,
  amount1,
}: {
  currency0: Currency | null | undefined
  currency1: Currency | null | undefined
  amount0?: CurrencyAmount<ERC20Token | Currency>
  amount1?: CurrencyAmount<ERC20Token | Currency>
}) => {
  const { data: currency0PriceFromApi } = useCurrencyUsdPrice(currency0, {
    enabled: amount0 && amount0.greaterThan(0),
  })
  const { data: currency1PriceFromApi } = useCurrencyUsdPrice(currency1, {
    enabled: amount1 && amount1.greaterThan(0),
  })
  return useMemo(() => {
    return (
      Number(currency0PriceFromApi ?? 0) * Number(amount0 ? amount0.toExact() : 0) +
      Number(currency1PriceFromApi ?? 0) * Number(amount1 ? amount1.toExact() : 0)
    )
  }, [amount0, amount1, currency0PriceFromApi, currency1PriceFromApi])
}
