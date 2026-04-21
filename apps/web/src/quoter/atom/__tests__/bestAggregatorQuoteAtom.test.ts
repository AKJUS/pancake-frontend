/**
 * Unit tests for bestAggregatorQuoteAtom's on-chain verification step.
 *
 * We exercise the atom through jotai's createStore() so we cover the full
 * loadable lifecycle (Just / Fail) surfaced to the UI. External boundaries
 * (aggregatorService.getQuote, validateTradeOnChain, allowlist, perf tracker) are
 * mocked so the test remains a pure unit test.
 */
import { ChainId } from '@pancakeswap/chains'
import { CurrencyAmount, ERC20Token, TradeType } from '@pancakeswap/sdk'
import { createStore } from 'jotai'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- Imports (after mocks) --------------------------------------------------

import { validateTradeOnChain } from 'quoter/utils/getVerifiedTrade'
import { isAllowedAggregatorRouter } from 'config/constants/aggregatorRouters'
import { logger } from 'utils/datadog'
import type { QuoteQuery } from 'quoter/quoter.types'
import { bestAggregatorQuoteAtom } from '../bestAggregatorQuoteAtom'

// --- Module mocks (must come before the SUT import) ------------------------

vi.mock('config/constants/endpoints', () => ({
  AGGREGATOR_API_BASE_URL: 'https://aggregator.test',
  AGGREGATOR_API_KEY: undefined,
}))

vi.mock('config/constants/aggregatorRouters', () => ({
  isAllowedAggregatorRouter: vi.fn(() => true),
}))

vi.mock('quoter/utils/getVerifiedTrade', () => ({
  validateTradeOnChain: vi.fn(),
}))

vi.mock('quoter/perf/quoteTracker', async () => {
  const { atom } = await vi.importActual<typeof import('jotai')>('jotai')
  const tracker = {
    track: vi.fn(),
    success: vi.fn(),
    fail: vi.fn(),
    report: vi.fn(),
  }
  return {
    quoteTraceAtom: () => atom(() => ({ tracker, trace: {} })),
  }
})

vi.mock('utils/datadog', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock the AggregatorService class so we control what getQuote returns.
// vi.hoisted so the mock fn exists at the hoisted vi.mock factory time.
const { mockGetQuote } = vi.hoisted(() => ({ mockGetQuote: vi.fn() }))
vi.mock('@pancakeswap/aggregator-sdk', () => ({
  AggregatorService: class {
    getQuote = mockGetQuote
  },
}))

// --- Fixtures ---------------------------------------------------------------

const WETH = new ERC20Token(ChainId.BSC, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 18, 'ETH')
const USDT = new ERC20Token(ChainId.BSC, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT')

function makeQuery(overrides: Partial<QuoteQuery> = {}): QuoteQuery {
  const amount = CurrencyAmount.fromRawAmount(WETH, '1000000000000000000')
  return {
    amount,
    currency: USDT,
    tradeType: TradeType.EXACT_INPUT,
    v2Swap: true,
    v3Swap: true,
    infinitySwap: true,
    infinityStableSwap: true,
    stableSwap: true,
    hash: 'hash-1',
    speedQuoteEnabled: false,
    xEnabled: false,
    blockNumber: 0,
    createTime: 0,
    ver: 0,
    ...overrides,
  } as QuoteQuery
}

// Build a trade shaped like deserializeAggregatorResponse produces.
// outputAmount drives the assertion for "verified trade wins".
function makeTrade(outputRaw: string) {
  return {
    tradeType: TradeType.EXACT_INPUT,
    inputAmount: CurrencyAmount.fromRawAmount(WETH, '1000000000000000000'),
    outputAmount: CurrencyAmount.fromRawAmount(USDT, outputRaw),
    routes: [],
    gasUseEstimate: 0n,
    gasUseEstimateBase: CurrencyAmount.fromRawAmount(WETH, 0),
    gasUseEstimateQuote: CurrencyAmount.fromRawAmount(USDT, 0),
    inputAmountWithGasAdjusted: CurrencyAmount.fromRawAmount(WETH, '1000000000000000000'),
    outputAmountWithGasAdjusted: CurrencyAmount.fromRawAmount(USDT, outputRaw),
  } as any
}

function makeQuoteResult(outputRaw: string) {
  return {
    order: {
      type: 'PCS_CLASSIC',
      trade: makeTrade(outputRaw),
    },
    quoteData: {
      srcToken: WETH.address,
      dstToken: USDT.address,
      tradeType: 'exactIn',
      inputAmount: '1000000000000000000',
      outputAmount: outputRaw,
      gasUseEstimate: '0',
      routes: [
        {
          percent: 100,
          inputAmount: '1000000000000000000',
          outputAmount: outputRaw,
          path: [
            { address: WETH.address, decimals: 18, symbol: 'ETH' },
            { address: USDT.address, decimals: 18, symbol: 'USDT' },
          ],
          pools: [
            {
              address: '0xPool1',
              type: 'infinityCl',
              fee: 7,
              provider: 'pancakeswap',
              hooks: null,
              token0: WETH.address.toLowerCase() < USDT.address.toLowerCase() ? WETH.address : USDT.address,
              token1: WETH.address.toLowerCase() < USDT.address.toLowerCase() ? USDT.address : WETH.address,
            },
          ],
        },
      ],
      aggregatorAddress: '0xRouterAllowedAddress',
    },
  }
}

// Read the unwrapped Loadable value from the atom. The atom is async-backed;
// createStore().get(atom) returns a Pending loadable synchronously, so we await
// the underlying promise first then re-read.
async function readLoadable(query: QuoteQuery) {
  const store = createStore()
  const atomInstance = bestAggregatorQuoteAtom(query)
  // Seed the atom to kick off the async work.
  store.get(atomInstance)
  // Jotai's unwrap surfaces the resolved Loadable on the next microtask flush.
  // Run a few flushes to be safe.
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
  return store.get(atomInstance)
}

// --- Tests ------------------------------------------------------------------

describe('bestAggregatorQuoteAtom — on-chain verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(isAllowedAggregatorRouter as any).mockReturnValue(true)
  })

  it('keeps the BE trade amounts on success (validation, not revision)', async () => {
    const apiOutput = '2000000000000000000' // 2 USDT
    mockGetQuote.mockResolvedValueOnce(makeQuoteResult(apiOutput))
    ;(validateTradeOnChain as any).mockResolvedValueOnce(undefined)

    const query = makeQuery({ hash: 'hash-happy' })
    const loadable = await readLoadable(query)

    expect(loadable.isJust()).toBe(true)
    const order = loadable.value as any
    // Aggregator BE is authoritative — outputAmount must match the API response,
    // not whatever the on-chain quoter would have recomputed.
    expect(order.trade.outputAmount.quotient.toString()).toBe(apiOutput)
    expect(order.trade.quoteQueryHash).toBe('hash-happy')
    expect(validateTradeOnChain).toHaveBeenCalledTimes(1)
    expect(order.aggregatorQuoteData).toEqual(expect.objectContaining({ outputAmount: apiOutput }))
  })

  it('rejects the quote when on-chain validation throws and logs rich diagnostic payload', async () => {
    mockGetQuote.mockResolvedValueOnce(makeQuoteResult('2000000000000000000'))
    const verifyError = new Error('Fail to validate')
    ;(validateTradeOnChain as any).mockRejectedValueOnce(verifyError)

    const query = makeQuery({ hash: 'hash-verify-fail' })
    const loadable = await readLoadable(query)

    expect(loadable.isFail()).toBe(true)
    expect(loadable.error).toBe(verifyError)
    // Error must be flattened to name/message/stack so DataDog forwards real content
    // instead of `{}` (Error instances don't JSON-serialize those fields).
    expect(logger.warn).toHaveBeenCalledWith(
      'aggregator.quote.rejected',
      expect.objectContaining({
        reason: 'verification-failed',
        chainId: ChainId.BSC,
        tokenIn: WETH.address,
        tokenOut: USDT.address,
        aggregatorAddress: '0xRouterAllowedAddress',
        error: expect.objectContaining({ name: 'Error', message: 'Fail to validate' }),
        quote: expect.objectContaining({
          srcToken: WETH.address,
          dstToken: USDT.address,
          routes: [
            expect.objectContaining({
              percent: 100,
              pools: [expect.objectContaining({ type: 'infinityCl', fee: 7 })],
            }),
          ],
        }),
      }),
    )
    // Invariant: a rejected quote never surfaces a partially-annotated order.
  })

  it('rejects on allowlist failure BEFORE calling on-chain validation and logs quote summary', async () => {
    mockGetQuote.mockResolvedValueOnce(makeQuoteResult('2000000000000000000'))
    ;(isAllowedAggregatorRouter as any).mockReturnValue(false)

    const query = makeQuery({ hash: 'hash-allowlist-fail' })
    const loadable = await readLoadable(query)

    expect(loadable.isFail()).toBe(true)
    expect(validateTradeOnChain).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'aggregator.quote.rejected',
      expect.objectContaining({
        reason: 'not-allowlisted',
        chainId: ChainId.BSC,
        tokenIn: WETH.address,
        tokenOut: USDT.address,
        aggregatorAddress: '0xRouterAllowedAddress',
        quote: expect.objectContaining({ srcToken: WETH.address }),
      }),
    )
  })
})
