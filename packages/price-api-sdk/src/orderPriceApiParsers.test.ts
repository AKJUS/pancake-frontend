import { ChainId } from '@pancakeswap/chains'
import { Token } from '@pancakeswap/sdk'
import { describe, expect, it } from 'vitest'
import { OrderType, ResponseType, type PriceResponse } from './types'
import { parseQuoteResponse } from './orderPriceApiParsers'

describe('parseQuoteResponse', () => {
  it('preserves quoteId for dutch limit orders', () => {
    const currencyIn = new Token(ChainId.BSC, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT', 'Tether USD')
    const currencyOut = new Token(
      ChainId.BSC,
      '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
      18,
      'DAI',
      'Dai Stablecoin',
    )

    const response: PriceResponse = {
      messageType: ResponseType.PRICE_RESPONSE,
      message: {
        bestOrder: {
          type: OrderType.DUTCH_LIMIT,
          order: {
            auctionPeriodSecs: 120,
            deadlineBufferSecs: 60,
            orderInfo: {
              deadline: '1714400000',
              reactor: '0x0000000000000000000000000000000000000000',
              swapper: '0x0000000000000000000000000000000000000000',
              nonce: '10',
              additionalValidationContract: '0x0000000000000000000000000000000000000000',
              additionalValidationData: '0x',
              exclusiveFiller: '0x0000000000000000000000000000000000000000',
              exclusivityOverrideBps: '0',
              decayStartTime: '1714399400',
              decayEndTime: '1714400000',
              input: {
                token: currencyIn.address,
                startAmount: '1000000000000000000',
                endAmount: '1000000000000000000',
              },
              outputs: [
                {
                  token: currencyOut.address,
                  startAmount: '990000000000000000',
                  endAmount: '980000000000000000',
                  recipient: '0x0000000000000000000000000000000000000000',
                },
              ],
            },
            encodedOrder: '0x',
            permitData: null,
            quoteId: 'quote-123',
            requestId: 'request-123',
            slippageTolerance: '0.10',
            startTimeBufferSecs: 30,
          },
        },
        allPossibleOrders: [],
      },
    }

    const result = parseQuoteResponse(response, {
      chainId: ChainId.BSC,
      currencyIn,
      currencyOut,
      tradeType: 0,
    })

    expect(result.type).toBe(OrderType.DUTCH_LIMIT)
    expect(result.quoteId).toBe('quote-123')
  })
})
