import { bscTokens } from '@pancakeswap/tokens'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import { describe, expect, it } from 'vitest'
import { defineFarmV3ConfigsFromUniversalFarm } from './defineFarmV3Configs'

describe('defineFarmV3ConfigsFromUniversalFarm', () => {
  it('filters out sentinel negative pids before poolInfo fetching', () => {
    const farms = defineFarmV3ConfigsFromUniversalFarm([
      {
        chainId: 8453,
        pid: -1,
        lpAddress: '0x1111111111111111111111111111111111111111',
        token0: bscTokens.usdt,
        token1: bscTokens.busd,
        feeAmount: FeeAmount.LOW,
      },
      {
        chainId: 8453,
        pid: 7,
        lpAddress: '0x2222222222222222222222222222222222222222',
        token0: bscTokens.usdt,
        token1: bscTokens.busd,
        feeAmount: FeeAmount.LOW,
      },
    ])

    expect(farms).toHaveLength(1)
    expect(farms[0]?.pid).toBe(7)
  })
})
