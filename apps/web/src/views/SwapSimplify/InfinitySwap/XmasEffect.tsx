import { useMatchBreakpoints } from '@pancakeswap/uikit'
import { ASSET_CDN } from 'config/constants/endpoints'
import { memo } from 'react'
import { styled } from 'styled-components'
import { XmasStarEffect } from './XmasStarEffect'

const XMAS_MOUNTAIN_HEIGHT_TABLE = {
  base: '560px',
  lg: '390px',
  xl: '420px',
  xxl: '460px',
} as const

const XMAS_MOUNTAIN_WIDTH_TABLE = {
  base: '2000px',
  lg: '1500px',
  xl: '100vw',
  xxl: '100vw',
} as const

const XmasEffectWrapper = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  z-index: 0;
`

const XmasScene = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
`

const XmasBackground = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image: ${({ theme }) =>
    `url('${ASSET_CDN}/web/swap/xmas-2025/bg_${theme.isDark ? 'dark' : 'light'}.webp')`};
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
  transform: translateZ(0);
`

const XmasMountain = styled.div<{ $isDesktop: boolean; $height: string; $width: string }>`
  position: absolute;
  left: 50%;
  bottom: -5%;
  transform: translateX(-50%);
  width: 100vw;
  height: ${({ $height }) => $height};
  z-index: 2;
  background-image: ${({ theme }) =>
    `url('${ASSET_CDN}/web/swap/xmas-2025/mt_${theme.isDark ? 'dark' : 'light'}.webp')`};
  background-size: ${({ $height, $width }) => `${$width} ${$height}`};
  background-position: bottom center;
  background-repeat: no-repeat;
  ${({ theme }) => theme.mediaQueries.md} {
    bottom: -2%;
  }
`

const XmasSideLeft = styled.div<{ $left: string; $width: string; $height: string }>`
  position: absolute;
  bottom: 0%;
  left: ${({ $left }) => $left};
  width: ${({ $width }) => $width};
  height: ${({ $height }) => $height};
  z-index: 3;
  background-image: ${({ theme }) =>
    `url('${ASSET_CDN}/web/swap/xmas-2025/${theme.isDark ? 'dark' : 'light'}_left_side.webp')`};
  background-size: cover;
  background-repeat: no-repeat;
  background-position: bottom left;
  ${({ theme }) => theme.mediaQueries.md} {
    bottom: -2%;
  }
`

const XmasSideRight = styled.div`
  position: absolute;
  bottom: -6%;
  z-index: 3;
  display: none;
  background-image: ${({ theme }) =>
    `url('${ASSET_CDN}/web/swap/xmas-2025/${theme.isDark ? 'dark' : 'light'}_right_side.webp')`};
  background-size: contain;
  background-repeat: no-repeat;
  background-position: bottom right;
  ${({ theme }) => theme.mediaQueries.md} {
    display: block;
    bottom: -2%;
    width: min(360px, 26vw);
    height: min(420px, 30vw);
    right: -4vw;
  }
  ${({ theme }) => theme.mediaQueries.lg} {
    right: -2vw;
  }
`

const pickBreakpointValue = <T,>(
  isXxl: boolean,
  isXl: boolean,
  isLg: boolean,
  table: { base: T; lg: T; xl: T; xxl: T },
) => {
  if (isXxl) return table.xxl
  if (isXl) return table.xl
  if (isLg) return table.lg
  return table.base
}

const getXmasSideLeftDimensions = ({
  isMobile,
  isTablet,
  isDesktop,
  isLg,
}: {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isLg: boolean
}) => {
  if (isDesktop || isLg) {
    return {
      left: '-4vw',
      width: 'min(580px, 47vw)',
      height: 'min(540px, 43vw)',
    }
  }

  if (isTablet) {
    return {
      left: '-24vw',
      width: 'min(520px, 64vw)',
      height: 'min(545px, 55vw)',
    }
  }

  if (isMobile) {
    return {
      left: '-24vw',
      width: '60vw',
      height: '60vw',
    }
  }

  return {
    left: '-24vw',
    width: '60vw',
    height: '60vw',
  }
}

export const XmasEffect: React.FC = memo(() => {
  const { isDesktop, isLg, isXl, isXxl, isMobile, isTablet } = useMatchBreakpoints()

  const mountainHeight = pickBreakpointValue(isXxl, isXl, isLg, XMAS_MOUNTAIN_HEIGHT_TABLE)
  const mountainWidth = pickBreakpointValue(isXxl, isXl, isLg, XMAS_MOUNTAIN_WIDTH_TABLE)
  const {
    left: sideLeft,
    width: sideLeftWidth,
    height: sideLeftHeight,
  } = getXmasSideLeftDimensions({
    isMobile,
    isTablet,
    isDesktop,
    isLg,
  })

  return (
    <XmasEffectWrapper id="swap-xmas-effect" aria-hidden="true">
      <XmasScene>
        <XmasBackground />
        <XmasStarEffect />
        <XmasMountain $isDesktop={isDesktop} $height={mountainHeight} $width={mountainWidth} />
        <XmasSideLeft $left={sideLeft} $width={sideLeftWidth} $height={sideLeftHeight} />
        <XmasSideRight />
      </XmasScene>
    </XmasEffectWrapper>
  )
})
