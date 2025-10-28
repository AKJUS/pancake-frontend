import { useTranslation } from '@pancakeswap/localization'
import { Flex, Text, TriangleDownIcon, TriangleUpIcon, useMatchBreakpoints } from '@pancakeswap/uikit'
import { HomePageToken } from 'edge/home/types'
import React from 'react'
import styled from 'styled-components'
import { CardRowLayout } from './component/CardRowLayout'
import { CardSection } from './component/CardSection'
import { HomepageCardBadge } from './component/HomepageCardBadge'
import { HomepageSymbol } from './component/HomepageSymbol'

// Helper function for dynamic font sizes
const getFontSize = (isMobile?: boolean, isTablet?: boolean): string => {
  if (isMobile) {
    return '12px'
  }
  if (isTablet) {
    return '13px'
  }
  return '14px'
}

interface StyledProps {
  isMobile?: boolean
  isTablet?: boolean
}

const PriceText = styled(Text)<StyledProps>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => getFontSize(isMobile, isTablet)};
  line-height: 21px;
  letter-spacing: 0%;
  color: ${({ theme }) => theme.colors.text};
`

const PercentageChange = styled(Text)<StyledProps>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => getFontSize(isMobile, isTablet)};
  line-height: 21px;
  letter-spacing: 0%;
  color: ${({ theme }) => theme.colors.textSubtle};
  position: relative;

  svg {
    width: 11px;
    margin-left: 4px;
    transform: translateY(2px);
  }
`

const LeverageText = styled(Text)<StyledProps>`
  font-size: ${({ isMobile, isTablet }) => getFontSize(isMobile, isTablet)};
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 24px;
  color: ${({ theme }) => theme.colors.positive60};
`

interface PerpetualCardProps {
  tokens: HomePageToken[]
}

function getIconSize(isMobile: boolean): string {
  if (isMobile) {
    return '32px'
  }
  return '40px'
}

export const PerpetualCard: React.FC<PerpetualCardProps> = ({ tokens }) => {
  const { t } = useTranslation()

  // Include isTablet here
  const { isMobile, isTablet } = useMatchBreakpoints()

  return (
    <CardSection
      isFrameLess={isMobile}
      subtitle={t('Perpetuals')}
      button={{
        text: t('See All'),
        link: 'https://perp.pancakeswap.finance/',
      }}
    >
      {tokens.map((token, index) => (
        <CardRowLayout
          key={token.id}
          left={
            <>
              <img
                style={{
                  borderRadius: '50%',
                }}
                src={token.icon}
                alt={token.symbol}
                width={getIconSize(isMobile)}
                height={getIconSize(isMobile)}
              />
              <Flex flexDirection="column" ml="12px">
                <HomepageSymbol isMobile={isMobile} isTablet={isTablet}>
                  {token.symbol}
                </HomepageSymbol>

                <Flex alignItems="center" justifyContent="center">
                  <PriceText isMobile={isMobile} isTablet={isTablet}>
                    ${token.price.toLocaleString()}
                  </PriceText>
                  <PercentageChange
                    isMobile={isMobile}
                    isTablet={isTablet}
                    style={{
                      position: 'relative',
                    }}
                  >
                    {token.percent >= 0 ? <TriangleUpIcon /> : <TriangleDownIcon />}{' '}
                    {Math.abs(token.percent).toFixed(2)}%
                  </PercentageChange>
                </Flex>
              </Flex>
            </>
          }
          isLast={index === tokens.length - 1}
        >
          <HomepageCardBadge
            text={
              !isMobile ? (
                <LeverageText isMobile={isMobile} isTablet={isTablet}>
                  {t(`Up to`)} {token.symbol === 'BTC' ? '1001x' : '250x'} {t('leverage')}
                </LeverageText>
              ) : (
                <>
                  <Text bold color="positive60" fontSize={isTablet ? '13px' : '12px'}>
                    {t(`Up to`)}{' '}
                  </Text>
                  <Text bold color="positive60" fontSize={isTablet ? '15px' : '14px'}>
                    {token.symbol === 'BTC' ? '1001x' : '250x'} {t('leverage')}
                  </Text>
                </>
              )
            }
          />
        </CardRowLayout>
      ))}
    </CardSection>
  )
}
