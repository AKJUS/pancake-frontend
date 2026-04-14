import { Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { ModalV2, useModal, useModalV2 } from '@pancakeswap/uikit'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'

import ImportTokenWarningModal from 'components/ImportTokenWarningModal'
import { useAllTokens, useCurrency } from 'hooks/Tokens'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { safeGetAddress } from 'utils'

import { useActiveChainId } from 'hooks/useActiveChainId'
import { useTokenRisk } from 'hooks/useTokenRisk'
import SwapWarningModal from '../components/SwapWarningModal'

export default function useWarningImport() {
  const router = useRouter()
  const { chainId, isWrongNetwork } = useActiveChainId()
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
  } = useSwapState()

  // swap warning state
  const [swapWarningState, setSwapWarningState] = useState<{
    currency: UnifiedCurrency
    title?: string
    reason?: string
    source?: 'cms' | 'thirdParty'
  } | null>(null)
  const [acknowledgedWarningKeys, setAcknowledgedWarningKeys] = useState<Record<string, true>>({})
  const { isOpen: isSwapWarningOpen, onOpen: openSwapWarningModal, onDismiss: dismissSwapWarningModal } = useModalV2()

  // token warning stuff
  const [loadedInputCurrency, loadedOutputCurrency] = [useCurrency(inputCurrencyId), useCurrency(outputCurrencyId)]

  const urlLoadedTokens: Token[] = useMemo(
    () => [loadedInputCurrency, loadedOutputCurrency]?.filter((c): c is Token => Boolean(c?.isToken)) ?? [],
    [loadedInputCurrency, loadedOutputCurrency],
  )

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

  const getCurrencyKey = useCallback((currency?: UnifiedCurrency | null) => {
    return currency && (currency as Token).isToken
      ? `${currency.chainId}:${(currency as Token).address.toLowerCase()}`
      : null
  }, [])

  const clearSwapWarning = useCallback(() => {
    setSwapWarningState(null)
    dismissSwapWarningModal()
  }, [dismissSwapWarningModal])

  const acknowledgeSwapWarning = useCallback(() => {
    const key = getCurrencyKey(swapWarningState?.currency)
    if (key) {
      setAcknowledgedWarningKeys((prev) => ({ ...prev, [key]: true }))
    }
    clearSwapWarning()
  }, [clearSwapWarning, getCurrencyKey, swapWarningState?.currency])

  const [onPresentImportTokenWarningModal] = useModal(
    <ImportTokenWarningModal tokens={importTokensNotInDefault} onCancel={() => router.push('/swap')} />,
  )

  const presentSwapWarning = useCallback(
    (currency: UnifiedCurrency, title?: string, reason?: string, source?: 'cms' | 'thirdParty') => {
      setSwapWarningState({ currency, title, reason, source })
      openSwapWarningModal()
    },
    [openSwapWarningModal],
  )

  const { tokenRiskA: inputRisk, tokenRiskB: outputRisk } = useTokenRisk(loadedInputCurrency, loadedOutputCurrency)

  useEffect(() => {
    const inputWarningKey = getCurrencyKey(loadedInputCurrency)
    const outputWarningKey = getCurrencyKey(loadedOutputCurrency)
    const activeWarningKey = getCurrencyKey(swapWarningState?.currency)

    if (
      loadedInputCurrency &&
      inputRisk?.severity === 'warn' &&
      inputWarningKey &&
      !acknowledgedWarningKeys[inputWarningKey]
    ) {
      if (activeWarningKey === inputWarningKey && isSwapWarningOpen) {
        return
      }

      presentSwapWarning(loadedInputCurrency, inputRisk.title, inputRisk.reason, inputRisk.source)
      return
    }

    if (
      loadedOutputCurrency &&
      outputRisk?.severity === 'warn' &&
      outputWarningKey &&
      !acknowledgedWarningKeys[outputWarningKey]
    ) {
      if (activeWarningKey === outputWarningKey && isSwapWarningOpen) {
        return
      }

      presentSwapWarning(loadedOutputCurrency, outputRisk.title, outputRisk.reason, outputRisk.source)
    }
  }, [
    acknowledgedWarningKeys,
    getCurrencyKey,
    inputRisk,
    isSwapWarningOpen,
    loadedInputCurrency,
    loadedOutputCurrency,
    outputRisk,
    presentSwapWarning,
    swapWarningState?.currency,
  ])

  useEffect(() => {
    if (!swapWarningState) {
      return
    }

    const warningKey = getCurrencyKey(swapWarningState.currency)
    const inputWarningKey = getCurrencyKey(loadedInputCurrency)
    const outputWarningKey = getCurrencyKey(loadedOutputCurrency)

    if (warningKey && warningKey !== inputWarningKey && warningKey !== outputWarningKey) {
      clearSwapWarning()
    }
  }, [clearSwapWarning, getCurrencyKey, loadedInputCurrency, loadedOutputCurrency, swapWarningState])

  useEffect(() => {
    if (importTokensNotInDefault.length > 0) {
      onPresentImportTokenWarningModal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importTokensNotInDefault.length])

  const warningModalNode: ReactNode = swapWarningState ? (
    <ModalV2 isOpen={isSwapWarningOpen} onDismiss={clearSwapWarning} closeOnOverlayClick={false}>
      <SwapWarningModal
        swapCurrency={swapWarningState.currency as any}
        title={swapWarningState.title}
        reason={swapWarningState.reason}
        source={swapWarningState.source}
        onAcknowledge={acknowledgeSwapWarning}
      />
    </ModalV2>
  ) : null

  return warningModalNode
}
