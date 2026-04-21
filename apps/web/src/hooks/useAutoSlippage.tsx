import { ChainId } from '@pancakeswap/chains'
import { ExclusiveDutchOrderTrade } from '@pancakeswap/pcsx-sdk'
import { Percent, TradeType } from '@pancakeswap/sdk'
import { InfinityRouter, SmartRouterTrade } from '@pancakeswap/smart-router'
import { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { BigNumber } from 'bignumber.js'
import { L2_CHAIN_IDS } from 'config/chains'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useMemo } from 'react'

import { BridgeTrade } from '@pancakeswap/price-api-sdk'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useGasPrice } from 'state/user/hooks'
import useNativeCurrency from './useNativeCurrency'
import { useStablecoinPrice, useStablecoinPriceAmount } from './useStablecoinPrice'

export const MIN_DEFAULT_SLIPPAGE_NUMERATOR = 50
export const MAX_SLIPPAGE_NUMERATOR = 500
export const DEFAULT_AUTO_SLIPPAGE = new Percent(MIN_DEFAULT_SLIPPAGE_NUMERATOR, 10_000) // 0.5%
export const PCSX_AUTO_SLIPPAGE_TOLERANCE = new Percent(10, 10_000) // 0.1%

// Helper functions
const isL2ChainId = (chainId?: number): boolean => {
  if (!chainId) return false
  return L2_CHAIN_IDS.includes(chainId)
}

const chainSupportsGasEstimates = (chainId?: number): boolean => {
  if (!chainId) return false
  return chainId === ChainId.ETHEREUM || chainId === ChainId.BSC
}

// Type guard to check if trade is V4Trade
const isV4Trade = (
  trade:
    | SmartRouterTrade<TradeType>
    | InfinityRouter.InfinityTradeWithoutGraph<TradeType>
    | ExclusiveDutchOrderTrade<Currency, Currency>
    | BridgeTrade
    | undefined,
): trade is InfinityRouter.InfinityTradeWithoutGraph<TradeType> => {
  return trade !== undefined && trade !== null && 'gasUseEstimate' in trade && !('orderInfo' in trade)
}

// Estimate gas for a trade
const guesstimateGas = (
  trade?:
    | SmartRouterTrade<TradeType>
    | InfinityRouter.InfinityTradeWithoutGraph<TradeType>
    | ExclusiveDutchOrderTrade<Currency, Currency>
    | BridgeTrade,
): number => {
  if (!trade) return 0
  // A very rough gas estimation based on the trade type
  return 200000 // Default gas estimate
}

// Calculate gas estimate in USD based on trade type
const calculateGasEstimateUSD = (
  supportsGasEstimate: boolean,
  trade?:
    | SmartRouterTrade<TradeType>
    | InfinityRouter.InfinityTradeWithoutGraph<TradeType>
    | ExclusiveDutchOrderTrade<Currency, Currency>
    | BridgeTrade,
  baseGasEstimatePrice?: any,
) => {
  if (!supportsGasEstimate || !trade) return null

  if (isV4Trade(trade)) {
    const baseGasEstimate = trade.gasUseEstimateBase
    if (baseGasEstimate?.greaterThan(0) && baseGasEstimatePrice) {
      const baseAmount = parseFloat(baseGasEstimate.toSignificant(6))
      return baseAmount * parseFloat(baseGasEstimatePrice.toSignificant(6))
    }
    return null
  }

  // For ExclusiveDutchOrderTrade, use a default gas estimate
  if ('orderInfo' in trade) {
    // This is an ExclusiveDutchOrderTrade
    return 0.5 // Default gas cost in USD for Dutch Order trades
  }

  // For SmartRouterTrade, use gasEstimateInUSD
  return 'gasEstimateInUSD' in trade
    ? typeof trade.gasEstimateInUSD === 'string'
      ? parseFloat(trade.gasEstimateInUSD)
      : Number(trade.gasEstimateInUSD?.toSignificant(6))
    : null
}

// Calculate native gas cost
const calculateNativeGasCost = (nativeGasPrice?: string, gasEstimate?: number) => {
  return nativeGasPrice && typeof gasEstimate === 'number'
    ? new BigNumber(nativeGasPrice.toString()).multipliedBy(gasEstimate)
    : undefined
}

// Calculate gas cost amount
const calculateGasCostAmount = (nativeGasCost?: BigNumber, nativeCurrency?: any) => {
  return nativeGasCost && nativeCurrency
    ? parseFloat(nativeGasCost.toFixed(0)) / 10 ** nativeCurrency.decimals
    : undefined
}

// Calculate slippage based on dollar cost and output value
const calculateSlippageFromDollarValues = (dollarCostToUse: number, outputDollarValue: number) => {
  // Optimize for highest possible slippage without getting MEV'd
  // Set slippage % such that the difference between expected amount out and minimum amount out < gas fee to sandwich the trade
  const fraction = dollarCostToUse / outputDollarValue
  return new Percent(Math.floor(fraction * 10000), 10000)
}

// Apply slippage tolerance limits
const applySlippageLimits = (
  calculatedSlippage: Percent,
  min = MIN_DEFAULT_SLIPPAGE_NUMERATOR,
  max = MAX_SLIPPAGE_NUMERATOR,
) => {
  if (calculatedSlippage.greaterThan(new Percent(max, 10_000))) {
    return new Percent(max, 10_000)
  }

  if (calculatedSlippage.lessThan(new Percent(min, 10_000))) {
    return new Percent(min, 10_000)
  }

  return calculatedSlippage
}

type SupportedTrade =
  | SmartRouterTrade<TradeType>
  | InfinityRouter.InfinityTradeWithoutGraph<TradeType>
  | ExclusiveDutchOrderTrade<Currency, Currency>
  | BridgeTrade

export default function useClassicAutoSlippageTolerance(trade?: SupportedTrade): Percent {
  const { chainId } = useActiveChainId()
  const onL2 = isL2ChainId(chainId)
  const { inputBasedSlippage, inputDollarValue } = useInputBasedAutoSlippage(trade?.inputAmount)

  // Get USD price of output amount
  const outputCurrency = trade?.outputAmount?.currency
  const outputUSDPrice = useStablecoinPrice(outputCurrency, { enabled: Boolean(trade?.outputAmount?.greaterThan(0)) })

  const nativeGasPrice = useGasPrice()
  const nativeCurrency = useNativeCurrency(chainId)

  // Gas estimation
  const supportsGasEstimate = useMemo(() => chainId && chainSupportsGasEstimates(chainId), [chainId])
  const gasEstimate = guesstimateGas(trade)

  const baseGasEstimateCurrency =
    isV4Trade(trade) && trade.gasUseEstimateBase?.greaterThan(0) ? trade.gasUseEstimateBase.currency : undefined
  const baseGasEstimatePrice = useStablecoinPrice(baseGasEstimateCurrency, { enabled: Boolean(trade) })

  const gasCostAmount = useMemo(() => {
    const nativeGasCost = calculateNativeGasCost(nativeGasPrice?.toString(), gasEstimate)
    return calculateGasCostAmount(nativeGasCost, nativeCurrency)
  }, [nativeGasPrice, gasEstimate, nativeCurrency])
  const gasCostUSDValue = useStablecoinPriceAmount(nativeCurrency, gasCostAmount, {
    enabled: Boolean(trade?.outputAmount?.greaterThan(0)),
  })

  // If valid estimate from API and using API trade, use gas estimate from API
  // NOTE - don't use gas estimate for L2s yet - need to verify accuracy
  // If not, use local heuristic
  const dollarCostToUse = useMemo(() => {
    const gasEstimateUSD = calculateGasEstimateUSD(!!supportsGasEstimate, trade, baseGasEstimatePrice)
    return supportsGasEstimate && gasEstimateUSD ? gasEstimateUSD : gasCostUSDValue
  }, [supportsGasEstimate, gasCostUSDValue, baseGasEstimatePrice, trade])

  const { data } = useQuery({
    queryKey: [
      'classic-auto-slippage',
      trade?.outputAmount?.wrapped?.toExact(),
      outputUSDPrice?.wrapped?.toSignificant(),
      dollarCostToUse,
    ],
    queryFn: () => {
      if (!trade || onL2) {
        return DEFAULT_AUTO_SLIPPAGE
      }

      const outputAmount = trade?.outputAmount?.toSignificant(6)
      const outputDollarValue =
        outputAmount && outputUSDPrice
          ? parseFloat(outputAmount) * parseFloat(outputUSDPrice.toSignificant(6))
          : undefined

      if (outputDollarValue && dollarCostToUse) {
        const calculatedSlippage = calculateSlippageFromDollarValues(dollarCostToUse, outputDollarValue)
        const outputBaseSlippage = applySlippageLimits(calculatedSlippage)
        // input usd has value and the usd value difference is 5% up, this is for some edge case
        const shouldUseInputBase =
          inputDollarValue &&
          Math.abs(inputDollarValue - outputDollarValue) > outputDollarValue * 0.05 &&
          outputBaseSlippage.lessThan(inputBasedSlippage)

        const finalSlippage = shouldUseInputBase ? inputBasedSlippage : outputBaseSlippage

        return finalSlippage
      }

      // eslint-disable-next-line no-console
      console.log('Auto Slippage: Using DEFAULT_AUTO_SLIPPAGE because missing outputDollarValue or dollarCostToUse')
      return DEFAULT_AUTO_SLIPPAGE
    },
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 0, // Remove data from cache immediately after unmount
  })

  return data ?? DEFAULT_AUTO_SLIPPAGE
}

// Calculate slippage based on input dollar value
export function useInputBasedAutoSlippage(inputAmount?: CurrencyAmount<Currency>): {
  inputBasedSlippage: Percent
  inputDollarValue: number | undefined
} {
  const { chainId } = useActiveChainId()
  const onL2 = isL2ChainId(chainId)

  const nativeGasPrice = useGasPrice()
  const nativeCurrency = useNativeCurrency(chainId)
  const inputCurrency = inputAmount?.currency
  const inputUSDPrice = useStablecoinPrice(inputCurrency, { enabled: Boolean(inputAmount?.greaterThan(0)) })

  const gasEstimate = 200000

  const gasCostAmount = useMemo(() => {
    const nativeGasCost = calculateNativeGasCost(nativeGasPrice?.toString(), gasEstimate)
    return calculateGasCostAmount(nativeGasCost, nativeCurrency)
  }, [nativeGasPrice, nativeCurrency])
  const gasCostUSDValue = useStablecoinPriceAmount(nativeCurrency, gasCostAmount, {
    enabled: Boolean(inputAmount?.greaterThan(0)),
  })

  const { data } = useQuery({
    queryKey: [
      'input-based-auto-slippage',
      inputAmount?.wrapped?.toExact(),
      inputUSDPrice?.wrapped?.toSignificant(),
      gasCostUSDValue,
    ],
    queryFn: () => {
      // If no input amount or on L2 chain, use default
      if (!inputAmount || onL2) return { inputBasedSlippage: DEFAULT_AUTO_SLIPPAGE, inputDollarValue: undefined }

      const inputAmountValue = inputAmount?.toSignificant(6)
      const inputDollarValue =
        inputAmountValue && inputUSDPrice
          ? parseFloat(inputAmountValue) * parseFloat(inputUSDPrice.toSignificant(6))
          : undefined

      // If we have input dollar value and gas cost, calculate slippage
      if (inputDollarValue && gasCostUSDValue) {
        // For input-based calculation, we use a different formula
        // We want to ensure the slippage covers the gas cost relative to the input amount
        const calculatedSlippage = calculateSlippageFromDollarValues(gasCostUSDValue, inputDollarValue)
        return { inputBasedSlippage: applySlippageLimits(calculatedSlippage), inputDollarValue }
      }

      return { inputBasedSlippage: DEFAULT_AUTO_SLIPPAGE, inputDollarValue: undefined }
    },
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    gcTime: 0, // Remove data from cache immediately after unmount
  })
  return data ?? { inputBasedSlippage: DEFAULT_AUTO_SLIPPAGE, inputDollarValue: undefined }
}
