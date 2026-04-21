import { describe, expect, it } from 'vitest'
import { ChainId } from '@pancakeswap/chains'
import { OrderType } from '@pancakeswap/price-api-sdk'
import { PoolType, RouteType } from '@pancakeswap/smart-router'
import { NativeCurrency, Token, TradeType } from '@pancakeswap/swap-sdk-core'

import { deserializeAggregatorResponse } from './deserializeAggregatorResponse'
import type { AggregatorQuoteResponse } from './types'

class BNB extends NativeCurrency {
  constructor(chainId: number) {
    super(chainId, 18, 'BNB', 'BNB')
  }

  public equals(other: any): boolean {
    return other?.isNative === true && other?.chainId === this.chainId
  }

  public get wrapped(): Token {
    return new Token(this.chainId, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 18, 'WBNB')
  }
}

const WBNB = { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, symbol: 'WBNB' }
const USDT = { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' }
const USDC = { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, symbol: 'USDC' }
const DAI = { address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18, symbol: 'DAI' }

// Deserializer throws if an infinity pool is missing `poolManager`; most fixtures
// don't care about the exact value so share one.
const FIXTURE_POOL_MANAGER = '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b'

// Pool fixture helper — BE provides token0/token1 address-sorted (matches on-chain PoolKey).
// Deserializer requires these fields; spread `...sortedPair(A, B)` into any pool fixture.
function sortedPair(a: { address: string }, b: { address: string }) {
  return a.address.toLowerCase() < b.address.toLowerCase()
    ? { token0: a.address, token1: b.address }
    : { token0: b.address, token1: a.address }
}

function makeSingleRouteResponse(overrides?: Partial<AggregatorQuoteResponse['data']>): AggregatorQuoteResponse {
  return {
    code: 0,
    msg: 'success',
    data: {
      srcToken: WBNB.address,
      dstToken: USDT.address,
      tradeType: 'exactIn',
      inputAmount: '1000000000000000000',
      outputAmount: '300000000000000000000',
      gasUseEstimate: '200000',
      gasUseEstimateUsd: '50000000000000000',
      priceImpactBps: 12,
      routes: [
        {
          percent: 100,
          inputAmount: '1000000000000000000',
          outputAmount: '300000000000000000000',
          path: [WBNB, USDT],
          pools: [
            {
              address: '0xd99c7F6C65857AC913a8f880A4cb84032AB2FC5b',
              type: 'v3',
              fee: 500,
              provider: 'pancakeswap',
              ...sortedPair(WBNB, USDT),
            },
          ],
        },
      ],
      ...overrides,
    },
  }
}

function makeMultiRouteResponse(): AggregatorQuoteResponse {
  return {
    code: 0,
    msg: 'success',
    data: {
      srcToken: WBNB.address,
      dstToken: USDT.address,
      tradeType: 'exactIn',
      inputAmount: '1000000000000000000',
      outputAmount: '300000000000000000000',
      gasUseEstimate: '435000',
      priceImpactBps: 5,
      routes: [
        {
          percent: 70,
          inputAmount: '700000000000000000',
          outputAmount: '210000000000000000000',
          path: [WBNB, USDT],
          pools: [{ address: '0xPoolA', type: 'v3', fee: 500, provider: 'pancakeswap', ...sortedPair(WBNB, USDT) }],
        },
        {
          percent: 30,
          inputAmount: '300000000000000000',
          outputAmount: '90000000000000000000',
          path: [WBNB, USDC, USDT],
          pools: [
            { address: '0xPoolB', type: 'v3', fee: 3000, provider: 'pancakeswap', ...sortedPair(WBNB, USDC) },
            { address: '0xPoolC', type: 'stableswap', fee: 100, provider: 'pancakeswap', ...sortedPair(USDC, USDT) },
          ],
        },
      ],
    },
  }
}

describe('deserializeAggregatorResponse', () => {
  it('should deserialize a single-route exact-input response', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT)

    expect(result).toBeDefined()
    expect(result!.type).toBe(OrderType.PCS_CLASSIC)
    expect(result!.trade.tradeType).toBe(TradeType.EXACT_INPUT)
    expect(result!.trade.inputAmount.quotient.toString()).toBe('1000000000000000000')
    expect(result!.trade.outputAmount.quotient.toString()).toBe('300000000000000000000')
    expect(result!.trade.routes).toHaveLength(1)
    expect(result!.trade.routes[0].percent).toBe(100)
  })

  it('should deserialize a multi-route (split) response', () => {
    const result = deserializeAggregatorResponse(makeMultiRouteResponse(), 56, TradeType.EXACT_INPUT)

    expect(result).toBeDefined()
    expect(result!.trade.routes).toHaveLength(2)
    expect(result!.trade.routes[0].percent).toBe(70)
    expect(result!.trade.routes[1].percent).toBe(30)
    expect(result!.trade.routes[1].path).toHaveLength(3)
    expect(result!.trade.routes[1].pools).toHaveLength(2)
  })

  it('prefers resolvedFee over protocolFee for displayFee from /v2/quote', () => {
    const response = makeSingleRouteResponse({
      routes: [
        {
          percent: 100,
          inputAmount: '1000000000000000000',
          outputAmount: '300000000000000000000',
          path: [WBNB, USDT],
          pools: [
            {
              address: '0x1111111111111111111111111111111111111111',
              type: 'infinityCl',
              fee: 3000,
              resolvedFee: 131104,
              protocolFee: 42,
              poolManager: FIXTURE_POOL_MANAGER,
              parameters: '0x00000000000000000000000000000000000000000000000000000000000003e80000',
              hooks: '0x0000000000000000000000000000000000000000',
              provider: 'pancakeswap',
              ...sortedPair(WBNB, USDT),
            },
          ],
        },
      ],
    })

    const result = deserializeAggregatorResponse(response, 56, TradeType.EXACT_INPUT)
    const pool = result!.trade.routes[0].pools[0] as { displayFee?: number }

    expect(pool.displayFee).toBe(131104)
  })

  it('should deserialize an exact-output response', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_OUTPUT)

    expect(result).toBeDefined()
    expect(result!.trade.tradeType).toBe(TradeType.EXACT_OUTPUT)
  })

  it('should set OrderType to PCS_CLASSIC', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT)
    expect(result!.type).toBe(OrderType.PCS_CLASSIC)
  })

  it('should construct correct Token objects with chainId, address, decimals, symbol', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT)

    const inputCur = result!.trade.inputAmount.currency
    expect(inputCur.chainId).toBe(56)
    expect(inputCur.address).toBe(WBNB.address)
    expect(inputCur.decimals).toBe(18)
    expect(inputCur.symbol).toBe('WBNB')

    const outputCur = result!.trade.outputAmount.currency
    expect(outputCur.address).toBe(USDT.address)
    expect(outputCur.symbol).toBe('USDT')
  })

  it('should compute inputAmount and outputAmount as CurrencyAmount from raw strings', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT)

    expect(result!.trade.inputAmount.quotient).toBe(1000000000000000000n)
    expect(result!.trade.outputAmount.quotient).toBe(300000000000000000000n)
  })

  it('should map pool types correctly', () => {
    const poolTypes: Array<{ apiType: string; expected: PoolType }> = [
      { apiType: 'v2', expected: PoolType.V2 },
      { apiType: 'v3', expected: PoolType.V3 },
      { apiType: 'infinityCl', expected: PoolType.InfinityCL },
      { apiType: 'infinityBin', expected: PoolType.InfinityBIN },
      { apiType: 'stableswap', expected: PoolType.STABLE },
    ]

    for (const { apiType, expected } of poolTypes) {
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '1000',
          outputAmount: '2000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '1000',
              outputAmount: '2000',
              path: [WBNB, USDT],
              pools: [
                {
                  address: '0xPool',
                  type: apiType as any,
                  fee: 100,
                  poolManager: FIXTURE_POOL_MANAGER,
                  ...sortedPair(WBNB, USDT),
                },
              ],
            },
          ],
        },
      }

      const result = deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT)
      expect(result!.trade.routes[0].pools[0].type).toBe(expected)
    }
  })

  it('should default unknown pool type to PoolType.V3', () => {
    const resp: AggregatorQuoteResponse = {
      code: 0,
      msg: 'success',
      data: {
        tradeType: 'exactIn',
        inputAmount: '1000',
        outputAmount: '2000',
        gasUseEstimate: '100',
        routes: [
          {
            percent: 100,
            inputAmount: '1000',
            outputAmount: '2000',
            path: [WBNB, USDT],
            pools: [{ address: '0xPool', type: 'unknown_type' as any, fee: 100, ...sortedPair(WBNB, USDT) }],
          },
        ],
      },
    }

    const result = deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT)
    expect(result!.trade.routes[0].pools[0].type).toBe(PoolType.V3)
  })

  it('should parse gasUseEstimate as BigInt', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT)
    expect(result!.trade.gasUseEstimate).toBe(200000n)
  })

  it('should pass through priceImpactBps', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT)
    expect(result!.trade.priceImpactBps).toBe(12)
  })

  it('should infer route type as single protocol when all pools same type', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT)
    expect(result!.trade.routes[0].type).toBe(RouteType.V3)
  })

  it('should infer route type as MIXED when pools have different types', () => {
    const result = deserializeAggregatorResponse(makeMultiRouteResponse(), 56, TradeType.EXACT_INPUT)
    expect(result!.trade.routes[1].type).toBe(RouteType.MIXED)
  })

  it('should return undefined when code is non-zero', () => {
    const result = deserializeAggregatorResponse(
      { code: 42102, msg: 'quote is unavailable', data: undefined as any },
      56,
      TradeType.EXACT_INPUT,
    )
    expect(result).toBeUndefined()
  })

  it('should return undefined when routes array is empty', () => {
    const result = deserializeAggregatorResponse(
      {
        code: 0,
        msg: 'success',
        data: { tradeType: 'exactIn', inputAmount: '0', outputAmount: '0', gasUseEstimate: '0', routes: [] },
      },
      56,
      TradeType.EXACT_INPUT,
    )
    expect(result).toBeUndefined()
  })

  it('should return undefined when data is missing', () => {
    const result = deserializeAggregatorResponse(
      { code: 0, msg: 'success', data: undefined as any },
      56,
      TradeType.EXACT_INPUT,
    )
    expect(result).toBeUndefined()
  })

  it('should return undefined when route path has fewer than 2 tokens', () => {
    const resp: AggregatorQuoteResponse = {
      code: 0,
      msg: 'success',
      data: {
        tradeType: 'exactIn',
        inputAmount: '1000',
        outputAmount: '2000',
        gasUseEstimate: '100',
        routes: [
          {
            percent: 100,
            inputAmount: '1000',
            outputAmount: '2000',
            path: [WBNB],
            pools: [],
          },
        ],
      },
    }
    expect(deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT)).toBeUndefined()
  })

  it('should return undefined when pools.length !== path.length - 1', () => {
    const resp: AggregatorQuoteResponse = {
      code: 0,
      msg: 'success',
      data: {
        tradeType: 'exactIn',
        inputAmount: '1000',
        outputAmount: '2000',
        gasUseEstimate: '100',
        routes: [
          {
            percent: 100,
            inputAmount: '1000',
            outputAmount: '2000',
            path: [WBNB, USDT],
            pools: [
              { address: '0xP1', type: 'v3', fee: 500, ...sortedPair(WBNB, USDT) },
              { address: '0xP2', type: 'v3', fee: 500, ...sortedPair(WBNB, USDT) },
            ],
          },
        ],
      },
    }
    expect(deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT)).toBeUndefined()
  })

  it('should handle route with single hop (1 pool, 2 tokens)', () => {
    const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT)
    expect(result!.trade.routes[0].path).toHaveLength(2)
    expect(result!.trade.routes[0].pools).toHaveLength(1)
  })

  it('should handle route with many hops', () => {
    const CAKE = { address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, symbol: 'CAKE' }
    const resp: AggregatorQuoteResponse = {
      code: 0,
      msg: 'success',
      data: {
        tradeType: 'exactIn',
        inputAmount: '1000',
        outputAmount: '5000',
        gasUseEstimate: '500000',
        routes: [
          {
            percent: 100,
            inputAmount: '1000',
            outputAmount: '5000',
            path: [WBNB, USDC, CAKE, USDT],
            pools: [
              { address: '0xP1', type: 'v3', fee: 500, ...sortedPair(WBNB, USDC) },
              { address: '0xP2', type: 'v2', ...sortedPair(USDC, CAKE) },
              { address: '0xP3', type: 'stableswap', fee: 100, ...sortedPair(CAKE, USDT) },
            ],
          },
        ],
      },
    }

    const result = deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT)
    expect(result!.trade.routes[0].path).toHaveLength(4)
    expect(result!.trade.routes[0].pools).toHaveLength(3)
  })

  it('should handle missing optional fields', () => {
    const resp: AggregatorQuoteResponse = {
      code: 0,
      msg: 'success',
      data: {
        tradeType: 'exactIn',
        inputAmount: '1000',
        outputAmount: '2000',
        gasUseEstimate: '100',
        routes: [
          {
            percent: 100,
            inputAmount: '1000',
            outputAmount: '2000',
            path: [WBNB, USDT],
            pools: [{ address: '0xPool', type: 'v3', fee: 500, ...sortedPair(WBNB, USDT) }],
          },
        ],
      },
    }

    const result = deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT)
    expect(result).toBeDefined()
    expect(result!.trade.priceImpactBps).toBeUndefined()
    expect(result!.trade.gasUseEstimate).toBe(100n)
  })

  it('should assign pool token0/token1 sorted by address', () => {
    const result = deserializeAggregatorResponse(makeMultiRouteResponse(), 56, TradeType.EXACT_INPUT)

    // Path WBNB(bb)->USDC(8a) -> sorted: token0=USDC, token1=WBNB
    const route1 = result!.trade.routes[1]
    expect(route1.pools[0].token0.symbol).toBe('USDC')
    expect(route1.pools[0].token1.symbol).toBe('WBNB')
    // Path USDC(8a)->USDT(55) -> sorted: token0=USDT, token1=USDC
    expect(route1.pools[1].token0.symbol).toBe('USDT')
    expect(route1.pools[1].token1.symbol).toBe('USDC')
  })

  it('should produce V2 pool with mock reserve0/reserve1 for route display', () => {
    const resp: AggregatorQuoteResponse = {
      code: 0,
      msg: 'success',
      data: {
        tradeType: 'exactIn',
        inputAmount: '1000',
        outputAmount: '2000',
        gasUseEstimate: '100',
        routes: [
          {
            percent: 100,
            inputAmount: '1000',
            outputAmount: '2000',
            path: [WBNB, USDT],
            pools: [{ address: '0xPool', type: 'v2', fee: 2500, ...sortedPair(WBNB, USDT) }],
          },
        ],
      },
    }

    const result = deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT)
    const pool = result!.trade.routes[0].pools[0] as any
    expect(pool.type).toBe(PoolType.V2)
    expect(pool.reserve0).toBeDefined()
    // Sorted by address: USDT(55) < WBNB(bb)
    expect(pool.reserve0.currency.symbol).toBe('USDT')
    expect(pool.reserve1).toBeDefined()
    expect(pool.reserve1.currency.symbol).toBe('WBNB')
  })

  describe('native-currency preservation', () => {
    function makeNativeSrcResponse(): AggregatorQuoteResponse {
      // Aggregator echoes srcToken as zero-address when native BNB was submitted,
      // but path[0] is still WBNB because pools hold wrapped tokens.
      return {
        code: 0,
        msg: 'success',
        data: {
          srcToken: '0x0000000000000000000000000000000000000000',
          dstToken: USDT.address,
          tradeType: 'exactIn',
          inputAmount: '1000000000000000000',
          outputAmount: '300000000000000000000',
          gasUseEstimate: '200000',
          routes: [
            {
              percent: 100,
              inputAmount: '1000000000000000000',
              outputAmount: '300000000000000000000',
              path: [WBNB, USDT],
              pools: [{ address: '0xPool', type: 'v3', fee: 500, provider: 'pancakeswap', ...sortedPair(WBNB, USDT) }],
            },
          ],
        },
      }
    }

    it('preserves native input currency (BNB, not WBNB) when inputCurrency is provided', () => {
      const nativeBnb = new BNB(56)
      const result = deserializeAggregatorResponse(makeNativeSrcResponse(), 56, TradeType.EXACT_INPUT, nativeBnb)

      expect(result).toBeDefined()
      expect(result!.trade.inputAmount.currency.isNative).toBe(true)
      expect(result!.trade.inputAmount.currency.symbol).toBe('BNB')
    })

    it('preserves native output currency when outputCurrency is provided', () => {
      const nativeBnb = new BNB(56)
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          srcToken: USDT.address,
          dstToken: '0x0000000000000000000000000000000000000000',
          tradeType: 'exactIn',
          inputAmount: '300000000000000000000',
          outputAmount: '1000000000000000000',
          gasUseEstimate: '200000',
          routes: [
            {
              percent: 100,
              inputAmount: '300000000000000000000',
              outputAmount: '1000000000000000000',
              path: [USDT, WBNB],
              pools: [{ address: '0xPool', type: 'v3', fee: 500, provider: 'pancakeswap', ...sortedPair(WBNB, USDT) }],
            },
          ],
        },
      }

      const result = deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT, undefined, nativeBnb)

      expect(result).toBeDefined()
      expect(result!.trade.outputAmount.currency.isNative).toBe(true)
      expect(result!.trade.outputAmount.currency.symbol).toBe('BNB')
    })

    it('prefers provided inputCurrency even when aggregator srcToken is a non-zero address', () => {
      // Caller's currency selection is the source of truth — aggregator echoing the wrapped address back
      // should not override the user's native-vs-wrapped intent.
      const wbnbToken = new Token(56, WBNB.address as `0x${string}`, 18, 'WBNB')
      const result = deserializeAggregatorResponse(makeSingleRouteResponse(), 56, TradeType.EXACT_INPUT, wbnbToken)

      expect(result!.trade.inputAmount.currency.symbol).toBe('WBNB')
    })

    it('inner route path tokens stay as wrapped Tokens regardless of native outer currency', () => {
      const nativeBnb = new BNB(56)
      const result = deserializeAggregatorResponse(makeNativeSrcResponse(), 56, TradeType.EXACT_INPUT, nativeBnb)

      const routePath = result!.trade.routes[0].path
      expect(routePath[0].isToken).toBe(true)
      expect(routePath[0].symbol).toBe('WBNB')
    })
  })

  it('should produce infinity pool with id, currency0, currency1 from path verbatim', () => {
    const resp: AggregatorQuoteResponse = {
      code: 0,
      msg: 'success',
      data: {
        tradeType: 'exactIn',
        inputAmount: '1000',
        outputAmount: '2000',
        gasUseEstimate: '100',
        routes: [
          {
            percent: 100,
            inputAmount: '1000',
            outputAmount: '2000',
            path: [WBNB, USDT],
            pools: [
              {
                address: '0xPoolId',
                type: 'infinityCl',
                fee: 100,
                poolManager: FIXTURE_POOL_MANAGER,
                ...sortedPair(WBNB, USDT),
              },
            ],
          },
        ],
      },
    }

    const result = deserializeAggregatorResponse(resp, 56, TradeType.EXACT_INPUT)
    const pool = result!.trade.routes[0].pools[0] as any
    expect(pool.type).toBe(PoolType.InfinityCL)
    expect(pool.id).toBe('0xPoolId')
    // Sorted by address: USDT(55) < WBNB(bb)
    expect(pool.currency0.symbol).toBe('USDT')
    expect(pool.currency1.symbol).toBe('WBNB')
    expect(pool.token0.symbol).toBe('USDT')
    expect(pool.token1.symbol).toBe('WBNB')
    expect(pool.hooks).toBeDefined()
    expect(pool.poolManager).toBeDefined()
  })

  describe('infinity pool parameters & poolManager', () => {
    const CL_TICK_SPACING_2 = '0x0000000000000000000000000000000000000000000000000000000000020000'
    const BIN_STEP_1 = '0x0000000000000000000000000000000000000000000000000000000000010000'

    it('decodes tickSpacing from parameters for InfinityCL pools', () => {
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '1000',
          outputAmount: '2000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '1000',
              outputAmount: '2000',
              path: [WBNB, USDT],
              pools: [
                {
                  address: '0xPoolId',
                  type: 'infinityCl',
                  fee: 82,
                  parameters: CL_TICK_SPACING_2,
                  poolManager: FIXTURE_POOL_MANAGER,
                  ...sortedPair(WBNB, USDT),
                },
              ],
            },
          ],
        },
      }

      const result = deserializeAggregatorResponse(resp, ChainId.BSC, TradeType.EXACT_INPUT)
      const pool = result!.trade.routes[0].pools[0] as any
      expect(pool.tickSpacing).toBe(2)
    })

    it('decodes binStep from parameters for InfinityBin pools', () => {
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '1000',
          outputAmount: '2000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '1000',
              outputAmount: '2000',
              path: [WBNB, USDT],
              pools: [
                {
                  address: '0xPoolId',
                  type: 'infinityBin',
                  fee: 100,
                  parameters: BIN_STEP_1,
                  poolManager: FIXTURE_POOL_MANAGER,
                  ...sortedPair(WBNB, USDT),
                },
              ],
            },
          ],
        },
      }

      const result = deserializeAggregatorResponse(resp, ChainId.BSC, TradeType.EXACT_INPUT)
      const pool = result!.trade.routes[0].pools[0] as any
      expect(pool.binStep).toBe(1)
    })

    // Real BSC BNB→CAKE response captured from preview (infinity-only, 3 hops).
    const BSC_BNB_CAKE_AGGREGATOR_RESPONSE: AggregatorQuoteResponse = {
      code: 0,
      msg: 'success',
      data: {
        srcToken: '0x0000000000000000000000000000000000000000',
        dstToken: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        tradeType: 'exactIn',
        inputAmount: '10000000000000000',
        outputAmount: '7900000000000000000',
        gasUseEstimate: '400000',
        priceImpactBps: 1,
        aggregatorAddress: '0x40A1Fe393A7F566F27dF6acE18e6773be844dAfc',
        routes: [
          {
            percent: 100,
            inputAmount: '10000000000000000',
            outputAmount: '7900000000000000000',
            path: [
              { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, symbol: 'WBNB' },
              { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' },
              { address: '0x0000000000000000000000000000000000000000', decimals: 18, symbol: 'BNB' },
              { address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, symbol: 'Cake' },
            ],
            pools: [
              {
                address: '0x1b34e3fb3cf88a49654a3fdc36a68b5c2e87d744290dd39156b6175a92d18b98',
                type: 'infinityCl',
                fee: 67,
                protocolFee: 131104,
                poolManager: '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b',
                provider: 'pancakeswap',
                hooks: null,
                parameters: '0x0000000000000000000000000000000000000000000000000000000000010000',
                // WBNB(bb) / USDT(55) -> sorted token0=USDT
                token0: '0x55d398326f99059fF775485246999027B3197955',
                token1: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
              } as any,
              {
                address: '0xd37aa0f0d66ad670279f6b89325c88bdff17d0265144762fb01f54fca9779944',
                type: 'infinityCl',
                fee: 67,
                protocolFee: 131104,
                poolManager: '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b',
                provider: 'pancakeswap',
                hooks: null,
                parameters: '0x0000000000000000000000000000000000000000000000000000000000010000',
                // USDT(55) / BNB(00) -> sorted token0=BNB
                token0: '0x0000000000000000000000000000000000000000',
                token1: '0x55d398326f99059fF775485246999027B3197955',
              } as any,
              // Hooked pool: parameters' last 2 bytes (0x00c2) are the hooksRegistrationBitmap.
              {
                address: '0x737a7d974a19bafb34c8d74d898188c9b59689b91f291fa6ade69f71fa0f5afa',
                type: 'infinityCl',
                fee: 500,
                protocolFee: 0,
                poolManager: '0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b',
                provider: 'pancakeswap',
                hooks: '0x32C59D556B16DB81DFc32525eFb3CB257f7e493d',
                parameters: '0x00000000000000000000000000000000000000000000000000000000000a00c2',
                // BNB(00) / Cake(0e) -> sorted token0=BNB
                token0: '0x0000000000000000000000000000000000000000',
                token1: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
              } as any,
            ],
          },
        ],
      },
    }

    it('deserializes real BSC infinity-only response: API displayFee, poolManager, tickSpacing, hooksRegistrationBitmap', () => {
      const result = deserializeAggregatorResponse(BSC_BNB_CAKE_AGGREGATOR_RESPONSE, ChainId.BSC, TradeType.EXACT_INPUT)

      expect(result).toBeDefined()
      const route = result!.trade.routes[0]
      expect(route.pools).toHaveLength(3)

      const [hop1, hop2, hop3] = route.pools.map((p) => p as any)

      expect(hop1.type).toBe(PoolType.InfinityCL)
      expect(hop1.fee).toBe(67)
      expect(hop1.displayFee).toBe(131104)
      expect(hop1.tickSpacing).toBe(1)
      expect(hop1.hooks).toBe('0x0000000000000000000000000000000000000000')
      expect(hop1.hooksRegistrationBitmap).toBe('0x0000')
      expect(hop1.poolManager).toBe('0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b')
      // Sorted by address: USDT(55) < WBNB(bb)
      expect(hop1.currency0.symbol).toBe('USDT')
      expect(hop1.currency1.symbol).toBe('WBNB')

      expect(hop2.fee).toBe(67)
      expect(hop2.displayFee).toBe(131104)
      expect(hop2.tickSpacing).toBe(1)
      expect(hop2.hooksRegistrationBitmap).toBe('0x0000')

      expect(hop3.fee).toBe(0x800000) // DYNAMIC_FEE_FLAG for dynamic fee hook
      expect(hop3.displayFee).toBe(0)
      expect(hop3.tickSpacing).toBe(10)
      expect(hop3.hooksRegistrationBitmap).toBe('0x00c2')
      expect(hop3.hooks).toBe('0x32C59D556B16DB81DFc32525eFb3CB257f7e493d')
    })

    it('throws when API omits poolManager on an infinity pool', () => {
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '1000',
          outputAmount: '2000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '1000',
              outputAmount: '2000',
              path: [WBNB, USDT],
              pools: [{ address: '0xPoolId', type: 'infinityCl', fee: 100, ...sortedPair(WBNB, USDT) }],
            },
          ],
        },
      }

      expect(() => deserializeAggregatorResponse(resp, ChainId.BSC, TradeType.EXACT_INPUT)).toThrow(
        /missing required poolManager/,
      )
    })

    it('leaves tickSpacing/binStep unset when parameters is missing or malformed', () => {
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '1000',
          outputAmount: '2000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '1000',
              outputAmount: '2000',
              path: [WBNB, USDT],
              pools: [
                {
                  address: '0xPoolId',
                  type: 'infinityCl',
                  fee: 100,
                  parameters: null,
                  poolManager: FIXTURE_POOL_MANAGER,
                  ...sortedPair(WBNB, USDT),
                },
              ],
            },
          ],
        },
      }

      const result = deserializeAggregatorResponse(resp, ChainId.BSC, TradeType.EXACT_INPUT)
      const pool = result!.trade.routes[0].pools[0] as any
      expect(pool.tickSpacing).toBeUndefined()
    })

    it('uses API-provided poolManager verbatim (both CL and Bin)', () => {
      const customClManager = '0x1111111111111111111111111111111111111111' as `0x${string}`
      const customBinManager = '0x2222222222222222222222222222222222222222' as `0x${string}`
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '1000',
          outputAmount: '2000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '1000',
              outputAmount: '2000',
              path: [WBNB, USDC, USDT],
              pools: [
                {
                  address: '0xClPool',
                  type: 'infinityCl',
                  fee: 100,
                  poolManager: customClManager,
                  ...sortedPair(WBNB, USDC),
                },
                {
                  address: '0xBinPool',
                  type: 'infinityBin',
                  fee: 100,
                  poolManager: customBinManager,
                  ...sortedPair(USDC, USDT),
                },
              ],
            },
          ],
        },
      }

      const result = deserializeAggregatorResponse(resp, ChainId.BSC, TradeType.EXACT_INPUT)
      const [clPool, binPool] = result!.trade.routes[0].pools.map((p) => p as any)
      expect(clPool.poolManager).toBe(customClManager)
      expect(binPool.poolManager).toBe(customBinManager)
    })

    it('orients pool token0/token1 from BE-provided addresses, not path direction', () => {
      // Trade direction is WBNB->USDT (path[0]=WBNB). BE provides token0=USDT (address-sorted).
      // Deserializer must match symbols to BE's sorted pair, not to path order.
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '1000',
          outputAmount: '2000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '1000',
              outputAmount: '2000',
              path: [WBNB, USDT],
              pools: [
                {
                  address: '0xPoolId',
                  type: 'infinityCl',
                  fee: 100,
                  poolManager: FIXTURE_POOL_MANAGER,
                  token0: USDT.address,
                  token1: WBNB.address,
                },
              ],
            },
          ],
        },
      }

      const result = deserializeAggregatorResponse(resp, ChainId.BSC, TradeType.EXACT_INPUT)
      const pool = result!.trade.routes[0].pools[0] as any
      expect(pool.currency0.symbol).toBe('USDT')
      expect(pool.currency1.symbol).toBe('WBNB')
      expect(pool.token0.address).toBe(USDT.address)
      expect(pool.token1.address).toBe(WBNB.address)
    })

    it('orients pool token0/token1 identically for reversed path', () => {
      // Same BE pool.token0/token1 but path is reversed (USDT->WBNB).
      // Pool orientation must not change.
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '2000',
          outputAmount: '1000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '2000',
              outputAmount: '1000',
              path: [USDT, WBNB],
              pools: [
                {
                  address: '0xPoolId',
                  type: 'infinityCl',
                  fee: 100,
                  poolManager: FIXTURE_POOL_MANAGER,
                  token0: USDT.address,
                  token1: WBNB.address,
                },
              ],
            },
          ],
        },
      }

      const result = deserializeAggregatorResponse(resp, ChainId.BSC, TradeType.EXACT_INPUT)
      const pool = result!.trade.routes[0].pools[0] as any
      expect(pool.currency0.symbol).toBe('USDT')
      expect(pool.currency1.symbol).toBe('WBNB')
    })

    it('throws when pool omits token0/token1', () => {
      const resp: AggregatorQuoteResponse = {
        code: 0,
        msg: 'success',
        data: {
          tradeType: 'exactIn',
          inputAmount: '1000',
          outputAmount: '2000',
          gasUseEstimate: '100',
          routes: [
            {
              percent: 100,
              inputAmount: '1000',
              outputAmount: '2000',
              path: [WBNB, USDT],
              pools: [{ address: '0xPoolId', type: 'infinityCl', fee: 100, poolManager: FIXTURE_POOL_MANAGER }],
            },
          ],
        },
      }

      expect(() => deserializeAggregatorResponse(resp, ChainId.BSC, TradeType.EXACT_INPUT)).toThrow(
        /missing required token0\/token1/,
      )
    })
  })
})

function makeSplitRouteResponse(): AggregatorQuoteResponse {
  return {
    code: 0,
    msg: 'success',
    data: {
      tradeType: 'exactIn',
      inputAmount: '12000000000000000000',
      outputAmount: '18958188605765097',
      gasUseEstimate: '1175000',
      priceImpactBps: 3,
      routes: [
        {
          percent: 30,
          inputAmount: '3600000000000000000',
          outputAmount: '5684905300861810',
          path: [USDT, USDC, WBNB],
          pools: [
            {
              address: '0xEc6557348085Aa57C72514D67070dC863C0a5A8c',
              type: 'v3',
              fee: 500,
              provider: 'pancakeswap',
              ...sortedPair(USDT, USDC),
            },
            {
              address: '0xd99c7F6C65857AC913a8f880A4cb84032AB2FC5b',
              type: 'v3',
              fee: 500,
              provider: 'pancakeswap',
              ...sortedPair(USDC, WBNB),
            },
          ],
        },
        {
          percent: 40,
          inputAmount: '4800000000000000000',
          outputAmount: '7591220267352993',
          path: [USDT, USDC, WBNB],
          pools: [
            {
              address: '0x3EFebC418efB585248A0D2140cfb87aFcc2C63DD',
              type: 'v3',
              fee: 2500,
              provider: 'pancakeswap',
              ...sortedPair(USDT, USDC),
            },
            {
              address: '0xd99c7F6C65857AC913a8f880A4cb84032AB2FC5b',
              type: 'v3',
              fee: 500,
              provider: 'pancakeswap',
              ...sortedPair(USDC, WBNB),
            },
          ],
        },
        {
          percent: 30,
          inputAmount: '3600000000000000000',
          outputAmount: '5682063037550294',
          path: [USDT, DAI, WBNB],
          pools: [
            {
              address: '0xf6f5CE9a91Dd4FAe2d2eD92E25F2A4dc8564F174',
              type: 'stableswap',
              fee: 100,
              provider: 'pancakeswap',
              ...sortedPair(USDT, DAI),
            },
            {
              address: '0xc7c3cCCE4FA25700fD5574DA7E200ae28BBd36A3',
              type: 'v3',
              fee: 500,
              provider: 'pancakeswap',
              ...sortedPair(DAI, WBNB),
            },
          ],
        },
      ],
    },
  }
}

describe('split route deserialization', () => {
  it('should deserialize a 3-way split route', () => {
    const result = deserializeAggregatorResponse(makeSplitRouteResponse(), 56, TradeType.EXACT_INPUT)

    expect(result).toBeDefined()
    expect(result!.trade.routes).toHaveLength(3)
    expect(result!.trade.inputAmount.quotient.toString()).toBe('12000000000000000000')
    expect(result!.trade.outputAmount.quotient.toString()).toBe('18958188605765097')
  })

  it('should preserve per-route percentages', () => {
    const result = deserializeAggregatorResponse(makeSplitRouteResponse(), 56, TradeType.EXACT_INPUT)

    expect(result!.trade.routes[0].percent).toBe(30)
    expect(result!.trade.routes[1].percent).toBe(40)
    expect(result!.trade.routes[2].percent).toBe(30)
  })

  it('should set per-route gasUseEstimate to 0n (not returned by API)', () => {
    const result = deserializeAggregatorResponse(makeSplitRouteResponse(), 56, TradeType.EXACT_INPUT)

    expect(result!.trade.routes[0].gasUseEstimate).toBe(0n)
    expect(result!.trade.routes[1].gasUseEstimate).toBe(0n)
    expect(result!.trade.routes[2].gasUseEstimate).toBe(0n)
  })

  // reviseGasUseEstimate dereferences `.gasUseEstimateQuote.currency` when
  // `gasUseEstimate === 0n` — omitting these fields used to reject every quote.
  it('should populate per-route gasUseEstimateBase/Quote so on-chain verification can run', () => {
    const result = deserializeAggregatorResponse(makeSplitRouteResponse(), 56, TradeType.EXACT_INPUT)

    for (const r of result!.trade.routes) {
      const typed = r as any
      expect(typed.gasUseEstimateBase).toBeDefined()
      expect(typed.gasUseEstimateQuote).toBeDefined()
      expect(typed.gasUseEstimateBase.currency.symbol).toBe(r.path[0].symbol)
      expect(typed.gasUseEstimateQuote.currency.symbol).toBe(r.path[r.path.length - 1].symbol)
      expect(typed.gasUseEstimateBase.quotient).toBe(0n)
      expect(typed.gasUseEstimateQuote.quotient).toBe(0n)
      expect(typed.inputAmountWithGasAdjusted.quotient).toBe(r.inputAmount.quotient)
      expect(typed.outputAmountWithGasAdjusted.quotient).toBe(r.outputAmount.quotient)
    }
  })

  it('should handle different intermediate tokens across routes', () => {
    const result = deserializeAggregatorResponse(makeSplitRouteResponse(), 56, TradeType.EXACT_INPUT)

    expect(result!.trade.routes[0].path[1].symbol).toBe('USDC')
    expect(result!.trade.routes[1].path[1].symbol).toBe('USDC')
    expect(result!.trade.routes[2].path[1].symbol).toBe('DAI')
  })

  it('should assign pool token0/token1 sorted by address', () => {
    const result = deserializeAggregatorResponse(makeSplitRouteResponse(), 56, TradeType.EXACT_INPUT)

    // DAI(1a) < USDT(55) < USDC(8a) < WBNB(bb)
    const r0 = result!.trade.routes[0]
    // USDT->USDC sorted: USDT, USDC
    expect(r0.pools[0].token0.symbol).toBe('USDT')
    expect(r0.pools[0].token1.symbol).toBe('USDC')
    // USDC->WBNB sorted: USDC, WBNB
    expect(r0.pools[1].token0.symbol).toBe('USDC')
    expect(r0.pools[1].token1.symbol).toBe('WBNB')

    const r2 = result!.trade.routes[2]
    // USDT->DAI sorted: DAI, USDT
    expect(r2.pools[0].token0.symbol).toBe('DAI')
    expect(r2.pools[0].token1.symbol).toBe('USDT')
    // DAI->WBNB sorted: DAI, WBNB
    expect(r2.pools[1].token0.symbol).toBe('DAI')
    expect(r2.pools[1].token1.symbol).toBe('WBNB')
  })

  it('should infer route type independently per route', () => {
    const result = deserializeAggregatorResponse(makeSplitRouteResponse(), 56, TradeType.EXACT_INPUT)

    expect(result!.trade.routes[0].type).toBe(RouteType.V3)
    expect(result!.trade.routes[1].type).toBe(RouteType.V3)
    expect(result!.trade.routes[2].type).toBe(RouteType.MIXED)
  })

  it('should use trade-level gasUseEstimate for the trade object', () => {
    const result = deserializeAggregatorResponse(makeSplitRouteResponse(), 56, TradeType.EXACT_INPUT)
    expect(result!.trade.gasUseEstimate).toBe(1175000n)
  })
})
