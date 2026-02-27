import { Currency, CurrencyAmount, Price, TradeType } from '@pancakeswap/swap-sdk-core'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useAtomValue } from 'jotai'
import { bestAMMTradeFromQuoterWorkerAtom } from 'quoter/atom/bestAMMTradeFromQuoterWorkerAtom'
import { useCurrentBlock } from 'state/block/hooks'
import { getTokenAddress } from 'views/Swap/components/Chart/utils'
import { InterfaceOrder } from 'views/Swap/utils'
import { OrderType } from '@pancakeswap/price-api-sdk'

import { createQuoteQuery } from '../utils/createQuoteQuery'
import { multicallGasLimitAtom } from './useMulticallGasLimit'

interface Query {
  inputCurrencyId?: string
  inputCurrency?: Currency
  outputCurrencyId?: string
  outputCurrency?: Currency
}
export function useSingleTokenSwapInfo(query: Query): { [key: string]: number } {
  const { inputCurrencyId, inputCurrency, outputCurrencyId, outputCurrency } = query
  const { chainId } = useActiveChainId()
  const token0Address = getTokenAddress(chainId, inputCurrencyId)
  const token1Address = getTokenAddress(chainId, outputCurrencyId)
  const amount = tryParseAmount('1', inputCurrency ?? undefined)

  const blockNumber = useCurrentBlock()
  const gasLimit = useAtomValue(multicallGasLimitAtom(chainId))
  const quoteOption = createQuoteQuery({
    amount,
    baseCurrency: inputCurrency ?? undefined,
    currency: outputCurrency ?? undefined,
    tradeType: TradeType.EXACT_INPUT,
    maxHops: 1,
    maxSplits: 0,
    v2Swap: true,
    v3Swap: true,
    stableSwap: true,
    xEnabled: false,
    speedQuoteEnabled: true,
    infinitySwap: false,
    infinityStableSwap: false,
    blockNumber,
    gasLimit,
    routeKey: 'single-token-swap',
    ver: 0,
  })

  const quoteResult = useAtomValue(bestAMMTradeFromQuoterWorkerAtom(quoteOption))

  const bestTradeExactIn = quoteResult.map((x) => x.trade).unwrapOr(undefined)

  const isSVMOrder = (bestTradeExactIn as InterfaceOrder | undefined)?.type === OrderType.PCS_SVM

  if (!inputCurrency || !outputCurrency || !bestTradeExactIn || !isSVMOrder) {
    return {}
  }

  let inputTokenPrice = 0
  try {
    inputTokenPrice = parseFloat(
      new Price({
        // NOTE: safe to cast to CurrencyAmount<Currency> since we already check isSVMOrder above
        baseAmount: bestTradeExactIn.inputAmount as CurrencyAmount<Currency>,
        quoteAmount: bestTradeExactIn.outputAmount as CurrencyAmount<Currency>,
      }).toSignificant(6),
    )
  } catch (error) {
    //
  }
  if (!inputTokenPrice) {
    return {}
  }
  const outputTokenPrice = 1 / inputTokenPrice

  return {
    [token0Address]: inputTokenPrice,
    [token1Address]: outputTokenPrice,
  }
}
