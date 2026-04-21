import type { Loadable } from '@pancakeswap/utils/Loadable'
import { isBetterQuoteTrade } from 'quoter/utils/getBetterQuote'
import type { InterfaceOrder } from 'views/Swap/utils'

export function findBestQuote(...args: Loadable<InterfaceOrder>[]): [InterfaceOrder, number] | undefined {
  const fulfilledValues = args.map((x) => x.unwrapOr(undefined))

  let bestOrder: InterfaceOrder | undefined
  let idx = -1
  for (let i = 0; i < fulfilledValues.length; i++) {
    const order = fulfilledValues[i]
    if (!order) {
      continue
    }
    if (!order?.trade) continue
    if (!bestOrder) {
      bestOrder = order
      idx = i
      continue
    }
    if (isBetterQuoteTrade(bestOrder.trade, order.trade)) {
      bestOrder = order
      idx = i
    }
  }
  return bestOrder ? [bestOrder, idx] : undefined
}
