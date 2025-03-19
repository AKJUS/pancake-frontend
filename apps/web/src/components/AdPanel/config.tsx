import { useMatchBreakpoints } from '@pancakeswap/uikit'
import { AdsIds, useAdsConfigs } from 'components/AdPanel/hooks/useAdsConfig'
import { useMemo } from 'react'
import { AdTradingCompetitionEos } from 'components/AdPanel/Ads/AdTradingCompetition'
import { AdCakeStaking } from './Ads/AdCakeStaking'
import { AdCommon } from './Ads/AdCommon'
import { AdIfo } from './Ads/AdIfo'
import { AdPCSX } from './Ads/AdPCSX'
import { AdSpringboard } from './Ads/AdSpringboard'
import { ExpandableAd } from './Expandable/ExpandableAd'
import { shouldRenderOnPages } from './renderConditions'
import { AdSlide } from './types'
import { useShouldRenderAdIfo } from './useShouldRenderAdIfo'

enum Priority {
  FIRST_AD = 6,
  VERY_HIGH = 5,
  HIGH = 4,
  MEDIUM = 3,
  LOW = 2,
  VERY_LOW = 1,
}

export const useAdConfig = () => {
  const { isDesktop } = useMatchBreakpoints()
  const shouldRenderOnPage = shouldRenderOnPages(['/buy-crypto', '/', '/prediction'])
  const MAX_ADS = isDesktop ? 6 : 4
  const shouldRenderAdIfo = useShouldRenderAdIfo()
  const configs = useAdsConfigs()
  const commonAdConfigs = useMemo(() => {
    return Object.entries(configs)
      .map(([key, value]) => {
        if (value.ad) {
          return {
            id: value.id,
            component: <AdCommon id={key as AdsIds} />,
          }
        }
        return undefined
      })
      .filter(Boolean) as { id: string; component: JSX.Element }[]
  }, [configs])

  const adList: Array<AdSlide> = useMemo(
    () => [
      {
        id: 'expandable-ad',
        component: <ExpandableAd />,
        priority: Priority.FIRST_AD,
        shouldRender: [shouldRenderOnPage],
      },
      ...commonAdConfigs,
      {
        id: 'ad-springboard',
        component: <AdSpringboard />,
      },
      {
        id: 'ad-eos-tc',
        component: <AdTradingCompetitionEos />,
      },
      {
        id: 'ad-ifo',
        component: <AdIfo />,
        shouldRender: [shouldRenderAdIfo],
      },
      {
        id: 'pcsx',
        component: <AdPCSX />,
      },
      {
        id: 'cake-staking',
        component: <AdCakeStaking />,
      },
    ],
    [shouldRenderOnPage, shouldRenderAdIfo, commonAdConfigs],
  )

  return useMemo(
    () =>
      adList
        .filter((ad) => ad.shouldRender === undefined || ad.shouldRender.every(Boolean))
        .sort((a, b) => (b.priority || Priority.VERY_LOW) - (a.priority || Priority.VERY_LOW))
        .slice(0, MAX_ADS),
    [adList, MAX_ADS],
  )
}

// Array of strings or regex patterns
const commonLayoutAdIgnoredPages = [
  '/home',
  '/cake-staking',
  // Route matching: /liquidity/pool/<chainName>/<poolAddress>
  /\/liquidity\/pool\/\w+\/\w+/,
]

/**
 *  On the pages mentioned, the Mobile ads will be placed directly in page instead of in the app layout.
 *  So don't render in the app layout.
 *  Contains strings or regex patterns.
 */
export const layoutMobileAdIgnoredPages = [
  ...commonLayoutAdIgnoredPages,
  '/',
  '/prediction',
  '/liquidity/pools',
  '/migration/bcake',
]

/**
 *  On the pages mentioned, the Desktop ads will be placed directly in page instead of in the app layout.
 *  So don't render in the app layout.
 *  Contains strings or regex patterns.
 */
export const layoutDesktopAdIgnoredPages = [...commonLayoutAdIgnoredPages]

// NOTE: In current phase, we're adding pages to whitelist as well for AdPlayer.
export const commonLayoutWhitelistedPages = ['/swap', '/buy-crypto', '/prediction']
