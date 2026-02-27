import { getBinPoolTokenPrice } from '@pancakeswap/infinity-sdk'
import { Currency, CurrencyAmount, Pair, Percent, Price } from '@pancakeswap/sdk'
import { getSwapOutput } from '@pancakeswap/stable-swap-sdk'
import memoize from '@pancakeswap/utils/memoize'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { Pool as SDKV3Pool, computePoolAddress } from '@pancakeswap/v3-sdk'
import { Address } from 'viem'
import { INFINITY_STABLE_POOL_FEE_DENOMINATOR } from '@pancakeswap/infinity-stable-sdk'

import {
  InfinityBinPool,
  InfinityClPool,
  InfinityStablePool,
  Pool,
  PoolType,
  StablePool,
  V2Pool,
  V3Pool,
} from '../types'

export function isV2Pool(pool: Pool): pool is V2Pool {
  return pool.type === PoolType.V2
}

export function isV3Pool(pool: Pool): pool is V3Pool {
  return pool.type === PoolType.V3
}

export function isStablePool(pool: Pool): pool is StablePool {
  return pool.type === PoolType.STABLE && pool.balances.length >= 2
}

export function isInfinityBinPool(pool: Pool): pool is InfinityBinPool {
  return pool.type === PoolType.InfinityBIN
}

export function isInfinityClPool(pool: Pool): pool is InfinityClPool {
  return pool.type === PoolType.InfinityCL
}

export function isInfinityStablePool(pool: Pool): pool is InfinityStablePool {
  return pool.type === PoolType.InfinityStable
}

export function involvesCurrency(pool: Pool, currency: Currency) {
  const token = currency.wrapped
  if (isV2Pool(pool)) {
    const { reserve0, reserve1 } = pool
    return reserve0.currency.equals(token) || reserve1.currency.equals(token)
  }
  if (isV3Pool(pool)) {
    const { token0, token1 } = pool
    return token0.equals(token) || token1.equals(token)
  }
  if (isInfinityClPool(pool) || isInfinityBinPool(pool)) {
    const { currency0, currency1 } = pool
    return (
      currency0.equals(currency) ||
      currency1.equals(currency) ||
      currency0.wrapped.equals(token) ||
      currency1.wrapped.equals(token)
    )
  }
  if (isStablePool(pool)) {
    const { balances } = pool
    return balances.some((b) => b.currency.equals(token))
  }

  if (isInfinityStablePool(pool)) {
    const { reserve0, reserve1 } = pool
    return reserve0?.currency.equals(token) || reserve1?.currency.equals(token)
  }

  return false
}

// FIXME: current version is not working with stable pools that have more than 2 tokens
export function getOutputCurrency(pool: Pool, currencyIn: Currency): Currency {
  const tokenIn = currencyIn.wrapped
  if (isV2Pool(pool)) {
    const { reserve0, reserve1 } = pool
    return reserve0.currency.equals(tokenIn) ? reserve1.currency : reserve0.currency
  }
  if (isV3Pool(pool)) {
    const { token0, token1 } = pool
    return token0.equals(tokenIn) ? token1 : token0
  }
  if (isStablePool(pool)) {
    const { balances } = pool
    return balances[0].currency.equals(tokenIn) ? balances[1].currency : balances[0].currency
  }
  if (isInfinityClPool(pool) || isInfinityBinPool(pool) || isInfinityStablePool(pool)) {
    const { currency0, currency1 } = pool
    return currency0.wrapped.equals(tokenIn) ? currency1 : currency0
  }
  throw new Error('Cannot get output currency by invalid pool')
}

export const computeV3PoolAddress = memoize(
  computePoolAddress,
  ({ deployerAddress, tokenA, tokenB, fee }) =>
    `${tokenA.chainId}_${deployerAddress}_${tokenA.address}_${tokenB.address}_${fee}`,
)

export const computeV2PoolAddress = memoize(
  Pair.getAddress,
  (tokenA, tokenB) => `${tokenA.chainId}_${tokenA.address}_${tokenB.address}`,
)

export const getPoolAddress = (pool: Pool): Address | '' => {
  if (isStablePool(pool) || isV3Pool(pool)) {
    return pool.address
  }
  if (isV2Pool(pool)) {
    const { reserve0, reserve1 } = pool
    return computeV2PoolAddress(reserve0.currency.wrapped, reserve1.currency.wrapped)
  }
  if (isInfinityBinPool(pool) || isInfinityClPool(pool) || isInfinityStablePool(pool)) {
    return pool.id
  }
  return ''
}

export const getPoolCurrency0 = (pool: Pool): Currency => {
  if (isV2Pool(pool)) {
    return pool.reserve0.currency
  }
  if (isV3Pool(pool)) {
    return pool.token0
  }
  if (isInfinityClPool(pool) || isInfinityBinPool(pool) || isInfinityStablePool(pool)) {
    return pool.currency0
  }
  if (isStablePool(pool)) {
    return pool.balances[0].currency
  }
  throw new Error('Cannot get currency0 by invalid pool')
}

export const getPoolCurrency1 = (pool: Pool): Currency => {
  if (isV2Pool(pool)) {
    return pool.reserve1.currency
  }
  if (isV3Pool(pool)) {
    return pool.token1
  }
  if (isInfinityClPool(pool) || isInfinityBinPool(pool) || isInfinityStablePool(pool)) {
    return pool.currency1
  }
  if (isStablePool(pool)) {
    return pool.balances[1].currency
  }
  throw new Error('Cannot get currency0 by invalid pool')
}

export function getTokenPrice(pool: Pool, base: Currency, quote: Currency): Price<Currency, Currency> {
  if (isV3Pool(pool)) {
    const { token0, token1, fee, liquidity, sqrtRatioX96, tick } = pool
    const v3Pool = new SDKV3Pool(token0.wrapped, token1.wrapped, fee, sqrtRatioX96, liquidity, tick)
    return v3Pool.priceOf(base.wrapped)
  }

  if (isInfinityClPool(pool)) {
    const { currency0, currency1, fee, liquidity, sqrtRatioX96, tick } = pool
    const v3Pool = new SDKV3Pool(currency0.asToken, currency1.asToken, fee, sqrtRatioX96, liquidity, tick)
    const baseToken = currency0.wrapped.equals(base.wrapped) ? currency0.asToken : base.wrapped
    const tokenPrice = v3Pool.priceOf(baseToken)
    const [baseCurrency, quoteCurrency] = baseToken.equals(currency0.asToken)
      ? [currency0, currency1]
      : [currency1, currency0]
    return new Price(baseCurrency, quoteCurrency, tokenPrice.denominator, tokenPrice.numerator)
  }

  if (isInfinityBinPool(pool)) {
    const { activeId, binStep, currency0, currency1 } = pool
    return getBinPoolTokenPrice(
      {
        currencyX: currency0,
        currencyY: currency1,
        binStep: BigInt(binStep),
        activeId: BigInt(activeId),
      },
      base,
    )
  }

  if (isV2Pool(pool)) {
    const pair = new Pair(pool.reserve0.wrapped, pool.reserve1.wrapped)
    return pair.priceOf(base.wrapped)
  }

  if (isStablePool(pool) || isInfinityStablePool(pool)) {
    const stablePool = isInfinityStablePool(pool) ? convertInfinityStablePoolToStablePool(pool) : pool

    const { amplifier, balances, fee } = stablePool

    const baseBalance = balances.find((b) => b.currency.wrapped.equals(base.wrapped))
    const quoteBalance = balances.find((b) => b.currency.wrapped.equals(quote.wrapped))

    // Use balance-derived probe amount (capped at 1):
    // Compare balances in normalised token units (each divided by their own decimals)
    // so that pools with different decimal counts (e.g. ETH/USDC) are handled correctly.
    // if both balances >= 1 token → probe with 1; otherwise probe with the smaller balance.
    let probeAmountStr = '1'
    if (baseBalance && quoteBalance) {
      const baseInTokens = Number(baseBalance.quotient) / 10 ** base.decimals
      const quoteInTokens = Number(quoteBalance.quotient) / 10 ** quote.decimals

      if (baseInTokens < 1 || quoteInTokens < 1) {
        const smallerInTokens = baseInTokens < quoteInTokens ? baseInTokens : quoteInTokens
        probeAmountStr = smallerInTokens > 0 ? String(smallerInTokens) : '1'
      }
    }

    const baseIn = tryParseAmount(probeAmountStr, base)
    if (!baseIn) {
      throw new Error(`Cannot parse amount for ${base.symbol}`)
    }

    const quoteOut = getSwapOutput({
      amplifier,
      balances,
      fee,
      outputCurrency: quote,
      amount: baseIn,
    })

    return new Price({
      baseAmount: baseIn,
      quoteAmount: quoteOut,
    })
  }
  return new Price(base, quote, 1n, 0n)
}

/**
 * Convert InfinityStable pools (hook-based) into StableSwap-style pools.
 * This function is used to display InfinityStable Pool in UI.
 * Why we don't return StablePool-like candidated pools instead of InfinityStablePool?
 * Because we want to keep Swap flow compatiable with CLInfinityPool.
 */
export function convertInfinityStablePoolToStablePool(pool: InfinityStablePool): StablePool {
  if (!pool.hooks || pool.type !== PoolType.InfinityStable) {
    throw new Error(`convertInfinityStablePoolToStablePool: Invalid pool type: ${pool.type}`)
  }

  const balance0 = pool.reserve0 ?? CurrencyAmount.fromRawAmount(pool.currency0, 0)
  const balance1 = pool.reserve1 ?? CurrencyAmount.fromRawAmount(pool.currency1, 0)

  return {
    type: PoolType.STABLE,
    address: pool.hooks,
    balances: [balance0, balance1],
    amplifier: BigInt(pool.amplifier ?? 0),
    fee: new Percent(BigInt(pool.stableFee ?? 0), INFINITY_STABLE_POOL_FEE_DENOMINATOR),
  }
}
