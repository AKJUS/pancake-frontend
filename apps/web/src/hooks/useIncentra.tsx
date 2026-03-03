import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { isAddressEqual } from 'utils'

export const INCENTRA_API = 'https://incentra-prd.brevis.network/sdk/v1'
export const INCENTRA_CAMPAIGN_TYPES = [3, 4, 8] as const
export const DEFAULT_INCENTRA_CAMPAIGN_TYPE = 3
export const INCENTRA_CAMPAIGN_TYPE_ENUM_TO_ID: Record<string, number> = {
  PANCAKE_V2: 4,
  PANCAKE_V3: 3,
  PANCAKE_V4_CL: 8,
}

export const parseIncentraCampaignType = (campaignType?: string | number): number | undefined => {
  const normalized = typeof campaignType === 'string' ? campaignType.trim() : campaignType

  if (typeof normalized === 'number' && Number.isFinite(normalized)) return normalized

  if (typeof normalized === 'string') {
    const numericType = Number(normalized)
    if (Number.isFinite(numericType)) return numericType

    return INCENTRA_CAMPAIGN_TYPE_ENUM_TO_ID[normalized]
  }

  return undefined
}

export type IncentraCampaign = {
  chainId: string
  campaignType: string
  pools: {
    poolId: string
    poolName: string
  }
  campaignId: string
  campaignName: string
  startTime: string
  endTime: string
  rewardInfo: {
    apr: number
    tokenAddress: string
    tokenSymbol: string
  }
  status: string
}

const isHexPoolId = (value?: string) => /^0x[0-9a-fA-F]+$/.test(value ?? '')

const normalizePoolId = (value?: string) => (value ? value.toLowerCase() : '')

/**
 * Incentra pool ids can be either:
 * - EVM address (0x + 40 hex), or
 * - Infinity pool id bytes32 (0x + 64 hex).
 */
const isPoolIdEqual = (a?: string, b?: string) => {
  if (!a || !b) return false

  // Preserve checksum-safe address compare for address-based pools.
  if (isAddressEqual(a, b)) return true

  // Fallback for bytes32/hex identifiers that are not valid EVM addresses.
  if (isHexPoolId(a) && isHexPoolId(b)) {
    return normalizePoolId(a) === normalizePoolId(b)
  }

  // Last fallback for non-hex identifiers.
  return a === b
}

export function useIncentraInfo(poolAddress?: string): {
  isPending: boolean
  hasIncentra: boolean
  incentraApr?: number
  incentraCampaignType?: number
  refreshData: () => void
} {
  const { data, isPending, refetch } = useQuery({
    queryKey: ['fetchIncentraPools'],
    queryFn: async () => {
      const res = await fetch(`${INCENTRA_API}/liquidityCampaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_type: INCENTRA_CAMPAIGN_TYPES, // PancakeSwap + Infinity campaigns
          status: [4], // ACTIVE
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to fetch Incentra campaigns')
      }

      const json = await res.json()

      if (json.err) {
        throw new Error(`Incentra API error: ${json.err}`)
      }

      return json?.campaigns as IncentraCampaign[]
    },
    enabled: Boolean(poolAddress),
    staleTime: Infinity,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  return useMemo(() => {
    if (!data || !poolAddress) {
      return {
        isPending,
        hasIncentra: false,
        incentraApr: undefined,
        incentraCampaignType: undefined,
        refreshData: refetch,
      }
    }

    const campaign = data.find((c) => isPoolIdEqual(c.pools.poolId, poolAddress))
    const campaignType = parseIncentraCampaignType(campaign?.campaignType)

    return {
      isPending,
      hasIncentra: Boolean(campaign),
      incentraApr: campaign?.rewardInfo?.apr,
      incentraCampaignType: campaignType,
      refreshData: refetch,
    }
  }, [data, poolAddress, isPending, refetch])
}
