import { Currency, Native, SOL, Trade, TradeType, UnifiedNativeCurrency } from '@pancakeswap/sdk'
import { CAKE, STABLE_COIN, USDC, USDT } from '@pancakeswap/tokens'
import { PairDataTimeWindowEnum } from '@pancakeswap/uikit'
import { isAptos, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { useQuery } from '@tanstack/react-query'
import { getChainId } from 'config/chains'
import { DEFAULT_INPUT_CURRENCY } from 'config/constants/exchange'
import dayjs from 'dayjs'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useUnifiedNativeCurrency } from 'hooks/useNativeCurrency'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useAtom, useAtomValue } from 'jotai'
import { useRouter } from 'next/router'
import { ParsedUrlQuery } from 'querystring'
import { useCallback, useEffect, useState } from 'react'
import { ChartPeriod, chainIdToExplorerInfoChainName, explorerApiClient } from 'state/info/api/client'
import { isAddressEqual, safeGetAddress, safeGetUnifiedAddress } from 'utils'
import { useBridgeAvailableChains } from 'views/Swap/Bridge/hooks'
import { Field, replaceSwapState } from './actions'
import { SwapState, swapReducerAtom } from './reducer'

export function useSwapState() {
  return useAtomValue(swapReducerAtom)
}

function parseTokenAmountURLParameter(urlParam: any): string {
  return typeof urlParam === 'string' && !Number.isNaN(parseFloat(urlParam)) ? urlParam : ''
}

function parseIndependentFieldURLParameter(urlParam: any): Field {
  return typeof urlParam === 'string' && urlParam.toLowerCase() === 'output' ? Field.OUTPUT : Field.INPUT
}

const ENS_NAME_REGEX = /^[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)?$/

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
function validatedRecipient(recipient: any): string | null {
  if (typeof recipient !== 'string') return null
  const address = safeGetAddress(recipient)
  if (address) return address
  if (ENS_NAME_REGEX.test(recipient)) return recipient
  if (ADDRESS_REGEX.test(recipient)) return recipient
  return null
}

function getNativeCurrency(chainId?: UnifiedChainId) {
  if (!chainId) {
    return undefined
  }
  if (chainId === NonEVMChainId.SOLANA) {
    return SOL
  }
  return Native.onChain(chainId)
}

export function queryParametersToSwapState(
  parsedQs: ParsedUrlQuery,
  nativeSymbol?: string,
  defaultOutputCurrency?: string,
): SwapState {
  // Parse chains
  const inputChain = parsedQs.chain
  // NOTE: if chainOut is not provided, means user want to swap on the same chain
  const outputChain = parsedQs.chainOut || inputChain

  const inputChainId =
    typeof inputChain === 'string' && !isAptos(getChainId(inputChain)) ? getChainId(inputChain) : undefined
  const outputChainId =
    typeof outputChain === 'string' && !isAptos(getChainId(outputChain)) ? getChainId(outputChain) : undefined

  const recipient = validatedRecipient(parsedQs.recipient)

  // Parse currencies
  let inputCurrency =
    safeGetUnifiedAddress(inputChainId, parsedQs.inputCurrency) ||
    getNativeCurrency(inputChainId)?.symbol ||
    nativeSymbol ||
    DEFAULT_INPUT_CURRENCY
  let outputCurrency =
    typeof parsedQs.outputCurrency === 'string'
      ? safeGetUnifiedAddress(outputChainId, parsedQs.outputCurrency) ||
        getNativeCurrency(outputChainId)?.symbol ||
        nativeSymbol
      : defaultOutputCurrency
  if (inputCurrency === outputCurrency && inputChainId === outputChainId) {
    if (typeof parsedQs.outputCurrency === 'string') {
      inputCurrency = ''
    } else {
      outputCurrency = ''
    }
  }

  return {
    [Field.INPUT]: {
      currencyId: inputCurrency,
      chainId: inputChainId,
    },
    [Field.OUTPUT]: {
      currencyId: outputCurrency,
      chainId: outputChainId,
    },
    typedValue: parseTokenAmountURLParameter(parsedQs.exactAmount),
    independentField: parseIndependentFieldURLParameter(parsedQs.exactField),
    recipient,
  }
}

export function normalizeCurrencySelectionForChain({
  inputCurrencyId,
  inputChainId,
  outputCurrencyId,
  outputChainId,
  native,
  pathname,
  supportedBridgeChains,
  chainId,
  defaultOutputCurrency,
}: {
  inputCurrencyId?: string
  inputChainId?: number
  outputCurrencyId?: string
  outputChainId?: number
  native: UnifiedNativeCurrency
  pathname: string
  supportedBridgeChains: UnifiedChainId[]
  chainId: number
  defaultOutputCurrency: string
}) {
  let finalInputCurrencyId = inputCurrencyId
  let finalInputChainId = inputChainId
  let finalOutputCurrencyId = outputCurrencyId
  let finalOutputChainId = outputChainId

  // not support pages bridge
  const isNotTwapOrLimitPath = !['twap', 'limit'].some((p) => pathname.includes(p))

  // Set input currency to default (native currency) if chain is changed by user
  // and input currency is on different chain
  if (finalInputChainId && finalInputChainId !== chainId) {
    finalInputCurrencyId = native.symbol
    finalInputChainId = chainId

    const isOutputChainSupported =
      finalOutputChainId &&
      isNotTwapOrLimitPath &&
      supportedBridgeChains.includes(finalInputChainId) &&
      supportedBridgeChains.includes(finalOutputChainId)

    // If now input and output currencies are the same,
    // OR if output chain is NOT supported by the bridge,
    // set output currency to the default value
    if (
      !isOutputChainSupported ||
      (finalOutputCurrencyId === finalInputCurrencyId && finalOutputChainId === finalInputChainId)
    ) {
      finalOutputCurrencyId = defaultOutputCurrency
      finalOutputChainId = chainId
    }
  }

  if (finalOutputChainId && finalOutputChainId !== chainId) {
    const isOutputChainSupported =
      isNotTwapOrLimitPath &&
      supportedBridgeChains?.find((id) => id === finalInputChainId || id === chainId) &&
      supportedBridgeChains?.includes(finalOutputChainId)

    if (!isOutputChainSupported) {
      finalOutputCurrencyId = defaultOutputCurrency
      finalOutputChainId = chainId
    }
  }

  // If input and output currencies are the same, set output currency to native currency (other default currency)
  if (finalInputCurrencyId === finalOutputCurrencyId && finalOutputChainId === finalInputChainId) {
    if (finalOutputCurrencyId !== native.symbol) {
      finalOutputCurrencyId = native.symbol
    } else {
      finalOutputCurrencyId = defaultOutputCurrency
    }
  }

  return {
    finalInputCurrencyId,
    finalOutputCurrencyId,
    finalInputChainId,
    finalOutputChainId,
  }
}

// updates the swap state to use the defaults for a given network
export function useDefaultsFromURLSearch():
  | { inputCurrencyId: string | undefined; outputCurrencyId: string | undefined }
  | undefined {
  const { chainId } = useAccountActiveChain()
  const [, dispatch] = useAtom(swapReducerAtom)
  const native = useUnifiedNativeCurrency()
  const { query, pathname, isReady } = useRouter()
  const [result, setResult] = useState<
    | {
        inputCurrencyId: string | undefined
        outputCurrencyId: string | undefined
        inputChainId: number | undefined
        outputChainId: number | undefined
      }
    | undefined
  >()

  const { chains: supportedBridgeChains, loading: isSupportedBridgePending } = useBridgeAvailableChains({
    originChainId: chainId,
  })

  useEffect(() => {
    if (!chainId || !native || !isReady) return

    const defaultOutputCurrency =
      CAKE[chainId]?.address ?? STABLE_COIN[chainId]?.address ?? USDC[chainId]?.address ?? USDT[chainId]?.address

    const parsed = queryParametersToSwapState(query, native.symbol, defaultOutputCurrency)

    if (isSupportedBridgePending && parsed[Field.INPUT].chainId !== parsed[Field.OUTPUT].chainId) {
      return
    }

    const { finalInputCurrencyId, finalOutputCurrencyId, finalInputChainId, finalOutputChainId } =
      normalizeCurrencySelectionForChain({
        inputCurrencyId: parsed[Field.INPUT].currencyId,
        inputChainId: parsed[Field.INPUT].chainId,
        outputCurrencyId: parsed[Field.OUTPUT].currencyId,
        outputChainId: parsed[Field.OUTPUT].chainId,
        native,
        pathname,
        supportedBridgeChains,
        chainId,
        defaultOutputCurrency,
      })

    dispatch(
      replaceSwapState({
        typedValue: parsed.typedValue,
        field: parsed.independentField,
        inputCurrencyId: finalInputCurrencyId,
        outputCurrencyId: finalOutputCurrencyId,
        inputChainId: finalInputChainId || chainId,
        outputChainId: finalOutputChainId || chainId,
        recipient: null,
      }),
    )

    setResult({
      inputCurrencyId: finalInputCurrencyId,
      outputCurrencyId: finalOutputCurrencyId,
      inputChainId: finalInputChainId || chainId,
      outputChainId: finalOutputChainId || chainId,
    })
  }, [dispatch, chainId, query, native, isReady, pathname, supportedBridgeChains, isSupportedBridgePending])

  return result
}

type useFetchPairPricesParams = {
  token0Address: string
  token1Address: string
  timeWindow: PairDataTimeWindowEnum
  currentSwapPrice: {
    [key: string]: number
  }
}

const timeWindowToPeriod = (timeWindow: PairDataTimeWindowEnum): ChartPeriod => {
  switch (timeWindow) {
    case PairDataTimeWindowEnum.HOUR:
      return '1H'
    case PairDataTimeWindowEnum.DAY:
      return '1D'
    case PairDataTimeWindowEnum.WEEK:
      return '1W'
    case PairDataTimeWindowEnum.MONTH:
      return '1M'
    case PairDataTimeWindowEnum.YEAR:
      return '1Y'
    default:
      throw new Error('Invalid time window')
  }
}

export const usePairRate = ({
  token0Address,
  token1Address,
  timeWindow,
  currentSwapPrice,
}: useFetchPairPricesParams) => {
  const { chainId } = useActiveChainId()

  const chainName = chainIdToExplorerInfoChainName[chainId]

  return useQuery({
    queryKey: ['pair-rate', { token0Address, token1Address, chainId, timeWindow }],
    enabled: Boolean(token0Address && token1Address && chainId && chainName),
    queryFn: async ({ signal }) => {
      return explorerApiClient
        .GET('/cached/tokens/chart/{chainName}/rate', {
          signal,
          params: {
            path: {
              chainName,
            },

            query: {
              period: timeWindowToPeriod(timeWindow),
              tokenA: token0Address,
              tokenB: token1Address,
            },
          },
        })
        .then((res) => res.data)
    },
    select: useCallback(
      (data_) => {
        if (!data_) {
          throw new Error('No data')
        }
        const hasSwapPrice = currentSwapPrice && currentSwapPrice[token0Address] > 0

        const formatted = data_.map((d) => ({
          time: dayjs(d.bucket as string).toDate(),
          open: d.open ? +d.open : 0,
          close: d.close ? +d.close : 0,
          low: d.low ? +d.low : 0,
          high: d.high ? +d.high : 0,
          value: d.close ? +d.close : 0,
        }))
        if (hasSwapPrice) {
          return [...formatted, { time: new Date(), value: currentSwapPrice[token0Address] }]
        }
        return formatted
      },
      [currentSwapPrice, token0Address],
    ),
  })
}
