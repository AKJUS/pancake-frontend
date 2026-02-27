import { ChainId, isSolana } from '@pancakeswap/chains'
import { TokenAddressMap } from '@pancakeswap/token-lists'
import { Loadable } from '@pancakeswap/utils/Loadable'
import { userSlippageAtomWithLocalStorage } from '@pancakeswap/utils/user/slippage'
import { type QuoteQuery } from 'quoter/quoter.types'
import { createQuoteQuery } from 'quoter/utils/createQuoteQuery'
import { combinedTokenMapFromActiveUrlsAtom } from 'state/lists/hooks'
import { swapReducerAtom } from 'state/swap/reducer'
import { type Route } from 'views/Swap/Bridge/api'
import { accountActiveChainAtom, AccountChainState } from 'wallet/atoms/accountStateAtoms'
import { solanaBridgeQuoteAtom } from 'quoter/atom/solanaBridgeQuoteAtom'
import { availableBridgeRoutesAtom } from '../../../atom/availableBridgeRoutesAtom'
import { bestSameChainWithoutPlaceHolderAtom } from '../../../atom/bestSameChainAtom'
import { bridgeOnlyQuoteAtom } from '../../../atom/bridgeOnlyQuoteAtom'
import { type BridgeQuoteParams, type QuoteContext } from '../types'
import { CROSSCHAIN_INFINITY_SWAP_SUPPORTED_CHAINS } from '../config'

interface AtomGetterFunction {
  <T>(atom: any): T
}

interface SwapReducerState {
  recipient: string | null
}

interface AccountActiveChainState {
  account: string
}

export class ContextBuilder {
  static getAvailableRoutes(option: QuoteQuery, get: AtomGetterFunction): Loadable<Route[]> {
    const crossChainRoutesLoadable = get(availableBridgeRoutesAtom(option)) as Loadable<Route[]>

    if (crossChainRoutesLoadable.isPending()) {
      return Loadable.Pending<Route[]>()
    }

    if (crossChainRoutesLoadable.isFail()) {
      return Loadable.Fail<Route[]>(crossChainRoutesLoadable.error)
    }

    return crossChainRoutesLoadable
  }

  static build(option: QuoteQuery, routes: Route[], get: AtomGetterFunction): QuoteContext {
    const { destinationBlockNumber, gasLimitDestinationChain, infinitySwap, infinityStableSwap, ..._option } = option

    const swapState = get(swapReducerAtom) as SwapReducerState
    const { account: evmAccount, solanaAccount } = get(accountActiveChainAtom) as AccountChainState

    const account = isSolana(_option.currency?.chainId) ? solanaAccount : evmAccount

    const recipientOnDestChain = (swapState.recipient === null ? account : swapState.recipient) || undefined

    if (!_option.amount || !_option.currency) {
      throw new Error('Missing required amount or currency in option')
    }

    const userSlippage = get(userSlippageAtomWithLocalStorage) as number
    const baseCurrencyAmount = _option.amount
    const quoteCurrency = _option.currency

    const tokenMap = get(combinedTokenMapFromActiveUrlsAtom) as TokenAddressMap<ChainId>

    return {
      routes,
      userSlippage,
      baseCurrencyAmount,
      quoteCurrency,
      tokenMap,
      atomGetters: {
        getBridgeQuote: (params: BridgeQuoteParams) =>
          get(
            isSolana(params.inputAmount.currency.chainId) || isSolana(params.outputCurrency.chainId)
              ? solanaBridgeQuoteAtom({
                  inputAmount: params.inputAmount,
                  outputCurrency: params.outputCurrency,
                  nonce: _option.nonce,
                  commands: params.commands,
                  recipientOnDestChain,
                })
              : bridgeOnlyQuoteAtom({
                  inputAmount: params.inputAmount,
                  outputCurrency: params.outputCurrency,
                  nonce: _option.nonce,
                  commands: params.commands,
                  recipientOnDestChain,
                }),
          ),
        getSwapQuote: (swapOption: Partial<QuoteQuery>) => {
          const isDestinationSwap = quoteCurrency.chainId === swapOption.baseCurrency?.chainId

          // Create a modified option for the swap quote
          const customSwapOption = {
            ..._option,
            blockNumber: isDestinationSwap && destinationBlockNumber ? destinationBlockNumber : _option.blockNumber,
            gasLimit: isDestinationSwap && gasLimitDestinationChain ? gasLimitDestinationChain : _option.gasLimit,
            hash: '',
            placeholderHash: '',
            infinitySwap,
            infinityStableSwap,
            // Disable xSwap is not supported for cross chain swap
            xEnabled: false,
            ...swapOption,
          }

          // Only support swap to bridge for bsc chain
          if (
            customSwapOption.infinitySwap &&
            customSwapOption.baseCurrency?.chainId &&
            !CROSSCHAIN_INFINITY_SWAP_SUPPORTED_CHAINS.includes(customSwapOption.baseCurrency?.chainId)
          ) {
            customSwapOption.infinitySwap = false
          }

          // Apply the same chain support check for infinityStableSwap
          if (
            customSwapOption.infinityStableSwap &&
            customSwapOption.baseCurrency?.chainId &&
            !CROSSCHAIN_INFINITY_SWAP_SUPPORTED_CHAINS.includes(customSwapOption.baseCurrency?.chainId)
          ) {
            customSwapOption.infinityStableSwap = false
          }

          const quoteQuery = createQuoteQuery(customSwapOption)

          return get(bestSameChainWithoutPlaceHolderAtom(quoteQuery))
        },
      },
    }
  }
}
