import { Currency, TradeType } from '@pancakeswap/swap-sdk-core'

import { deserializeAggregatorResponse } from './deserializeAggregatorResponse'
import type {
  AggregatorCalldataData,
  AggregatorCalldataParams,
  AggregatorCalldataResponse,
  AggregatorQuoteParams,
  AggregatorQuoteResponse,
  AggregatorQuoteResult,
} from './types'

export class AggregatorService {
  private readonly baseUrl: string

  private readonly apiKey: string | undefined

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json' }
    if (this.apiKey) h['PCS-API-KEY'] = this.apiKey
    return h
  }

  async getQuote(
    params: AggregatorQuoteParams,
    signal?: AbortSignal,
    currencies?: { input?: Currency; output?: Currency },
  ): Promise<AggregatorQuoteResult | undefined> {
    const qs = new URLSearchParams({
      chainId: String(params.chainId),
      inputToken: params.tokenIn,
      outputToken: params.tokenOut,
      amount: params.amount,
      tradeType: params.tradeType === TradeType.EXACT_INPUT ? 'exactIn' : 'exactOut',
    })

    if (params.protocol) qs.set('protocol', params.protocol)
    if (params.provider) qs.set('provider', params.provider)

    const res = await fetch(`${this.baseUrl}/v2/quote?${qs}`, {
      method: 'GET',
      signal,
      headers: this.headers,
    })

    if (!res.ok) {
      throw new Error(`Aggregator error: ${res.status}`)
    }

    const json = (await res.json()) as AggregatorQuoteResponse
    if (json.code !== 0) {
      throw new Error(`Aggregator: ${json.msg}`)
    }

    const order = deserializeAggregatorResponse(
      json,
      params.chainId,
      params.tradeType,
      currencies?.input,
      currencies?.output,
    )
    if (!order) return undefined

    return { order, quoteData: json.data }
  }

  async getCalldata(params: AggregatorCalldataParams): Promise<AggregatorCalldataData> {
    const { chainId, quoteData, recipient, slippageBps, deadline } = params
    const res = await fetch(`${this.baseUrl}/v1/calldata`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId,
        srcToken: quoteData.srcToken,
        dstToken: quoteData.dstToken,
        tradeType: quoteData.tradeType,
        inputAmount: quoteData.inputAmount,
        outputAmount: quoteData.outputAmount,
        gasUseEstimate: quoteData.gasUseEstimate,
        routes: quoteData.routes,
        recipient,
        slippageTolerance: slippageBps / 10000,
        ...(deadline != null ? { deadline } : {}),
      }),
    })

    if (!res.ok) {
      throw new Error(`Aggregator calldata error: ${res.status}`)
    }

    const json = (await res.json()) as AggregatorCalldataResponse
    if (json.code !== 0) {
      throw new Error(`Aggregator calldata: ${json.msg}`)
    }

    return json.data
  }
}
