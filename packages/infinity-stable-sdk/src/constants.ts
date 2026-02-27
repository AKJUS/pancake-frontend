import { Address } from 'viem'
import { ChainId } from '@pancakeswap/chains'

/**
 * InfinityStable Pool Factory contract addresses by chain
 */
export const CL_STABLE_SWAP_POOL_FACTORY_ADDRESS: Record<ChainId.BSC | ChainId.BSC_TESTNET, Address> = {
  [ChainId.BSC]: '0x3669dDD1a9ee009dB9Eb2174C5C760FFfc66cfeF',
  [ChainId.BSC_TESTNET]: '0x41187151170541bE6Ec0F3C235781ED9d7EF9923',
}

/**
 * InfinityStable Hook Factory contract addresses by chain
 */
export const HOOK_INFINITY_STABLE_HOOK_FACTORY_ADDRESS: Record<ChainId.BSC | ChainId.BSC_TESTNET, Address> = {
  [ChainId.BSC]: '0x44de03599d1088b205D959b09A842448A0a63173',
  [ChainId.BSC_TESTNET]: '0x9188584835110FB6e0eB3BAE10ef1459Acf99edB', // TODO: Update with actual testnet address
}

/**
 * Default null method ID
 */
export const NULL_METHOD_ID = '0x00000000' as const

/**
 * Default implementation index
 */
export const DEFAULT_IMPLEMENTATION_IDX = 0n

/**
 * Default asset type (standard ERC20)
 */
export const DEFAULT_ASSET_TYPE = 0

/**
 * Maximum fee (1% = 10000000)
 */
export const MAX_FEE = 10000000n

/**
 * Minimum amplification parameter
 */
export const MIN_A = 1n

/**
 * Maximum amplification parameter
 */
export const MAX_A = 10000n

export const INFINITY_STABLE_POOL_FEE_DENOMINATOR = 1e10
