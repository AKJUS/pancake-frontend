import { aggregatorAbi } from '@pancakeswap/aggregator-sdk'
import { describe, expect, it } from 'vitest'
import { encodeFunctionData, Hex, zeroAddress } from 'viem'
import { extractAggregatorRecipient } from '../decodeAggregatorCall'

const USER = '0x1111111111111111111111111111111111111111' as const
const TOKEN_IN = '0x2222222222222222222222222222222222222222' as const
const TOKEN_OUT = '0x3333333333333333333333333333333333333333' as const

describe('extractAggregatorRecipient', () => {
  it('returns recipient for swapExactIn calldata', () => {
    const calldata = encodeFunctionData({
      abi: aggregatorAbi,
      functionName: 'swapExactIn',
      args: [
        1n,
        {
          inputToken: TOKEN_IN,
          outputToken: TOKEN_OUT,
          minOutputAmount: 1000n,
          deadline: 99999999n,
        },
        [1000n],
        [[]],
        0n,
        USER,
      ],
    }) as Hex

    expect(extractAggregatorRecipient(calldata).toLowerCase()).toBe(USER.toLowerCase())
  })

  it('returns recipient for swapWrap calldata', () => {
    const calldata = encodeFunctionData({
      abi: aggregatorAbi,
      functionName: 'swapWrap',
      args: [1n, 1000n, true, 0n, USER],
    }) as Hex

    expect(extractAggregatorRecipient(calldata).toLowerCase()).toBe(USER.toLowerCase())
  })

  it('throws when calldata targets a non-swap function', () => {
    const calldata = encodeFunctionData({
      abi: aggregatorAbi,
      functionName: 'sweep',
      args: [zeroAddress, USER, 0n],
    }) as Hex

    expect(() => extractAggregatorRecipient(calldata)).toThrow(/Unexpected aggregator calldata function/)
  })

  it('throws on malformed calldata', () => {
    expect(() => extractAggregatorRecipient('0xdeadbeef' as Hex)).toThrow()
  })
})
