import { Price, UnifiedCurrency, UnifiedToken } from '@pancakeswap/sdk'
import { Bound } from 'config/constants/types'
import { formatPrice } from 'utils/formatCurrencyAmount'

export function formatTickPrice(
  price: Price<UnifiedToken, UnifiedToken> | Price<UnifiedCurrency, UnifiedCurrency> | undefined,
  atLimit: { [bound in Bound]?: boolean | undefined },
  direction: Bound,
  locale: string,
  placeholder?: string,
) {
  if (atLimit[direction]) {
    return direction === Bound.LOWER ? '0' : '∞'
  }

  if (!price && placeholder !== undefined) {
    return placeholder
  }

  return formatPrice(price, 6, locale)
}
