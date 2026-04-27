import { CurrencyAmount, ERC20Token, TradeType } from '@pancakeswap/sdk'
import { ChainId } from '@pancakeswap/chains'
import { PoolType, RouteType } from '@pancakeswap/smart-router'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { validateTradeOnChain } from '../getVerifiedTrade'

const { fetchQuotesMock } = vi.hoisted(() => ({
  fetchQuotesMock: vi.fn(),
}))

vi.mock('@pancakeswap/routing-sdk-addon-quoter', () => ({
  fetchQuotes: fetchQuotesMock,
}))

vi.mock('utils/convertTrade', () => ({
  toRoutingSDKTrade: vi.fn((trade) => trade),
}))

vi.mock('utils/viem', () => ({
  getViemClients: vi.fn(() => undefined),
}))

const BNB = new ERC20Token(ChainId.BSC, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB')
const ETH = new ERC20Token(ChainId.BSC, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 18, 'ETH')

function makeTrade(routeOverrides: Partial<any> = {}) {
  return {
    tradeType: TradeType.EXACT_INPUT,
    inputAmount: CurrencyAmount.fromRawAmount(BNB, '200000000000000000'),
    outputAmount: CurrencyAmount.fromRawAmount(ETH, '54122237336633911'),
    routes: [
      {
        type: RouteType.InfinityBIN,
        pools: [
          {
            type: PoolType.InfinityBIN,
            poolManager: '0xC697d2898e0D09264376196696c51D7aBbbAA4a9',
            ...routeOverrides,
          },
        ],
        path: [BNB, ETH],
        inputAmount: CurrencyAmount.fromRawAmount(BNB, '200000000000000000'),
        outputAmount: CurrencyAmount.fromRawAmount(ETH, '54122237336633911'),
        gasUseEstimate: 0n,
      },
    ],
    gasUseEstimate: 0n,
    gasUseEstimateBase: CurrencyAmount.fromRawAmount(BNB, 0),
    gasUseEstimateQuote: CurrencyAmount.fromRawAmount(ETH, 0),
    inputAmountWithGasAdjusted: CurrencyAmount.fromRawAmount(BNB, '200000000000000000'),
    outputAmountWithGasAdjusted: CurrencyAmount.fromRawAmount(ETH, '54122237336633911'),
  } as any
}

describe('validateTradeOnChain', () => {
  beforeEach(() => {
    fetchQuotesMock.mockReset()
  })

  it('skips InfinityBin routes that are missing binStep metadata', async () => {
    const trade = makeTrade()

    await expect(validateTradeOnChain(trade)).resolves.toBeUndefined()
    expect(fetchQuotesMock).not.toHaveBeenCalled()
  })

  it('verifies InfinityBin routes when binStep metadata is present', async () => {
    const trade = makeTrade({ binStep: 1 })

    fetchQuotesMock.mockResolvedValueOnce([
      {
        quote: CurrencyAmount.fromRawAmount(ETH, '54122237336633911'),
        gasUseEstimate: 123n,
      },
    ])

    await expect(validateTradeOnChain(trade)).resolves.toBeUndefined()
    expect(fetchQuotesMock).toHaveBeenCalledTimes(1)
  })
})
