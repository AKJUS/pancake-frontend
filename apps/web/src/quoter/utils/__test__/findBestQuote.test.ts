import { Loadable } from '@pancakeswap/utils/Loadable'
import { OrderType } from '@pancakeswap/price-api-sdk'
import { CurrencyAmount, Token, TradeType } from '@pancakeswap/swap-sdk-core'
import type { InterfaceOrder } from 'views/Swap/utils'
import { findBestQuote } from '../findBestQuote'

const TOKEN_A = new Token(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB')
const TOKEN_B = new Token(56, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT')

function makeOrder(outputRaw: string, inputRaw = '1000000000000000000'): InterfaceOrder {
  return {
    type: OrderType.PCS_CLASSIC,
    trade: {
      tradeType: TradeType.EXACT_INPUT,
      inputAmount: CurrencyAmount.fromRawAmount(TOKEN_A, inputRaw),
      outputAmount: CurrencyAmount.fromRawAmount(TOKEN_B, outputRaw),
      routes: [],
      gasUseEstimate: 0n,
      gasUseEstimateBase: CurrencyAmount.fromRawAmount(TOKEN_A, 0),
      gasUseEstimateQuote: CurrencyAmount.fromRawAmount(TOKEN_B, 0),
      inputAmountWithGasAdjusted: CurrencyAmount.fromRawAmount(TOKEN_A, inputRaw),
      outputAmountWithGasAdjusted: CurrencyAmount.fromRawAmount(TOKEN_B, outputRaw),
    },
  } as InterfaceOrder
}

function makeExactOutputOrder(inputRaw: string, outputRaw = '1000000000000000000'): InterfaceOrder {
  return {
    type: OrderType.PCS_CLASSIC,
    trade: {
      tradeType: TradeType.EXACT_OUTPUT,
      inputAmount: CurrencyAmount.fromRawAmount(TOKEN_A, inputRaw),
      outputAmount: CurrencyAmount.fromRawAmount(TOKEN_B, outputRaw),
      routes: [],
      gasUseEstimate: 0n,
      gasUseEstimateBase: CurrencyAmount.fromRawAmount(TOKEN_A, 0),
      gasUseEstimateQuote: CurrencyAmount.fromRawAmount(TOKEN_B, 0),
      inputAmountWithGasAdjusted: CurrencyAmount.fromRawAmount(TOKEN_A, inputRaw),
      outputAmountWithGasAdjusted: CurrencyAmount.fromRawAmount(TOKEN_B, outputRaw),
    },
  } as InterfaceOrder
}

describe('findBestQuote', () => {
  it('should pick the quote with higher output for exact-input', () => {
    const orderA = makeOrder('200')
    const orderB = makeOrder('300')
    const result = findBestQuote(Loadable.Just(orderA), Loadable.Just(orderB))

    expect(result).toBeDefined()
    expect(result![0]).toBe(orderB)
    expect(result![1]).toBe(1)
  })

  it('should pick the quote with lower input for exact-output', () => {
    const orderA = makeExactOutputOrder('500')
    const orderB = makeExactOutputOrder('300')
    const result = findBestQuote(Loadable.Just(orderA), Loadable.Just(orderB))

    expect(result).toBeDefined()
    expect(result![0]).toBe(orderB)
    expect(result![1]).toBe(1)
  })

  it('should return the only successful result when others are Fail', () => {
    const order = makeOrder('200')
    const result = findBestQuote(Loadable.Fail<InterfaceOrder>(new Error('fail')), Loadable.Just(order))

    expect(result).toBeDefined()
    expect(result![0]).toBe(order)
    expect(result![1]).toBe(1)
  })

  it('should return the only successful result when others are Pending', () => {
    const order = makeOrder('200')
    const result = findBestQuote(Loadable.Pending<InterfaceOrder>(), Loadable.Just(order))

    expect(result).toBeDefined()
    expect(result![0]).toBe(order)
    expect(result![1]).toBe(1)
  })

  it('should return undefined when all results are Fail', () => {
    const result = findBestQuote(
      Loadable.Fail<InterfaceOrder>(new Error('a')),
      Loadable.Fail<InterfaceOrder>(new Error('b')),
    )
    expect(result).toBeUndefined()
  })

  it('should return undefined when all results are Pending', () => {
    const result = findBestQuote(Loadable.Pending<InterfaceOrder>(), Loadable.Pending<InterfaceOrder>())
    expect(result).toBeUndefined()
  })

  it('should return undefined when all results are Nothing', () => {
    const result = findBestQuote(Loadable.Nothing<InterfaceOrder>(), Loadable.Nothing<InterfaceOrder>())
    expect(result).toBeUndefined()
  })

  it('should handle single result input', () => {
    const order = makeOrder('200')
    const result = findBestQuote(Loadable.Just(order))

    expect(result).toBeDefined()
    expect(result![0]).toBe(order)
    expect(result![1]).toBe(0)
  })

  it('should handle two results with equal output amounts', () => {
    const orderA = makeOrder('200')
    const orderB = makeOrder('200')
    const result = findBestQuote(Loadable.Just(orderA), Loadable.Just(orderB))

    expect(result).toBeDefined()
    // When equal, first one wins (no swap happens in isBetterQuoteTrade)
    expect(result![0]).toBe(orderA)
    expect(result![1]).toBe(0)
  })
})
