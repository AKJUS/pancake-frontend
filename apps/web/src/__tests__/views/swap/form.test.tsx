import { describe, it, expect, vi } from 'vitest'
import { handleCurrencySelectFn } from 'views/SwapSimplify/InfinitySwap/FormMainInfinity'
import { Field } from 'state/swap/actions'
import { baseTokens, bscTokens } from '@pancakeswap/tokens'
import { ChainId } from '@pancakeswap/chains'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { USDON_TOKEN_ADDRESS } from 'quoter/atom/ondoTokenAtoms'

describe('handleCurrencySelect', () => {
  it('switches network and updates router when isInput && canSwitch', async () => {
    const switchNetwork = vi.fn().mockResolvedValue(undefined)
    const replace = vi.fn()
    const replaceBrowserHistoryMultiple = vi.fn()

    const newCurrency = baseTokens.usdt

    const mockContext = {
      onCurrencySelection: vi.fn(),
      warningSwapHandler: vi.fn(),
      canSwitchToChain: (_chainId: number) => true,
      switchNetwork,
      outputChainId: ChainId.BSC,
      inputChainId: ChainId.BSC,
      inputCurrencyId: bscTokens.cake.address,
      outputCurrencyId: bscTokens.usdt.address,
      router: {
        query: { inputCurrency: bscTokens.cake.address, outputCurrency: bscTokens.usdt.address },
        replace,
      },
      replaceBrowserHistoryMultiple,
      newCurrency,
      field: Field.INPUT,
    }

    await handleCurrencySelectFn(mockContext)

    expect(switchNetwork).toHaveBeenCalledWith(ChainId.BASE, {
      from: 'switch',
      replaceUrl: false,
    })
    expect(replace).toHaveBeenCalledWith(
      {
        query: expect.objectContaining({
          inputCurrency: newCurrency.address,
          chain: CHAIN_QUERY_NAME[ChainId.BASE],
          outputCurrency: bscTokens.usdt.address,
          chainOut: CHAIN_QUERY_NAME[ChainId.BSC],
        }),
      },
      undefined,
      { shallow: true },
    )
  })

  it('resets invalid output currency when selecting an Ondo input token', async () => {
    const onCurrencySelection = vi.fn()
    const replaceBrowserHistoryMultiple = vi.fn()

    const newCurrency = {
      address: '0x2494b603319d4D9F9715c9f4496d9E0364B59d93',
      chainId: ChainId.BSC,
      wrapped: {
        address: '0x2494b603319d4D9F9715c9f4496d9E0364B59d93',
      },
      isToken: true,
      isNative: false,
    }

    await handleCurrencySelectFn({
      onCurrencySelection,
      canSwitchToChain: () => false,
      switchNetwork: vi.fn(),
      outputChainId: ChainId.BSC,
      supportedBridgeChains: [ChainId.BSC, ChainId.ETHEREUM],
      inputChainId: ChainId.BSC,
      inputCurrencyId: bscTokens.cake.address,
      outputCurrencyId: bscTokens.cake.address,
      router: {
        query: { inputCurrency: bscTokens.cake.address, outputCurrency: bscTokens.cake.address },
        replace: vi.fn(),
      },
      replaceBrowserHistoryMultiple,
      newCurrency,
      field: Field.INPUT,
      isOndoTokenFn: () => true,
    })

    expect(onCurrencySelection).toHaveBeenNthCalledWith(1, Field.INPUT, newCurrency)
    expect(onCurrencySelection).toHaveBeenNthCalledWith(2, Field.OUTPUT, bscTokens.usdt)
    expect(replaceBrowserHistoryMultiple).toHaveBeenCalledWith({
      inputCurrency: newCurrency.address,
      outputCurrency: bscTokens.usdt.address,
      chainOut: null,
    })
  })

  it('keeps USDON as a valid Ondo counterparty without resetting output', async () => {
    const onCurrencySelection = vi.fn()
    const replaceBrowserHistoryMultiple = vi.fn()
    const usdon = USDON_TOKEN_ADDRESS[ChainId.BSC]!

    const newCurrency = {
      address: '0x2494b603319d4D9F9715c9f4496d9E0364B59d93',
      chainId: ChainId.BSC,
      wrapped: {
        address: '0x2494b603319d4D9F9715c9f4496d9E0364B59d93',
      },
      isToken: true,
      isNative: false,
    }

    await handleCurrencySelectFn({
      onCurrencySelection,
      canSwitchToChain: () => false,
      switchNetwork: vi.fn(),
      outputChainId: ChainId.BSC,
      supportedBridgeChains: [ChainId.BSC, ChainId.ETHEREUM],
      inputChainId: ChainId.BSC,
      inputCurrencyId: bscTokens.cake.address,
      outputCurrencyId: usdon,
      router: {
        query: { inputCurrency: bscTokens.cake.address, outputCurrency: usdon },
        replace: vi.fn(),
      },
      replaceBrowserHistoryMultiple,
      newCurrency,
      field: Field.INPUT,
      isOndoTokenFn: () => true,
    })

    expect(onCurrencySelection).toHaveBeenCalledTimes(1)
    expect(replaceBrowserHistoryMultiple).toHaveBeenCalledWith({
      inputCurrency: newCurrency.address,
      chainOut: null,
    })
  })
})
