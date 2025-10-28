import { Flex, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { HomePagePartner } from 'edge/home/types'
import styled from 'styled-components'

type Props = {
  partners: HomePagePartner[]
}

// Helper functions for layout adjustments
const getContainerMarginTop = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '30px'
  if (isTablet) return '50px'
  return '60px'
}

const getContainerMarginBottom = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '80px'
  if (isTablet) return '100px'
  return '120px'
}

const getContainerGap = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '16px'
  if (isTablet) return '20px'
  return '24px'
}

const getTextFontSize = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '14px'
  if (isTablet) return '15px'
  return '16px'
}

export const Partners = ({ partners }: Props) => {
  const { isMobile, isTablet } = useMatchBreakpoints()

  return (
    <Container isMobile={isMobile} isTablet={isTablet}>
      {partners.map((partner) => (
        <LinkItem key={partner.link} href={partner.link} target="_blank" rel="noopener noreferrer">
          <img
            src={partner.logo}
            alt={partner.name}
            style={{
              width: '80px',
              height: '80px',
            }}
          />
          <TextWrapper isMobile={isMobile} isTablet={isTablet}>
            {partner.name}
          </TextWrapper>
        </LinkItem>
      ))}
    </Container>
  )
}

// Container with responsive margin and gap
const Container = styled(Flex)<{ isMobile: boolean; isTablet: boolean }>`
  margin-top: ${({ isMobile, isTablet }) => getContainerMarginTop(isMobile, isTablet)};
  margin-bottom: ${({ isMobile, isTablet }) => getContainerMarginBottom(isMobile, isTablet)};
  justify-content: center;
  gap: ${({ isMobile, isTablet }) => getContainerGap(isMobile, isTablet)};
  flex-wrap: wrap;
`

const LinkItem = styled.a`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  width: 111px;
  height: 128px;
  border-radius: 24px;
  border-top-width: 1px;
  border-right-width: 1px;
  border-bottom-width: 2px;
  border-left-width: 1px;
  border-style: solid;
  border-color: transparent;
  box-sizing: border-box;
  transition: all 0.3s;
  padding: 12px;

  &:hover {
    background: ${({ theme }) => theme.colors.primary10};
    border-width: 1px 1px 2px 1px;
    border-style: solid;
    border-color: ${({ theme }) => theme.colors.primary20};
  }
`

// Text with responsive font size
const TextWrapper = styled(Text)<{ isMobile: boolean; isTablet: boolean }>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => getTextFontSize(isMobile, isTablet)};
  line-height: 24px;
  letter-spacing: 0%;
  text-align: center;
  margin-top: 8px;
  color: ${({ theme }) => theme.colors.textSubtle};
`
