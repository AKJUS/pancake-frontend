import { describe, expect, it } from 'vitest'
import { ChainId, isTestnetChainId, isEvm, NonEVMChainId } from '../src'

describe('chains', () => {
  it('should be defined', () => {
    expect(ChainId).toBeDefined()
  })

  it('should return if chainId is testnet or not ', () => {
    expect(isTestnetChainId(ChainId.ARBITRUM_GOERLI)).toBeTruthy()
    expect(isTestnetChainId(ChainId.ARBITRUM_ONE)).toBeFalsy()
  })

  it('should check if chain is evm', () => {
    expect(isEvm(ChainId.BSC)).toBeTruthy()
    expect(isEvm(ChainId.ETHEREUM)).toBeTruthy()
    expect(isEvm(ChainId.ARBITRUM_GOERLI)).toBeTruthy()
    expect(isEvm(ChainId.ARBITRUM_ONE)).toBeTruthy()
    expect(isEvm(ChainId.BASE)).toBeTruthy()
    expect(isEvm(ChainId.BASE_TESTNET)).toBeTruthy()
    expect(isEvm(ChainId.GOERLI)).toBeTruthy()
    expect(isEvm(ChainId.SEPOLIA)).toBeTruthy()
    expect(isEvm(NonEVMChainId.SOLANA)).toBeFalsy()
    expect(isEvm(NonEVMChainId.APTOS)).toBeFalsy()
  })
})
