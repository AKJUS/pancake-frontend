import { getIsMobile, isInBinance } from '@binance/w3w-utils'
import { WalletIds, selectedWalletAtom } from '@pancakeswap/ui-wallets'
import { getCurrencyAddress, TradeType } from '@pancakeswap/swap-sdk-core'
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { QuoteQuery } from 'quoter/quoter.types'

import { BasePerf, PerfTracker } from 'utils/PerfTracker'
import { InterfaceOrder } from 'views/Swap/utils'
import { accountActiveChainAtom, currentConnectorAtom } from 'wallet/atoms/accountStateAtoms'
import { walletRuntimeAtom } from 'wallet/atoms/runtimeAtom'

type QuoteTrace = BasePerf & {
  quoteHash: string
  createAt: number
  currencyA?: `0x${string}` | ''
  currencyB?: `0x${string}` | ''
  amount: string
  tradeType: TradeType
  v2Swap: boolean
  v3Swap: boolean
  infinitySwap: boolean
  infinityStableSwap: boolean
  xSwap: boolean
  chainId?: number
  account?: `0x${string}`
  route?: string
  app: string
  env: string
  wallet: WalletIds
  connectorId?: string
  selectedWalletId?: WalletIds
  quote: string
}

const APPS = [
  { regex: /MetaMask/i, app: 'mm' },
  { regex: /Trust Wallet/i, app: 'trust' },
  { regex: /CoinbaseWallet/i, app: 'coinbase' },
]

function detectApp() {
  if (isInBinance()) {
    return 'bn'
  }

  const ua = navigator.userAgent

  for (const { regex, app } of APPS) {
    if (regex.test(ua)) {
      return app
    }
  }

  if (getIsMobile()) {
    if (/Android/i.test(ua)) {
      return 'android'
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return 'ios'
    }
    return 'mobile'
  }

  return 'web'
}

class RouteTracker extends PerfTracker<QuoteTrace> {
  public success(order: InterfaceOrder) {
    super.success()
    if (order.trade.tradeType === TradeType.EXACT_INPUT) {
      this.trace.quote = order.trade.outputAmount.toExact()
    } else {
      this.trace.quote = order.trade.inputAmount.toExact()
    }
  }

  public async report() {
    super.report(`quote-${this.trace.route}`)
  }
}

export const quoteTraceAtom = atomFamily(
  (params: QuoteQuery) => {
    return atom((get) => {
      const { account } = get(accountActiveChainAtom)
      const runtime = get(walletRuntimeAtom)
      const connector = get(currentConnectorAtom)
      const selectedWallet = get(selectedWalletAtom)
      const trace: QuoteTrace = {
        quoteHash: params.hash,
        createAt: Date.now(),
        currencyA: params.baseCurrency ? getCurrencyAddress(params.baseCurrency) : '',
        currencyB: params.currency ? getCurrencyAddress(params.currency) : '',
        tradeType: params.tradeType || TradeType.EXACT_INPUT,
        amount: `${params.amount?.quotient || 0}`,
        v2Swap: !!params.v2Swap,
        v3Swap: !!params.v3Swap,
        infinitySwap: params.infinitySwap,
        infinityStableSwap: !!params.infinityStableSwap,
        xSwap: params.xEnabled,
        chainId: params.currency?.chainId,
        account,
        route: params.routeKey,
        perf: {
          start: 0,
          pool_success: 0,
          pool_error: 0,
          success: 0,
          fail: 0,
          duration: 0,
        },
        flags: {},
        app: detectApp() || 'web',
        env: runtime.env,
        wallet: runtime.wallet,
        connectorId: connector?.id,
        selectedWalletId: selectedWallet?.id,
        quote: '',
        error: '',
      }

      const tracker = new RouteTracker('quote', trace, params.createTime)
      return {
        trace,
        tracker,
      }
    })
  },
  (a, b) => a.hash === b.hash && a.routeKey === b.routeKey,
)
