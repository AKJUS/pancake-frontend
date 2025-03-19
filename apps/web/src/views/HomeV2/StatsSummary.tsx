import { useTranslation } from '@pancakeswap/localization'
import { Box, Flex, useMatchBreakpoints } from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatInfoNumbers'
import { SiteStats } from 'pages/api/home/types'
import React from 'react'
import CountUp from 'react-countup'
import styled from 'styled-components'

interface StatCardProps {
  bgColor: string
  borderColor: string
  textColor: string
  isMobile?: boolean
  isTablet?: boolean
  index: number
}

const StatCard = styled(Box)<StatCardProps>`
  width: ${({ isMobile, isTablet }) => {
    if (isMobile) return '152px'
    if (isTablet) return '190px'
    return '210px'
  }};
  height: ${({ isMobile, isTablet }) => {
    if (isMobile) return '110px'
    if (isTablet) return '130px'
    return '146px'
  }};
  border-radius: ${({ isMobile, isTablet }) => {
    if (isMobile) return '36px'
    if (isTablet) return '42px'
    return '48px'
  }};
  border-top-width: 1px;
  border-right-width: 1px;
  border-bottom-width: 2px;
  border-left-width: 1px;
  border-style: solid;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: ${({ theme, bgColor }) => theme.colors[bgColor]};
  border-color: ${({ theme, borderColor }) => theme.colors[borderColor]};
  margin-top: ${({ isMobile, isTablet }) => (isMobile || isTablet ? '8px' : '0')};
  margin-right: ${({ isMobile, index }) => (isMobile ? (index % 2 === 0 ? '16px' : '0px') : '24px')};
`

interface TitleProps {
  textColor: string
  isMobile?: boolean
  isTablet?: boolean
}

const Title = styled.div<TitleProps>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => {
    if (isMobile) return '14px'
    if (isTablet) return '18px'
    return '20px'
  }};
  line-height: ${({ isMobile, isTablet }) => {
    if (isMobile) return '24px'
    if (isTablet) return '28px'
    return '30px'
  }};
  text-align: center;
  letter-spacing: -1%;
  color: ${({ theme, textColor }) => theme.colors[textColor]};
`

interface ValueProps {
  textColor: string
  isMobile?: boolean
  isTablet?: boolean
}

export const Additional = styled.div`
  font-family: Kanit;
  font-weight: 600;
  font-size: 16px;
  line-height: 150%;
  letter-spacing: 0%;
  vertical-align: middle;
  color: ${({ theme }) => theme.colors.textSubtle};
`

const Value = styled.div<ValueProps>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => {
    if (isMobile) return '32px'
    if (isTablet) return '36px'
    return '40px'
  }};
  line-height: ${({ isMobile, isTablet }) => {
    if (isMobile) return '40px'
    if (isTablet) return '44px'
    return '48px'
  }};
  letter-spacing: -1%;
  background: transparent;
  text-align: center;
  margin-top: ${({ isMobile, isTablet }) => {
    if (isMobile) return '2px'
    if (isTablet) return '3px'
    return '4px'
  }};
  color: ${({ theme, textColor }) => theme.colors[textColor]};
`

export const StatsSummary: React.FC<{ stats?: SiteStats }> = ({ stats }) => {
  const { isMobile, isTablet, isDesktop } = useMatchBreakpoints()
  const { t } = useTranslation()

  if (!stats) {
    return null
  }

  return (
    <Flex
      justifyContent="center"
      alignItems="center"
      flexWrap={isTablet || isMobile ? 'wrap' : 'nowrap'}
      flexDirection={isTablet || isMobile ? 'row' : 'row'}
      mt={isMobile ? '40px' : '80px'}
      width="100%"
      maxWidth={isMobile ? '420px' : 'none'}
      mx="auto"
      padding="0"
    >
      <StatCard
        bgColor="primary10"
        borderColor="primary20"
        textColor="primary60"
        isMobile={isMobile}
        isTablet={isTablet}
        index={0}
      >
        <Title textColor="primary60" isMobile={isMobile} isTablet={isTablet}>
          {t('Total Users')}
        </Title>
        <Value textColor="primary60" isMobile={isMobile} isTablet={isTablet}>
          ~<CountUpAnimation num={stats.totalUsers} />+
        </Value>
        {isDesktop && <Additional>{t('in the last 30 days')}</Additional>}
      </StatCard>

      <StatCard
        bgColor="secondary10"
        borderColor="cardBorder"
        textColor="secondary"
        isMobile={isMobile}
        isTablet={isTablet}
        index={1}
      >
        <Title textColor="secondary" isMobile={isMobile} isTablet={isTablet}>
          {t('Total Trades')}
        </Title>
        <Value textColor="secondary" isMobile={isMobile} isTablet={isTablet}>
          <CountUpAnimation num={stats.totalTrades} />+
        </Value>
        {isDesktop && <Additional>{t('in the last 30 days')}</Additional>}
      </StatCard>

      <StatCard
        bgColor="blue10"
        borderColor="blue20"
        textColor="blue60"
        isMobile={isMobile}
        isTablet={isTablet}
        index={2}
      >
        <Title textColor="blue60" isMobile={isMobile} isTablet={isTablet}>
          {t('Total Value Locked')}
        </Title>
        <Value textColor="blue60" isMobile={isMobile} isTablet={isTablet}>
          $<CountUpAnimation num={stats.totalValueLocked} />+
        </Value>
      </StatCard>

      <StatCard
        index={3}
        bgColor="destructive10"
        borderColor="destructive20"
        textColor="destructive60"
        isMobile={isMobile}
        isTablet={isTablet}
      >
        <Title textColor="destructive60" isMobile={isMobile} isTablet={isTablet}>
          {t('Community')}
        </Title>
        <Value textColor="destructive60" isMobile={isMobile} isTablet={isTablet}>
          <CountUpAnimation num={stats.community} />+
        </Value>
      </StatCard>
    </Flex>
  )
}

const CountUpAnimation = ({ num }: { num: number }) => {
  return <CountUp delay={1.5} end={num} duration={2} separator="," formattingFn={formatFunction} />
}

const formatFunction = (num: number) => {
  return (
    formatAmount(num, {
      precision: 1,
    }) || ''
  ).replace('.0', '')
}
