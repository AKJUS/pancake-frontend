import { useTranslation } from '@pancakeswap/localization'
import { Box, Flex, MotionBox, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { HomepageChain } from 'edge/home/types'
import React from 'react'
import styled from 'styled-components'
import { MultipleLogos } from './cards/component/MultipleLogos'

const Wrapper = styled(MotionBox)<{
  isMobile: boolean
  isTablet: boolean
}>`
  padding: ${({ isMobile, isTablet }) => (isMobile || isTablet ? '24px 0px 0px 0px' : '24px')};
  text-align: center;
  background-color: transparent;
`

const TitleText = styled(Text)<{ isMobile: boolean; isTablet: boolean }>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => (isMobile ? '40px' : isTablet ? '64px' : '88px')};
  line-height: ${({ isMobile, isTablet }) => (isMobile ? '48px' : isTablet ? '72px' : '88px')};
  letter-spacing: -2%;
  text-align: ${({ isMobile, isTablet }) => (isMobile || isTablet ? 'center' : 'left')};
  color: ${({ theme }) => theme.colors.text};
`

const HighlightedText = styled(Text)<{ isMobile: boolean; isTablet: boolean }>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => (isMobile ? '40px' : isTablet ? '64px' : '88px')};
  line-height: ${({ isMobile, isTablet }) => (isMobile ? '40px' : isTablet ? '72px' : '88px')};
  letter-spacing: -2%;
  text-align: ${({ isMobile, isTablet }) => (isMobile || isTablet ? 'center' : 'left')};
  color: ${({ theme }) => theme.colors.secondary};
  white-space: nowrap;
`

const DescriptionText = styled(Text)<{ isMobile: boolean; isTablet: boolean }>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => (isMobile ? '16px' : isTablet ? '20px' : '24px')};
  line-height: ${({ isMobile, isTablet }) => (isMobile ? '28px' : isTablet ? '32px' : '36px')};
  letter-spacing: -1%;
  text-align: ${({ isMobile, isTablet }) => (isMobile || isTablet ? 'center' : 'left')};
  color: ${({ theme }) => theme.colors.text};
  margin-top: ${({ isMobile, isTablet }) => (isMobile ? '16px' : isTablet ? '24px' : '40px')};
  margin-bottom: ${({ isMobile, isTablet }) => (isMobile ? '16px' : isTablet ? '20px' : '24px')};
`

interface FavoriteDEXBannerProps {
  chains: HomepageChain[]
}

export const FavoriteDEXBanner: React.FC<FavoriteDEXBannerProps> = ({ chains }) => {
  const { t } = useTranslation()
  const { isMobile, isTablet } = useMatchBreakpoints()

  return (
    <Wrapper
      isMobile={isMobile}
      isTablet={isTablet}
      initial={{ opacity: 0, scale: 0.3, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 50 }}
      transition={{ type: 'spring', delay: 0.3, stiffness: 100, damping: 12, duration: 0.5 }}
    >
      <TitleText as={isMobile ? 'span' : 'h2'} isMobile={isMobile} isTablet={isTablet}>
        {t("Everyone's")}{' '}
      </TitleText>
      <HighlightedText as={isMobile ? 'span' : 'h2'} isMobile={isMobile} isTablet={isTablet}>
        {t('Favorite DEX')}
      </HighlightedText>
      <DescriptionText isMobile={isMobile} isTablet={isTablet}>
        {t('Trade Crypto Instantly Across %count%+ Chains', { count: chains.length })}
      </DescriptionText>
      <Flex
        alignItems="center"
        justifyContent={isMobile || isTablet ? 'center' : 'flex-start'}
        style={{
          position: 'relative',
          height: isMobile ? '10px' : '56px',
        }}
      >
        <Box style={{ position: isMobile ? 'static' : 'absolute', marginTop: '0px' }}>
          <MultipleLogos
            clickExpand={{
              logos: isMobile ? chains.map((x) => x.logoM) : chains.map((x) => x.logoL),
            }}
            borderRadius="12px"
            gap={isMobile ? -8 : 20}
            logos={chains.map((x) => x.logo)}
            maxDisplay={20}
          />
        </Box>
      </Flex>
    </Wrapper>
  )
}
