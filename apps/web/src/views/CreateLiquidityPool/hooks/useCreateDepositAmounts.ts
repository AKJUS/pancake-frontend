import { Currency, CurrencyAmount, isCurrencySorted } from '@pancakeswap/swap-sdk-core'
import { isSolana } from '@pancakeswap/chains'
import {
  encodeSqrtRatioX96,
  maxLiquidityForAmount0Imprecise,
  maxLiquidityForAmount1,
  SqrtPriceMath,
  TickMath,
} from '@pancakeswap/v3-sdk'
import { useCLPriceRange } from 'hooks/infinity/useCLPriceRange'
import { atom, useAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import tryParseCurrencyAmount from 'utils/tryParseCurrencyAmount'
import { parseUnits } from 'viem/utils'
import { useCurrencies } from './useCurrencies'
import {
  useInfinityBinQueryState,
  useInfinityCLQueryState,
  useInfinityCreateFormQueryState,
} from './useInfinityFormState/useInfinityFormQueryState'
import { useStartPriceAsFraction } from './useStartPriceAsFraction'

type LastEdit = {
  lastEditAmount: string
  lastEditCurrency: 0 | 1
}

/**
 * no need to track both currency amounts, only need to track the last edited one
 *
 * as we have the formula: startPriceAsFraction = amount1 / amount0
 *
 * so if we know the last edited currency, we can derive the other currency amount
 */
export const lastEditAtom = atom<LastEdit>({
  lastEditAmount: '',
  lastEditCurrency: 0,
})

export const useCreateDepositAmountsEnabled = () => {
  const startPriceAsFraction = useStartPriceAsFraction()
  const { baseCurrency, quoteCurrency } = useCurrencies()
  const { isCl, isBin } = useInfinityCreateFormQueryState()
  const { lowerTick, upperTick, tickSpacing } = useInfinityCLQueryState()
  const { lowerBinId, upperBinId, activeId } = useInfinityBinQueryState()
  const b = baseCurrency && !isSolana(baseCurrency.chainId) ? (baseCurrency as unknown as Currency) : undefined
  const q = quoteCurrency && !isSolana(quoteCurrency.chainId) ? (quoteCurrency as unknown as Currency) : undefined
  const { lowerPrice, upperPrice } = useCLPriceRange(b, q, tickSpacing ?? undefined)

  const isDepositEnabled = useMemo(() => {
    if (isCl) {
      return Boolean(startPriceAsFraction && lowerTick !== null && upperTick !== null)
    }
    return Boolean(startPriceAsFraction && lowerBinId !== null && upperBinId !== null)
  }, [startPriceAsFraction, isCl, lowerTick, upperTick, lowerBinId, upperBinId])

  const binInRange = useMemo(() => {
    if (isBin) {
      return lowerBinId && upperBinId && activeId !== null && lowerBinId <= activeId && activeId <= upperBinId
    }
    return false
  }, [isBin, lowerBinId, upperBinId, activeId])

  const isDeposit0Enabled = useMemo(() => {
    if (!baseCurrency || !quoteCurrency || !startPriceAsFraction) return false
    if (isCl) {
      const p = isCurrencySorted(startPriceAsFraction.baseCurrency, startPriceAsFraction.quoteCurrency)
        ? startPriceAsFraction
        : startPriceAsFraction.invert()
      return Boolean(isDepositEnabled && upperPrice && (p.lessThan(upperPrice) || p.equalTo(upperPrice)))
    }

    if (isBin) {
      return Boolean(isDepositEnabled && lowerBinId && activeId !== null && (lowerBinId >= activeId || binInRange))
    }

    return false
  }, [
    baseCurrency,
    quoteCurrency,
    startPriceAsFraction,
    isCl,
    isBin,
    isDepositEnabled,
    upperPrice,
    lowerBinId,
    activeId,
    binInRange,
  ])

  const isDeposit1Enabled = useMemo(() => {
    if (!baseCurrency || !quoteCurrency || !startPriceAsFraction) return false
    if (isCl) {
      const p = isCurrencySorted(startPriceAsFraction.baseCurrency, startPriceAsFraction.quoteCurrency)
        ? startPriceAsFraction
        : startPriceAsFraction.invert()
      return Boolean(isDepositEnabled && lowerPrice && (p.greaterThan(lowerPrice) || p.equalTo(lowerPrice)))
    }

    if (isBin) {
      return Boolean(isDepositEnabled && upperBinId && activeId !== null && (upperBinId <= activeId || binInRange))
    }

    return false
  }, [
    baseCurrency,
    quoteCurrency,
    startPriceAsFraction,
    isCl,
    isBin,
    isDepositEnabled,
    lowerPrice,
    upperBinId,
    activeId,
    binInRange,
  ])

  return { isDepositEnabled, isDeposit0Enabled, isDeposit1Enabled }
}

export const useClDepositAmounts = () => {
  const [lastEdit, setLastEdit] = useAtom(lastEditAtom)
  const { currency0, currency1 } = useCurrencies()
  const { lowerTick, upperTick } = useInfinityCLQueryState()
  const startPriceFraction = useStartPriceAsFraction()
  const { isDeposit0Enabled, isDeposit1Enabled } = useCreateDepositAmountsEnabled()

  const [depositCurrencyAmount0, depositCurrencyAmount1] = useMemo(() => {
    // without startPrice, cannot allow editing
    if (!startPriceFraction || !currency0 || !currency1 || lowerTick === null || upperTick === null)
      return [undefined, undefined]
    // @notice: if the lower and upper tick are the same, the price is the same,
    // will result in a division by zero error
    if (lowerTick === upperTick) return [undefined, undefined]

    const p = isCurrencySorted(startPriceFraction.baseCurrency, startPriceFraction.quoteCurrency)
      ? startPriceFraction
      : startPriceFraction.invert()

    const sqrtPriceX96 = p.denominator ? encodeSqrtRatioX96(p.numerator, p.denominator) : undefined
    let amount0: CurrencyAmount<Currency> | undefined
    let amount1: CurrencyAmount<Currency> | undefined

    if (lastEdit.lastEditCurrency === 0) {
      const c0 = currency0 && !isSolana(currency0.chainId) ? (currency0 as unknown as Currency) : undefined
      const c1 = currency1 && !isSolana(currency1.chainId) ? (currency1 as unknown as Currency) : undefined
      amount0 = tryParseCurrencyAmount(lastEdit.lastEditAmount, c0)

      if (!amount0 || amount0.equalTo(0) || startPriceFraction.equalTo(0)) return [undefined, undefined]

      if (isDeposit1Enabled && sqrtPriceX96) {
        const sqrtLowerX96 = TickMath.getSqrtRatioAtTick(lowerTick)
        const sqrtUpperX96 = TickMath.getSqrtRatioAtTick(upperTick)

        if (sqrtPriceX96 === sqrtUpperX96) {
          return [undefined, undefined]
        }
        const liquidity = maxLiquidityForAmount0Imprecise(sqrtPriceX96, sqrtUpperX96, amount0.quotient)
        const amount1Raw = SqrtPriceMath.getAmount1Delta(sqrtLowerX96, sqrtPriceX96, liquidity, false)
        amount1 = c1 ? CurrencyAmount.fromRawAmount(c1, amount1Raw) : undefined
      } else {
        amount1 = c1 ? CurrencyAmount.fromRawAmount(c1, 0n) : undefined
      }
    } else {
      const c0 = currency0 && !isSolana(currency0.chainId) ? (currency0 as unknown as Currency) : undefined
      const c1 = currency1 && !isSolana(currency1.chainId) ? (currency1 as unknown as Currency) : undefined
      amount1 = tryParseCurrencyAmount(lastEdit.lastEditAmount, c1)

      if (!amount1 || amount1.equalTo(0) || startPriceFraction.equalTo(0)) return [undefined, undefined]

      if (isDeposit0Enabled && sqrtPriceX96) {
        const sqrtLowerX96 = TickMath.getSqrtRatioAtTick(lowerTick)
        const sqrtUpperX96 = TickMath.getSqrtRatioAtTick(upperTick)

        if (sqrtPriceX96 === sqrtLowerX96) {
          return [undefined, undefined]
        }
        const liquidity = maxLiquidityForAmount1(sqrtLowerX96, sqrtPriceX96, amount1.quotient)
        const rawAmount0 = SqrtPriceMath.getAmount0Delta(sqrtPriceX96, sqrtUpperX96, liquidity, true)
        amount0 = c0 ? CurrencyAmount.fromRawAmount(c0, rawAmount0) : undefined
      } else {
        amount0 = c0 ? CurrencyAmount.fromRawAmount(c0, 0n) : undefined
      }
    }
    return [amount0, amount1]
  }, [
    currency0,
    currency1,
    isDeposit0Enabled,
    isDeposit1Enabled,
    lastEdit.lastEditAmount,
    lastEdit.lastEditCurrency,
    lowerTick,
    startPriceFraction,
    upperTick,
  ])

  const handleDepositAmountChange = useCallback(
    (amount: string, currency: 0 | 1) => {
      setLastEdit({ lastEditAmount: amount, lastEditCurrency: currency })
    },
    [setLastEdit],
  )

  const resetAmounts = useCallback(() => {
    setLastEdit({ lastEditAmount: '', lastEditCurrency: 0 })
  }, [setLastEdit])

  const switchDepositAmounts = useCallback(() => {
    setLastEdit({ lastEditAmount: lastEdit.lastEditAmount, lastEditCurrency: lastEdit.lastEditCurrency === 0 ? 1 : 0 })
  }, [setLastEdit, lastEdit])

  return {
    depositCurrencyAmount0: isDeposit0Enabled ? depositCurrencyAmount0 : undefined,
    depositCurrencyAmount1: isDeposit1Enabled ? depositCurrencyAmount1 : undefined,
    handleDepositAmountChange,
    inputValue0: lastEdit.lastEditCurrency === 0 ? lastEdit.lastEditAmount : depositCurrencyAmount0?.toExact(),
    inputValue1: lastEdit.lastEditCurrency === 1 ? lastEdit.lastEditAmount : depositCurrencyAmount1?.toExact(),
    resetAmounts,
    switchDepositAmounts,
  }
}

const binDepositAmountsAtom = atom<{
  depositCurrencyAmount0: CurrencyAmount<Currency> | null
  depositCurrencyAmount1: CurrencyAmount<Currency> | null
}>({
  depositCurrencyAmount0: null,
  depositCurrencyAmount1: null,
})
export const useBinDepositAmounts = () => {
  const { currency0, currency1 } = useCurrencies()
  const [depositCurrencyAmounts, setDepositCurrencyAmounts] = useAtom(binDepositAmountsAtom)
  const [inputValue0, setInputValue0] = useState('')
  const [inputValue1, setInputValue1] = useState('')

  const { depositCurrencyAmount0, depositCurrencyAmount1 } = depositCurrencyAmounts
  const { isDeposit0Enabled, isDeposit1Enabled } = useCreateDepositAmountsEnabled()

  const handleDepositAmountChange = useCallback(
    (amount: string, currency: 0 | 1) => {
      if (!currency0 || !currency1) return
      const c0 = !isSolana(currency0.chainId) ? (currency0 as unknown as Currency) : undefined
      const c1 = !isSolana(currency1.chainId) ? (currency1 as unknown as Currency) : undefined
      if (!c0 || !c1) return
      const rawAmount = amount === '' ? null : amount
      const parsedAmount = parseUnits(rawAmount ?? '0', currency === 0 ? c0.decimals : c1.decimals)

      if (currency === 0) {
        setInputValue0(amount)
        setDepositCurrencyAmounts((prev) => ({
          ...prev,
          depositCurrencyAmount0: amount === '' ? null : CurrencyAmount.fromRawAmount(c0, parsedAmount),
        }))
      } else {
        setInputValue1(amount)
        setDepositCurrencyAmounts((prev) => ({
          ...prev,
          depositCurrencyAmount1: amount === '' ? null : CurrencyAmount.fromRawAmount(c1, parsedAmount),
        }))
      }
    },
    [currency0, currency1, setDepositCurrencyAmounts],
  )

  const resetAmounts = useCallback(() => {
    setDepositCurrencyAmounts({
      depositCurrencyAmount0: null,
      depositCurrencyAmount1: null,
    })
    setInputValue0('')
    setInputValue1('')
  }, [setDepositCurrencyAmounts, setInputValue0, setInputValue1])

  const switchDepositAmounts = useCallback(() => {
    setDepositCurrencyAmounts({
      depositCurrencyAmount0: depositCurrencyAmount1,
      depositCurrencyAmount1: depositCurrencyAmount0,
    })
  }, [setDepositCurrencyAmounts, depositCurrencyAmount0, depositCurrencyAmount1])

  return {
    depositCurrencyAmount0: isDeposit0Enabled ? depositCurrencyAmount0 : undefined,
    depositCurrencyAmount1: isDeposit1Enabled ? depositCurrencyAmount1 : undefined,
    handleDepositAmountChange,
    inputValue0: depositCurrencyAmount0 ? inputValue0 : '',
    inputValue1: depositCurrencyAmount1 ? inputValue1 : '',
    resetAmounts,
    switchDepositAmounts,
  }
}

export const useCreateDepositAmounts = () => {
  const { isCl } = useInfinityCreateFormQueryState()
  const clDepositAmounts = useClDepositAmounts()
  const binDepositAmounts = useBinDepositAmounts()

  return isCl ? clDepositAmounts : binDepositAmounts
}
