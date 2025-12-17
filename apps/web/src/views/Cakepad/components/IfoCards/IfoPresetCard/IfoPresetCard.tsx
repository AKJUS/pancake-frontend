import { useTheme } from '@pancakeswap/hooks'
import useIfo from 'views/Cakepad/hooks/useIfo'
import { Box, CardBody, Container, useMatchBreakpoints } from '@pancakeswap/uikit'
import { Header, StyledCard } from '../IfoCards'
import { Footer } from '../../Footer'
import { IfoPresetRibbon } from './IfoPresetRibbon'
import { IfoPresetCardComing } from './IfoPresetCardComing'
import { SectionBackground } from '../../SectionBackground'
import HowToTakePart from '../../HowToTakePart'
import FaqList from '../../IfoQuestions/FaqList'

export const IfoPresetPage = () => {
  const { config } = useIfo()
  const { isMobile } = useMatchBreakpoints()

  return (
    <>
      <SectionBackground>
        <Container px={isMobile ? '16px' : '0px'}>
          <IfoPresetCard />
        </Container>
      </SectionBackground>
      <HowToTakePart />
      <FaqList ifoFaqs={config?.faqs} />
    </>
  )
}

/**
 * Use for displaying preset data when production contract is not available in config yet
 */
const IfoPresetCard = () => {
  const { config } = useIfo()
  const { theme } = useTheme()

  return (
    <StyledCard>
      <Box className="sticky-header" position="sticky" bottom="48px" width="100%" zIndex={6}>
        <Header $isCurrent $bannerUrl={config?.bannerUrl ?? ''} />
        <Box
          style={{
            background: theme.colors.gradientBubblegum,
          }}
        >
          <IfoPresetRibbon />
          <CardBody>
            <IfoPresetCardComing />
          </CardBody>
        </Box>
      </Box>
      <Footer />
    </StyledCard>
  )
}
