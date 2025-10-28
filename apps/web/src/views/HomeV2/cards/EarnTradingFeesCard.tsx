import { useTranslation } from '@pancakeswap/localization'
import { Box, Flex, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useRouter } from 'next/router'
import { HomePagePoolInfo } from 'edge/home/types'
import styled from 'styled-components'
import { getNetworkFullName } from 'views/BuyCrypto/constants'
import { CardRowLayout } from './component/CardRowLayout'
import { CardSection } from './component/CardSection'
import { HomepageCardBadge } from './component/HomepageCardBadge'
import { HomepageSymbol } from './component/HomepageSymbol'
import { MultipleCurrencyLogos } from './component/MultipleCurrencyLogos'

const getMarginLeft = (isMobile?: boolean, isTablet?: boolean) => {
  if (isMobile) return '12px'
  if (isTablet) return '20px'
  // Keep the original 12px for PC or update if needed
  return '12px'
}

const VerticalLayout = styled(Flex)<{ isMobile?: boolean; isTablet?: boolean }>`
  flex-direction: column;
  align-items: flex-start;
  margin-left: ${({ isMobile, isTablet }) => getMarginLeft(isMobile, isTablet)};
`

const getChainTextFontSize = (isMobile?: boolean, isTablet?: boolean) => {
  // Keep original font size for mobile & PC, only adjust tablet slightly
  if (isMobile) return '12px'
  if (isTablet) return '14px'
  return '12px'
}

const ChainText = styled(Text)<{ isMobile?: boolean; isTablet?: boolean }>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => getChainTextFontSize(isMobile, isTablet)};
  line-height: 18px;
  letter-spacing: 2%;
  color: ${({ theme }) => theme.colors.textSubtle};
  white-space: nowrap;
`

export const EarnTradingFeesCard = ({ pairs }: { pairs: HomePagePoolInfo[] }) => {
  const { t } = useTranslation()
  const { isMobile, isTablet } = useMatchBreakpoints()
  const router = useRouter()
  return (
    <CardSection
      title={t('Earn Trading Fees')}
      subtitle={t('by Providing Liquidity')}
      button={{ link: '/liquidity/pools', text: t('Liquidity') }}
    >
      <Box>
        {pairs.map((pair, index) => {
          return (
            <CardRowLayout
              onClick={() => {
                router.push(pair.link)
              }}
              key={`${pair.token0}-${pair.token1}`}
              left={
                <Flex alignItems="center">
                  <MultipleCurrencyLogos
                    isFirstSmall
                    tokens={[
                      {
                        logo: pair.token0.icon,
                      },
                      {
                        logo: pair.token1.icon,
                      },
                    ]}
                    chainId={pair.chainId}
                  />

                  {/* Pass isMobile, isTablet to VerticalLayout */}
                  <VerticalLayout isMobile={isMobile} isTablet={isTablet}>
                    <HomepageSymbol isMobile={isMobile} isTablet={isTablet}>
                      {pair.token0.symbol.toUpperCase()}/{pair.token1.symbol.toUpperCase()}
                    </HomepageSymbol>
                    {/* Pass isMobile, isTablet to ChainText */}
                    <ChainText isMobile={isMobile} isTablet={isTablet}>
                      {getNetworkFullName(pair.chainId)}
                    </ChainText>
                  </VerticalLayout>
                </Flex>
              }
              isLast={index === pairs.length - 1}
            >
              <HomepageCardBadge
                text={
                  isMobile ? (
                    <Box>
                      <Text color="positive60" bold fontSize="12px">
                        {t('Up to')}{' '}
                      </Text>
                      <Text color="positive60" bold fontSize="14px">
                        {(pair.apr24h * 100).toFixed(2)}% APR
                      </Text>
                    </Box>
                  ) : (
                    `${t('Up to')} ${(pair.apr24h * 100).toFixed(2)}% APR`
                  )
                }
              />
            </CardRowLayout>
          )
        })}
      </Box>
    </CardSection>
  )
}
