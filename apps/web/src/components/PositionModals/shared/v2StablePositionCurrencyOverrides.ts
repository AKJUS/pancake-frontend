import type { ERC20Token } from '@pancakeswap/sdk'
import type { Currency } from '@pancakeswap/swap-sdk-core'
import { CurrencyAmount } from '@pancakeswap/swap-sdk-core'

/** V2 / stable LP detail: deposited token amounts (wallet + farming) for the position */
export type V2StableDepositedPosition = {
  nativeDeposited0: CurrencyAmount<ERC20Token>
  farmingDeposited0: CurrencyAmount<ERC20Token>
  nativeDeposited1: CurrencyAmount<ERC20Token>
  farmingDeposited1: CurrencyAmount<ERC20Token>
}

/**
 * Display balances for CurrencyInputPanelSimplify: pool position token amounts (not wallet).
 */
export function getV2StablePositionCurrencyOverrides(
  position: V2StableDepositedPosition,
  currency0: Currency | undefined,
  currency1: Currency | undefined,
): { override0: CurrencyAmount<Currency> | undefined; override1: CurrencyAmount<Currency> | undefined } {
  if (!currency0 || !currency1) {
    return { override0: undefined, override1: undefined }
  }
  const d0 = position.nativeDeposited0.add(position.farmingDeposited0)
  const d1 = position.nativeDeposited1.add(position.farmingDeposited1)
  const w0 = currency0.wrapped
  const w1 = currency1.wrapped

  if (d0.currency.equals(w0) && d1.currency.equals(w1)) {
    return {
      override0: CurrencyAmount.fromRawAmount(currency0, d0.quotient),
      override1: CurrencyAmount.fromRawAmount(currency1, d1.quotient),
    }
  }
  if (d0.currency.equals(w1) && d1.currency.equals(w0)) {
    return {
      override0: CurrencyAmount.fromRawAmount(currency0, d1.quotient),
      override1: CurrencyAmount.fromRawAmount(currency1, d0.quotient),
    }
  }
  return { override0: undefined, override1: undefined }
}
