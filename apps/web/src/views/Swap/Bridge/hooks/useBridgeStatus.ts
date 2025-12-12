import { UnifiedCurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { formatScientificToDecimal } from '@pancakeswap/utils/formatNumber'
import { useQuery } from '@tanstack/react-query'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { useMemo } from 'react'
import { getBridgeStatus } from '../api'
import { ActiveBridgeOrderMetadata, BridgeStatus, BridgeStatusData, BridgeStatusResponse, Command } from '../types'

export const bridgeStatusQueryKey = (chainId?: number, txHash?: string, destinationChainId?: number) => [
  'bridge-status',
  chainId,
  txHash,
  destinationChainId,
]

export const useBridgeStatus = (
  chainId?: number,
  txHash?: string,
  metadata?: ActiveBridgeOrderMetadata['metadata'],
  destinationChainId?: number,
  isMultisig?: boolean,
) => {
  const queryResult = useQuery({
    queryKey: bridgeStatusQueryKey(chainId, txHash, destinationChainId),
    queryFn: () => (chainId && txHash ? getBridgeStatus(chainId, txHash, destinationChainId) : undefined),
    refetchInterval: (query) =>
      !query.state.data ||
      query.state.data?.status === BridgeStatus.PENDING ||
      query.state.data?.status === BridgeStatus.BRIDGE_PENDING
        ? 3_000
        : 15_000,
    retry: 3,
    retryDelay: 1_000,
    enabled: !!chainId && !!txHash && !isMultisig,
    notifyOnChangeProps: ['data', 'isFetching'],
  })

  const data: BridgeStatusResponse | undefined = useMemo(
    () =>
      metadata
        ? {
            ...(metadata as BridgeStatusResponse),
            ...queryResult.data,
          }
        : queryResult.data,
    [metadata, queryResult.data],
  )

  const inputCurrency = useUnifiedCurrency(data?.inputToken, data?.originChainId)
  const outputCurrency = useUnifiedCurrency(data?.outputToken, data?.destinationChainId)

  const inputCurrencyAmount = useMemo(() => {
    if (!inputCurrency || !data || !data?.inputAmount) return undefined
    return UnifiedCurrencyAmount.fromRawAmount(inputCurrency, formatScientificToDecimal(data?.inputAmount))
  }, [inputCurrency, data])

  const outputCurrencyAmount = useMemo(() => {
    if (!outputCurrency || !data || !data?.outputAmount) return undefined
    return UnifiedCurrencyAmount.fromRawAmount(outputCurrency, formatScientificToDecimal(data?.outputAmount))
  }, [outputCurrency, data])

  const feesBreakdown = useMemo(() => {
    if (!data?.data?.length) return { totalFeesUSD: 0, swapFeesUSD: 0, bridgeFeesUSD: 0 }

    const bridgeFeesUSD = Number(data.data.find((item) => item.command === Command.BRIDGE)?.metadata?.fee) || 0

    const swapNotReadyYet = data.data.some((item) => {
      const fee = Number(item.metadata?.fee)

      // NOTE: Swap command will return undefined fee if PENDING
      // of return '0' (string) if not ready yet
      return item.command === Command.SWAP && (Number.isNaN(fee) || fee === 0)
    })

    const swapFeesUSD = swapNotReadyYet
      ? null
      : Number(
          data.data
            .filter((item) => item.command === Command.SWAP)
            .reduce((prev, curr) => prev + Number(curr.metadata?.fee), 0),
        ) || 0

    return {
      totalFeesUSD: (bridgeFeesUSD || 0) + (swapFeesUSD || 0),
      swapFeesUSD,
      bridgeFeesUSD,
    }
  }, [data])

  const bridgeStatusData: BridgeStatusData | undefined = useMemo(() => {
    if (!data) return undefined

    if (isMultisig) {
      return {
        ...data,
        inputCurrencyAmount,
        outputCurrencyAmount,
        feesBreakdown: { totalFeesUSD: 0, swapFeesUSD: 0, bridgeFeesUSD: 0 },
        bridgeStatus: BridgeStatus.MULTISIG_SUBMITTED,
      }
    }

    return {
      ...data,
      inputCurrencyAmount,
      outputCurrencyAmount,
      feesBreakdown,
      bridgeStatus: data.data?.find((item) => item.command === Command.BRIDGE)?.metadata?.bridgeStatus,
    }
  }, [data, inputCurrencyAmount, outputCurrencyAmount, feesBreakdown, isMultisig])

  return { data: bridgeStatusData, isLoading: queryResult.isFetching }
}
