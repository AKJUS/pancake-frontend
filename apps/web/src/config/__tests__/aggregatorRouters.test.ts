import { ChainId } from '@pancakeswap/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGGREGATOR_ROUTERS,
  AGGREGATOR_SUPPORTED_CHAIN_IDS,
  isAllowedAggregatorRouter,
} from '../constants/aggregatorRouters'

const ETH_ROUTER_CHECKSUM = '0x40A1Fe393A7F566F27dF6acE18e6773be844dAfc'
const ETH_ROUTER_LOWER = '0x40A1Fe393A7F566F27dF6acE18e6773be844dAfc'

describe('isAllowedAggregatorRouter', () => {
  it('returns true for the known router on Ethereum (mixed-checksum input)', () => {
    expect(isAllowedAggregatorRouter(ChainId.ETHEREUM, ETH_ROUTER_CHECKSUM)).toBe(true)
    expect(isAllowedAggregatorRouter(ChainId.ETHEREUM, ETH_ROUTER_LOWER)).toBe(true)
    expect(isAllowedAggregatorRouter(ChainId.ETHEREUM, ETH_ROUTER_LOWER.toUpperCase().replace('0X', '0x'))).toBe(true)
  })

  it('returns true for the known router on Base', () => {
    expect(isAllowedAggregatorRouter(ChainId.BASE, ETH_ROUTER_LOWER)).toBe(true)
  })

  it('returns true for the known router on BSC', () => {
    expect(isAllowedAggregatorRouter(ChainId.BSC, ETH_ROUTER_LOWER)).toBe(true)
  })

  it('returns false for an off-by-one address on a supported chain', () => {
    expect(isAllowedAggregatorRouter(ChainId.ETHEREUM, '0x40a1fE393a7f566f27df6Ace18E6773Be844DAFd')).toBe(false)
  })

  it('returns false for a valid address on an unsupported chain', () => {
    expect(isAllowedAggregatorRouter(ChainId.ARBITRUM_ONE, ETH_ROUTER_LOWER)).toBe(false)
  })

  it('returns false for malformed input', () => {
    expect(isAllowedAggregatorRouter(ChainId.ETHEREUM, undefined)).toBe(false)
    expect(isAllowedAggregatorRouter(ChainId.ETHEREUM, '')).toBe(false)
    expect(isAllowedAggregatorRouter(ChainId.ETHEREUM, '0xnothex')).toBe(false)
    expect(isAllowedAggregatorRouter(ChainId.ETHEREUM, '0x1234')).toBe(false)
  })

  it('returns false when chainId is undefined', () => {
    expect(isAllowedAggregatorRouter(undefined, ETH_ROUTER_LOWER)).toBe(false)
  })
})

describe('AGGREGATOR_SUPPORTED_CHAIN_IDS', () => {
  it('contains Ethereum and Base', () => {
    expect(AGGREGATOR_SUPPORTED_CHAIN_IDS).toContain(ChainId.ETHEREUM)
    expect(AGGREGATOR_SUPPORTED_CHAIN_IDS).toContain(ChainId.BASE)
  })

  it('contains BSC', () => {
    expect(AGGREGATOR_SUPPORTED_CHAIN_IDS).toContain(ChainId.BSC)
  })

  it('is derived from AGGREGATOR_ROUTERS keys — every supported chain has at least one router', () => {
    for (const chainId of AGGREGATOR_SUPPORTED_CHAIN_IDS) {
      const list = AGGREGATOR_ROUTERS[chainId as ChainId]
      expect(list && list.length > 0).toBe(true)
    }
  })

  it('every allowlisted chain is supported — AGGREGATOR_ROUTERS and AGGREGATOR_SUPPORTED_CHAIN_IDS do not drift', () => {
    const allowlistedChains = Object.entries(AGGREGATOR_ROUTERS)
      .filter(([, list]) => (list?.length ?? 0) > 0)
      .map(([chainId]) => Number(chainId))
    expect([...AGGREGATOR_SUPPORTED_CHAIN_IDS].sort()).toEqual(allowlistedChains.sort())
  })
})

describe('AGGREGATOR_ROUTERS', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('keeps BSC allowlisted when NEXT_PUBLIC_VERCEL_ENV === "production"', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    vi.resetModules()
    const mod = await import('../constants/aggregatorRouters')
    expect(mod.AGGREGATOR_SUPPORTED_CHAIN_IDS).toContain(ChainId.BSC)
    expect(mod.AGGREGATOR_SUPPORTED_CHAIN_IDS).toContain(ChainId.ETHEREUM)
    expect(mod.AGGREGATOR_SUPPORTED_CHAIN_IDS).toContain(ChainId.BASE)
    expect(mod.isAllowedAggregatorRouter(ChainId.BSC, ETH_ROUTER_LOWER)).toBe(true)
  })
})
