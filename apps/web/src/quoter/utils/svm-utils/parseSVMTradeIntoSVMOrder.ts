import { type SVMOrder, OrderType, SVMTrade } from '@pancakeswap/price-api-sdk'
import { PoolType, Route, RouteType, SVMPool } from '@pancakeswap/smart-router'
import type { SolRouterTrade, RouterPlan } from '@pancakeswap/solana-router-sdk'
import {
  Currency,
  CurrencyAmount,
  Percent,
  TradeType,
  UnifiedCurrencyAmount,
  SPLToken,
  SPLNativeCurrency,
} from '@pancakeswap/swap-sdk-core'
import { SVMQuoteQuery } from 'quoter/quoter.types'

// Extended type to support both SPLToken and SPLNative currencies
type ExtendedSolRouterTrade = Omit<SolRouterTrade, 'inputAmount' | 'outputAmount'> & {
  inputAmount: UnifiedCurrencyAmount<SPLToken>
  outputAmount: UnifiedCurrencyAmount<SPLToken>
}

function createMockCurrency(address: string, chainId: number, programId: string) {
  return new SPLToken({
    address,
    chainId,
    programId,
    decimals: 0,
    symbol: 'MOCK_INFO',
    name: 'MOCK_INFO',
    logoURI: '',
  })
}

export function parseRoutePlansToRoutes(svmTrade: ExtendedSolRouterTrade): Route[] {
  const routes: Route[] = []
  let currentGroup: typeof svmTrade.routes = []

  // Identify convergence points: plans where multiple prior plans output to its input
  const convergenceIndices = new Set<number>()
  for (let i = 0; i < svmTrade.routes.length; i++) {
    const plan = svmTrade.routes[i]
    if (plan.percent === 100) {
      // Count how many previous plans output to this plan's input
      let contributingPlans = 0
      for (let j = 0; j < i; j++) {
        if (svmTrade.routes[j].swapInfo.outputMint === plan.swapInfo.inputMint) {
          contributingPlans++
        }
      }
      // If multiple plans contribute to this plan's input, it's a convergence point
      if (contributingPlans >= 2) {
        convergenceIndices.add(i)
      }
    }
  }

  for (let i = 0; i < svmTrade.routes.length; i++) {
    const routerPlan = svmTrade.routes[i]
    currentGroup.push(routerPlan)

    const isLastPlan = i === svmTrade.routes.length - 1
    const nextPlan = isLastPlan ? null : svmTrade.routes[i + 1]
    const nextIsConvergence = nextPlan && convergenceIndices.has(i + 1)

    // Check if current plan connects to next plan (output of current = input of next)
    const currentConnectsToNext =
      nextPlan && !isLastPlan && routerPlan.swapInfo.outputMint === nextPlan.swapInfo.inputMint

    const isEndOfRoute =
      isLastPlan ||
      (nextPlan && nextPlan.percent < 100) ||
      nextIsConvergence ||
      (!currentConnectsToNext && nextPlan && nextPlan.percent === 100)

    if (isEndOfRoute) {
      const route = createRoute(currentGroup, svmTrade)
      routes.push(route)
      currentGroup = []
    }
  }

  return routes
}

const FEE_PRECISION = 1_000_000n

function trimPercentage(fee: number) {
  // Round to 5 decimal places to remove floating point precision errors
  // This handles cases like 0.00120000000002 becoming 0.0012
  return Math.round(fee * 100000) / 100000
}

function createRoute(currentGroup: RouterPlan[], svmTrade: ExtendedSolRouterTrade): Route {
  // Process the current group into a single Route
  const pools = currentGroup.map((plan) => {
    const inAmountNumber = BigInt(plan.swapInfo.inAmount)
    const feeAmountNumber = BigInt(plan.swapInfo.feeAmount ?? 0)

    // In case inAmountNumber is 0 or NaN
    const feeAmount = inAmountNumber > 0 ? (feeAmountNumber * FEE_PRECISION) / inAmountNumber : 0n

    const fee = (Number(feeAmount) / Number(FEE_PRECISION)) * 100

    const pool: SVMPool = {
      type: PoolType.SVM,
      id: plan.swapInfo.ammKey.toString(),
      fee: trimPercentage(fee),
      feeAmount: plan.swapInfo.feeAmount,
      feeMintAddress: plan.swapInfo.feeMint?.toString(),
    }

    return pool
  })

  // Build path: start with input currency, include all intermediate currencies, end with output currency
  // For multi-hop routes, path will be [inputCurrency, intermediate1, intermediate2, ..., outputCurrency]
  const path: Currency[] = []

  // Add the input currency (from the first plan)
  const firstPlan = currentGroup[0]
  const firstPlanInputMint = firstPlan.swapInfo.inputMint

  // Determine the actual input currency for this route group
  let routeInputCurrency: SPLToken
  if (firstPlanInputMint === svmTrade.inputAmount.currency.wrapped.address) {
    routeInputCurrency = svmTrade.inputAmount.currency
  } else if (firstPlanInputMint === svmTrade.outputAmount.currency.wrapped.address) {
    routeInputCurrency = svmTrade.outputAmount.currency
  } else {
    // Create currency for route input token
    routeInputCurrency = createMockCurrency(
      firstPlanInputMint,
      svmTrade.inputAmount.currency.chainId,
      svmTrade.inputAmount.currency.programId,
    )
  }

  path.push(routeInputCurrency as Currency)

  // Add intermediate currencies (outputMint of each plan except the last one becomes an intermediate currency)
  for (let j = 0; j < currentGroup.length - 1; j++) {
    const plan = currentGroup[j]
    const outputMintAddress = plan.swapInfo.outputMint

    // Find the currency for this outputMint
    let intermediateCurrency: SPLToken | SPLNativeCurrency
    if (outputMintAddress === svmTrade.inputAmount.currency.wrapped.address) {
      intermediateCurrency = svmTrade.inputAmount.currency
    } else if (outputMintAddress === svmTrade.outputAmount.currency.wrapped.address) {
      intermediateCurrency = svmTrade.outputAmount.currency
    } else {
      // For intermediate tokens that don't match input/output currencies,
      // create a proper SPLToken instance
      intermediateCurrency = createMockCurrency(
        outputMintAddress,
        svmTrade.inputAmount.currency.chainId,
        svmTrade.inputAmount.currency.programId,
      )
    }

    // NOTE: cast to Currency to avoid type error
    // Fix it later
    path.push(intermediateCurrency as Currency)
  }

  // Determine final output currency based on last plan in group
  const lastPlan = currentGroup[currentGroup.length - 1]
  const finalOutputMintAddress = lastPlan.swapInfo.outputMint

  let finalOutputCurrency: SPLToken
  if (finalOutputMintAddress === svmTrade.inputAmount.currency.wrapped.address) {
    finalOutputCurrency = svmTrade.inputAmount.currency
  } else if (finalOutputMintAddress === svmTrade.outputAmount.currency.wrapped.address) {
    finalOutputCurrency = svmTrade.outputAmount.currency
  } else {
    // Create currency for final output token
    finalOutputCurrency = createMockCurrency(
      finalOutputMintAddress,
      svmTrade.inputAmount.currency.chainId,
      svmTrade.inputAmount.currency.programId,
    )
  }

  // Add the final output currency
  path.push(finalOutputCurrency as Currency)

  const inputAmount = UnifiedCurrencyAmount.fromRawAmount(routeInputCurrency, firstPlan.swapInfo.inAmount)
  const outputAmount = UnifiedCurrencyAmount.fromRawAmount(finalOutputCurrency, lastPlan.swapInfo.outAmount)

  return {
    type: RouteType.SVM,
    pools,
    path,
    // NOTE: it's dangerous to cast UnifiedCurrencyAmount to CurrencyAmount
    // but can't add UnifiedCurrencyAmount to Route[] becuase it's only for EVM
    // Need to find a better way to handle this
    inputAmount: inputAmount as CurrencyAmount<Currency>,
    outputAmount: outputAmount as CurrencyAmount<Currency>,
    percent: firstPlan.percent, // Use percent from first plan in group
  }
}

/**
 * SVM Trade to SVM Order mapping
 * SolRouterTrade → SVMOrder
 * ├── tradeType (from query.tradeType)
 * ├── inputAmount ✓ (direct copy)
 * ├── outputAmount ✓ (direct copy)
 * ├── routes: RouterPlan[] → Route[] (convert each RouterPlan with grouping)
 * |───────|Group RouterPlans until outputMint matches final outputAmount address
 * |───────|RouterPlan.swapInfo.ammKey → SVMPool.id
 * |───────|RouterPlan.swapInfo.feeAmount → SVMPool.feeAmount
 * |───────|RouterPlan.percent → Route.percent (from first plan in group)
 * |───────|RouterPlan.swapInfo.inAmount → Route.inputAmount (from first plan)
 * |───────|RouterPlan.swapInfo.outAmount → Route.outputAmount (from last plan)
 * ├── priceImpactPct → priceImpactPct ✓ (direct copy)
 * ├── transaction ✓ (direct copy)
 * ├── maximumAmountIn → maximumAmountIn ✓ (direct copy)
 * ├── minimumAmountOut → minimumAmountOut ✓ (direct copy)
 * └── + quoteQueryHash (from query.hash)
 */
export function parseSVMTradeIntoSVMOrder(svmTrade: ExtendedSolRouterTrade, query: SVMQuoteQuery): SVMOrder<TradeType> {
  // Convert RouterPlan[] to Route[] with grouping logic
  const routes: Route[] = parseRoutePlansToRoutes(svmTrade)

  const PCT_MULTIPLIER = 1_000_000

  // Truncate decimal part (e.g. 123.232 -> 123)
  const priceNumber = Math.trunc(Math.abs(Number(svmTrade.priceImpactPct)) * PCT_MULTIPLIER)

  // Create SVMTrade
  const svmTradeData: SVMTrade<TradeType> = {
    tradeType: query.tradeType || svmTrade.tradeType,
    inputAmount: svmTrade.inputAmount,
    outputAmount: svmTrade.outputAmount,
    priceImpactPct: priceNumber > 0 ? new Percent(priceNumber, PCT_MULTIPLIER) : new Percent(0, PCT_MULTIPLIER / 100),
    routes,
    requestId: svmTrade.requestId,
    quoteQueryHash: query.hash,
    transaction: svmTrade.transaction,
    maximumAmountIn: UnifiedCurrencyAmount.fromRawAmount(svmTrade.inputAmount.currency, svmTrade.otherAmountThreshold),
    minimumAmountOut: UnifiedCurrencyAmount.fromRawAmount(
      svmTrade.outputAmount.currency,
      svmTrade.otherAmountThreshold,
    ),
  }

  // Create SVMOrder
  return {
    type: OrderType.PCS_SVM,
    trade: svmTradeData,
  }
}
