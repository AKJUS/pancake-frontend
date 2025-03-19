import { ArrowForwardIcon, Button, Flex, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useHoverContext } from 'hooks/useHover'
import { useRouter } from 'next/router'
import { useRef } from 'react'
import styled from 'styled-components'

interface CardRowSectionButtonProps {
  link: string
  text: string
  hover?: {
    text: string
    width: number
    originalWidth: number
  }
  alwaysShow?: boolean
}

// Helper functions for layout
const getButtonHeight = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '40px'
  if (isTablet) return '48px'
  return '40px'
}

const getButtonPadding = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '16px'
  if (isTablet) return '20px'
  return '24px'
}

export const CardRowSectionButton = ({ link, text, alwaysShow = false, hover }: CardRowSectionButtonProps) => {
  const router = useRouter()
  const { isMobile, isTablet } = useMatchBreakpoints()
  const isHover = useHoverContext()

  // For width, treat tablet same as PC
  const width = !isMobile && !isTablet && hover ? (isHover ? `${hover.width}px` : `${hover.originalWidth}px`) : 'auto'

  const buttonRef = useRef<HTMLDivElement>(null)
  const displayText = hover ? (isHover ? hover.text : text) : text

  return (
    <StyledButton
      show={isHover || alwaysShow}
      isMobile={isMobile}
      isHover={isHover}
      style={{ width }}
      onClick={() => {
        if (link.startsWith('http')) {
          window.open(link, '_blank')
          return
        }
        router.push(link)
      }}
      // No logic changes, so keep the original variant usage.
      variant={isHover || isMobile ? 'primary' : 'light'}
    >
      <Flex flexDirection="row" ref={buttonRef}>
        {displayText}
        {!isMobile && isHover && <ArrowForwardIcon color="card" ml="8px" />}
      </Flex>
    </StyledButton>
  )
}

const StyledButton = styled(Button)<{
  show: boolean
  isMobile: boolean
  isHover?: boolean
}>`
  transition: width 0.5s ease;
  opacity: ${({ show }) => (show ? 1 : 0)};
  height: ${({ isMobile, isTablet }) => getButtonHeight(isMobile, isTablet)};
  padding-right: ${({ isMobile, isTablet }) => getButtonPadding(isMobile, isTablet)};
  padding-left: ${({ isMobile, isTablet }) => getButtonPadding(isMobile, isTablet)};
  border-radius: 999px;
  border-width: 3px;
  color: ${({ theme, isHover, isMobile }) => {
    // Tablet shares the same color set as PC
    if (isHover) {
      return theme.colors.card
    }
    if (isMobile) {
      return theme.colors.card
    }
    // treat tablet as PC
    return theme.colors.textSubtle
  }};
`
