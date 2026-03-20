import { useTranslation } from '@pancakeswap/localization'
import { ChainId } from '@pancakeswap/sdk'
import { Box, Button, Container, Flex, Heading, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useRouter } from 'next/router'
import { useContext, useMemo } from 'react'
import { styled } from 'styled-components'

import { ASSET_CDN } from 'config/constants/endpoints'
import { getChainName } from '@pancakeswap/chains'
import { IfoV2Context } from '../contexts/IfoV2Context'
import { CAKEPAD_URL, withCakepadBaseChainQuery } from '../config/routes'
import { useCakepadBaseExperience } from '../hooks/useCakepadBaseExperience'

const StyledHero = styled(Box)`
  position: relative;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.isDark
      ? 'linear-gradient(139.73deg, #313D5C 0%, #3D2A54 100%)'
      : 'linear-gradient(139.73deg, #E6FDFF 0%, #F3EFFF 100%)'};
`

const BunnyContainer = styled(Box)`
  z-index: 1;
  position: absolute;
  right: 0%;
  bottom: -1%;

  ${({ theme }) => theme.mediaQueries.md} {
    right: 10%;
    bottom: 0;
  }
`

const StyledHeading = styled(Heading)`
  font-size: 2.5rem;
  color: ${({ theme }) => theme.colors.secondary};

  ${({ theme }) => theme.mediaQueries.md} {
    font-size: 4rem;
  }
`

const StyledButton = styled(Button)`
  background-color: ${({ theme }) => theme.colors.textSubtle};
  color: ${({ theme }) => theme.colors.invertedContrast};
  padding: 8px 13px;
  height: auto;
  text-transform: uppercase;
  align-self: flex-start;
  font-size: 12px;
  box-shadow: ${({ theme }) => theme.shadows.inset};
  border-radius: 20px;
  ${({ theme }) => theme.mediaQueries.md} {
  }
`

const DesktopButton = styled(Button)`
  align-self: flex-end;

  &:hover {
    opacity: 1 !important;
  }
`

const StyledSubTitle = styled(Text)`
  font-size: 16px;

  ${({ theme }) => theme.mediaQueries.md} {
    font-size: 20px;
  }
`

interface HeroProps {
  chainId?: ChainId
}

const Hero: React.FC<HeroProps> = ({ chainId }) => {
  const router = useRouter()
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  const ifoContext = useContext(IfoV2Context)
  const isCakepadBase = useCakepadBaseExperience()
  const cakepadBaseUrl = withCakepadBaseChainQuery(CAKEPAD_URL, isCakepadBase)
  const resolvedChainId = chainId ?? ifoContext?.chainId

  const handleClick = () => {
    const howToElem = document.getElementById('cakepad-how-to')
    if (howToElem != null) {
      howToElem.scrollIntoView()
    } else {
      router.push(`${cakepadBaseUrl}#cakepad-how-to`)
    }
  }

  return (
    <Box mb="8px">
      <StyledHero py={['14px', '14px', '40px']} minHeight={['212px', '212px', '197px']}>
        <HeaderBunny chainId={resolvedChainId} />
        <Container position="relative" zIndex="2">
          <Flex
            justifyContent="space-between"
            flexDirection={['column', 'column', 'column', 'row']}
            style={{ gap: '4px' }}
          >
            <Box>
              <StyledHeading as="h1" mb={['12px', '12px', '24px']}>
                CAKE.PAD
              </StyledHeading>
              <StyledSubTitle
                bold
                style={{
                  maxWidth: isMobile ? '60%' : '100%',
                }}
              >
                {isMobile
                  ? t('Early access to tokens with CAKE')
                  : t('Get exclusive early access to new tokens with CAKE')}
              </StyledSubTitle>
            </Box>
            {!isCakepadBase &&
              (isMobile ? (
                <StyledButton onClick={handleClick} mt="0.375rem">
                  {t('How does it work?')}
                </StyledButton>
              ) : (
                <DesktopButton onClick={handleClick} variant="subtle">
                  {t('How does it work?')}
                </DesktopButton>
              ))}
          </Flex>
        </Container>
      </StyledHero>
    </Box>
  )
}

function getHeadBunny(isMobile: boolean, chainId?: ChainId) {
  if (chainId) {
    if (chainId === ChainId.BASE) {
      return `${ASSET_CDN}/web/ifos/v2/bunny/base/bunny-base-blue.webp`
    }
    const chainName = getChainName(chainId)
    if (isMobile) {
      return `${ASSET_CDN}/web/ifos/v2/bunny/${chainName}/bunny-mobile.png`
    }
    return `${ASSET_CDN}/web/ifos/v2/bunny/${chainName}/bunny.png`
  }
  // Fallback to default bunny images
  if (isMobile) {
    return `${ASSET_CDN}/web/ifos/v2/bunny-mobile.png`
  }
  return `${ASSET_CDN}/web/ifos/v2/bunny.png`
}

function HeaderBunny({ chainId }: { chainId?: ChainId }) {
  const { isDesktop, isMobile } = useMatchBreakpoints()

  const bunnyImageUrl = useMemo(() => {
    return getHeadBunny(isMobile, chainId)
  }, [chainId, isMobile])

  return (
    <BunnyContainer>
      <img
        alt="header-bunny"
        src={bunnyImageUrl}
        style={{
          width: isDesktop ? 393 : 207,
          height: isDesktop ? 197 : 192,
        }}
        onError={(e) => {
          const target = e.currentTarget
          if (isMobile) {
            target.src = `${ASSET_CDN}/web/ifos/v2/bunny-mobile.png`
          } else {
            target.src = `${ASSET_CDN}/web/ifos/v2/bunny.png`
          }
        }}
      />
    </BunnyContainer>
  )
}

export default Hero
