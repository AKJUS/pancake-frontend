import { describe, expect, it } from 'vitest'
import { ChainId } from '@pancakeswap/chains'
import { edgeQueries } from '../edgePoolQueries'

describe('edgePoolQueries.shouldDefaultToOnChainCandidatePools', () => {
  it('returns true for BSC testnet when preferOnChain is enabled', () => {
    expect(edgeQueries.shouldDefaultToOnChainCandidatePools(ChainId.BSC_TESTNET, true)).toBe(true)
  })

  it('returns false for BSC testnet when preferOnChain is disabled', () => {
    expect(edgeQueries.shouldDefaultToOnChainCandidatePools(ChainId.BSC_TESTNET, false)).toBe(false)
  })

  it('returns false for non-testnet chains even if preferOnChain is enabled', () => {
    expect(edgeQueries.shouldDefaultToOnChainCandidatePools(ChainId.BSC, true)).toBe(false)
  })
})
