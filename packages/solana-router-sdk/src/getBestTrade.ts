import { isWSol, solToWSol, SPLToken, TradeType, UnifiedCurrencyAmount } from '@pancakeswap/sdk'
import { PublicKey } from '@solana/web3.js'
import { create } from 'superstruct'
import Decimal from 'decimal.js'
import { FormattedUltraQuoteResponse } from './FormattedUltraQuoteResponse'
import { ultraSwapService } from './UltraSwapService'

interface SolanaQuoteRequest {
  inputMint: string
  outputMint: string
  amount: string
  slippageBps: number
  swapMode: 'ExactIn' | 'ExactOut'
  taker?: string
  excludeRouters?: string
  excludeDexes?: string
  priorityFeeLamports?: number
  useWsol?: boolean
}

interface BestSolanaTradeParams {
  inputCurrency: SPLToken
  outputCurrency: SPLToken
  amount: UnifiedCurrencyAmount<SPLToken>
  account?: string
  slippageBps?: number
  tradeType: TradeType
  excludeRouters?: string
  excludeDexes?: string
  priorityFeeLamports?: number
}

export interface RouterPlan {
  swapInfo: {
    inputMint: string
    inAmount: string
    outputMint: string
    outAmount: string
    ammKey: PublicKey
    label: string
    feeAmount?: string
    feeMint?: PublicKey
  }
  // 10000 = 0.01%, 15000 = 0.15%
  bps?: number
  percent: number
}

export interface SolRouterTrade {
  tradeType: TradeType
  inputAmount: UnifiedCurrencyAmount<SPLToken>
  outputAmount: UnifiedCurrencyAmount<SPLToken>
  routes: RouterPlan[]
  requestId: string
  otherAmountThreshold: string
  priceImpactPct: string
  slippageBps: number
  transaction: string | null
}

export const getBestSolanaTrade = async ({
  inputCurrency,
  outputCurrency,
  tradeType,
  amount,
  account,
  slippageBps = 50,
  priorityFeeLamports,
}: BestSolanaTradeParams): Promise<SolRouterTrade> => {
  const inputMint = solToWSol(inputCurrency.address)
  const outputMint = solToWSol(outputCurrency.address)
  const swapMode = tradeType === TradeType.EXACT_INPUT ? 'ExactIn' : 'ExactOut'

  const requestBody: SolanaQuoteRequest = {
    inputMint,
    outputMint,
    amount: amount.quotient.toString(),
    slippageBps,
    swapMode,
    taker: account,
    priorityFeeLamports,
    useWsol: isWSol(inputCurrency.address) || isWSol(outputCurrency.address),
  }

  const response = await ultraSwapService.getQuote(requestBody)
  const quoteResponse = create(response, FormattedUltraQuoteResponse, 'conver FormattedUltraQuoteResponse Error')

  // Convert Solana quote format to SmartRouter trade format
  return {
    tradeType,
    inputAmount: UnifiedCurrencyAmount.fromRawAmount(inputCurrency, quoteResponse.inAmount),
    outputAmount: UnifiedCurrencyAmount.fromRawAmount(outputCurrency, quoteResponse.outAmount),
    routes: quoteResponse.routePlan,
    requestId: quoteResponse.requestId,
    otherAmountThreshold: quoteResponse.otherAmountThreshold,
    priceImpactPct: new Decimal(quoteResponse.priceImpact).dividedBy(100).toString(),
    slippageBps: quoteResponse.slippageBps,
    transaction: quoteResponse.transaction,
  }
}
