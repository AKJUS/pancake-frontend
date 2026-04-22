import { CurrencyAmount, ERC20Token, TradeType } from '@pancakeswap/sdk'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ChainId } from '@pancakeswap/chains'
import { resetReportedQuoteSessions } from 'quoter/perf/quoteSessionReportGuard'
import { logStrategyComparison } from '../quoteStrategyLogger'

const { logMock } = vi.hoisted(() => ({
  logMock: vi.fn(),
}))

vi.mock('utils/datadog', () => ({
  getLogger: vi.fn(() => ({
    log: logMock,
  })),
}))

const WBNB = new ERC20Token(ChainId.BSC, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB')
const USDT = new ERC20Token(ChainId.BSC, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT')

function makeOrder(outputRaw: string) {
  return {
    type: 'PCS_CLASSIC',
    trade: {
      quoteQueryHash: 'hash-1',
      tradeType: TradeType.EXACT_INPUT,
      inputAmount: CurrencyAmount.fromRawAmount(WBNB, '1000000000000000000'),
      outputAmount: CurrencyAmount.fromRawAmount(USDT, outputRaw),
      routes: [],
    },
  } as any
}

function makeLoadable(order?: any, error?: Error) {
  return {
    unwrapOr: (fallback: unknown) => order || fallback,
    isPending: () => false,
    isFail: () => Boolean(error),
    error,
  }
}

describe('quoteStrategyLogger', () => {
  beforeEach(() => {
    resetReportedQuoteSessions()
    logMock.mockReset()
  })

  it('emits a single quote-session log for a quote hash', async () => {
    const option = {
      hash: 'quote-hash-1',
      createTime: 0,
      amount: CurrencyAmount.fromRawAmount(WBNB, '1000000000000000000'),
      baseCurrency: WBNB,
      currency: USDT,
    } as any

    const quotes = [
      { key: 'aggregator', result: makeLoadable(makeOrder('2000000000000000000')) },
      { key: 'smart-router', result: makeLoadable(makeOrder('1900000000000000000')) },
    ]

    await logStrategyComparison([], quotes as any, 0, option)
    await logStrategyComparison([], quotes as any, 0, option)

    expect(logMock).toHaveBeenCalledTimes(1)
    expect(logMock).toHaveBeenCalledWith(
      'quote.session.completed',
      expect.objectContaining({
        event: 'quote.session.completed',
        quoteHash: 'quote-hash-1',
        selectedStrategy: 'aggregator',
        strategyCount: 2,
      }),
    )
  })

  it('swallows logger failures without throwing', async () => {
    logMock.mockImplementationOnce(() => {
      throw new Error('dd down')
    })

    const option = {
      hash: 'quote-hash-2',
      createTime: 0,
      amount: CurrencyAmount.fromRawAmount(WBNB, '1000000000000000000'),
      baseCurrency: WBNB,
      currency: USDT,
    } as any

    await expect(
      logStrategyComparison(
        [],
        [{ key: 'aggregator', result: makeLoadable(makeOrder('2000000000000000000')) }] as any,
        0,
        option,
      ),
    ).resolves.toBeUndefined()
  })
})
