import { ContextApi, useTranslation } from '@pancakeswap/localization'
import { useMatchBreakpoints } from '@pancakeswap/uikit'
import { ASSET_CDN } from 'config/constants/endpoints'
import { useMemo } from 'react'
import { AdsCampaignConfig, Priority } from '../ads.types'
import { getImageUrl } from '../utils'

export enum AdsIds {
  PANCAKE_SOCIAL_LOGIN = 'pancake-social-login',
  PANCAKE_GIFT = 'pancake-gift',
  BINANCE_ALPHA = 'binance-alpha',
  SOLANA_LIQUIDITY = 'solana-liquidity',
  TRADE_SOCIAL = 'trade-social',
}

type AdsConfigMap = {
  [key in AdsIds]: AdsCampaignConfig
}
const getAdsConfigs = (t: ContextApi['t'], isMobile: boolean): AdsCampaignConfig[] => {
  const now = Date.now()
  const config: AdsCampaignConfig[] = [
    {
      id: AdsIds.SOLANA_LIQUIDITY,
      priority: Priority.HIGH,
      ad: {
        img: `${ASSET_CDN}/solana/promotions/add_liquidity.png`,
        texts: [
          {
            text: t('Provide Liquidity on Solana PancakeSwap'),
          },
        ],
        btn: {
          text: t('Add LP Now'),
          link: 'https://pancakeswap.finance/liquidity/pools?network=8000001001',
          mt: '32px',
        },
      },
    },
    {
      id: AdsIds.BINANCE_ALPHA,
      priority: Priority.HIGH,
      ad: {
        img: getImageUrl(isMobile ? 'alpha-comp-mobile-v4' : 'alpha-comp-v4'),
        texts: [
          {
            text: `${t('Trade %product% Tokens to Win %amount%', {
              product: isMobile ? 'Alpha' : 'Binance Alpha',
              amount: isMobile ? '$250K' : '$250,000',
            })}. `,
            inline: true,
          },
          {
            text: t('Trade Now'),
            link: 'https://pancakeswap.finance/swap?utm_source=Website&utm_medium=banner&utm_campaign=Birthday&utm_id=TradingCompetition',
            inline: true,
          },
        ],
        btn: {
          text: t('Learn More'),
          link: 'https://blog.pancakeswap.finance/articles/Birthday-trading-competition?utm_source=Website&utm_medium=banner&utm_campaign=Birthday&utm_id=TradingCompetition',
          mt: !isMobile ? '8px' : undefined,
        },
        ...(isMobile && {
          options: {
            imageMargin: '25px',
          },
        }),
      },
      end: 1759795140000,
    },
    {
      id: AdsIds.TRADE_SOCIAL,
      priority: Priority.MEDIUM,
      ad: {
        img: getImageUrl(!isMobile ? 'trade-social-comp' : 'trade-social-comp-mobile'),
        texts: [
          ...(isMobile
            ? [
                {
                  text: t('Trade with %product%', { product: 'Social Login' }),
                  link: 'https://pancakeswap.finance/swap?utm_source=Website&utm_medium=banner&utm_campaign=SocialLogin&utm_id=TradingCompetition',
                  inline: true,
                },
                {
                  text: ` ${t('to Win %amount%', { amount: '$15,000' })}`,
                  inline: true,
                },
              ]
            : [
                {
                  text: t('Trade with %product% to Win %amount%', { product: 'Social Login', amount: '$15,000' }),
                },
                {
                  text: t('Trade Now'),
                  link: 'https://pancakeswap.finance/swap?utm_source=Website&utm_medium=banner&utm_campaign=SocialLogin&utm_id=TradingCompetition',
                },
              ]),
        ],
        btn: {
          text: t('Learn More'),
          link: 'https://blog.pancakeswap.finance/articles/social-login-trading-competition?utm_source=Website&utm_medium=banner&utm_campaign=SocialLogin&utm_id=TradingCompetition',
          mt: !isMobile ? '8px' : '32px',
        },
        ...(isMobile && {
          options: {
            imageMargin: '25px',
          },
        }),
      },
      end: 1757721600000,
    },
    {
      id: AdsIds.PANCAKE_SOCIAL_LOGIN,
      priority: Priority.MEDIUM,
      ad: {
        img: getImageUrl(isMobile ? 'social-login-mobile' : 'social-login'),
        texts: [
          {
            text: t('Create your Wallet with Social Login'),
          },
        ],
        btn: {
          text: t('Learn More'),
          link: 'https://blog.pancakeswap.finance/articles/sociallogin',
          mt: !isMobile ? '8px' : undefined,
        },
      },
    },
  ]

  return config.filter((ad) => {
    const start = ad?.start
    const end = ad?.end

    const hasStarted = !start || now >= start
    const notEnded = !end || now <= end

    return hasStarted && notEnded
  })
}

export const useAdsConfigs = (): AdsConfigMap => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()

  const AdsConfigs: AdsConfigMap = useMemo(
    () =>
      getAdsConfigs(t, isMobile).reduce((acc, config) => {
        // eslint-disable-next-line no-param-reassign
        acc[config.id] = config
        return acc
      }, {} as AdsConfigMap),
    [t, isMobile],
  )

  return AdsConfigs
}

export const useAdsConfig = (id: AdsIds) => {
  const configs = useAdsConfigs()
  return configs[id]
}
