import { AVERAGE_CHAIN_BLOCK_TIMES, ChainId } from '@pancakeswap/chains'

export * from './pools'
export * from './boostedPools'
export * from './contracts'
export * from './supportedChains'

// BNB Chain Fermi hard fork reduces block time from 0.75s to 0.45s
export const BSC_BLOCK_TIME = AVERAGE_CHAIN_BLOCK_TIMES[ChainId.BSC]

// Round to avoid float precision drift from BSC_BLOCK_TIME (0.45s).
export const BLOCKS_PER_DAY = Math.round((60 / BSC_BLOCK_TIME) * 60 * 24)
export const BLOCKS_PER_YEAR = BLOCKS_PER_DAY * 365 // 70080000

export const SECONDS_IN_YEAR = 31536000 // 365 * 24 * 60 * 60
