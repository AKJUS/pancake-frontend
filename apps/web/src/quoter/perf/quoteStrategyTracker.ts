import { TradeType } from '@pancakeswap/swap-sdk-core'
import { BasePerf, PerfTracker } from 'utils/PerfTracker'

interface StrategyMetric {
  strategy: string
  status: 'success' | 'pending' | 'fail' | 'shadow-fail'
  amount?: string
  error?: string
}

interface StrategyComparison {
  strategy: string
  diffPercent: string
}

type QuoteStrategyTrace = BasePerf & {
  selectedStrategy: string
  selectedAmount: string
  tradeType: TradeType
  inputCurrency?: string
  outputCurrency?: string
  strategyCount: number
  allStrategies: StrategyMetric[]
  comparisons: StrategyComparison[]
  failedCount: number
}

class QuoteStrategyTracker extends PerfTracker<QuoteStrategyTrace> {
  public recordStrategy(metric: StrategyMetric) {
    this.trace.allStrategies.push(metric)
    if (metric.status === 'fail' || metric.status === 'shadow-fail') {
      this.trace.failedCount += 1
    }
  }

  public recordComparison(strategy: string, diffPercent: string) {
    this.trace.comparisons.push({
      strategy,
      diffPercent,
    })
  }

  public async report() {
    super.report(`router-selection`)
  }
}

export function createQuoteStrategyTracker(
  selectedStrategy: string,
  selectedAmount: string,
  tradeType: TradeType,
  inputCurrency?: string,
  outputCurrency?: string,
  strategyCount?: number,
): QuoteStrategyTracker {
  const trace: QuoteStrategyTrace = {
    selectedStrategy,
    selectedAmount,
    tradeType,
    inputCurrency,
    outputCurrency,
    strategyCount: strategyCount || 0,
    allStrategies: [],
    comparisons: [],
    failedCount: 0,
    perf: {
      start: 0,
      success: 0,
      fail: 0,
      duration: 0,
    },
    flags: {},
    error: '',
  }

  const tracker = new QuoteStrategyTracker('router-selection', trace, Date.now())
  tracker.track('start')
  return tracker
}
