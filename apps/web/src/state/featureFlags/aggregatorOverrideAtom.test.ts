import { describe, expect, it } from 'vitest'

import {
  AGGREGATOR_OVERRIDE_TTL_MS,
  createAggregatorOverrideState,
  getAggregatorOverrideQueryAction,
  isAggregatorOverrideEnabled,
} from './aggregatorOverrideAtom'

describe('aggregatorOverrideAtom helpers', () => {
  it('maps agg_override=1 to enable', () => {
    expect(getAggregatorOverrideQueryAction('1')).toBe('enable')
  })

  it('maps agg_override=0 to clear', () => {
    expect(getAggregatorOverrideQueryAction('0')).toBe('clear')
  })

  it('ignores other query values', () => {
    expect(getAggregatorOverrideQueryAction('anything-else')).toBeNull()
    expect(getAggregatorOverrideQueryAction(undefined)).toBeNull()
  })

  it('creates a one-day override by default', () => {
    const now = 1_700_000_000_000
    expect(createAggregatorOverrideState(now)).toEqual({
      enabled: true,
      expiresAt: now + AGGREGATOR_OVERRIDE_TTL_MS,
    })
  })

  it('marks override inactive after expiry', () => {
    const state = createAggregatorOverrideState(1_000, 50)
    expect(isAggregatorOverrideEnabled(state, 1_049)).toBe(true)
    expect(isAggregatorOverrideEnabled(state, 1_050)).toBe(false)
  })
})
