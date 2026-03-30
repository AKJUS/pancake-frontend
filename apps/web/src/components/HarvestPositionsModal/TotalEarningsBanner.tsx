import { useTranslation } from '@pancakeswap/localization'
import { Button, Flex, FlexGap, Text } from '@pancakeswap/uikit'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import styled from 'styled-components'

const BannerCard = styled(Flex)`
  background: ${({ theme }) => theme.card.background};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: 24px;
  padding: 8px 16px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`

interface TotalEarningsBannerProps {
  totalEarningsUSD: number
  onHarvest: () => void
  disabled?: boolean
}

export function TotalEarningsBanner({ totalEarningsUSD, onHarvest, disabled }: TotalEarningsBannerProps) {
  const { t } = useTranslation()

  return (
    <BannerCard>
      <FlexGap flexDirection="column" gap="0px">
        <Text fontSize="14px" color="textSubtle">
          {t('My Total Earnings')}
        </Text>
        <Text fontSize="24px" bold letterSpacing="-0.24px">
          {formatFiatNumber(totalEarningsUSD)}
        </Text>
      </FlexGap>
      <Button
        variant="secondary"
        scale="md"
        onClick={onHarvest}
        disabled={disabled || totalEarningsUSD <= 0}
        style={{ minWidth: '106px' }}
      >
        {t('Harvest')}
      </Button>
    </BannerCard>
  )
}
