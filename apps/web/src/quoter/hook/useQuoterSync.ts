import { useDebounce } from '@orbs-network/twap-ui/dist/hooks'
import { TradeType } from '@pancakeswap/swap-sdk-core'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { useInputBasedAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { activeQuoteHashAtom } from 'quoter/atom/abortControlAtoms'
import { bestCrossChainQuoteAtom } from 'quoter/atom/bestCrossChainAtom'
import { baseAllTypeBestTradeAtom, pauseAtom, userTypingAtom } from 'quoter/atom/bestTradeUISyncAtom'
import { updatePlaceholderAtom } from 'quoter/atom/placeholderAtom'
import { QUOTE_FAIL_REVALIDATE, QUOTE_SUCC_REVALIDATE } from 'quoter/consts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCurrentBlock } from 'state/block/hooks'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { NonEVMChainId } from '@pancakeswap/chains'
import { QuoteQuery, SVMQuoteQuery } from 'quoter/quoter.types'

import { quoteNonceAtom } from '../atom/revalidateAtom'
import { createQuoteQuery } from '../utils/createQuoteQuery'
import { useQuoteContext } from './QuoteContext'
import { multicallGasLimitAtom } from './useMulticallGasLimit'

export const useQuoterSync = () => {
  const swapState = useSwapState()
  const debouncedSwapState = useDebounce(swapState, 300)
  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputCurrencyChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputCurrencyChainId },
  } = debouncedSwapState
  const { account: address, solanaAccount, chainId: currentChain } = useAccountActiveChain()
  const inputCurrency = useUnifiedCurrency(inputCurrencyId, inputCurrencyChainId)
  const outputCurrency = useUnifiedCurrency(outputCurrencyId, outputCurrencyChainId)
  const isExactIn = independentField === Field.INPUT
  const independentCurrency = isExactIn ? inputCurrency : outputCurrency
  const dependentCurrency = isExactIn ? outputCurrency : inputCurrency
  const tradeType = isExactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT
  const amount = tryParseAmount(typedValue, independentCurrency ?? undefined)

  const {
    singleHopOnly,
    split,
    v2Swap,
    v3Swap,
    infinitySwap,
    infinityStableSwap,
    stableSwap,
    maxHops,
    chainId,
    speedQuoteEnabled,
    xEnabled,
  } = useQuoteContext()
  const setTrade = useSetAtom(baseAllTypeBestTradeAtom)
  const setTyping = useSetAtom(userTypingAtom)
  const [paused, pauseQuote] = useAtom(pauseAtom)

  const { slippageTolerance: slippage, isAuto } = useInputBasedAutoSlippageWithFallback(amount)
  const blockNumber = useCurrentBlock()
  const destinationBlockNumber = useCurrentBlock(outputCurrencyChainId)
  const setActiveQuoteHash = useSetAtom(activeQuoteHashAtom)
  const [nonce, setNonce] = useAtom(quoteNonceAtom)
  const gasLimit = useAtomValue(multicallGasLimitAtom(chainId))
  const gasLimitDestinationChain = useAtomValue(multicallGasLimitAtom(outputCurrencyChainId))

  const quoteQueryInit = {
    amount,
    currency: dependentCurrency,
    baseCurrency: independentCurrency,
    tradeType,
    maxHops: singleHopOnly ? 1 : maxHops,
    maxSplits: split ? undefined : 0,
    v2Swap,
    v3Swap,
    infinitySwap: Boolean(infinitySwap), // chain support is check inner
    infinityStableSwap: Boolean(infinityStableSwap),
    stableSwap,
    speedQuoteEnabled,
    xEnabled,
    slippage,
    isAutoSlippage: isAuto,
    address: currentChain === NonEVMChainId.SOLANA ? solanaAccount : address,
    blockNumber,
    destinationBlockNumber,
    gasLimitDestinationChain,
    nonce,
    for: 'main',
    gasLimit,
  } as QuoteQuery | SVMQuoteQuery

  // const isCrossChain = inputCurrencyChainId !== outputCurrencyChainId

  const quoteQuery = createQuoteQuery(quoteQueryInit)
  const setPlaceholder = useSetAtom(updatePlaceholderAtom)
  const { t, schedule, clear } = useTimer(1000)

  const successRevalidate = QUOTE_SUCC_REVALIDATE[chainId as keyof typeof QUOTE_SUCC_REVALIDATE] ?? 15
  const failRevalidate = QUOTE_FAIL_REVALIDATE[chainId as keyof typeof QUOTE_FAIL_REVALIDATE] ?? 3

  useEffect(() => {
    setActiveQuoteHash(quoteQuery.hash)
  }, [quoteQuery.hash, setActiveQuoteHash])

  useEffect(() => {
    clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteQuery.placeholderHash])

  useEffect(() => {
    setTyping(true)
  }, [typedValue, setTyping])

  const quoteResult = useAtomValue(bestCrossChainQuoteAtom(quoteQuery))

  const refresh = useCallback(() => {
    setNonce((v) => v + 1)
  }, [setNonce])

  const pauseQuoting = useCallback(() => {
    pauseQuote(true)
  }, [pauseQuote])

  const resumeQuoting = useCallback(() => {
    pauseQuote(false)
  }, [pauseQuote])

  useEffect(() => {
    if (t > 0 && !paused) {
      if (quoteResult.isJust() && !quoteResult.hasFlag('placeholder')) {
        schedule(t + successRevalidate, () => {
          setNonce((v) => v + 1)
        })
        return
      }

      if (quoteResult.isFail()) {
        schedule(t + failRevalidate, () => {
          setNonce((v) => v + 1)
        })
      }
    }
  }, [t, quoteResult, paused, schedule, successRevalidate, failRevalidate, setNonce])

  useEffect(() => {
    const quoteResultToSetPlaceholder =
      (quoteResult.isJust() || quoteResult.isFail()) && !quoteResult.hasFlag('placeholder')

    if (quoteResultToSetPlaceholder) {
      // NOTE: placeholderHash is used to show previous quote when new quote is pending
      const placeholderHash = quoteResult.getExtra('placeholderHash') as string

      const orderOrError = quoteResult.isFail() ? quoteResult.error : quoteResult.unwrap()

      setPlaceholder(placeholderHash, orderOrError)
    }

    if (paused) {
      return
    }

    const order = quoteResult.unwrapOr(undefined)

    setTrade({
      bestOrder: order,
      tradeLoaded: !quoteResult.isPending(),
      tradeError: quoteResult.error,
      refreshDisabled: false,
      refreshOrder: refresh,
      refreshTrade: refresh,
      pauseQuoting,
      resumeQuoting,
    })
    setTyping(false)
  }, [
    quoteResult.value,
    quoteResult.loading,
    quoteResult.error,
    pauseQuote,
    setTrade,
    setTyping,
    setNonce,
    paused,
    setPlaceholder,
    quoteResult,
    refresh,
    pauseQuoting,
    resumeQuoting,
  ])
}

interface Task {
  t: number
  fn: () => void
}
const useTimer = (interval: number) => {
  const [count, setCount] = useState(0)
  const tasks = useRef<Task[]>([])

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => prev + 1)
    }, interval)

    return () => clearInterval(timer)
  }, [interval, setCount])

  useEffect(() => {
    for (const task of tasks.current) {
      if (task.t <= count) {
        task.fn()
        tasks.current = tasks.current.filter((t) => t !== task)
      }
    }
  }, [count])

  const scheduleFn = useCallback((t: number, fn: () => void) => {
    if (tasks.current.length === 0) {
      tasks.current.push({ t, fn })
    }
  }, [])

  const clear = useCallback(() => {
    tasks.current = []
  }, [])

  return {
    t: count,
    schedule: scheduleFn,
    clear,
  }
}
