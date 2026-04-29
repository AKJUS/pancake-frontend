import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTokenList } from './getTokenList'

const validList = {
  name: 'Test List',
  timestamp: '2026-04-29T00:00:00.000Z',
  version: {
    major: 1,
    minor: 0,
    patch: 0,
  },
  tokens: [
    {
      chainId: 56,
      address: '0x0000000000000000000000000000000000000001',
      decimals: 18,
      name: 'Valid Token',
      symbol: 'VALID',
    },
  ],
}

describe('getTokenList', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('filters invalid tokens without warning when the list is recoverable', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ...validList,
        tokens: [
          ...validList.tokens,
          {
            chainId: 56,
            address: '0x0000000000000000000000000000000000000002',
            decimals: 18,
            name: 'Broken Token',
            symbol: 'BROKEN🚨',
          },
        ],
      }),
    } as Response)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const list = await getTokenList('https://tokens.example.com/list.json')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(list?.tokens).toHaveLength(1)
    expect(list?.tokens[0]?.symbol).toBe('VALID')
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
