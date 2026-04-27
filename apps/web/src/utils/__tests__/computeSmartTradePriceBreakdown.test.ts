import { PoolType } from '@pancakeswap/smart-router'
import { CurrencyAmount, Percent, Token, TradeType } from '@pancakeswap/swap-sdk-core'
import { describe, expect, it } from 'vitest'
import { computeSmartTradePriceBreakdown } from '../computeSmartTradePriceBreakdown'

const chainId = 56
const tokenIn = new Token(chainId, '0x1111111111111111111111111111111111111111', 18, 'TK1')
const tokenOut = new Token(chainId, '0x2222222222222222222222222222222222222222', 18, 'TK2')

describe('computeSmartTradePriceBreakdown', () => {
  it('prefers quote displayFee for aggregator v3 routes', () => {
    const inputAmount = CurrencyAmount.fromRawAmount(tokenIn, 1_000_000)
    const outputAmount = CurrencyAmount.fromRawAmount(tokenOut, 900_000)
    const trade = {
      tradeType: TradeType.EXACT_INPUT,
      inputAmount,
      outputAmount,
      routes: [
        {
          percent: 100,
          path: [tokenIn, tokenOut],
          inputAmount,
          outputAmount,
          pools: [
            {
              type: PoolType.V3,
              fee: 500,
              displayFee: 800,
              token0: tokenIn,
              token1: tokenOut,
              address: '0x3333333333333333333333333333333333333333',
            },
          ],
        },
      ],
    }

    const result = computeSmartTradePriceBreakdown(trade as any)

    expect(result.priceImpactWithoutFee).toBeUndefined()
    expect(result.lpFeeAmount?.quotient).toBe(800n)
  })

  it('prefers quote displayFee for aggregator infinity routes', () => {
    const inputAmount = CurrencyAmount.fromRawAmount(tokenIn, 1_000_000)
    const outputAmount = CurrencyAmount.fromRawAmount(tokenOut, 900_000)
    const trade = {
      tradeType: TradeType.EXACT_INPUT,
      inputAmount,
      outputAmount,
      routes: [
        {
          percent: 100,
          path: [tokenIn, tokenOut],
          inputAmount,
          outputAmount,
          pools: [
            {
              type: PoolType.InfinityCL,
              fee: 3000,
              displayFee: 4200,
              currency0: tokenIn,
              currency1: tokenOut,
              id: '0x4444444444444444444444444444444444444444',
            },
          ],
        },
      ],
    }

    const result = computeSmartTradePriceBreakdown(trade as any)

    expect(result.priceImpactWithoutFee).toBeUndefined()
    expect(result.lpFeeAmount?.quotient).toBe(4200n)
  })

  it('skips V2 routes with a zero reserve instead of attempting mid-price calculation', () => {
    const inputAmount = CurrencyAmount.fromRawAmount(tokenIn, 1_000_000)
    const outputAmount = CurrencyAmount.fromRawAmount(tokenOut, 900_000)
    const trade = {
      tradeType: TradeType.EXACT_INPUT,
      inputAmount,
      outputAmount,
      routes: [
        {
          percent: 100,
          path: [tokenOut, tokenIn],
          inputAmount,
          outputAmount,
          pools: [
            {
              type: PoolType.V2,
              token0: tokenIn,
              token1: tokenOut,
              reserve0: CurrencyAmount.fromRawAmount(tokenIn, 1_000_000),
              reserve1: CurrencyAmount.fromRawAmount(tokenOut, 0),
            },
          ],
        },
      ],
    }

    const result = computeSmartTradePriceBreakdown(trade as any)

    expect(() => computeSmartTradePriceBreakdown(trade as any)).not.toThrow()
    expect(result.priceImpactWithoutFee).toBeUndefined()
    expect(result.lpFeeAmount?.quotient).toBe(2500n)
  })

  it('falls back to quote priceImpactBps for stable stub pools without on-chain state', () => {
    const inputAmount = CurrencyAmount.fromRawAmount(tokenIn, 1_000_000)
    const outputAmount = CurrencyAmount.fromRawAmount(tokenOut, 941_882)
    const trade = {
      tradeType: TradeType.EXACT_INPUT,
      inputAmount,
      outputAmount,
      priceImpactBps: 321,
      routes: [
        {
          percent: 100,
          path: [tokenIn, tokenOut],
          inputAmount,
          outputAmount,
          pools: [
            {
              type: PoolType.STABLE,
              token0: tokenIn,
              token1: tokenOut,
              fee: new Percent(25, 10_000),
              displayFee: 25,
              balances: [CurrencyAmount.fromRawAmount(tokenIn, 0), CurrencyAmount.fromRawAmount(tokenOut, 0)],
              amplifier: 0n,
            },
          ],
        },
      ],
    }

    const result = computeSmartTradePriceBreakdown(trade as any)

    expect(result.priceImpactWithoutFee?.numerator.toString()).toBe('321')
    expect(result.priceImpactWithoutFee?.denominator.toString()).toBe('10000')
    expect(result.lpFeeAmount?.quotient).toBe(2500n)
  })
})
