import { Currency } from '@pancakeswap/sdk'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ACCESS_TOKEN_SUPPORT_CHAIN_IDS } from 'components/AccessRisk/config/supportedChains'
import { fetchRiskToken, RiskTokenInfo } from 'components/AccessRisk/utils/fetchTokenRisk'
import { RISK_TOKEN_CONFIG_URL } from 'config/constants/riskTokenConfig'
import { wrappedCurrency } from 'utils/wrappedCurrency'

export type RiskSeverity = 'warn' | 'block'

export type RiskTokenEntry = {
  chainId: number
  address: string
  symbol: string
  title?: string
  severity: RiskSeverity
  reason?: string
}

type RiskTokenMap = Record<string, RiskTokenEntry>
const THIRD_PARTY_WARN_RISK_LEVEL = 3

const toKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`

const isRiskEntry = (value: unknown): value is RiskTokenEntry => {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<RiskTokenEntry>
  return (
    typeof entry.chainId === 'number' &&
    typeof entry.address === 'string' &&
    typeof entry.symbol === 'string' &&
    (entry.title === undefined || typeof entry.title === 'string') &&
    (entry.severity === 'warn' || entry.severity === 'block') &&
    (entry.reason === undefined || typeof entry.reason === 'string')
  )
}

const fetchRiskTokenConfig = async (): Promise<RiskTokenMap> => {
  try {
    const response = await fetch(RISK_TOKEN_CONFIG_URL)
    if (!response.ok) {
      return {}
    }

    const data = await response.json()
    if (!Array.isArray(data)) {
      return {}
    }

    const map: RiskTokenMap = {}
    data.forEach((item) => {
      if (!isRiskEntry(item)) return

      const key = toKey(item.chainId, item.address)
      const prev = map[key]
      if (!prev || (prev.severity === 'warn' && item.severity === 'block')) {
        map[key] = item
      }
    })

    return map
  } catch {
    return {}
  }
}

export const getCurrencyRiskEntry = (
  riskTokenMap: RiskTokenMap,
  currency?: Currency | null,
): RiskTokenEntry | undefined => {
  if (!currency) return undefined
  const wrapped = wrappedCurrency(currency, currency.chainId)
  if (!wrapped) return undefined

  return riskTokenMap[toKey(wrapped.chainId, wrapped.address)]
}

export function useRiskTokenConfigMap() {
  return useQuery({
    queryKey: ['risk-token-config', RISK_TOKEN_CONFIG_URL],
    queryFn: fetchRiskTokenConfig,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useTokenRisk(currencyA?: Currency | null, currencyB?: Currency | null) {
  const { data: riskTokenMap = {}, isLoading: isConfigLoading } = useRiskTokenConfigMap()

  const wrappedA = currencyA ? wrappedCurrency(currencyA, currencyA.chainId) : undefined
  const wrappedB = currencyB ? wrappedCurrency(currencyB, currencyB.chainId) : undefined

  const [thirdPartyRiskAQuery, thirdPartyRiskBQuery] = useQueries({
    queries: [
      {
        queryKey: ['third-party-risk', wrappedA?.chainId, wrappedA?.address],
        queryFn: () => fetchRiskToken(wrappedA!.address, wrappedA!.chainId),
        enabled: Boolean(wrappedA && ACCESS_TOKEN_SUPPORT_CHAIN_IDS.includes(wrappedA.chainId)),
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ['third-party-risk', wrappedB?.chainId, wrappedB?.address],
        queryFn: () => fetchRiskToken(wrappedB!.address, wrappedB!.chainId),
        enabled: Boolean(wrappedB && ACCESS_TOKEN_SUPPORT_CHAIN_IDS.includes(wrappedB.chainId)),
        staleTime: 30 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    ],
  })

  const mergeTokenRisk = (
    cmsRisk: RiskTokenEntry | undefined,
    thirdPartyRisk: RiskTokenInfo | undefined,
    symbol?: string,
  ): RiskTokenEntry | undefined => {
    if (cmsRisk) return cmsRisk

    const shouldWarnByThirdParty =
      thirdPartyRisk &&
      !thirdPartyRisk.isError &&
      thirdPartyRisk.hasResult &&
      thirdPartyRisk.riskLevel >= THIRD_PARTY_WARN_RISK_LEVEL

    if (!shouldWarnByThirdParty) return undefined

    return {
      chainId: thirdPartyRisk.chainId,
      address: thirdPartyRisk.address,
      symbol: symbol ?? '',
      severity: 'warn',
      reason: thirdPartyRisk.riskLevelDescription || undefined,
    }
  }

  const tokenRiskA = mergeTokenRisk(
    getCurrencyRiskEntry(riskTokenMap, currencyA),
    thirdPartyRiskAQuery.data,
    wrappedA?.symbol,
  )
  const tokenRiskB = mergeTokenRisk(
    getCurrencyRiskEntry(riskTokenMap, currencyB),
    thirdPartyRiskBQuery.data,
    wrappedB?.symbol,
  )

  const shouldBlock = tokenRiskA?.severity === 'block' || tokenRiskB?.severity === 'block'
  const shouldWarn = !shouldBlock && (tokenRiskA?.severity === 'warn' || tokenRiskB?.severity === 'warn')

  return {
    tokenRiskA,
    tokenRiskB,
    warningToken:
      tokenRiskA?.severity === 'warn'
        ? currencyA ?? undefined
        : tokenRiskB?.severity === 'warn'
        ? currencyB ?? undefined
        : undefined,
    blockedToken:
      tokenRiskA?.severity === 'block'
        ? currencyA ?? undefined
        : tokenRiskB?.severity === 'block'
        ? currencyB ?? undefined
        : undefined,
    shouldWarn,
    shouldBlock,
    isLoading: isConfigLoading || thirdPartyRiskAQuery.isLoading || thirdPartyRiskBQuery.isLoading,
  }
}
