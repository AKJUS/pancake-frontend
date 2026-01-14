import { AVERAGE_CHAIN_BLOCK_TIMES, ChainId } from '@pancakeswap/chains'
import { getFullDecimalMultiplier } from '@pancakeswap/utils/getFullDecimalMultiplier'

// BNB Chain Fermi hard fork reduces block time from 0.75s to 0.45s
export const BSC_BLOCK_TIME = AVERAGE_CHAIN_BLOCK_TIMES[ChainId.BSC]

// CAKE_PER_BLOCK details
// 40 CAKE is minted per block
// 20 CAKE per block is sent to Burn pool (A farm just for burning cake)
// 10 CAKE per block goes to CAKE syrup pool
// 9 CAKE per block goes to Yield farms and lottery
// CAKE_PER_BLOCK in config/index.ts = 40 as we only change the amount sent to the burn pool which is effectively a farm.
// CAKE/Block in src/views/Home/components/CakeDataRow.tsx = 15 (40 - Amount sent to burn pool)
export const CAKE_PER_BLOCK = 40
// Round to avoid float precision drift from BSC_BLOCK_TIME (0.45s).
export const BLOCKS_PER_DAY = Math.round((60 / BSC_BLOCK_TIME) * 60 * 24)
export const BLOCKS_PER_YEAR = BLOCKS_PER_DAY * 365 // 70080000
export const SECONDS_PER_YEAR = 31536000 // 60 * 60 * 24 * 365
export const CAKE_PER_YEAR = CAKE_PER_BLOCK * BLOCKS_PER_YEAR
export const BASE_URL = 'https://pancakeswap.finance'
export const BASE_ADD_LIQUIDITY_URL = `${BASE_URL}/add`
export const DEFAULT_TOKEN_DECIMAL = getFullDecimalMultiplier(18)
export const DEFAULT_GAS_LIMIT = 250000n
export const BOOSTED_FARM_GAS_LIMIT = 500000n
export const BOOSTED_FARM_V3_GAS_LIMIT = 1000000n
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs'
export const DAY_PER_YEAR = 365
