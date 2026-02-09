import { useTheme } from '@pancakeswap/hooks'
import { memo, useEffect, useMemo, useState } from 'react'
import { styled } from 'styled-components'
import { FireworkEffect } from './FireworkEffect'
import { RedpackEffect } from './RedpackEffect'
import { XmasStarEffect } from './XmasStarEffect'

const FESTIVAL_THEME_CONFIG_URL =
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
    ? 'https://proofs.pancakeswap.com/cms/festival-theme-config.json'
    : 'https://proofs.pancakeswap.com/cms-preview/festival-theme-config.json'

type FestivalTheme = {
  bgGradient?: string
  bgImageUrl?: string
  foregroundLeftUrl?: string
  foregroundRightUrl?: string
}

type FestivalThemeConfig = {
  active?: boolean
  effect?: string
  themes?: {
    light?: FestivalTheme
    dark?: FestivalTheme
  }
}

const FestivalWrapper = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
  z-index: 0;
`

const FestivalScene = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
`

const resolveBackgroundImage = (gradient?: string, imageUrl?: string) => {
  const layers: string[] = []
  if (imageUrl) {
    layers.push(`url('${imageUrl}')`)
  }
  if (gradient) {
    layers.push(gradient)
  }
  return layers.length ? layers.join(', ') : 'none'
}

const FestivalBackground = styled.div<{ $gradient?: string; $imageUrl?: string }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  background-image: ${({ $gradient, $imageUrl }) => resolveBackgroundImage($gradient, $imageUrl)};
  background-size: cover;
  background-position: center bottom;
  background-repeat: no-repeat;
  transform: translateZ(0);
`

const FestivalEffectLayer = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
`

const FestivalForeground = styled.div<{ $imageUrl?: string; $position: 'left' | 'right' }>`
  position: absolute;
  bottom: 0;
  ${({ $position }) => ($position === 'left' ? 'left: 0;' : 'right: 0;')}
  z-index: 2;
  display: none;
  background-image: ${({ $imageUrl }) => ($imageUrl ? `url('${$imageUrl}')` : 'none')};
  background-size: contain;
  background-repeat: no-repeat;
  background-position: ${({ $position }) => `bottom ${$position}`};
  ${({ theme }) => theme.mediaQueries.md} {
    display: block;
    width: min(320px, 40vw);
    height: min(340px, 42vw);
  }
  ${({ theme }) => theme.mediaQueries.lg} {
    width: 388px;
    height: 411px;
  }
`

const EFFECT_COMPONENTS: Record<string, React.FC> = {
  fireworks: FireworkEffect,
  redpack: RedpackEffect,
  stars: XmasStarEffect,
  shootingstars: XmasStarEffect,
}

const resolveEffectComponent = (effect?: string) => {
  if (!effect) {
    return null
  }
  const key = effect.toLowerCase().replace(/\s+/g, '')
  return EFFECT_COMPONENTS[key] || null
}

export const Festival: React.FC = memo(() => {
  const { isDark } = useTheme()
  const [config, setConfig] = useState<FestivalThemeConfig | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadConfig = async () => {
      try {
        const response = await fetch(`${FESTIVAL_THEME_CONFIG_URL}?t=${Date.now()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!response.ok) {
          setConfig(null)
          return
        }
        const data = (await response.json()) as FestivalThemeConfig
        setConfig(data)
      } catch {
        setConfig(null)
      }
    }

    loadConfig()

    return () => {
      controller.abort()
    }
  }, [])

  const themeKey = isDark ? 'dark' : 'light'
  const theme = config?.themes?.[themeKey]
  const EffectComponent = useMemo(() => resolveEffectComponent(config?.effect), [config?.effect])

  if (!config?.active || !theme) {
    return null
  }

  return (
    <FestivalWrapper id="swap-festival-effect" aria-hidden="true">
      <FestivalScene>
        <FestivalBackground $gradient={theme.bgGradient} $imageUrl={theme.bgImageUrl} />
        <FestivalEffectLayer>{EffectComponent ? <EffectComponent /> : null}</FestivalEffectLayer>
        <FestivalForeground $position="left" $imageUrl={theme.foregroundLeftUrl} />
        <FestivalForeground $position="right" $imageUrl={theme.foregroundRightUrl} />
      </FestivalScene>
    </FestivalWrapper>
  )
})
