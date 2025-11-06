import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { AutoColumn, Box, CardBody, FlexGap, TableView, Text, Toggle, useMatchBreakpoints } from '@pancakeswap/uikit'
import { displayApr } from '@pancakeswap/utils/displayApr'
import { LightCard, LightGreyCard } from '@pancakeswap/widgets-internal'
import { UnifiedPoolInfo } from 'state/farmsV4/state/type'
import styled from 'styled-components'
import { isInfinityProtocol } from 'utils/protocols'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'

const StyledCardBody = styled(CardBody)`
  border-bottom: 1px solid ${({ theme }) => theme.colors.cardBorder};
`

const StyledPositionCard = styled(Box)`
  padding: 16px;
  transition: background 0.2s ease-in-out;

  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.colors.cardBorder};
  }

  &:hover {
    background: ${({ theme }) => (theme.isDark ? theme.colors.backgroundDisabled : theme.colors.backgroundHover)};
  }

  &:active {
    background: ${({ theme }) => theme.colors.backgroundTapped};
  }
`

interface PositionsTableProps {
  data: any[]
  poolInfo?: UnifiedPoolInfo | null
  totalLiquidityUSD: number
  totalApr: number
  showInactiveOnly?: boolean
  toggleInactiveOnly?: () => void
  harvestAllButton?: React.ReactNode
  totalEarnings?: string
  onRowClick?: (record: any) => void
  onlyFarmHarvest?: boolean
}

const EMPTY_ARRAY = []

export const PositionsTable: React.FC<PositionsTableProps> = ({
  poolInfo,
  totalLiquidityUSD,
  totalApr,
  showInactiveOnly,
  toggleInactiveOnly,
  harvestAllButton,
  totalEarnings,
  data,
  onRowClick,
  onlyFarmHarvest = true,
}) => {
  const { t } = useTranslation()

  const { isMobile, isTablet } = useMatchBreakpoints()
  const isSmallScreen = isMobile || isTablet

  const { protocol } = poolInfo ?? {}

  if (!poolInfo) return null

  return (
    <LightCard padding="0" borderRadius="24px">
      <StyledCardBody>
        <FlexGap justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="16px">
          <FlexGap gap="32px" justifyContent="space-between" width={isSmallScreen ? '100%' : null}>
            <Box>
              <Text color="textSubtle">{t('Total Liquidity')}</Text>
              <Text fontSize="24px" bold>
                {formatDollarAmount(totalLiquidityUSD)}
              </Text>
            </Box>
            <Box>
              <Text color="textSubtle">{t('Total APR')}</Text>
              <Text fontSize="24px" bold>
                {totalApr ? displayApr(totalApr) : '-'}
              </Text>
            </Box>
          </FlexGap>

          <LightGreyCard padding="8px 16px" width={isSmallScreen ? '100%' : 'max-content'} borderRadius="24px">
            <FlexGap gap="16px" alignItems="center" justifyContent="space-between">
              <Box>
                <Text color="textSubtle">{onlyFarmHarvest ? t('Total Farm Earnings') : t('Total Earnings')}</Text>
                <Text fontSize="24px" bold>
                  {totalEarnings || '-'}
                </Text>
              </Box>
              {harvestAllButton}
            </FlexGap>
          </LightGreyCard>
        </FlexGap>
      </StyledCardBody>

      {!isSmallScreen ? (
        <TableView
          getRowKey={(row) => row.tokenId}
          columns={[
            {
              title: (
                <>
                  {!!toggleInactiveOnly && (
                    <FlexGap gap="8px" alignItems="center">
                      <Text color="textSubtle">{t('Inactive Only')}</Text>
                      <Toggle checked={showInactiveOnly} onChange={toggleInactiveOnly} scale="sm" />
                    </FlexGap>
                  )}
                </>
              ),
              dataIndex: 'tokenInfo',
              key: 'tokenInfo',
              render: (tokenInfo) => <div>{tokenInfo}</div>,
            },
            {
              title: t('Liquidity'),
              dataIndex: 'liquidity',
              key: 'liquidity',
              render: (liquidity) => <div>{liquidity}</div>,
            },
            {
              title: t('Earnings'),
              dataIndex: 'earnings',
              key: 'earnings',
              render: (earnings) => <div>{earnings}</div>,
              display: protocol !== Protocol.V2 && protocol !== Protocol.STABLE,
            },
            {
              title: t('APR'),
              dataIndex: 'apr',
              key: 'apr',
              render: (apr) => <Box pr="8px">{apr}</Box>,
            },
            {
              title: t('Price Range (Min/Max)'),
              dataIndex: 'priceRange',
              key: 'priceRange',
              render: (priceRange) => <div>{priceRange}</div>,
              display: isInfinityProtocol(protocol) || protocol === Protocol.V3,
            },
            {
              title: '',
              dataIndex: 'actions',
              key: 'actions',
              render: (actions) => <div>{actions}</div>,
            },
          ]}
          data={data || EMPTY_ARRAY}
          onRowClick={onRowClick}
        />
      ) : (
        <AutoColumn>
          {!!toggleInactiveOnly && (
            <FlexGap gap="8px" alignItems="center" padding="16px" borderBottom="1px solid" borderColor="cardBorder">
              <Text color="textSubtle">{t('Inactive Only')}</Text>
              <Toggle checked={showInactiveOnly} onChange={toggleInactiveOnly} scale="sm" />
            </FlexGap>
          )}
          {data.map((row) => (
            <StyledPositionCard key={row.tokenId} onClick={() => onRowClick?.(row)}>
              <Box>{row.tokenInfo}</Box>
              <FlexGap mt="24px" gap="4px" justifyContent="space-between" alignItems="center">
                <Box>
                  <Text color="textSubtle">{t('APR')}</Text>
                  <Box>{row.apr}</Box>
                </Box>
                <Box>
                  <Text color="textSubtle">{t('Liquidity')}</Text>
                  <Box>{row.liquidity}</Box>
                </Box>
                {protocol !== Protocol.V2 && protocol !== Protocol.STABLE && (
                  <Box>
                    <Text color="textSubtle">{t('Earnings')}</Text>
                    <Box>{row.earnings}</Box>
                  </Box>
                )}
              </FlexGap>

              {(isInfinityProtocol(protocol) || protocol === Protocol.V3) && (
                <FlexGap mt="24px" width="100%" alignItems="center" justifyContent="center">
                  <Box width="max-content">{row.priceRange}</Box>
                </FlexGap>
              )}

              <Box mt="24px">{row.actions}</Box>
            </StyledPositionCard>
          ))}
        </AutoColumn>
      )}
    </LightCard>
  )
}
