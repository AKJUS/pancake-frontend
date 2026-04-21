import { buildAggregatorProtocol } from 'quoter/atom/bestAggregatorQuoteAtom'
import type { QuoteQuery } from 'quoter/quoter.types'

function makeQuery(overrides: Partial<QuoteQuery> = {}): QuoteQuery {
  return {
    v2Swap: false,
    v3Swap: false,
    infinitySwap: false,
    stableSwap: false,
    hash: 'test',
    speedQuoteEnabled: false,
    xEnabled: false,
    blockNumber: 0,
    createTime: 0,
    ver: 0,
    ...overrides,
  } as QuoteQuery
}

describe('buildAggregatorProtocol', () => {
  it('returns undefined when all toggles are on (API default)', () => {
    const query = makeQuery({ v2Swap: true, v3Swap: true, infinitySwap: true, stableSwap: true })
    expect(buildAggregatorProtocol(query)).toBeUndefined()
  })

  it('returns undefined when all toggles are off', () => {
    const query = makeQuery()
    expect(buildAggregatorProtocol(query)).toBeUndefined()
  })

  it('returns "v2" when only v2 is on', () => {
    const query = makeQuery({ v2Swap: true })
    expect(buildAggregatorProtocol(query)).toBe('v2')
  })

  it('returns "v3" when only v3 is on', () => {
    const query = makeQuery({ v3Swap: true })
    expect(buildAggregatorProtocol(query)).toBe('v3')
  })

  it('returns "stableswap" when only stableSwap is on', () => {
    const query = makeQuery({ stableSwap: true })
    expect(buildAggregatorProtocol(query)).toBe('stableswap')
  })

  it('expands infinitySwap into infinityCl and infinityBin', () => {
    const query = makeQuery({ infinitySwap: true })
    expect(buildAggregatorProtocol(query)).toBe('infinityCl,infinityBin')
  })

  it('joins multiple selected protocols', () => {
    const query = makeQuery({ v2Swap: true, v3Swap: true })
    expect(buildAggregatorProtocol(query)).toBe('v2,v3')
  })

  it('returns correct combo for v3 + infinitySwap + stableswap', () => {
    const query = makeQuery({ v3Swap: true, infinitySwap: true, stableSwap: true })
    expect(buildAggregatorProtocol(query)).toBe('v3,infinityCl,infinityBin,stableswap')
  })
})
