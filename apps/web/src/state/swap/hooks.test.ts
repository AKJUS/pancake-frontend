/* eslint-disable no-var */
/* eslint-disable vars-on-top */
import { parse } from 'querystring'
import { Mock, vi } from 'vitest'
import { NonEVMChainId } from '@pancakeswap/chains'
import { UnifiedNativeCurrency } from '@pancakeswap/swap-sdk-core'
import { Field } from './actions'
import { queryParametersToSwapState, normalizeCurrencySelectionForChain } from './hooks'

describe('hooks', () => {
  describe('#queryParametersToSwapState', () => {
    test('BNB to DAI', () => {
      expect(
        queryParametersToSwapState(
          parse(
            'inputCurrency=BNB&outputCurrency=0x6b175474e89094c44da98b954eedeac495271d0f&exactAmount=20.5&exactField=outPUT',
          ),
        ),
      ).toEqual({
        [Field.OUTPUT]: { currencyId: '0x6B175474E89094C44Da98b954EedeAC495271d0F', chainId: undefined },
        [Field.INPUT]: { currencyId: 'BNB', chainId: undefined },
        typedValue: '20.5',
        independentField: Field.OUTPUT,
        recipient: null,
      })
    })

    test('should return Native by default', () => {
      expect(queryParametersToSwapState(parse(''))).toEqual({
        [Field.OUTPUT]: { currencyId: undefined, chainId: undefined },
        [Field.INPUT]: { currencyId: 'BNB', chainId: undefined },
        typedValue: '',
        independentField: Field.INPUT,
        recipient: null,
      })
    })

    test('does not duplicate BNB for invalid output token', () => {
      expect(queryParametersToSwapState(parse('outputCurrency=invalid'), 'BNB')).toEqual({
        [Field.INPUT]: { currencyId: '', chainId: undefined },
        [Field.OUTPUT]: { currencyId: 'BNB', chainId: undefined },
        typedValue: '',
        independentField: Field.INPUT,
        recipient: null,
      })
    })

    test('output BNB only', () => {
      expect(queryParametersToSwapState(parse('outputCurrency=bnb&exactAmount=20.5'), 'BNB')).toEqual({
        [Field.OUTPUT]: { currencyId: 'BNB', chainId: undefined },
        [Field.INPUT]: { currencyId: '', chainId: undefined },
        typedValue: '20.5',
        independentField: Field.INPUT,
        recipient: null,
      })
    })

    test('invalid recipient', () => {
      expect(queryParametersToSwapState(parse('outputCurrency=BNB&exactAmount=20.5&recipient=abc'), 'BNB')).toEqual({
        [Field.OUTPUT]: { currencyId: 'BNB', chainId: undefined },
        [Field.INPUT]: { currencyId: '', chainId: undefined },
        typedValue: '20.5',
        independentField: Field.INPUT,
        recipient: null,
      })
    })

    test('valid recipient', () => {
      expect(
        queryParametersToSwapState(
          parse('outputCurrency=BNB&exactAmount=20.5&recipient=0x0fF2D1eFd7A57B7562b2bf27F3f37899dB27F4a5'),
          'BNB',
        ),
      ).toEqual({
        [Field.OUTPUT]: { currencyId: 'BNB', chainId: undefined },
        [Field.INPUT]: { currencyId: '', chainId: undefined },
        typedValue: '20.5',
        independentField: Field.INPUT,
        recipient: '0x0fF2D1eFd7A57B7562b2bf27F3f37899dB27F4a5',
      })
    })

    test('handle Solana chain with token address', () => {
      const outputCurrency = '4qQeZ5LwSz6HuupUu8jCtgXyW1mYQcNbFAW1sWZp89HL'
      expect(queryParametersToSwapState(parse(`chain=sol&outputCurrency=${outputCurrency}`))).toEqual({
        [Field.INPUT]: { currencyId: 'SOL', chainId: NonEVMChainId.SOLANA },
        [Field.OUTPUT]: { currencyId: outputCurrency, chainId: NonEVMChainId.SOLANA },
        typedValue: '',
        independentField: Field.INPUT,
        recipient: null,
      })
    })
  })

  describe('#normalizeCurrencySelectionForChain', () => {
    const mockNative = { symbol: 'BNB' } as UnifiedNativeCurrency
    const defaultParams = {
      native: mockNative,
      pathname: '/swap',
      chainId: 56, // BSC
      defaultOutputCurrency: '0x55d398326f99059fF775485246999027B3197955', // USDT
    }

    test('should return unchanged currencies when input chain matches current chain', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'BNB',
        inputChainId: 56,
        outputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        outputChainId: 56,
        supportedBridgeChains: [],
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should reset input currency to native when input chain differs from current chain', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: '0x1234567890123456789012345678901234567890',
        inputChainId: 1, // Ethereum
        outputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        outputChainId: 56,
        supportedBridgeChains: [56],
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should reset output currency when bridge is not supported', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'BNB',
        inputChainId: 1, // Ethereum
        outputCurrencyId: '0x1111111111111111111111111111111111111111',
        outputChainId: 137, // Polygon
        supportedBridgeChains: [], // No bridge support
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should handle Solana input chain correctly', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'SOL',
        inputChainId: NonEVMChainId.SOLANA,
        outputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        outputChainId: 56,
        supportedBridgeChains: [],
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should handle Solana output chain correctly', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'BNB',
        inputChainId: 56,
        outputCurrencyId: 'SOL',
        outputChainId: NonEVMChainId.SOLANA,
        supportedBridgeChains: [NonEVMChainId.SOLANA, 56],
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: 'SOL',
        finalInputChainId: 56,
        finalOutputChainId: NonEVMChainId.SOLANA,
      })
    })

    test('should maintain cross-chain when bridge is supported', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'BNB',
        inputChainId: 1, // Ethereum
        outputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        outputChainId: 56, // BSC
        supportedBridgeChains: [56],
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should resolve duplicate currencies on same chain - switch output to native', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        inputChainId: 56,
        outputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        outputChainId: 56,
        supportedBridgeChains: [],
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalOutputCurrencyId: 'BNB',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should resolve duplicate native currencies - switch output to default', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'BNB',
        inputChainId: 56,
        outputCurrencyId: 'BNB',
        outputChainId: 56,
        supportedBridgeChains: [],
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should not modify output chain when bridge is supported for cross-chain', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'BNB',
        inputChainId: 56,
        outputCurrencyId: '0x1111111111111111111111111111111111111111',
        outputChainId: 1, // Ethereum
        supportedBridgeChains: [56, 1],
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x1111111111111111111111111111111111111111',
        finalInputChainId: 56,
        finalOutputChainId: 1,
      })
    })

    test('should handle TWAP path correctly (no bridge validation)', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'BNB',
        inputChainId: 1, // Different chain
        outputCurrencyId: '0x1111111111111111111111111111111111111111',
        outputChainId: 137, // Polygon
        supportedBridgeChains: [], // No bridge support
        ...defaultParams,
        pathname: '/twap', // TWAP path should skip bridge validation
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should handle limit path correctly (no bridge validation)', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: 'BNB',
        inputChainId: 1, // Different chain
        outputCurrencyId: '0x1111111111111111111111111111111111111111',
        outputChainId: 137, // Polygon
        supportedBridgeChains: [], // No bridge support
        ...defaultParams,
        pathname: '/limit', // Limit path should skip bridge validation
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })

    test('should handle complex scenario with chain switching and currency conflicts', () => {
      const result = normalizeCurrencySelectionForChain({
        inputCurrencyId: '0x1234567890123456789012345678901234567890',
        inputChainId: 1, // Ethereum
        outputCurrencyId: 'BNB', // Same as native after input reset
        outputChainId: 137, // Polygon (unsupported)
        supportedBridgeChains: [], // No bridge support
        ...defaultParams,
      })

      expect(result).toEqual({
        finalInputCurrencyId: 'BNB',
        finalOutputCurrencyId: '0x55d398326f99059fF775485246999027B3197955',
        finalInputChainId: 56,
        finalOutputChainId: 56,
      })
    })
  })
})

// weird bug on jest Reference Error, must use `var` here
var mockUseActiveWeb3React: Mock

vi.mock('../../hooks/useActiveWeb3React', () => {
  mockUseActiveWeb3React = vi.fn().mockReturnValue({
    chainId: 56,
  })
  return {
    __esModule: true,
    default: mockUseActiveWeb3React,
  }
})

var mockAccount: Mock

vi.mock('wagmi', async () => {
  mockAccount = vi.fn().mockReturnValue({})
  const original = await vi.importActual('wagmi') // Step 2.
  return {
    // @ts-ignore
    ...original,
    useAccount: mockAccount,
  }
})
