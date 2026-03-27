import { describe, it, expect } from 'vitest'
import { Chains } from './chains'
import { testnetChainIds } from './chainId'

describe('chains', () => {
  it('every ID in testnetChainIds should have the testnet flag', () => {
    testnetChainIds.forEach((chainId) => {
      const chain = Chains.find((chain) => chain.id === chainId)
      expect(chain, `chainId ${chainId} should be defined`).toBeDefined()
      expect(chain?.testnet, `chainId ${chainId} should have the testnet flag`).toBe(true)
    })
  })
})
