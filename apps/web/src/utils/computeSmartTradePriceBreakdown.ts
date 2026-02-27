import { CurrencyAmount, Fraction, Percent, ZERO } from '@pancakeswap/sdk'
import { INPUT_FRACTION_AFTER_FEE, ONE_HUNDRED_PERCENT } from 'config/constants/exchange'
import { BIPS_BASE, SmartRouter } from '@pancakeswap/smart-router'
import { parseNumberToFraction } from '@pancakeswap/utils/formatFractions'
import { findHook, HOOK_CATEGORY } from '@pancakeswap/infinity-sdk'
import { zeroAddress } from '@pancakeswap/price-api-sdk'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import { INFINITY_STABLE_POOL_FEE_DENOMINATOR } from '@pancakeswap/infinity-stable-sdk'
import { isAddressEqual } from './safeGetAddress'
import { TradeEssentialForPriceBreakdown, TradePriceBreakdown } from './swapTypes'

// computes price breakdown for the trade
export function computeSmartTradePriceBreakdown(trade?: TradeEssentialForPriceBreakdown | null): TradePriceBreakdown {
  if (!trade) {
    return {
      priceImpactWithoutFee: undefined,
      lpFeeAmount: null,
    }
  }

  const { routes, outputAmount, inputAmount } = trade
  let feePercent = new Percent(0)
  let outputAmountWithoutPriceImpact = CurrencyAmount.fromRawAmount(trade.outputAmount.currency, 0)
  for (const route of routes) {
    const { inputAmount: routeInputAmount, pools, percent } = route

    const routeFeePercent = ONE_HUNDRED_PERCENT.subtract(
      pools.reduce<Percent>((currentFee, pool) => {
        if (SmartRouter.isV2Pool(pool)) {
          return currentFee.multiply(INPUT_FRACTION_AFTER_FEE)
        }
        if (SmartRouter.isStablePool(pool)) {
          return currentFee.multiply(ONE_HUNDRED_PERCENT.subtract(pool.fee))
        }

        if (SmartRouter.isInfinityStablePool(pool)) {
          return currentFee.multiply(
            ONE_HUNDRED_PERCENT.subtract(
              new Percent(BigInt(pool.stableFee ?? 0), INFINITY_STABLE_POOL_FEE_DENOMINATOR),
            ),
          )
        }

        if (SmartRouter.isV3Pool(pool)) {
          return currentFee.multiply(ONE_HUNDRED_PERCENT.subtract(v3FeeToPercent(pool.fee)))
        }
        if (SmartRouter.isInfinityClPool(pool) || SmartRouter.isInfinityBinPool(pool)) {
          let poolFee = pool.fee
          // override pool fee if the pool is a dynamic fee pool
          if (pool.hooks && !isAddressEqual(pool.hooks, zeroAddress)) {
            const hook = findHook(pool.hooks, trade.inputAmount.currency.chainId)
            if (hook && hook.category?.includes(HOOK_CATEGORY.DynamicFees) && hook.defaultFee) {
              poolFee = hook.defaultFee
            }
          }
          const infinityFeePercent = new Percent(calculateInfiFeePercent(poolFee, pool.protocolFee).totalFee, 1e6)
          return currentFee.multiply(ONE_HUNDRED_PERCENT.subtract(infinityFeePercent))
        }
        return currentFee
      }, ONE_HUNDRED_PERCENT),
    )
    // Not accurate since for stable swap, the lp fee is deducted on the output side
    feePercent = feePercent.add(
      routeFeePercent.multiply(Percent.toPercent(parseNumberToFraction(percent / 100) || new Fraction(0))),
    )

    try {
      const midPrice = SmartRouter.getMidPrice(route)
      outputAmountWithoutPriceImpact = outputAmountWithoutPriceImpact.add(
        CurrencyAmount.fromRawAmount(
          trade.outputAmount.currency,
          midPrice.wrapped.quote(routeInputAmount.wrapped).quotient,
        ),
      )
    } catch (error) {
      console.error('Error calculating output amount:', error)
      outputAmountWithoutPriceImpact = CurrencyAmount.fromRawAmount(trade.outputAmount.currency, 0)
      break
    }
  }

  if (outputAmountWithoutPriceImpact.quotient === ZERO) {
    return {
      priceImpactWithoutFee: undefined,
      lpFeeAmount: null,
    }
  }

  const priceImpactRaw = outputAmountWithoutPriceImpact.subtract(outputAmount).divide(outputAmountWithoutPriceImpact)
  const priceImpactPercent = new Percent(priceImpactRaw.numerator, priceImpactRaw.denominator)
  const priceImpactWithoutFee = priceImpactPercent.subtract(feePercent)
  const lpFeeAmount = inputAmount.multiply(feePercent)

  return {
    priceImpactWithoutFee,
    lpFeeAmount,
  }
}

export function calculateInfiFeePercent(lpFee: number, protocolFee?: number) {
  const protocolFee1 = (protocolFee ?? 0) & 0xfff
  const totalFee = (protocolFee1 + ((1e6 - protocolFee1) * lpFee) / 1e6).toFixed(0)

  return {
    totalFee: Number(totalFee),
    lpFee,
    protocolFee: protocolFee1,
  }
}

export function v3FeeToPercent(fee: FeeAmount): Percent {
  return new Percent(fee, BIPS_BASE * 100n)
}
