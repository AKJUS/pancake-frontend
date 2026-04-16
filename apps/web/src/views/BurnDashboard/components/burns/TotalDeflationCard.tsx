import { useTranslation } from '@pancakeswap/localization'
import { Box, CardProps, Flex, FlexGap, InfoIcon, QuestionHelperV2, Text } from '@pancakeswap/uikit'
import { LightGreyCard } from 'components/Card'
import { ProgressBar } from 'components/Progress/ProgressBar'
import { formatAmount } from 'utils/formatInfoNumbers'
import { useBurnStats } from 'views/BurnDashboard/hooks/useBurnStats'
import { getBurnInfoPrecision, getPeakSupply } from 'views/BurnDashboard/utils'
import { StatsCard, StatsCardHeader } from '../StatsCard'

export const TotalDeflationCard = (props: CardProps) => {
  const { t } = useTranslation()

  const { data } = useBurnStats()

  const peakSupply = getPeakSupply(data?.totalSupplyTimeSeries || [])
  const totalDeflation = peakSupply - (data?.total_supply || 0)

  const totalDeflationByPeakSupplyPercentage = peakSupply > 0 ? (totalDeflation / peakSupply) * 100 : 0

  return (
    <StatsCard {...props}>
      <FlexGap alignItems="center" gap="4px">
        <StatsCardHeader>{t('Total Deflation (Since peak supply)')}</StatsCardHeader>
        <QuestionHelperV2 text={t('Total Deflation = Peak CAKE Supply - Current CAKE Supply')} placement="top">
          <InfoIcon color="textSubtle" />
        </QuestionHelperV2>
      </FlexGap>
      <LightGreyCard mt="8px" padding="16px">
        <Text fontSize="18px" bold>
          {formatAmount(totalDeflation, { precision: getBurnInfoPrecision(totalDeflation) })} CAKE
        </Text>

        <Text mt="16px" color="textSubtle" small>
          <Box as="span" color="text" style={{ fontWeight: 600 }}>
            {totalDeflationByPeakSupplyPercentage.toFixed(2)}%
          </Box>{' '}
          {t('of peak CAKE supply')}
        </Text>
        <ProgressBar
          mt="8px"
          min={0}
          max={100}
          progress={totalDeflationByPeakSupplyPercentage}
          backgroundColor="secondary20"
          fillColor="success"
          height="8px"
        />
        <Flex mt="8px" justifyContent="space-between">
          <Text color="textSubtle" fontSize="12px">
            0%
          </Text>
          <Text color="textSubtle" fontSize="12px">
            100%
          </Text>
        </Flex>
      </LightGreyCard>
    </StatsCard>
  )
}
