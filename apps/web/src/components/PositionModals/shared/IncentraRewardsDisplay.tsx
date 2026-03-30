import { useTranslation } from '@pancakeswap/localization'
import { Button, FlexGap, PreTitle, Text, OpenNewIcon } from '@pancakeswap/uikit'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { useIncentraInfo } from 'hooks/useIncentra'
import { getIncentraLink, INCENTRA_USER_LINK } from 'utils/getIncentraLink'
import { Address } from 'viem'

interface IncentraRewardsDisplayProps {
  poolAddress?: string
  chainId?: number
}

export function IncentraRewardsDisplay({ poolAddress, chainId }: IncentraRewardsDisplayProps) {
  const { t } = useTranslation()
  const { hasIncentra, incentraCampaignType } = useIncentraInfo(poolAddress)

  if (!hasIncentra) return null

  const incentraLink = getIncentraLink({
    hasIncentra,
    chainId,
    lpAddress: poolAddress as Address,
    campaignType: incentraCampaignType,
  })

  return (
    <>
      <LightGreyCard mt="16px" padding="16px" borderRadius="24px" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <PreTitle color="secondary" mb="8px">
          {t('Incentra Rewards')}
        </PreTitle>

        <Text small color="textSubtle">
          {t("This pool has active Incentra rewards. Claim on Incentra's website.")}
        </Text>
      </LightGreyCard>

      <Button
        as="a"
        href={incentraLink ?? INCENTRA_USER_LINK}
        target="_blank"
        rel="noopener noreferrer"
        mt="16px"
        width="100%"
        variant="primary60Outline"
      >
        <FlexGap gap="4px" alignItems="center">
          {t('Claim on Incentra')}
          <OpenNewIcon width="16px" color="currentColor" />
        </FlexGap>
      </Button>
    </>
  )
}
