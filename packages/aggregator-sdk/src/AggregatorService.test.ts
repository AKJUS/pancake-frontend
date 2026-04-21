import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { TradeType } from '@pancakeswap/swap-sdk-core'

import { AggregatorService } from './AggregatorService'
import type { AggregatorQuoteParams } from './types'

const WBNB = { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, symbol: 'WBNB' }
const USDT = { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' }

// BE provides address-sorted token0/token1 on each pool.
function sortedPair(a: { address: string }, b: { address: string }) {
  return a.address.toLowerCase() < b.address.toLowerCase()
    ? { token0: a.address, token1: b.address }
    : { token0: b.address, token1: a.address }
}

const BASE_PARAMS: AggregatorQuoteParams = {
  chainId: 56,
  tokenIn: WBNB.address,
  tokenOut: USDT.address,
  amount: '1000000000000000000',
  tradeType: TradeType.EXACT_INPUT,
}

function makeSuccessResponse() {
  return {
    code: 0,
    msg: 'success',
    data: {
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
          pools: [{ address: '0xPool1', type: 'v3', fee: 500, provider: 'pancakeswap', ...sortedPair(WBNB, USDT) }],
        },
      ],
    },
  }
}

describe('AggregatorService', () => {
  let service: AggregatorService
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    service = new AggregatorService('https://aggregator.example.com')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('should build correct URL path and query params for exact-input', async () => {
    let capturedUrl = ''
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString()
      return new Response(JSON.stringify(makeSuccessResponse()), { status: 200 })
    }) as any

    await service.getQuote(BASE_PARAMS)

    expect(capturedUrl).toContain('/v2/quote?')
    expect(capturedUrl).toContain('chainId=56')
    expect(capturedUrl).toContain(`inputToken=${WBNB.address}`)
    expect(capturedUrl).toContain(`outputToken=${USDT.address}`)
    expect(capturedUrl).toContain('amount=1000000000000000000')
    expect(capturedUrl).toContain('tradeType=exactIn')
  })

  it('should use exactOut tradeType value for exact-output', async () => {
    let capturedUrl = ''
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString()
      return new Response(JSON.stringify(makeSuccessResponse()), { status: 200 })
    }) as any

    await service.getQuote({ ...BASE_PARAMS, tradeType: TradeType.EXACT_OUTPUT })

    expect(capturedUrl).toContain('tradeType=exactOut')
  })

  it('should not include protocol or provider params when not provided', async () => {
    let capturedUrl = ''
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString()
      return new Response(JSON.stringify(makeSuccessResponse()), { status: 200 })
    }) as any

    await service.getQuote(BASE_PARAMS)

    expect(capturedUrl).not.toContain('protocol=')
    expect(capturedUrl).not.toContain('provider=')
  })

  it('should append protocol and provider params when provided', async () => {
    let capturedUrl = ''
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString()
      return new Response(JSON.stringify(makeSuccessResponse()), { status: 200 })
    }) as any

    await service.getQuote({ ...BASE_PARAMS, protocol: 'v2,v3', provider: 'pancakeswap' })

    expect(capturedUrl).toContain('protocol=v2%2Cv3')
    expect(capturedUrl).toContain('provider=pancakeswap')
  })

  it('should send PCS-API-KEY header when apiKey is provided', async () => {
    let capturedHeaders: Record<string, string> = {}
    globalThis.fetch = vi.fn(async (_url: any, opts: any) => {
      capturedHeaders = opts?.headers ?? {}
      return new Response(JSON.stringify(makeSuccessResponse()), { status: 200 })
    }) as any

    const serviceWithKey = new AggregatorService('https://aggregator.example.com', 'test-api-key')
    await serviceWithKey.getQuote(BASE_PARAMS)

    expect(capturedHeaders['PCS-API-KEY']).toBe('test-api-key')
  })

  it('should not send PCS-API-KEY header when apiKey is not provided', async () => {
    let capturedHeaders: Record<string, string> = {}
    globalThis.fetch = vi.fn(async (_url: any, opts: any) => {
      capturedHeaders = opts?.headers ?? {}
      return new Response(JSON.stringify(makeSuccessResponse()), { status: 200 })
    }) as any

    await service.getQuote(BASE_PARAMS)

    expect(capturedHeaders['PCS-API-KEY']).toBeUndefined()
  })

  it('should pass abort signal to fetch', async () => {
    let capturedSignal: AbortSignal | undefined
    globalThis.fetch = vi.fn(async (_url: any, opts: any) => {
      capturedSignal = opts?.signal
      return new Response(JSON.stringify(makeSuccessResponse()), { status: 200 })
    }) as any

    const controller = new AbortController()
    await service.getQuote(BASE_PARAMS, controller.signal)

    expect(capturedSignal).toBe(controller.signal)
  })

  it('should return order and quoteData on success', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(makeSuccessResponse()), { status: 200 })
    }) as any

    const result = await service.getQuote(BASE_PARAMS)

    expect(result).toBeDefined()
    expect(result!.order.trade.inputAmount.quotient.toString()).toBe('1000000000000000000')
    expect(result!.quoteData).toBeDefined()
    expect(result!.quoteData.routes).toHaveLength(1)
    expect(result!.quoteData.inputAmount).toBe('1000000000000000000')
  })

  it('should return undefined when response has no routes', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ code: 0, msg: 'success', data: { routes: [] } }), { status: 200 })
    }) as any

    const result = await service.getQuote(BASE_PARAMS)
    expect(result).toBeUndefined()
  })

  it('should throw on non-ok HTTP status', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('', { status: 500 })
    }) as any

    await expect(service.getQuote(BASE_PARAMS)).rejects.toThrow('Aggregator error: 500')
  })

  it('should throw when response code is non-zero', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ code: 42102, msg: 'quote is unavailable' }), { status: 200 })
    }) as any

    await expect(service.getQuote(BASE_PARAMS)).rejects.toThrow('Aggregator: quote is unavailable')
  })

  it('should throw on network failure', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as any

    await expect(service.getQuote(BASE_PARAMS)).rejects.toThrow('Failed to fetch')
  })
})

describe('AggregatorService.getCalldata', () => {
  let service: AggregatorService
  const originalFetch = globalThis.fetch

  const CALLDATA_PARAMS = {
    chainId: 56,
    quoteData: {
      srcToken: WBNB.address,
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
          pools: [
            {
              address: '0xPool1',
              type: 'v3' as const,
              fee: 500,
              provider: 'pancakeswap',
              ...sortedPair(WBNB, USDT),
            },
          ],
        },
      ],
    },
    recipient: '0x9D24d495F7380BA80dC114D8C2cF1a54a68e25A4',
    slippageBps: 50,
  }

  function makeCalldataResponse() {
    return {
      code: 0,
      msg: 'success',
      data: {
        to: '0x8046417dc273954B523fDDAdc207fDE29D29BAf6',
        value: '0x8AC7230489E80000',
        calldata: '0x9aa90356000000000000000000',
        gasUseEstimate: '200000',
      },
    }
  }

  beforeEach(() => {
    service = new AggregatorService('https://aggregator.example.com', 'test-key')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('should POST to correct URL with JSON body', async () => {
    let capturedUrl = ''
    let capturedOpts: any
    globalThis.fetch = vi.fn(async (url: any, opts: any) => {
      capturedUrl = url.toString()
      capturedOpts = opts
      return new Response(JSON.stringify(makeCalldataResponse()), { status: 200 })
    }) as any

    await service.getCalldata(CALLDATA_PARAMS)

    expect(capturedUrl).toBe('https://aggregator.example.com/v1/calldata')
    expect(capturedOpts.method).toBe('POST')
    expect(capturedOpts.headers['Content-Type']).toBe('application/json')
    expect(capturedOpts.headers['PCS-API-KEY']).toBe('test-key')
    const body = JSON.parse(capturedOpts.body)
    expect(body.chainId).toBe(56)
    expect(body.quoteData).toBeUndefined()
    expect(body.srcToken).toBe(WBNB.address)
    expect(body.dstToken).toBe(USDT.address)
    expect(body.tradeType).toBe(CALLDATA_PARAMS.quoteData.tradeType)
    expect(body.inputAmount).toBe(CALLDATA_PARAMS.quoteData.inputAmount)
    expect(body.outputAmount).toBe(CALLDATA_PARAMS.quoteData.outputAmount)
    expect(body.gasUseEstimate).toBe(CALLDATA_PARAMS.quoteData.gasUseEstimate)
    expect(body.routes).toEqual(CALLDATA_PARAMS.quoteData.routes)
    expect(body.recipient).toBe(CALLDATA_PARAMS.recipient)
    expect(body.slippageBps).toBeUndefined()
    expect(body.slippageTolerance).toBe(0.005)
  })

  it('should include deadline when provided', async () => {
    let capturedBody: any
    globalThis.fetch = vi.fn(async (_url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return new Response(JSON.stringify(makeCalldataResponse()), { status: 200 })
    }) as any

    await service.getCalldata({ ...CALLDATA_PARAMS, deadline: 1711900000 })

    expect(capturedBody.deadline).toBe(1711900000)
  })

  it('should omit deadline when not provided', async () => {
    let capturedBody: any
    globalThis.fetch = vi.fn(async (_url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return new Response(JSON.stringify(makeCalldataResponse()), { status: 200 })
    }) as any

    await service.getCalldata(CALLDATA_PARAMS)

    expect(capturedBody.deadline).toBeUndefined()
  })

  it('should return calldata data on success', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(makeCalldataResponse()), { status: 200 })
    }) as any

    const result = await service.getCalldata(CALLDATA_PARAMS)

    expect(result.to).toBe('0x8046417dc273954B523fDDAdc207fDE29D29BAf6')
    expect(result.value).toBe('0x8AC7230489E80000')
    expect(result.calldata).toBe('0x9aa90356000000000000000000')
    expect(result.gasUseEstimate).toBe('200000')
  })

  it('should throw on non-ok HTTP status', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('', { status: 500 })
    }) as any

    await expect(service.getCalldata(CALLDATA_PARAMS)).rejects.toThrow('Aggregator calldata error: 500')
  })

  it('should throw when response code is non-zero', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ code: 40101, msg: 'invalid input' }), { status: 200 })
    }) as any

    await expect(service.getCalldata(CALLDATA_PARAMS)).rejects.toThrow('Aggregator calldata: invalid input')
  })

  it('should return gasUseEstimate that can be converted to BigInt for gas limit calculation', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(makeCalldataResponse()), { status: 200 })
    }) as any

    const result = await service.getCalldata(CALLDATA_PARAMS)

    // Gas 3 fix: FE uses BigInt(result.gasUseEstimate) + calculateGasMargin.
    // This confirms the value is a valid numeric string that survives BigInt conversion.
    expect(() => BigInt(result.gasUseEstimate)).not.toThrow()
    expect(BigInt(result.gasUseEstimate)).toBe(200000n)
  })
})

describe('AggregatorService — aggregatorAddress passthrough (Gap 1)', () => {
  let service: AggregatorService
  const originalFetch = globalThis.fetch

  const WBNB = { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, symbol: 'WBNB' }
  const USDT = { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' }

  const BASE_PARAMS: AggregatorQuoteParams = {
    chainId: 56,
    tokenIn: WBNB.address,
    tokenOut: USDT.address,
    amount: '1000000000000000000',
    tradeType: TradeType.EXACT_INPUT,
  }

  beforeEach(() => {
    service = new AggregatorService('https://aggregator.example.com')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('should pass aggregatorAddress from BE quote response through in quoteData', async () => {
    const aggregatorAddress = '0x8046417dc273954B523fDDAdc207fDE29D29BAf6'
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
            tradeType: 'exactIn',
            inputAmount: '1000000000000000000',
            outputAmount: '300000000000000000000',
            gasUseEstimate: '200000',
            aggregatorAddress,
            routes: [
              {
                percent: 100,
                inputAmount: '1000000000000000000',
                outputAmount: '300000000000000000000',
                path: [WBNB, USDT],
                pools: [{ address: '0xPool1', type: 'v3', fee: 500, ...sortedPair(WBNB, USDT) }],
              },
            ],
          },
        }),
        { status: 200 },
      )
    }) as any

    const result = await service.getQuote(BASE_PARAMS)

    // Gap 1 fix: quoteData is a raw passthrough of json.data, so aggregatorAddress must be present.
    // SwapCommitButton reads quoteData.aggregatorAddress to determine the ERC20 approval spender.
    expect(result).toBeDefined()
    expect(result!.quoteData.aggregatorAddress).toBe(aggregatorAddress)
  })

  it('should return quoteData with aggregatorAddress undefined when BE omits it', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
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
                pools: [{ address: '0xPool1', type: 'v3', fee: 500, ...sortedPair(WBNB, USDT) }],
              },
            ],
          },
        }),
        { status: 200 },
      )
    }) as any

    const result = await service.getQuote(BASE_PARAMS)

    expect(result).toBeDefined()
    expect(result!.quoteData.aggregatorAddress).toBeUndefined()
  })
})
