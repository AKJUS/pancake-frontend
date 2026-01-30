import { Route, SmartRouterTrade } from '@pancakeswap/smart-router'
import { Currency, CurrencyAmount, Percent, TradeType } from '@pancakeswap/swap-sdk-core'

export type TradeEssentialForPriceBreakdown = Pick<SmartRouterTrade<TradeType>, 'inputAmount' | 'outputAmount'> & {
  routes: Pick<Route, 'percent' | 'pools' | 'path' | 'inputAmount'>[]
}

export interface TradePriceBreakdown {
  priceImpactWithoutFee?: Percent | null
  lpFeeAmount?: CurrencyAmount<Currency> | null
}
