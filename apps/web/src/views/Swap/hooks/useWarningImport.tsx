import { Currency, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { useModal } from '@pancakeswap/uikit'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'

import ImportTokenWarningModal from 'components/ImportTokenWarningModal'
import { useAllTokens, useCurrency } from 'hooks/Tokens'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { safeGetAddress } from 'utils'

import { useActiveChainId } from 'hooks/useActiveChainId'
import { getCurrencyRiskEntry, useRiskTokenConfigMap, useTokenRisk } from 'hooks/useTokenRisk'
import { usePreviousValue } from '@pancakeswap/hooks'
import SwapWarningModal from '../components/SwapWarningModal'

export default function useWarningImport() {
  const router = useRouter()
  const { chainId, isWrongNetwork } = useActiveChainId()
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
  } = useSwapState()

  // swap warning state
  const [swapWarningCurrency, setSwapWarningCurrency] = useState<any>(null)
  const [swapWarningTitle, setSwapWarningTitle] = useState<string | undefined>(undefined)
  const [swapWarningReason, setSwapWarningReason] = useState<string | undefined>(undefined)

  // token warning stuff
  const [loadedInputCurrency, loadedOutputCurrency] = [useCurrency(inputCurrencyId), useCurrency(outputCurrencyId)]

  const urlLoadedTokens: Token[] = useMemo(
    () => [loadedInputCurrency, loadedOutputCurrency]?.filter((c): c is Token => Boolean(c?.isToken)) ?? [],
    [loadedInputCurrency, loadedOutputCurrency],
  )

  const prevInputCurrency = usePreviousValue(loadedInputCurrency)
  const prevOutputCurrency = usePreviousValue(loadedOutputCurrency)

  const defaultTokens = useAllTokens()

  const { data: loadedTokenList } = useQuery({
    queryKey: ['token-list'],
  })

  const importTokensNotInDefault = useMemo(() => {
    return !isWrongNetwork && urlLoadedTokens && !!loadedTokenList
      ? urlLoadedTokens.filter((token: Token) => {
          const checksummedAddress = safeGetAddress(token.address) || ''

          return !(checksummedAddress in defaultTokens) && token.chainId === chainId
        })
      : []
  }, [chainId, defaultTokens, isWrongNetwork, loadedTokenList, urlLoadedTokens])

  const [onPresentSwapWarningModal] = useModal(
    <SwapWarningModal swapCurrency={swapWarningCurrency} title={swapWarningTitle} reason={swapWarningReason} />,
    false,
  )
  const [onPresentImportTokenWarningModal] = useModal(
    <ImportTokenWarningModal tokens={importTokensNotInDefault} onCancel={() => router.push('/swap')} />,
  )

  useEffect(() => {
    if (swapWarningCurrency) {
      onPresentSwapWarningModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapWarningCurrency])

  const { data: riskTokenMap = {} } = useRiskTokenConfigMap()
  const { tokenRiskA: inputRisk, tokenRiskB: outputRisk } = useTokenRisk(loadedInputCurrency, loadedOutputCurrency)

  const swapWarningHandler = useCallback(
    (currencyInput?: UnifiedCurrency) => {
      const evmCurrency =
        currencyInput && (currencyInput as Token).isToken ? (currencyInput as unknown as Currency) : undefined
      const risk = getCurrencyRiskEntry(riskTokenMap, evmCurrency)
      if (risk?.severity === 'warn') {
        setSwapWarningCurrency(currencyInput)
        setSwapWarningTitle(risk.title)
        setSwapWarningReason(risk.reason)
      } else {
        setSwapWarningCurrency(null)
        setSwapWarningTitle(undefined)
        setSwapWarningReason(undefined)
      }
    },
    [riskTokenMap],
  )

  useEffect(() => {
    if (loadedInputCurrency && loadedInputCurrency !== prevInputCurrency && inputRisk?.severity === 'warn') {
      setSwapWarningCurrency(loadedInputCurrency)
      setSwapWarningTitle(inputRisk.title)
      setSwapWarningReason(inputRisk.reason)
      return
    }

    if (loadedOutputCurrency && loadedOutputCurrency !== prevOutputCurrency && outputRisk?.severity === 'warn') {
      setSwapWarningCurrency(loadedOutputCurrency)
      setSwapWarningTitle(outputRisk.title)
      setSwapWarningReason(outputRisk.reason)
      return
    }

    setSwapWarningCurrency(null)
    setSwapWarningTitle(undefined)
    setSwapWarningReason(undefined)
  }, [inputRisk, loadedInputCurrency, loadedOutputCurrency, outputRisk, prevInputCurrency, prevOutputCurrency])

  useEffect(() => {
    if (importTokensNotInDefault.length > 0) {
      onPresentImportTokenWarningModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importTokensNotInDefault.length])

  return swapWarningHandler
}
