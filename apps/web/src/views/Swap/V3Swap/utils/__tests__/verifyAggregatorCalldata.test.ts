import { ChainId } from '@pancakeswap/chains'
import { aggregatorAbi, AggregatorCalldataData, AggregatorQuoteData } from '@pancakeswap/aggregator-sdk'
import { describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, Hex } from 'viem'
import { verifyAggregatorCalldata } from '../verifyAggregatorCalldata'

vi.mock('utils/datadog', () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
  tracker: { warn: vi.fn(), info: vi.fn() },
  getLogger: () => ({ warn: vi.fn(), info: vi.fn() }),
}))

const ALLOWED_ROUTER = '0x40A1Fe393A7F566F27dF6acE18e6773be844dAfc' as const
const BAD_ROUTER = '0x000000000000000000000000000000000000dEaD'
const USER = '0x1111111111111111111111111111111111111111' as const
const ATTACKER = '0x2222222222222222222222222222222222222222' as const

function buildSwapWrapCalldata(recipient: `0x${string}`): Hex {
  return encodeFunctionData({
    abi: aggregatorAbi,
    functionName: 'swapWrap',
    args: [1n, 1000n, true, 0n, recipient],
  }) as Hex
}

function buildSweepCalldata(): Hex {
  return encodeFunctionData({
    abi: aggregatorAbi,
    functionName: 'sweep',
    args: ['0x0000000000000000000000000000000000000000', USER, 0n],
  }) as Hex
}

function quoteData(aggregatorAddress: string): AggregatorQuoteData {
  return {
    srcToken: '0x0000000000000000000000000000000000000000',
    dstToken: '0x0000000000000000000000000000000000000001',
    tradeType: 'EXACT_INPUT',
    inputAmount: '1000',
    outputAmount: '1000',
    gasUseEstimate: '0',
    routes: [],
    aggregatorAddress,
  }
}

function calldataResult(overrides: Partial<AggregatorCalldataData>): AggregatorCalldataData {
  return {
    to: ALLOWED_ROUTER,
    calldata: buildSwapWrapCalldata(USER),
    value: '0x0',
    gasUseEstimate: '0',
    ...overrides,
  }
}

describe('verifyAggregatorCalldata', () => {
  it('rejects when calldata.to is not on the allowlist', () => {
    expect(() =>
      verifyAggregatorCalldata({
        chainId: ChainId.BASE,
        quoteData: quoteData(ALLOWED_ROUTER),
        recipient: USER,
        calldataResult: calldataResult({ to: BAD_ROUTER }),
      }),
    ).toThrow(/not allowlisted/)
  })

  it('rejects when calldata.to differs from approved spender', () => {
    expect(() =>
      verifyAggregatorCalldata({
        chainId: ChainId.BASE,
        quoteData: quoteData('0x1111111111111111111111111111111111111111'),
        recipient: USER,
        calldataResult: calldataResult({ to: ALLOWED_ROUTER }),
      }),
    ).toThrow(/does not match approved spender/)
  })

  it('rejects when decoded recipient != FE recipient', () => {
    expect(() =>
      verifyAggregatorCalldata({
        chainId: ChainId.BASE,
        quoteData: quoteData(ALLOWED_ROUTER),
        recipient: USER,
        calldataResult: calldataResult({ calldata: buildSwapWrapCalldata(ATTACKER) }),
      }),
    ).toThrow(/does not match frontend recipient/)
  })

  it('rejects non-swap selectors (e.g. sweep)', () => {
    expect(() =>
      verifyAggregatorCalldata({
        chainId: ChainId.BASE,
        quoteData: quoteData(ALLOWED_ROUTER),
        recipient: USER,
        calldataResult: calldataResult({ calldata: buildSweepCalldata() }),
      }),
    ).toThrow(/Unexpected aggregator calldata function/)
  })

  it('rejects when quoteData has no aggregatorAddress at all', () => {
    expect(() =>
      verifyAggregatorCalldata({
        chainId: ChainId.BASE,
        quoteData: quoteData(undefined as unknown as string),
        recipient: USER,
        calldataResult: calldataResult({}),
      }),
    ).toThrow(/does not match approved spender/)
  })

  it('happy path: allowlisted + matching spender + matching recipient returns txTo/txData', () => {
    const result = verifyAggregatorCalldata({
      chainId: ChainId.BASE,
      quoteData: quoteData(ALLOWED_ROUTER),
      recipient: USER,
      calldataResult: calldataResult({}),
    })
    expect(result.txTo.toLowerCase()).toBe(ALLOWED_ROUTER.toLowerCase())
    expect(result.txData).toMatch(/^0x/)
  })
})
