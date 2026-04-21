import fs from 'fs'
import path from 'path'

import { OrderType, type BridgeOrder, type ClassicOrder } from '@pancakeswap/price-api-sdk'
import { describe, expect, it } from 'vitest'

import { getAggregatorQuoteData, isAggregatorOrder } from '../aggregatorOrder'

const baseTrade = { quoteQueryHash: 'h' } as ClassicOrder['trade']

const makeAggregatorOrder = (): ClassicOrder => ({
  type: OrderType.PCS_CLASSIC,
  trade: baseTrade,
  aggregatorQuoteData: {
    srcToken: '0x0',
    dstToken: '0x1',
    tradeType: 'exactIn',
    inputAmount: '100',
    outputAmount: '99',
    gasUseEstimate: '0',
    routes: [],
    aggregatorAddress: '0xAGG',
  },
})

const makeLegacyOrder = (): ClassicOrder => ({
  type: OrderType.PCS_CLASSIC,
  trade: baseTrade, // same trade shape + same quoteQueryHash as aggregator — regression for review §2
})

describe('aggregatorOrder helpers', () => {
  describe('isAggregatorOrder', () => {
    it('returns true for a classic order carrying aggregatorQuoteData', () => {
      expect(isAggregatorOrder(makeAggregatorOrder())).toBe(true)
    })

    it('returns false for a classic order without aggregatorQuoteData even if the hash matches', () => {
      const aggregator = makeAggregatorOrder()
      const legacy = makeLegacyOrder()
      // Both orders share the same `trade.quoteQueryHash` — the old Map-keyed lookup
      // misclassified the legacy winner as an aggregator order (review §2). Identity-bound
      // classification must not share state between distinct order objects.
      expect(aggregator.trade.quoteQueryHash).toBe(legacy.trade.quoteQueryHash)
      expect(isAggregatorOrder(legacy)).toBe(false)
    })

    it('returns false for undefined / null orders', () => {
      expect(isAggregatorOrder(undefined)).toBe(false)
      expect(isAggregatorOrder(null)).toBe(false)
    })

    it('returns false for non-PCS_CLASSIC orders', () => {
      const fakeBridge = { type: OrderType.PCS_BRIDGE, trade: baseTrade } as unknown as BridgeOrder
      expect(isAggregatorOrder(fakeBridge)).toBe(false)

      const fakeSvm = { type: OrderType.PCS_SVM, trade: baseTrade } as any
      expect(isAggregatorOrder(fakeSvm)).toBe(false)

      const fakeX = { type: OrderType.DUTCH_LIMIT, trade: baseTrade } as any
      expect(isAggregatorOrder(fakeX)).toBe(false)
    })
  })

  describe('getAggregatorQuoteData', () => {
    it('returns the stashed quoteData for an aggregator order', () => {
      const order = makeAggregatorOrder()
      expect(getAggregatorQuoteData(order)).toBe(order.aggregatorQuoteData)
    })

    it('returns undefined for a legacy classic order', () => {
      expect(getAggregatorQuoteData(makeLegacyOrder())).toBeUndefined()
    })

    it('returns undefined for undefined orders', () => {
      expect(getAggregatorQuoteData(undefined)).toBeUndefined()
      expect(getAggregatorQuoteData(null)).toBeUndefined()
    })

    it('returns undefined for non-PCS_CLASSIC orders', () => {
      const fakeBridge = { type: OrderType.PCS_BRIDGE, trade: baseTrade } as unknown as BridgeOrder
      expect(getAggregatorQuoteData(fakeBridge)).toBeUndefined()

      const fakeSvm = { type: OrderType.PCS_SVM, trade: baseTrade } as any
      expect(getAggregatorQuoteData(fakeSvm)).toBeUndefined()
    })
  })
})

describe('aggregatorQuoteDataAtom side-channel removal', () => {
  const repoRoot = path.resolve(__dirname, '../../../..') // apps/web
  const sideChannelPath = path.join(repoRoot, 'src/quoter/atom/aggregatorQuoteDataAtom.ts')

  // Files that used to import the deleted module. Guard against regressions where
  // somebody re-introduces the side-channel without re-introducing the file.
  const consumerPaths = [
    'src/quoter/atom/bestAggregatorQuoteAtom.ts',
    'src/views/Swap/V3Swap/hooks/useConfirmModalState.tsx',
    'src/views/Swap/V3Swap/hooks/useSwapCallback.ts',
    'src/views/SwapSimplify/InfinitySwap/SwapCommitButton.tsx',
  ]

  it('aggregatorQuoteDataAtom.ts no longer exists', () => {
    expect(fs.existsSync(sideChannelPath)).toBe(false)
  })

  it('no known consumer imports the removed module', () => {
    for (const rel of consumerPaths) {
      const abs = path.join(repoRoot, rel)
      expect(fs.existsSync(abs)).toBe(true)
      const source = fs.readFileSync(abs, 'utf8')
      expect(source).not.toContain('aggregatorQuoteDataAtom')
      expect(source).not.toContain('setAggregatorQuoteData')
    }
  })
})
