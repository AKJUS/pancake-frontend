import { Currency } from '@pancakeswap/sdk'
import { Pool, SmartRouter } from '@pancakeswap/smart-router'

export function getInputCurrency(pool: Pool, currencyIn: Currency): Currency {
  const list = getCurrencies(pool)

  const result = list.find((currency) => currency.wrapped.equals(currencyIn.wrapped))
  if (!result) {
    throw new Error(
      `Cannot get input currency by invalid pool: pool=${list[0].symbol}-${list[1].symbol}, curIn=${currencyIn.symbol}`,
    )
  }
  return result
}

export function isFirstCurrency(pool: Pool, currency: Currency): boolean {
  const list = getCurrencies(pool)
  const first = list[0]
  return first.wrapped.equals(currency.wrapped)
}

export function getCurrencies(pool: Pool) {
  if (SmartRouter.isV2Pool(pool)) {
    const { reserve0, reserve1 } = pool
    return [reserve0.currency, reserve1.currency]
  }
  if (SmartRouter.isV3Pool(pool)) {
    const { token0, token1 } = pool
    return [token0, token1]
  }
  if (SmartRouter.isStablePool(pool)) {
    const { balances } = pool
    return balances.map((b) => b.currency)
  }
  if (
    SmartRouter.isInfinityClPool(pool) ||
    SmartRouter.isInfinityBinPool(pool) ||
    SmartRouter.isInfinityStablePool(pool)
  ) {
    const { currency0, currency1 } = pool
    return [currency0, currency1]
  }
  throw new Error('Cannot get tokens by invalid pool')
}
