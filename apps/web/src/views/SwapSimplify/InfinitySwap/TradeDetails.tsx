import { SmartRouter } from '@pancakeswap/smart-router'
import { AutoColumn, Box } from '@pancakeswap/uikit'
import { memo, useMemo } from 'react'

import { styled } from 'styled-components'

import { Currency } from '@pancakeswap/sdk'
import { PriceOrder } from '@pancakeswap/price-api-sdk'
import { isBridgeOrder, isClassicOrder, isXOrder } from 'views/Swap/utils'
import { RouteDisplayEssentials } from 'views/Swap/V3Swap/components/RouteDisplayModal'
import { useIsWrapping, useSlippageAdjustedAmounts } from '../../Swap/V3Swap/hooks'
import { useHasDynamicHook } from '../hooks/useHasDynamicHook'
import { TradeSummary } from './AdvancedSwapDetails'
import { RoutesBreakdown, XRoutesBreakdown } from './RoutesBreakdown'
import { usePriceBreakdown } from '../hooks/usePriceBreakdown'

export const AdvancedDetailsFooter = styled.div.withConfig({
  shouldForwardProp: (prop) => !['show'].includes(prop),
})<{ show: boolean }>`
  margin-top: ${({ show }) => (show ? '16px' : 0)};
  padding-top: 16px;
  padding-bottom: 16px;
  width: 100%;
  border-radius: 20px;
  background-color: transparent;
  transform: ${({ show }) => (show ? 'translateY(0%)' : 'translateY(-100%)')};
  transition: transform 300ms ease-in-out;
`

interface Props {
  loaded: boolean
  order?: PriceOrder
}

export const TradeDetails = memo(function TradeDetails({ loaded, order }: Props) {
  const slippageAdjustedAmounts = useSlippageAdjustedAmounts(order)
  const isWrapping = useIsWrapping()
  const priceBreakdown = usePriceBreakdown(order)
  const hasStablePool = useMemo(
    () =>
      isClassicOrder(order)
        ? order.trade?.routes.some((route) => route.pools.some(SmartRouter.isStablePool))
        : undefined,
    [order],
  )
  const hasDynamicHook = useHasDynamicHook(order)

  if (isWrapping || !order || !slippageAdjustedAmounts || !order.trade) {
    return null
  }

  const { inputAmount, outputAmount, tradeType } = order.trade

  return (
    <AdvancedDetailsFooter show>
      <AutoColumn gap="0px">
        <TradeSummary
          order={order}
          expectedFillTimeSec={isBridgeOrder(order) ? order.expectedFillTimeSec : undefined}
          isX={isXOrder(order)}
          slippageAdjustedAmounts={slippageAdjustedAmounts}
          inputAmount={inputAmount}
          outputAmount={outputAmount}
          tradeType={tradeType}
          priceBreakdown={priceBreakdown}
          hasStablePair={hasStablePool}
          hasDynamicHook={hasDynamicHook}
          loading={!loaded}
        />
        <Box mt="10px" pl="4px">
          {isXOrder(order) ? (
            <XRoutesBreakdown wrapperStyle={{ padding: 0 }} loading={!loaded} />
          ) : (
            <RoutesBreakdown
              routes={
                // TODO: remove when bridge is implemented
                order?.trade?.routes as RouteDisplayEssentials[]
              }
              tradeInputCurrency={inputAmount.currency as Currency}
              tradeOutputCurrency={outputAmount.currency as Currency}
              wrapperStyle={{ padding: 0 }}
              loading={!loaded}
            />
          )}
        </Box>
      </AutoColumn>
    </AdvancedDetailsFooter>
  )
})
