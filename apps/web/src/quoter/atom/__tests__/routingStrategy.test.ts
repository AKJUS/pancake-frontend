import { ChainId } from '@pancakeswap/chains'
import { CurrencyAmount, ERC20Token, TradeType } from '@pancakeswap/sdk'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { QuoteQuery } from 'quoter/quoter.types'
import { getRoutingStrategy } from '../routingStrategy'

const ETH_CHAIN = ChainId.ETHEREUM
const BSC_CHAIN = ChainId.BSC
const UNSUPPORTED_CHAIN = ChainId.ZKSYNC

const WETH = new ERC20Token(ETH_CHAIN, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH')
const USDC = new ERC20Token(ETH_CHAIN, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC')
const WBNB = new ERC20Token(BSC_CHAIN, '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB', 18, 'WBNB')
const BSC_USDT = new ERC20Token(BSC_CHAIN, '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa', 18, 'USDT')

const UNSUPPORTED_A = new ERC20Token(UNSUPPORTED_CHAIN, '0x1111111111111111111111111111111111111111', 18, 'A')
const UNSUPPORTED_B = new ERC20Token(UNSUPPORTED_CHAIN, '0x2222222222222222222222222222222222222222', 18, 'B')

const strategyKeys = (strategies: ReturnType<typeof getRoutingStrategy>) => strategies.map((s) => s.key)

function makeQuery(overrides: Partial<QuoteQuery> = {}): QuoteQuery {
  const baseCurrency = WETH
  const currency = USDC
  return {
    baseCurrency,
    currency,
    amount: CurrencyAmount.fromRawAmount(baseCurrency, '1000000000000000000'),
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

describe('getRoutingStrategy (PostHog release flag)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('filters aggregator out in production when release flag is disabled', () => {
    const result = getRoutingStrategy(makeQuery(), {}, false, false)
    expect(strategyKeys(result)).not.toContain('aggregator')
    expect(strategyKeys(result).length).toBeGreaterThan(0)
  })

  it('keeps aggregator in production when release flag is enabled', () => {
    const result = getRoutingStrategy(makeQuery(), {}, false, true)
    expect(strategyKeys(result)).toContain('aggregator')
  })

  it('keeps aggregator on BSC in production when release flag is enabled', () => {
    const result = getRoutingStrategy(
      makeQuery({
        baseCurrency: WBNB,
        currency: BSC_USDT,
        amount: CurrencyAmount.fromRawAmount(WBNB, '1000000000000000000'),
      }),
      {},
      false,
      true,
    )
    expect(strategyKeys(result)).toContain('aggregator')
  })

  it('keeps aggregator in production when device override is enabled even if the flag is off', () => {
    const result = getRoutingStrategy(makeQuery(), {}, false, true, true)
    expect(strategyKeys(result)).toContain('aggregator')
  })

  it('aggregatorOnly QA toggle overrides release flag on non-prod envs', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    const result = getRoutingStrategy(makeQuery({ aggregatorOnly: true }), {}, false, false)
    expect(strategyKeys(result)).toEqual(['aggregator'])
  })

  it('filters aggregator out on unsupported chain even when flag is enabled', () => {
    const query = makeQuery({
      baseCurrency: UNSUPPORTED_A,
      currency: UNSUPPORTED_B,
      amount: CurrencyAmount.fromRawAmount(UNSUPPORTED_A, '1000000000000000000'),
    })
    const result = getRoutingStrategy(query, {}, false, true)
    expect(strategyKeys(result)).not.toContain('aggregator')
  })

  it('routes RWA-only path regardless of release flag', () => {
    const result = getRoutingStrategy(makeQuery(), {}, true, false)
    expect(strategyKeys(result)).toEqual(['x'])
  })

  it('filters aggregator out when excludeAggregator is true regardless of release flag', () => {
    const result = getRoutingStrategy(makeQuery({ excludeAggregator: true }), {}, false, true)
    expect(strategyKeys(result)).not.toContain('aggregator')
    expect(strategyKeys(result).length).toBeGreaterThan(0)
  })

  it('keeps aggregator when excludeAggregator is false and release flag is enabled', () => {
    const result = getRoutingStrategy(makeQuery({ excludeAggregator: false }), {}, false, true)
    expect(strategyKeys(result)).toContain('aggregator')
  })
})
