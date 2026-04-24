import { useMemo } from 'react'
import { useTranslation } from '@pancakeswap/localization'
import { Box, Card, CardBody, Column, RowBetween, Text } from '@pancakeswap/uikit'
import { displayApr } from '@pancakeswap/utils/displayApr'
import { styled } from 'styled-components'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'

const StyledCard = styled(Card)`
  height: fit-content;
`

const Divider = styled(Box)`
  height: 1px;
  background-color: ${({ theme }) => theme.colors.cardBorder};
  margin: 16px 0;
`

interface EstimatedFeesPanelProps {
  lpApr: number
  cakeAprValue?: number
  merklApr?: number
  incentraApr?: number
  totalUsdValue: number
}

export const EstimatedFeesPanel: React.FC<EstimatedFeesPanelProps> = ({
  lpApr,
  cakeAprValue = 0,
  merklApr = 0,
  incentraApr = 0,
  totalUsdValue,
}) => {
  const { t } = useTranslation()

  const combinedApr = useMemo(() => {
    return lpApr + cakeAprValue + merklApr + incentraApr
  }, [lpApr, cakeAprValue, merklApr, incentraApr])

  const estimatedFee24h = useMemo(() => {
    if (!combinedApr || !totalUsdValue) return 0
    return (combinedApr * totalUsdValue) / 365
  }, [combinedApr, totalUsdValue])

  const estimatedFee1yr = useMemo(() => {
    if (!combinedApr || !totalUsdValue) return 0
    return combinedApr * totalUsdValue
  }, [combinedApr, totalUsdValue])

  // Use displayApr (formatAmount) so the percent formatting matches the PoolInfoHeader exactly:
  // it truncates (not rounds) to the first two non-zero decimals, e.g. 0.685% → "0.68%".
  const yearlyAprText = useMemo(() => displayApr(combinedApr), [combinedApr])

  const hasDeposit = totalUsdValue > 0

  if (!hasDeposit) return null

  return (
    <StyledCard>
      <CardBody>
        <Text fontSize="14px" color="textSubtle">
          {t('Estimated fees (24h)')}
        </Text>
        <Text bold fontSize="24px" mt="4px">
          {formatDollarAmount(estimatedFee24h, 2, true)}
        </Text>

        <Divider />

        <Column gap="8px">
          <RowBetween>
            <Text fontSize="14px" color="textSubtle">
              {t('Yearly (APR)')}
            </Text>
            <Text bold fontSize="14px">
              {yearlyAprText}
            </Text>
          </RowBetween>
          <RowBetween>
            <Text fontSize="14px" color="textSubtle">
              {t('Estimated fees (1 year)')}
            </Text>
            <Text bold fontSize="14px">
              {formatDollarAmount(estimatedFee1yr, 2, true)}
            </Text>
          </RowBetween>
        </Column>
      </CardBody>
    </StyledCard>
  )
}
