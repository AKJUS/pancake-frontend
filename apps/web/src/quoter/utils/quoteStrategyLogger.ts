import { TradeType } from '@pancakeswap/swap-sdk-core'
import type { InterfaceOrder } from 'views/Swap/utils'
import type { Loadable } from '@pancakeswap/utils/Loadable'
import { shouldReportQuoteSession } from 'quoter/perf/quoteSessionReportGuard'
import {
  serializeOrder,
  serializeQuoteSessionLog,
  type QuoteSessionCandidateSnapshot,
} from 'quoter/utils/quoteLogSerializer'
import { getLogger } from 'utils/datadog'
import type { StrategyRoute } from '../atom/routingStrategy'

const sessionLogger = getLogger('quote-session')

function formatAmount(amount: any): string {
  if (!amount) return '0'
  try {
    return amount.toSignificant ? amount.toSignificant(6) : String(amount)
  } catch {
    return String(amount)
  }
}

function calculateDiff(winnerAmount: string, otherAmount: string): { diff: string; percent: string } {
  try {
    const winner = parseFloat(winnerAmount)
    const other = parseFloat(otherAmount)

    if (Number.isNaN(winner) || Number.isNaN(other) || winner === 0) {
      return { diff: '0', percent: '0%' }
    }

    const diff = Math.abs(other - winner)
    const percent = ((diff / winner) * 100).toFixed(2)

    return {
      diff: diff.toFixed(6),
      percent: `${percent}%`,
    }
  } catch {
    return { diff: '0', percent: '0%' }
  }
}

export async function logStrategyComparison(
  strategies: StrategyRoute[],
  quotes: Array<{
    result: Loadable<InterfaceOrder>
    isShadow?: boolean
    key: string
  }>,
  selectedIndex: number | undefined,
  option: any,
) {
  try {
    const selectedOrder = selectedIndex !== undefined ? quotes[selectedIndex].result.unwrapOr(undefined) : undefined
    const selectedTrade = selectedOrder?.trade

    if (!selectedTrade) {
      return
    }

    if (!shouldReportQuoteSession(option.hash)) {
      return
    }

    const isExactInput = selectedTrade.tradeType === TradeType.EXACT_INPUT
    const selectedAmount = isExactInput
      ? formatAmount(selectedTrade.outputAmount)
      : formatAmount(selectedTrade.inputAmount)
    const selectedStrategy = selectedIndex !== undefined ? quotes[selectedIndex].key : 'unknown'

    // Record all strategies and build console table data
    const strategyTable: Array<{
      Strategy: string
      Status: string
      Amount: string
    }> = []
    const comparisonMetrics: Record<string, { amount: string; diffPercent: string }> = {}
    const allStrategies: QuoteSessionCandidateSnapshot[] = []

    quotes.forEach((q, idx) => {
      const order = q.result.unwrapOr(undefined)
      const trade = order?.trade

      let status: 'success' | 'pending' | 'fail' | 'shadow-fail' = 'success'
      if (q.result.isPending()) status = 'pending'
      if (q.result.isFail()) status = q.isShadow ? 'shadow-fail' : 'fail'

      let amount: string | undefined
      let error: string | undefined

      if (trade) {
        amount = isExactInput ? formatAmount(trade.outputAmount) : formatAmount(trade.inputAmount)
      }

      if (q.result.isFail()) {
        const err = q.result.error
        error = err?.message || String(err)
      }

      // Build console table row
      strategyTable.push({
        Strategy: q.key,
        Status: status,
        Amount: amount || error || '-',
      })

      // Record comparisons for non-selected strategies
      let diffPercent: string | undefined
      if (idx !== selectedIndex && trade) {
        const tradeAmount = isExactInput ? formatAmount(trade.outputAmount) : formatAmount(trade.inputAmount)
        const { percent } = calculateDiff(selectedAmount, tradeAmount)
        diffPercent = percent
        comparisonMetrics[q.key] = {
          amount: tradeAmount,
          diffPercent: percent,
        }
      }

      allStrategies.push({
        strategy: q.key,
        status,
        amount,
        diffPercent,
        error,
        order: serializeOrder(order),
      })
    })

    // Console output for non-production
    if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.group(
        `%c[Quote Strategy] Winner: ${selectedStrategy} (${selectedAmount})`,
        'color: #51cf66; font-weight: bold',
      )
      // eslint-disable-next-line no-console
      console.table(strategyTable)
      if (Object.keys(comparisonMetrics).length > 0) {
        // eslint-disable-next-line no-console
        console.table(comparisonMetrics)
      }
      // eslint-disable-next-line no-console
      console.groupEnd()
    }

    const sessionPayload = serializeQuoteSessionLog({
      option,
      selectedStrategy,
      selectedAmount,
      selectedOrder,
      allStrategies,
    })

    // eslint-disable-next-line no-console
    console.log('[quote-session]', sessionPayload)

    sessionLogger.log('quote.session.completed', sessionPayload)
  } catch (error) {
    // Silently fail to avoid breaking quote flow
  }
}
