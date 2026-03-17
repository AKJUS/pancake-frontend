import { describe, expect, it } from 'vitest'
import { ChainId } from '@pancakeswap/chains'
import { WalletAdaptedNetwork } from 'src/types'
import { getAvailableWalletNetworks, isPhantomEvmChainSupported } from 'src/config/supportedEvmChains'

describe('supported evm chains', () => {
  it('recognizes supported phantom evm chains', () => {
    expect(isPhantomEvmChainSupported(ChainId.ETHEREUM)).toBe(true)
    expect(isPhantomEvmChainSupported(ChainId.BASE)).toBe(true)
    expect(isPhantomEvmChainSupported(ChainId.MONAD_MAINNET)).toBe(true)
    expect(isPhantomEvmChainSupported(ChainId.BSC)).toBe(false)
  })

  it('filters unsupported evm network while keeping solana', () => {
    expect(
      getAvailableWalletNetworks(
        {
          networks: [WalletAdaptedNetwork.EVM, WalletAdaptedNetwork.Solana],
          supportedEvmChainIds: [ChainId.ETHEREUM, ChainId.BASE, ChainId.MONAD_MAINNET],
        },
        ChainId.BSC,
      ),
    ).toEqual([WalletAdaptedNetwork.Solana])
  })
})
