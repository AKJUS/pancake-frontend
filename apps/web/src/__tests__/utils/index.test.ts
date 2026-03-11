/* eslint-disable address/addr-type */
import { Token, Percent, CurrencyAmount } from '@pancakeswap/sdk'
import { ChainId } from '@pancakeswap/chains'
import { getBlockExploreLink, safeGetAddress, calculateGasMargin, getBlockExploreName } from 'utils'
import { calculateSlippageAmount, basisPointsToPercent } from 'utils/exchange'
import { ADDRESS_ZERO } from '@pancakeswap/v3-sdk'
import { bsc } from 'wagmi/chains'
import { CHAINS } from 'config/chains'
import { multiChainName, multiChainScan } from 'state/info/constant'

describe('utils', () => {
  describe('#getBlockExploreLink', () => {
    it('correct for tx', () => {
      expect(getBlockExploreLink('abc', 'transaction', ChainId.BSC)).toEqual('https://bscscan.com/tx/abc')
    })
    it('correct for token', () => {
      expect(getBlockExploreLink('abc', 'token', ChainId.BSC)).toEqual('https://bscscan.com/token/abc')
    })
    it('correct for address', () => {
      expect(getBlockExploreLink('abc', 'address', ChainId.BSC)).toEqual('https://bscscan.com/address/abc')
    })
    it('enum', () => {
      expect(getBlockExploreLink('abc', 'address', ChainId.BSC_TESTNET)).toEqual(
        'https://testnet.bscscan.com/address/abc',
      )
    })
    it('zksync points to native explorer', () => {
      expect(getBlockExploreLink('0x123', 'transaction', ChainId.ZKSYNC)).toEqual('https://explorer.zksync.io/tx/0x123')
    })
  })

  describe('#calculateSlippageAmount', () => {
    it('bounds are correct', () => {
      const tokenAmount = CurrencyAmount.fromRawAmount(new Token(ChainId.BSC, ADDRESS_ZERO, 0, 'TOKEN'), '100')
      expect(() => calculateSlippageAmount(tokenAmount, -1)).toThrow()
      expect(calculateSlippageAmount(tokenAmount, 0).map((bound) => bound.toString())).toEqual(['100', '100'])
      expect(calculateSlippageAmount(tokenAmount, 100).map((bound) => bound.toString())).toEqual(['99', '101'])
      expect(calculateSlippageAmount(tokenAmount, 200).map((bound) => bound.toString())).toEqual(['98', '102'])
      expect(calculateSlippageAmount(tokenAmount, 10000).map((bound) => bound.toString())).toEqual(['0', '200'])
      expect(() => calculateSlippageAmount(tokenAmount, 10001)).toThrow()
    })
  })

  describe('#safeGetAddress', () => {
    it('returns undefined if it is not a valid address', () => {
      expect(safeGetAddress('')).toBe(undefined)
      expect(safeGetAddress('0x0000')).toBe(undefined)
      expect(safeGetAddress(1)).toBe(undefined)
      expect(safeGetAddress({})).toBe(undefined)
      expect(safeGetAddress(undefined)).toBe(undefined)
    })

    it('returns the checksummed address', () => {
      expect(safeGetAddress('0xf164fc0ec4e93095b804a4795bbe1e041497b92a')).toBe(
        '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a',
      )
      expect(safeGetAddress('0xf164fC0Ec4E93095b804a4795bBe1e041497b92a')).toBe(
        '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a',
      )
    })

    it('succeeds even without prefix', () => {
      expect(safeGetAddress('f164fc0ec4e93095b804a4795bbe1e041497b92a')).toBe(
        '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a',
      )
    })
    it('fails if too long', () => {
      expect(safeGetAddress('f164fc0ec4e93095b804a4795bbe1e041497b92a0')).toBe(undefined)
    })
  })

  describe('#calculateGasMargin', () => {
    it('adds 10%', () => {
      expect(calculateGasMargin(1000n).toString()).toEqual('1100')
      expect(calculateGasMargin(50n).toString()).toEqual('55')
    })
  })

  describe('#basisPointsToPercent', () => {
    it('converts basis points numbers to percents', () => {
      expect(basisPointsToPercent(100).equalTo(new Percent(1n, 100n))).toBeTruthy()
      expect(basisPointsToPercent(500).equalTo(new Percent(5n, 100n))).toBeTruthy()
      expect(basisPointsToPercent(50).equalTo(new Percent(5n, 1000n))).toBeTruthy()
    })
  })

  describe('#getBlockExploreName', () => {
    it('returns default BSC explorer if no chainId is provided', () => {
      expect(getBlockExploreName()).toEqual(bsc.blockExplorers.default.name)
    })

    it('returns the correct explorer from CHAINS', () => {
      const chain = CHAINS.find((c) => c.id === ChainId.BSC)
      expect(getBlockExploreName(ChainId.BSC)).toEqual(chain?.blockExplorers?.default.name)
    })

    it('returns the correct explorer from CHAINS #2', () => {
      const chain = CHAINS.find((c) => c.id === ChainId.ZKSYNC)
      expect(getBlockExploreName(ChainId.ZKSYNC)).toEqual(chain?.blockExplorers?.default.name)
    })

    it('returns the correct multiChainScan name if present', () => {
      const chain = CHAINS[0]
      const multiName = multiChainScan[multiChainName[chain.id]]
      if (multiName) {
        expect(getBlockExploreName(chain.id)).toEqual(multiName)
      }
    })

    it('falls back to default BSC explorer for unknown chainId', () => {
      expect(getBlockExploreName(-1)).toEqual(bsc.blockExplorers.default.name)
    })
  })
})
