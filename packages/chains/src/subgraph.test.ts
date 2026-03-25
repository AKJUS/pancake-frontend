import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { filterSubgraphs } from './subgraphs'

type SubgraphMap = Record<number, string | null | undefined>

describe('filterSubgraphs', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalVercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalVercelEnv === undefined) {
      delete process.env.NEXT_PUBLIC_VERCEL_ENV
    } else {
      process.env.NEXT_PUBLIC_VERCEL_ENV = originalVercelEnv
    }
  })

  describe('non-production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
      delete process.env.NEXT_PUBLIC_VERCEL_ENV
    })

    it('returns all entries as-is, including undefined values', () => {
      const input: SubgraphMap = {
        1: 'https://example.com/subgraph',
        2: null,
        3: undefined,
        4: 'https://example.com/subgraph-with-undefined-key',
      }
      const result = filterSubgraphs(input)
      expect(result).toEqual(input)
    })

    it('returns entries with "undefined" in URL strings unchanged', () => {
      const input: SubgraphMap = {
        1: 'https://gateway.thegraph.com/api/undefined/subgraphs/id/abc',
      }
      const result = filterSubgraphs(input)
      expect(result).toEqual(input)
    })

    it('returns an empty object unchanged', () => {
      expect(filterSubgraphs({})).toEqual({})
    })
  })

  describe('production environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      delete process.env.NEXT_PUBLIC_VERCEL_ENV
    })

    it('removes entries with undefined values', () => {
      const input: SubgraphMap = {
        1: 'https://example.com/subgraph',
        2: undefined,
      }
      const result = filterSubgraphs(input)
      expect(result).not.toHaveProperty('2')
      expect(result).toHaveProperty('1', 'https://example.com/subgraph')
    })

    it('keeps entries with null values', () => {
      const input: SubgraphMap = {
        1: 'https://example.com/subgraph',
        2: null,
      }
      const result = filterSubgraphs(input)
      expect(result).toHaveProperty('1')
      expect(result).toHaveProperty('2', null)
    })

    it('converts URLs containing "undefined" to null', () => {
      const input: SubgraphMap = {
        1: 'https://gateway.thegraph.com/api/undefined/subgraphs/id/abc',
        2: 'https://gateway.thegraph.com/api/real-api-key/subgraphs/id/xyz',
      }
      const result = filterSubgraphs(input)
      expect(result).toHaveProperty('1', null)
      expect(result).toHaveProperty('2', 'https://gateway.thegraph.com/api/real-api-key/subgraphs/id/xyz')
    })

    it('keeps valid URLs without "undefined"', () => {
      const input: SubgraphMap = {
        1: 'https://api.thegraph.com/subgraphs/name/pancakeswap/blocks',
        2: 'https://gateway.thegraph.com/api/abc123/subgraphs/id/xyz',
      }
      const result = filterSubgraphs(input)
      expect(result).toEqual(input)
    })

    it('returns empty object when all entries are undefined', () => {
      const input: SubgraphMap = { 1: undefined, 2: undefined }
      const result = filterSubgraphs(input)
      expect(result).toEqual({})
    })

    it('converts all entries to null when all URLs contain "undefined"', () => {
      const input: SubgraphMap = {
        1: 'https://example.com/api/undefined/subgraph',
        2: 'https://other.com/undefined/path',
      }
      const result = filterSubgraphs(input)
      expect(result).toEqual({ 1: null, 2: null })
    })

    it('handles mixed valid, null, undefined, and "undefined" URL entries', () => {
      const input: SubgraphMap = {
        1: 'https://valid.com/subgraph',
        2: null,
        3: undefined,
        4: 'https://gateway.com/api/undefined/subgraph',
      }
      const result = filterSubgraphs(input)
      expect(result).toEqual({
        1: 'https://valid.com/subgraph',
        2: null,
        4: null,
      })
      expect(result).not.toHaveProperty('3')
    })
  })

  describe('preview environment (treated as non-production)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_VERCEL_ENV = 'preview'
    })

    it('returns all entries as-is including undefined and "undefined" URLs', () => {
      const input: SubgraphMap = {
        1: 'https://gateway.thegraph.com/api/undefined/subgraphs/id/abc',
        2: undefined,
        3: null,
      }
      const result = filterSubgraphs(input)
      expect(result).toEqual(input)
    })
  })

  describe('simulating API key injection', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      delete process.env.NEXT_PUBLIC_VERCEL_ENV
    })

    it('includes subgraph when a real API key is provided (no "undefined" in URL)', () => {
      const theGraphApiKey = 'my-real-api-key'
      const input: SubgraphMap = {
        1: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/CJY`,
      }
      const result = filterSubgraphs(input)
      expect(result).toHaveProperty(
        '1',
        `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/CJY`,
      )
    })

    it('converts to null when API key is missing (template literal produces "undefined" in URL)', () => {
      const theGraphApiKey = undefined
      const input: SubgraphMap = {
        1: `https://gateway-arbitrum.network.thegraph.com/api/${theGraphApiKey}/subgraphs/id/CJY`,
      }
      const result = filterSubgraphs(input)
      expect(result).toHaveProperty('1', null)
    })
  })
})
