import { UnifiedCurrency } from '@pancakeswap/sdk'
import { useModal } from '@pancakeswap/uikit'
import { useCallback, useEffect, useState } from 'react'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { EMPTY_RISK_TOKEN_MAP, getCurrencyRiskEntry, useRiskTokenConfigMap, useTokenRisk } from 'hooks/useTokenRisk'
import SwapWarningModal from 'views/Swap/components/SwapWarningModal'

export default function useWarningLiquidity(currencyIdA?: string, currencyIdB?: string) {
  const currencyA = useUnifiedCurrency(currencyIdA)
  const currencyB = useUnifiedCurrency(currencyIdB)
  const [warningCurrency, setWarningCurrency] = useState<UnifiedCurrency | null>(null)
  const [warningTitle, setWarningTitle] = useState<string | undefined>(undefined)
  const [warningReason, setWarningReason] = useState<string | undefined>(undefined)
  const { data: riskTokenMap = EMPTY_RISK_TOKEN_MAP } = useRiskTokenConfigMap()
  const { tokenRiskA, tokenRiskB } = useTokenRisk(currencyA, currencyB)

  const [onPresentWarningModal] = useModal(
    <SwapWarningModal swapCurrency={warningCurrency as any} title={warningTitle} reason={warningReason} />,
    false,
  )

  useEffect(() => {
    if (warningCurrency) {
      onPresentWarningModal()
    }
  }, [warningCurrency, onPresentWarningModal])

  useEffect(() => {
    if (currencyA && tokenRiskA?.severity === 'warn') {
      setWarningCurrency(currencyA)
      setWarningTitle(tokenRiskA.title)
      setWarningReason(tokenRiskA.reason)
    } else if (currencyB && tokenRiskB?.severity === 'warn') {
      setWarningCurrency(currencyB)
      setWarningTitle(tokenRiskB.title)
      setWarningReason(tokenRiskB.reason)
    } else {
      setWarningCurrency(null)
      setWarningTitle(undefined)
      setWarningReason(undefined)
    }
  }, [currencyA, currencyB, tokenRiskA, tokenRiskB])

  const warningHandler = useCallback(
    (currency?: UnifiedCurrency) => {
      const risk = getCurrencyRiskEntry(riskTokenMap, currency)
      if (risk?.severity === 'warn') {
        setWarningCurrency(currency || null)
        setWarningTitle(risk.title)
        setWarningReason(risk.reason)
      } else {
        setWarningCurrency(null)
        setWarningTitle(undefined)
        setWarningReason(undefined)
      }
    },
    [riskTokenMap],
  )

  return warningHandler
}
