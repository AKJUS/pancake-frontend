import { useTranslation } from '@pancakeswap/localization'
import { Box, Flex, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { ASSET_CDN } from 'config/constants/endpoints'
import { useRouter } from 'next/router'
import { CakeRelatedFigures, HomePageToken } from 'pages/api/home/types'
import React from 'react'
import styled from 'styled-components'
import { formatNumber } from '../util/formatNumber'
import { CardRowLayout } from './component/CardRowLayout'
import { CardSection } from './component/CardSection'
import { HomepageCardBadge } from './component/HomepageCardBadge'
import { HomepageSymbol } from './component/HomepageSymbol'

interface CakeStatsCardProps {
  figures?: CakeRelatedFigures
  cakeToken?: HomePageToken
}

const GAUGE_ICON = `${ASSET_CDN}/web/landing/gauge-icon.png`

const StyledTitle = styled.p<{ isMobile?: boolean; isTablet?: boolean }>`
  font-size: 16px; /* You could replace with a function if needed, for now keep minimal */
  font-weight: bold;
  color: ${({ theme }) => theme.colors.text};
`

const StyledSubtitle = styled.p<{ isMobile?: boolean; isTablet?: boolean }>`
  font-family: Kanit;
  font-weight: 600;
  font-size: 12px; /* You could replace with a function if needed, for now keep minimal */
  line-height: 18px;
  letter-spacing: 2%;
  color: ${({ theme }) => theme.colors.textSubtle};
`

export const VoteForEmissionCard: React.FC<CakeStatsCardProps> = ({ figures, cakeToken }) => {
  const { t } = useTranslation()
  const { isMobile, isTablet } = useMatchBreakpoints()
  const router = useRouter()

  if (!figures || !cakeToken) {
    return null
  }

  return (
    <CardSection title={t('Vote for CAKE Emissions')} subtitle={t('on over 600+ Pools')}>
      <CardRowLayout
        onClick={() => {
          router.push('/cake-staking')
        }}
        left={
          isTablet ? (
            <>
              <CurrencyLogo
                style={{ width: '36px', height: '36px', marginRight: '10px' }}
                currency={{ address: cakeToken.id, chainId: cakeToken.chainId, isToken: true }}
                size="24px"
              />
              <Flex flexDirection="column">
                <HomepageSymbol isMobile={isMobile} isTablet={isTablet}>
                  {t('CAKE Staking')}
                </HomepageSymbol>
                <StyledSubtitle>
                  {t('%burned% BURN • $%marketCap% MKT. CAP', {
                    burned: formatNumber(figures.burned),
                    marketCap: formatNumber(figures.cakeStats.circulatingSupply * cakeToken.price),
                  })}
                </StyledSubtitle>
              </Flex>
            </>
          ) : !isMobile ? (
            <>
              <CurrencyLogo
                style={{ width: '40px', height: '40px', marginRight: '12px' }}
                currency={{ address: cakeToken.id, chainId: cakeToken.chainId, isToken: true }}
                size="24px"
              />
              <Flex flexDirection="column">
                <HomepageSymbol isMobile={isMobile} isTablet={isTablet}>
                  {t('CAKE Staking')}
                </HomepageSymbol>
                <StyledSubtitle>
                  {t('%burned% BURN • $%marketCap% MKT. CAP', {
                    burned: formatNumber(figures.burned),
                    marketCap: formatNumber(figures.cakeStats.circulatingSupply * cakeToken.price),
                  })}
                </StyledSubtitle>
              </Flex>
            </>
          ) : (
            <Flex flexDirection="column">
              <Flex flexDirection="row">
                <CurrencyLogo
                  style={{ width: '24px', height: '24px', marginRight: '8px' }}
                  currency={{ address: cakeToken.id, chainId: cakeToken.chainId, isToken: true }}
                  size="24px"
                />
                <HomepageSymbol isMobile={isMobile} isTablet={isTablet}>
                  {t('CAKE Staking')}
                </HomepageSymbol>
              </Flex>
              <StyledSubtitle>
                {t('%burned% BURN • $%marketCap% MKT. CAP', {
                  burned: formatNumber(figures.burned),
                  marketCap: formatNumber(figures.cakeStats.circulatingSupply * cakeToken.price),
                })}
              </StyledSubtitle>
            </Flex>
          )
        }
      >
        <HomepageCardBadge
          text={
            isTablet ? (
              `${t('Up to')} ${figures.totalApr.toFixed(2)}% APR`
            ) : isMobile ? (
              <Box>
                <Text bold color="positive60" fontSize="12px">
                  {t('Up to')}
                </Text>
                <Text
                  bold
                  color="positive60"
                  fontSize="14px"
                  style={{
                    whiteSpace: 'nowrap',
                  }}
                >
                  {figures.totalApr.toFixed(2)}% APR
                </Text>
              </Box>
            ) : (
              `${t('Up to')} ${figures.totalApr.toFixed(2)}% APR`
            )
          }
        />
      </CardRowLayout>

      <CardRowLayout
        onClick={() => {
          router.push('/gauges-voting')
        }}
        left={
          isTablet ? (
            <>
              <img style={{ width: '36px', height: '36px', marginRight: '10px' }} src={GAUGE_ICON} alt="icon" />
              <Flex flexDirection="column">
                <StyledTitle>{t('Gauges Voting')}</StyledTitle>
                <StyledSubtitle>
                  {t('TOTAL VOTES: %totalVotes%', {
                    totalVotes: formatNumber(Number(figures.gaugeTotalWeight)),
                  })}
                </StyledSubtitle>
              </Flex>
            </>
          ) : !isMobile ? (
            <>
              <img style={{ width: '40px', height: '40px', marginRight: '12px' }} src={GAUGE_ICON} alt="icon" />
              <Flex flexDirection="column">
                <StyledTitle>{t('Gauges Voting')}</StyledTitle>
                <StyledSubtitle>
                  {t('TOTAL VOTES: %totalVotes%', {
                    totalVotes: formatNumber(Number(figures.gaugeTotalWeight)),
                  })}
                </StyledSubtitle>
              </Flex>
            </>
          ) : (
            <Flex flexDirection="column">
              <Flex flexDirection="row">
                <img style={{ width: '24px', height: '24px', marginRight: '8px' }} src={GAUGE_ICON} alt="icon" />
                <HomepageSymbol isMobile={isMobile} isTablet={isTablet}>
                  {t('Gauges Voting')}
                </HomepageSymbol>
              </Flex>
              <StyledSubtitle>
                {t('TOTAL VOTES: %totalVotes%', {
                  totalVotes: formatNumber(Number(figures.gaugeTotalWeight)),
                })}
              </StyledSubtitle>
            </Flex>
          )
        }
        isLast
      >
        <HomepageCardBadge
          text={
            isTablet ? (
              `${(figures.weeklyReward / 1e3).toFixed(0)}K+ CAKE ${t('Rewards/Epoch')}`
            ) : isMobile ? (
              <Box>
                <Text bold color="positive60" fontSize="14px">
                  {(figures.weeklyReward / 1e3).toFixed(0)}K+ CAKE{' '}
                </Text>
                <Text bold color="positive60" fontSize="12px">
                  {t('Rewards/Epoch')}
                </Text>
              </Box>
            ) : (
              `${(figures.weeklyReward / 1e3).toFixed(0)}K+ CAKE ${t('Rewards/Epoch')}`
            )
          }
        />
      </CardRowLayout>
    </CardSection>
  )
}
