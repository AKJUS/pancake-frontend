import { Currency } from '@pancakeswap/swap-sdk-core'
import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUnifiedTokenUsdPrice } from './useUnifiedTokenUsdPrice'

// --- Types ---

export interface UseUsdDepositAmountParams {
  baseCurrency: Currency | undefined
  quoteCurrency: Currency | undefined

  /** Current token input values (display order — base/quote, not 0/1) */
  baseInputValue: string | undefined
  quoteInputValue: string | undefined

  /** Handlers to set individual token amounts */
  onBaseInput: (amount: string) => void
  onQuoteInput: (amount: string) => void

  /**
   * Fraction of USD value that should go to the base token (0–1).
   * - CL/V3: calculated from position math
   * - V2/StableSwap: ~0.5
   * - Bin: 0.5
   * - Out of range: 0 or 1
   * Defaults to 0.5 if not provided.
   */
  baseTokenRatio?: number

  /** Whether quote token amount is independently settable (true for Bin pools) */
  independentQuote?: boolean

  /** Whether base deposit is enabled */
  isBaseDepositEnabled?: boolean
  /** Whether quote deposit is enabled */
  isQuoteDepositEnabled?: boolean
}

export function useUsdDepositAmount({
  baseCurrency,
  quoteCurrency,
  baseInputValue,
  quoteInputValue,
  onBaseInput,
  onQuoteInput,
  baseTokenRatio = 0.5,
  independentQuote = false,
  isBaseDepositEnabled = true,
  isQuoteDepositEnabled = true,
}: UseUsdDepositAmountParams) {
  const [usdInputValue, setUsdInputValue] = useState('')
  const [isUsdLastEdited, setIsUsdLastEdited] = useState(false)

  // When true, token input changes came from USD conversion — don't clear isUsdLastEdited
  const isUsdDrivenRef = useRef(false)

  // Reset local USD state when the currency pair changes (user navigated to a new pool)
  const baseAddr = baseCurrency?.wrapped.address
  const quoteAddr = quoteCurrency?.wrapped.address
  useEffect(() => {
    setUsdInputValue('')
    setIsUsdLastEdited(false)
  }, [baseAddr, quoteAddr])

  // When token values change externally (e.g. range change recalculates amounts),
  // clear isUsdLastEdited so the USD display shows the derived total instead of stale input.
  // isUsdDrivenRef is set in onUsdInput and reset here after one render cycle so the
  // effect skips USD-driven token changes but catches external ones.
  const prevBaseRef = useRef(baseInputValue)
  const prevQuoteRef = useRef(quoteInputValue)
  useEffect(() => {
    if (isUsdDrivenRef.current) {
      isUsdDrivenRef.current = false
    } else if (isUsdLastEdited) {
      if (prevBaseRef.current !== baseInputValue || prevQuoteRef.current !== quoteInputValue) {
        setIsUsdLastEdited(false)
      }
    }
    prevBaseRef.current = baseInputValue
    prevQuoteRef.current = quoteInputValue
  }, [baseInputValue, quoteInputValue, isUsdLastEdited])

  // --- USD Prices ---
  const { data: basePriceUsd } = useUnifiedTokenUsdPrice(baseCurrency, Boolean(baseCurrency))
  const { data: quotePriceUsd } = useUnifiedTokenUsdPrice(quoteCurrency, Boolean(quoteCurrency))

  const canUseUsdMode = useMemo(() => {
    const hasBasePrice = Boolean(basePriceUsd && basePriceUsd > 0)
    const hasQuotePrice = Boolean(quotePriceUsd && quotePriceUsd > 0)

    // Single-sided deposit: only need the enabled token's price
    if (isBaseDepositEnabled && !isQuoteDepositEnabled) return hasBasePrice
    if (!isBaseDepositEnabled && isQuoteDepositEnabled) return hasQuotePrice

    return hasBasePrice && hasQuotePrice
  }, [basePriceUsd, quotePriceUsd, isBaseDepositEnabled, isQuoteDepositEnabled])

  // --- Effective ratio (respects deposit enabled states) ---
  const effectiveRatio = useMemo(() => {
    if (isBaseDepositEnabled && !isQuoteDepositEnabled) return 1
    if (!isBaseDepositEnabled && isQuoteDepositEnabled) return 0
    return baseTokenRatio
  }, [baseTokenRatio, isBaseDepositEnabled, isQuoteDepositEnabled])

  // --- USD → Token conversion ---
  const onUsdInput = useCallback(
    (usdValue: string) => {
      setUsdInputValue(usdValue)
      setIsUsdLastEdited(true)

      // For V3/V2/Stable the dependent protocol auto-calculates quote from base (or vice versa),
      // so we only write one side directly. But when the "driver" side is disabled (e.g. V3 out
      // of range above current price → base disabled), we must write to the enabled side instead,
      // otherwise nothing updates. Bin always writes both (independentQuote=true).
      const writeQuoteDirectly = independentQuote || !isBaseDepositEnabled

      // Don't gate on BOTH prices being present — for single-sided deposits (out of range) we only
      // need the enabled side's price, and canUseUsdMode reflects that. Each side's write below is
      // individually guarded by its own price check.
      if (!usdValue) {
        onBaseInput('')
        if (writeQuoteDirectly) onQuoteInput('')
        return
      }

      const usdNum = new BigNumber(usdValue)
      if (!usdNum.isFinite() || usdNum.lte(0)) {
        onBaseInput('')
        if (writeQuoteDirectly) onQuoteInput('')
        return
      }

      const baseUsd = usdNum.times(effectiveRatio)
      const quoteUsd = usdNum.times(1 - effectiveRatio)

      // Set flag so the external-change useEffect skips this render cycle
      isUsdDrivenRef.current = true
      if (isBaseDepositEnabled && basePriceUsd && basePriceUsd > 0) {
        const baseAmount = baseUsd.div(basePriceUsd).decimalPlaces(baseCurrency?.decimals ?? 18, BigNumber.ROUND_DOWN)
        onBaseInput(baseAmount.gt(0) ? baseAmount.toFixed() : '')
      }

      if (writeQuoteDirectly && isQuoteDepositEnabled && quotePriceUsd && quotePriceUsd > 0) {
        const quoteAmount = quoteUsd
          .div(quotePriceUsd)
          .decimalPlaces(quoteCurrency?.decimals ?? 18, BigNumber.ROUND_DOWN)
        onQuoteInput(quoteAmount.gt(0) ? quoteAmount.toFixed() : '')
      }
      // Note: isUsdDrivenRef is reset in the useEffect, not here, so the flag
      // persists through the next render cycle
    },
    [
      setUsdInputValue,
      setIsUsdLastEdited,
      basePriceUsd,
      quotePriceUsd,
      effectiveRatio,
      isBaseDepositEnabled,
      isQuoteDepositEnabled,
      baseCurrency?.decimals,
      quoteCurrency?.decimals,
      independentQuote,
      onBaseInput,
      onQuoteInput,
    ],
  )

  // --- Total USD value (derived from actual token amounts) ---
  const totalUsdValue = useMemo(() => {
    let total = 0
    if (baseInputValue && basePriceUsd) {
      const baseNum = Number(baseInputValue)
      if (Number.isFinite(baseNum)) total += baseNum * basePriceUsd
    }
    if (quoteInputValue && quotePriceUsd) {
      const quoteNum = Number(quoteInputValue)
      if (Number.isFinite(quoteNum)) total += quoteNum * quotePriceUsd
    }
    return total
  }, [baseInputValue, quoteInputValue, basePriceUsd, quotePriceUsd])

  // --- USD display value ---
  // When USD was last edited, show the typed value
  // When tokens were last edited, show the derived total
  const usdDisplayValue = useMemo(() => {
    if (isUsdLastEdited) return usdInputValue
    if (totalUsdValue > 0) return new BigNumber(totalUsdValue).decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed()
    return ''
  }, [isUsdLastEdited, usdInputValue, totalUsdValue])

  // --- Wrap token input handlers to track that tokens were last edited ---
  const onBaseInputWrapped = useCallback(
    (amount: string) => {
      if (!isUsdDrivenRef.current) {
        setIsUsdLastEdited(false)
      }
      onBaseInput(amount)
    },
    [onBaseInput],
  )

  const onQuoteInputWrapped = useCallback(
    (amount: string) => {
      if (!isUsdDrivenRef.current) {
        setIsUsdLastEdited(false)
      }
      onQuoteInput(amount)
    },
    [onQuoteInput],
  )

  // --- Reset ---
  const resetUsdInput = useCallback(() => {
    setUsdInputValue('')
    setIsUsdLastEdited(false)
  }, [setUsdInputValue, setIsUsdLastEdited])

  return {
    usdDisplayValue,
    onUsdInput,
    totalUsdValue,
    canUseUsdMode,
    isUsdLastEdited,
    basePriceUsd: basePriceUsd ?? 0,
    quotePriceUsd: quotePriceUsd ?? 0,
    onBaseInputWrapped,
    onQuoteInputWrapped,
    resetUsdInput,
  }
}
