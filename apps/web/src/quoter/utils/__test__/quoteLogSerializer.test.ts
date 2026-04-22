import { ChainId } from '@pancakeswap/chains'
import { OrderType } from '@pancakeswap/price-api-sdk'
import { CurrencyAmount, ERC20Token, TradeType } from '@pancakeswap/sdk'
import { describe, expect, it } from 'vitest'

import { serializeOrder } from '../quoteLogSerializer'

const WBNB = new ERC20Token(ChainId.BSC, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB')
const BUSD = new ERC20Token(ChainId.BSC, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, 'USDC')
const USDT = new ERC20Token(ChainId.BSC, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT')

describe('quoteLogSerializer', () => {
  it('preserves full addresses for aggregator classic orders', () => {
    const order = {
      type: OrderType.PCS_CLASSIC,
      trade: {
        quoteQueryHash: 'hash-1',
        tradeType: TradeType.EXACT_INPUT,
        inputAmount: CurrencyAmount.fromRawAmount(WBNB, '1000000000000000000'),
        outputAmount: CurrencyAmount.fromRawAmount(USDT, '1812442100'),
        gasUseEstimate: 185000n,
        priceImpactBps: 27,
        routes: [
          {
            percent: 100,
            inputAmount: CurrencyAmount.fromRawAmount(WBNB, '1000000000000000000'),
            outputAmount: CurrencyAmount.fromRawAmount(USDT, '1812442100'),
            path: [WBNB, BUSD, USDT],
            pools: [
              {
                type: 'v3',
                fee: 500,
                address: '0x1111111111111111111111111111111111111111',
              },
              {
                type: 'stableswap',
                address: '0x2222222222222222222222222222222222222222',
              },
            ],
          },
        ],
      },
      aggregatorQuoteData: {
        inputAmount: '1000000000000000000',
        outputAmount: '1812442100',
        aggregatorAddress: '0x3333333333333333333333333333333333333333',
        routes: [{ percent: 100 }],
      },
    } as any

    const serialized = serializeOrder(order)

    expect(serialized).toEqual(
      expect.objectContaining({
        type: 'PCS_CLASSIC',
        isAggregator: true,
        aggregatorQuoteData: expect.objectContaining({
          aggregatorAddress: '0x3333333333333333333333333333333333333333',
        }),
      }),
    )
    expect(serialized?.inputAmount?.currency?.address).toBe(WBNB.address)
    expect(serialized?.outputAmount?.currency?.address).toBe(USDT.address)
    expect(serialized?.type).toBe('PCS_CLASSIC')

    const classicOrder = serialized as Extract<NonNullable<typeof serialized>, { type: 'PCS_CLASSIC' }>

    expect(classicOrder.routes[0]?.path?.map((token) => token.address)).toEqual([
      WBNB.address,
      BUSD.address,
      USDT.address,
    ])
    expect(classicOrder.routes[0]?.pools?.map((pool) => pool.address)).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ])
  })
})
