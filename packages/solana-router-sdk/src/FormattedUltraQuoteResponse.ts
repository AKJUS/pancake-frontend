import { PublicKey } from '@solana/web3.js'
import {
  array,
  boolean,
  coerce,
  defaulted,
  Infer,
  instance,
  nullable,
  number,
  optional,
  string,
  type,
} from 'superstruct'

const PublicKeyFromString = coerce(instance(PublicKey), string(), (value) => new PublicKey(value))

const AmountFromString = string()

// const NumberFromString = coerce<string, null, number>(string(), number(), (value) => Number(value))

const SwapInfo = type({
  ammKey: PublicKeyFromString,
  label: string(),
  inputMint: string(),
  outputMint: string(),
  inAmount: AmountFromString,
  outAmount: AmountFromString,
  feeAmount: optional(AmountFromString),
  feeMint: optional(PublicKeyFromString),
})

const RoutePlanStep = type({
  swapInfo: SwapInfo,
  percent: number(),
  bps: optional(number()),
})
const RoutePlanWithMetadata = array(RoutePlanStep)

export const FormattedUltraQuoteResponse = type({
  inputMint: PublicKeyFromString,
  inAmount: AmountFromString,
  outputMint: PublicKeyFromString,
  outAmount: AmountFromString,
  otherAmountThreshold: AmountFromString,
  priceImpact: number(),
  routePlan: RoutePlanWithMetadata,
  slippageBps: number(),
  contextSlot: defaulted(number(), 0),
  computedAutoSlippage: optional(number()),
  transaction: nullable(string()),
  swapType: string(),
  gasless: boolean(),
  requestId: string(),
  prioritizationFeeLamports: optional(number()),
  feeBps: number(),
  router: string(),
})

export type FormattedUltraQuoteResponse = Infer<typeof FormattedUltraQuoteResponse>
