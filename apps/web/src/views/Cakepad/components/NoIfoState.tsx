import { useTranslation } from '@pancakeswap/localization'
import { Box, Container, Flex, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { styled } from 'styled-components'

import { ASSET_CDN } from 'config/constants/endpoints'
import { SectionBackground } from './SectionBackground'

const EmptyStateImage = styled.img`
  width: 98px;
  height: 130px;
  display: block;
`

const sirPcBaseImg = `${ASSET_CDN}/web/cakepad/upcoming.png`

const NoIfoState: React.FC = () => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()

  return (
    <SectionBackground>
      <Container px={isMobile ? '16px' : '0px'}>
        <Box py={['24px', '24px', '40px']} mb="16px">
          <Flex flexDirection="column" alignItems="center" style={{ gap: '16px' }}>
            <Flex alignItems="center" justifyContent="center">
              <EmptyStateImage alt="" src={sirPcBaseImg} />
            </Flex>
            <Text textAlign="center" color="textSubtle" fontSize="14px" lineHeight="1.5">
              {t('Upcoming launches on CAKE.PAD')}
              <br />
              {t('— available soon!')}
            </Text>
          </Flex>
        </Box>
      </Container>
    </SectionBackground>
  )
}

export default NoIfoState
