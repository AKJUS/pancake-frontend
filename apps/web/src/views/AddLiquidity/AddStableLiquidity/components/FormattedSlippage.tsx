import { Percent, Rounding } from '@pancakeswap/sdk'

import CircleLoader from 'components/Loader/CircleLoader'
import { ONE_BIPS } from 'config/constants/exchange'
import { ErrorText } from 'views/Swap/components/styleds'
import { TextProps } from '@pancakeswap/uikit'
import { warningSeverity } from '../utils/slippage'

/**
 * Formatted version of price impact text with warning colors
 */
export function FormattedSlippage({
  slippage,
  loading = false,
  ...props
}: { slippage?: Percent; loading?: boolean } & TextProps) {
  const slippageDisplay = slippage
    ? slippage.lessThan(ONE_BIPS) || slippage.equalTo(0)
      ? '<0.01%'
      : `${slippage.toFixed(2, { groupSeparator: '' }, Rounding.ROUND_DOWN)}%`
    : '-'

  const text = loading ? <CircleLoader /> : slippageDisplay
  return (
    <ErrorText severity={slippage ? warningSeverity(slippage) : 0} {...props}>
      {text}
    </ErrorText>
  )
}
