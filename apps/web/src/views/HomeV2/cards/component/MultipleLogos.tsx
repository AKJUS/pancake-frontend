import { Box, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

const LogoWrapper = styled(Box)`
  position: relative;
  display: flex;
  align-items: center;
`

const ImageContainer = styled.div<{
  gap: number
  isFirstSmall: boolean
  size: number
  index: number
  isActive?: boolean
}>(({ gap, isFirstSmall, size, isActive }) => {
  return `
  position: relative;
  width: ${isActive ? size * 2 : size}px;
  height: ${size}px;
  transition: all 0.3s;
  &:not(:first-child) {
    margin-left: ${gap}px;
  }

  &:first-child {
    margin-top: ${isFirstSmall ? '-12px' : '0'};
  }

`
})

const ImageContainerExpandable = styled.div<{
  gap: number
  isFirstSmall: boolean
  size: number
  index: number
  isActive?: boolean
  isMobile?: boolean
}>(({ gap, isFirstSmall, size, isActive, isMobile }) => {
  return `
  position: relative;
  width: ${isActive ? size * 2 : size}px;
  height: ${size}px;
  transition: all 0.3s;
  &:not(:first-child) {
    margin-left: ${gap}px;
  }

  &:first-child {
    margin-top: ${isFirstSmall ? '-12px' : '0'};
  }

  &:hover {
    width: ${isMobile ? 'auto' : '120px'};
  }

  &:hover ${OverlapLogo} {
    opacity: 0;
  }

  &:hover ${ExpandLogo} {
    opacity: 1;
    z-index: 2;
  }
`
})

const ImageContainerExpandableMobile = styled.div<{
  gap: number
  isFirstSmall: boolean
  size: number
  index: number
  isActive?: boolean
  isMobile?: boolean
}>(({ gap, isFirstSmall, size, isActive }) => {
  return `
  position: relative;
  width: ${isActive ? size * 2 : size}px;
  height: ${size}px;
  transition: all 0.3s;
  &:not(:first-child) {
    margin-left: ${gap}px;
  }

  &:first-child {
    margin-top: ${isFirstSmall ? '-12px' : '0'};
  }
`
})

const OverlapLogo = styled.img<{
  gap: number
  size: number
  isFirstSmall: boolean
  index: number
  borderRadius: string
  isActive: boolean
}>(({ gap, size, isFirstSmall, index, borderRadius, isActive, theme }) => {
  const logoSize = isFirstSmall && index === 0 ? '20px' : `${size}px`

  return `
    position: absolute;
    top: 0;
    left: 0;
    transition: all 0.3s;
    width: ${logoSize};
    opacity: ${isActive ? 1 : 0};
    height: auto;
    flex-shrink: 0;
    border: ${gap < 0 ? `3px solid ${theme.colors.card}` : 'none'};
    border-radius: ${borderRadius};
  `
})

const ExpandLogo = styled.img<{
  gap: number
  size: number
  isFirstSmall: boolean
  index: number
  borderRadius: string
  isActive: boolean
  isMobile: boolean
}>(({ size, isFirstSmall, isMobile, index, isActive }) => {
  const logoSize = isFirstSmall && index === 0 ? '20px' : `${size}px`

  return `
    position: absolute;
    top: 0;
    left: 0;
    transition: all 0.3s;
    width: ${isMobile ? logoSize : 'auto'};
    height: ${!isMobile ? `${logoSize} !important` : 'auto'};
    max-width: none !important;
    max-height: none !important;
    opacity: ${isActive ? 1 : 0};
    transition: all 0.3s;
    transform: scale(${isActive ? 2 : 1});
    transform-origin: ${isMobile ? 'top left' : 'center'};
    will-change: transform;
    height: auto;
    flex-shrink: 0;
    border-radius: '16px';
    z-index: 2;
  `
})

const ExtraCount = styled(Box)<{ gap: number; size: number; borderRadius: string }>`
  display: flex;
  width: ${({ size }) => `${size}px`};
  height: ${({ size }) => `${size}px`};
  flex-shrink: 0;
  border: ${({ theme, gap }) => `${gap < 0 ? `3px solid ${theme.colors.card}` : 'none'}`};
  margin-left: ${({ gap }) => `${gap}px`};
  border-radius: ${({ borderRadius }) => borderRadius};
  background-color: ${({ theme }) => theme.colors.secondary10};
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.secondary};
`

interface MultipleLogosProps {
  logos: string[]
  maxDisplay?: number
  gap?: number
  isFirstSmall?: boolean
  children?: React.ReactNode
  borderRadius?: string
  clickExpand?: {
    logos: string[]
  }
}

// Helper function to get different size for mobile, tablet, and desktop.
const getSize = (isMobile: boolean, isFirstSmall: boolean) => {
  if (isMobile) {
    return isFirstSmall ? 28 : 32
  }
  return 40
}

export const MultipleLogos = ({
  logos,
  maxDisplay = 3,
  gap = -16,
  isFirstSmall = false,
  children,
  borderRadius,
  clickExpand,
}: MultipleLogosProps) => {
  const { isMobile } = useMatchBreakpoints()
  const size = getSize(isMobile, isFirstSmall)

  const displayedLogos = logos.slice(0, maxDisplay)
  const hiddenCount = logos.length - displayedLogos.length
  const [expandIndex, setExpandIcon] = useState<number | undefined>(undefined)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMobile) {
      return () => {}
    }
    const handleScroll = () => {
      if (expandIndex !== undefined) {
        setExpandIcon(undefined)
      }
    }

    const handleTap = (e: TouchEvent | MouseEvent) => {
      if (expandIndex !== undefined && ref.current && !ref.current.contains(e.target as Node)) {
        setExpandIcon(undefined)
      }
    }
    document.addEventListener('scroll', handleScroll)
    document.addEventListener('touchmove', handleTap)
    document.addEventListener('click', handleTap)
    return () => {
      document.removeEventListener('scroll', handleScroll)
      document.removeEventListener('touchmove', handleTap)
      document.addEventListener('click', handleTap)
    }
  }, [expandIndex, isMobile])

  return (
    <LogoWrapper ref={ref}>
      {displayedLogos.map((logo, index) => {
        const active = isMobile && index === expandIndex
        const expandIcon = clickExpand?.logos[index]
        const Container = clickExpand
          ? isMobile
            ? ImageContainerExpandableMobile
            : ImageContainerExpandable
          : ImageContainer
        return (
          <Container
            isActive={active}
            size={size}
            isMobile={isMobile}
            index={index}
            gap={gap}
            isFirstSmall={isFirstSmall && isMobile}
            key={logo}
          >
            <OverlapLogo
              onClick={() => {
                console.log('set expand', index)
                if (!isMobile || !clickExpand) {
                  return
                }
                setExpandIcon(index)
              }}
              isActive={!active}
              src={logo}
              alt={`logo-${index}`}
              gap={gap}
              size={size}
              index={index}
              isFirstSmall={isFirstSmall && isMobile}
              borderRadius={borderRadius || '50%'}
            />
            {expandIcon && (
              <ExpandLogo
                isMobile={isMobile}
                onClick={() => {
                  if (!isMobile || !clickExpand) {
                    return
                  }
                  setExpandIcon(index)
                }}
                isActive={active}
                src={expandIcon}
                alt={`logo-${index}`}
                gap={gap}
                size={size}
                index={index}
                isFirstSmall={isFirstSmall && isMobile}
                borderRadius={borderRadius || '50%'}
              />
            )}
          </Container>
        )
      })}
      {hiddenCount > 0 && (
        <ExtraCount borderRadius={borderRadius || '50%'} gap={gap} size={size}>
          +{hiddenCount}
        </ExtraCount>
      )}
      {children}
    </LogoWrapper>
  )
}
