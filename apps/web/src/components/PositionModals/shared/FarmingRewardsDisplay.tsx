import { useTranslation } from '@pancakeswap/localization'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { Button, FlexGap, PreTitle, RowBetween, Text } from '@pancakeswap/uikit'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { CurrencyLogo, LightGreyCard } from '@pancakeswap/widgets-internal'

interface FarmingRewardsDisplayProps {
  rewardToken: Currency
  rewardsAmount: number | string
  rewardsUSD: number
  onHarvest: () => void
  harvesting: boolean
  disabled: boolean
  hideButton?: boolean
}

export function FarmingRewardsDisplay({
  rewardToken,
  rewardsAmount,
  rewardsUSD,
  onHarvest,
  harvesting,
  disabled,
  hideButton,
}: FarmingRewardsDisplayProps) {
  const { t } = useTranslation()

  return (
    <>
      <LightGreyCard padding="16px" borderRadius="24px" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <PreTitle color="secondary" mb="8px">
          {t('Farming Rewards')}
        </PreTitle>
        <Text fontSize="32px" bold lineHeight={1.2} letterSpacing="-0.32px">
          {formatFiatNumber(rewardsUSD)}
        </Text>

        <RowBetween mt="8px">
          <FlexGap gap="8px" alignItems="center">
            <CurrencyLogo currency={rewardToken} size="24px" />
            <Text small>{formatNumber(rewardsAmount)}</Text>
            <Text small color="textSubtle">
              {rewardToken.symbol}
            </Text>
          </FlexGap>
          <Text small>{formatFiatNumber(rewardsUSD)}</Text>
        </RowBetween>
      </LightGreyCard>

      {hideButton ? null : (
        <Button mt="16px" width="100%" disabled={disabled} onClick={onHarvest}>
          {harvesting ? t('Harvesting...') : t('Harvest')}
        </Button>
      )}
    </>
  )
}
