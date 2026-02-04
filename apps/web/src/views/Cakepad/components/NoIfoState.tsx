import { useTranslation } from '@pancakeswap/localization'
import { Box, Card, CardBody, Container, Flex, Heading, Tag, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { styled } from 'styled-components'

import { SectionBackground } from './SectionBackground'

const EmptyStateCard = styled(Card)`
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
`

const Glow = styled(Box)`
  position: absolute;
  inset: -40% -10% auto -10%;
  height: 140%;
  background: ${({ theme }) =>
    theme.isDark
      ? 'radial-gradient(60% 60% at 50% 40%, rgba(118, 69, 217, 0.22) 0%, rgba(118, 69, 217, 0) 70%)'
      : 'radial-gradient(60% 60% at 50% 40%, rgba(118, 69, 217, 0.14) 0%, rgba(118, 69, 217, 0) 70%)'};
  pointer-events: none;
`

const NoIfoState: React.FC = () => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()

  return (
    <SectionBackground>
      <Container px={isMobile ? '16px' : '0px'}>
        <Box position="relative" py={['24px', '24px', '40px']} mb="16px">
          <Glow />
          <EmptyStateCard>
            <CardBody p={['24px', '24px', '40px']}>
              <Flex flexDirection="column" alignItems="center" style={{ gap: '12px' }}>
                <Tag variant="primary60" scale="sm">
                  {t('Base')}
                </Tag>
                <Heading as="h2" textAlign="center" color="secondary">
                  {t('Upcoming launches on CAKEPAD - available soon')}
                </Heading>
                <Text textAlign="center" color="textSubtle" fontSize={['14px', '14px', '16px']}>
                  {t('We are preparing the next launches for Base. Check back soon.')}
                </Text>
              </Flex>
            </CardBody>
          </EmptyStateCard>
        </Box>
      </Container>
    </SectionBackground>
  )
}

export default NoIfoState
