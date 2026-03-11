import { UnifiedChainId } from '@pancakeswap/chains'
import { multiChainId, multiChainName, MultiChainNameExtend, multiChainScan } from 'state/info/constant'
import { getMultiChainName } from 'state/info/utils'

describe('MultiChain constants', () => {
  it('multiChainId values are unique', () => {
    const ids = Object.values(multiChainId)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('multiChainName values are consistent with multiChainId', () => {
    for (const [name, id] of Object.entries(multiChainId)) {
      expect(multiChainName[id as UnifiedChainId]).toBe(name)
    }
  })

  it('multiChainScan contains all MultiChainNameExtend keys', () => {
    const keys: MultiChainNameExtend[] = Object.keys(multiChainScan) as MultiChainNameExtend[]
    const expectedKeys: MultiChainNameExtend[] = [
      'BSC_TESTNET',
      'BSC',
      'ETH',
      'ZKSYNC',
      'ARB',
      'LINEA',
      'LINEA_TESTNET',
      'BASE',
      'OPBNB',
      'SOLANA',
      'MONAD',
    ]
    expect(keys.sort()).toEqual(expectedKeys.sort())
  })

  it('getMultiChainName returns correct name for each chainId', () => {
    for (const [name, id] of Object.entries(multiChainId)) {
      expect(getMultiChainName(id as UnifiedChainId)).toBe(name)
    }
  })

  it('getMultiChainName defaults to BSC when no chainId is provided', () => {
    expect(getMultiChainName()).toBe('BSC')
  })

  it('getMultiChainName returns default BSC for falsy values', () => {
    expect(getMultiChainName(undefined)).toBe('BSC')
    expect(getMultiChainName(null as unknown as UnifiedChainId)).toBe('BSC')
  })

  it('ZKSYNC points to the correct native explorer', () => {
    expect(multiChainScan.ZKSYNC).toBe('ZKsync Explorer')
  })
})
