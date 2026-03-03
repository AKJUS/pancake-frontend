import { ChainId } from '@pancakeswap/chains'
import { DEFAULT_INCENTRA_CAMPAIGN_TYPE, parseIncentraCampaignType } from 'hooks/useIncentra'
import memoize from 'lodash/memoize'
import { Address } from 'viem'

export const getIncentraLink = memoize(
  ({
    hasIncentra,
    chainId,
    lpAddress,
    campaignType,
  }: {
    hasIncentra: boolean
    chainId?: ChainId | number
    lpAddress?: Address
    campaignType?: number | string
  }): string | undefined => {
    if (!chainId || !lpAddress || !hasIncentra) return undefined
    const campaignTypeParam = parseIncentraCampaignType(campaignType) ?? DEFAULT_INCENTRA_CAMPAIGN_TYPE

    return `https://incentra.brevis.network/campaign/?pool_id=${lpAddress.toLowerCase()}&type=${campaignTypeParam}&chainId=${chainId}`
  },
  ({ hasIncentra, chainId, lpAddress, campaignType }) =>
    `${hasIncentra}:${chainId}:${lpAddress?.toLowerCase()}:${campaignType ?? ''}`,
)

export const INCENTRA_USER_LINK = 'https://incentra.brevis.network/dashboard/'
