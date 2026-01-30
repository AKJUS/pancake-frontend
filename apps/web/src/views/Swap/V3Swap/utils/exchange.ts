import { OrderType } from '@pancakeswap/price-api-sdk'
import { Currency, CurrencyAmount, Percent, Price, UnifiedCurrency, UnifiedCurrencyAmount } from '@pancakeswap/sdk'
import { SmartRouter } from '@pancakeswap/smart-router'
import { formatPrice } from '@pancakeswap/utils/formatFractions'
import { displaySymbolWithChainName } from '@pancakeswap/widgets-internal'
import last from 'lodash/last'

import { Field } from 'state/swap/actions'
import { basisPointsToPercent } from 'utils/exchange'
import { BridgeOrderFee } from 'views/Swap/Bridge/utils'
import { BridgeOrderWithCommands, InterfaceOrder, isBridgeOrder, isSolanaBridge } from 'views/Swap/utils'

export {
  computeSmartTradePriceBreakdown as computeTradePriceBreakdown,
  v3FeeToPercent,
  calculateInfiFeePercent,
} from 'utils/computeSmartTradePriceBreakdown'

export type { TradePriceBreakdown } from 'utils/swapTypes'

export type SlippageAdjustedAmounts = {
  [field in Field]?: UnifiedCurrencyAmount<UnifiedCurrency> | null
}

// computes the minimum amount out and maximum amount in for a trade given a user specified allowed slippage in bips
export function computeSlippageAdjustedAmounts(
  order: InterfaceOrder | undefined | null,
  allowedSlippage: number,
): SlippageAdjustedAmounts {
  if (order?.type === OrderType.DUTCH_LIMIT || order?.type === OrderType.PCS_SVM) {
    return {
      [Field.INPUT]: order.trade.maximumAmountIn,
      [Field.OUTPUT]: order.trade.minimumAmountOut,
    }
  }

  const trade = order?.trade

  if (!trade) {
    return {
      [Field.INPUT]: undefined,
      [Field.OUTPUT]: undefined,
    }
  }

  const pct = basisPointsToPercent(allowedSlippage)

  const bridgeOrder = order as BridgeOrderWithCommands
  const length = bridgeOrder?.commands?.length

  if (isSolanaBridge(order)) {
    return {
      [Field.INPUT]: trade.inputAmount,
      [Field.OUTPUT]: CurrencyAmount.fromRawAmount(
        trade.outputAmount.currency,
        BigInt(order.bridgeTransactionData.minimumOutputAmount ?? '0'),
      ),
    }
  }

  if (isBridgeOrder(order) && bridgeOrder.commands && length) {
    const isBridgeOnly = length === 1
    const isBridgeToSwap = length === 2 && bridgeOrder.commands[length - 1].type === OrderType.PCS_CLASSIC

    if (isBridgeOnly) {
      return {
        [Field.INPUT]: trade.inputAmount,
        [Field.OUTPUT]: trade.outputAmount,
      }
    }

    if (!isBridgeToSwap) {
      return {
        [Field.INPUT]: trade.inputAmount,
        // last command is swap order, and is already slippaged
        [Field.OUTPUT]: last(bridgeOrder.commands)!.trade.outputAmount,
      }
    }
  }

  return {
    [Field.INPUT]: trade && SmartRouter.maximumAmountIn(trade, pct),
    // NOTE: slippaged both regular and bridge order
    [Field.OUTPUT]: trade && SmartRouter.minimumAmountOut(trade, pct),
  }
}

export interface SVMTradePriceBreakdown {
  priceImpactWithoutFee?: Percent | null
  lpFeeAmount?: UnifiedCurrencyAmount<UnifiedCurrency> | null
}

export function formatExecutionPrice(
  executionPrice?: Price<Currency, Currency>,
  inputAmount?: CurrencyAmount<Currency>,
  outputAmount?: CurrencyAmount<Currency>,
  inverted?: boolean,
): string {
  if (!executionPrice || !inputAmount || !outputAmount) {
    return ''
  }

  const isBridge = inputAmount.currency.chainId !== outputAmount.currency.chainId

  return inverted
    ? `${formatPrice(executionPrice.invert(), 6)} ${displaySymbolWithChainName(
        inputAmount.currency,
        isBridge,
      )} / ${displaySymbolWithChainName(outputAmount.currency, isBridge)}`
    : `${formatPrice(executionPrice, 6)} ${displaySymbolWithChainName(
        outputAmount.currency,
        isBridge,
      )} / ${displaySymbolWithChainName(inputAmount.currency, isBridge)}`
}

// Helper function to find the highest price impact from multiple breakdowns
export function findHighestPriceImpact(breakdowns: BridgeOrderFee[]): Percent | null | undefined {
  return breakdowns.reduce((highest, breakdown) => {
    // Skip if current breakdown has no price impact
    if (!breakdown.priceImpactWithoutFee) return highest

    // If no highest value yet, use current one
    if (!highest) return breakdown.priceImpactWithoutFee

    // Compare and keep the higher value
    if (highest.lessThan(breakdown.priceImpactWithoutFee)) {
      return breakdown.priceImpactWithoutFee
    }

    return highest
  }, null as Percent | null)
}
