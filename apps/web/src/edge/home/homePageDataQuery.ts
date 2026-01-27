import { ChainId } from '@pancakeswap/chains'
import { ASSET_CDN } from 'config/constants/endpoints'
import { HomepageChain, HomePageCurrency, HomePagePartner } from './types'

export const partners: HomePagePartner[] = [
  {
    logo: `${ASSET_CDN}/web/landing/partner/x.png`,
    link: 'https://x.com/pancakeswap',
    name: 'X',
  },
  {
    logo: `${ASSET_CDN}/web/landing/partner/telegram.png`,
    link: 'https://t.me/pancakeswap',
    name: 'Telegram',
  },
  {
    logo: `${ASSET_CDN}/web/landing/partner/discord.png`,
    link: 'https://discord.gg/pancakeswap',
    name: 'Discord',
  },
  {
    logo: `${ASSET_CDN}/web/landing/partner/instagram.png`,
    link: 'https://instagram.com/pancakeswapfinance',
    name: 'Instagram',
  },
  {
    logo: `${ASSET_CDN}/web/landing/partner/youtube.png`,
    link: 'https://www.youtube.com/@pancakeswap_official',
    name: 'Youtube',
  },
  {
    logo: `${ASSET_CDN}/web/landing/partner/blog.png`,
    link: 'https://blog.pancakeswap.finance/',
    name: 'Blog',
  },
]

export const homePageCurrencies: HomePageCurrency[] = [
  'usd',
  'eur',
  'gbp',
  'hkd',
  'cad',
  'aud',
  'brl',
  'jpy',
  'krw',
  'vnd',
  'idr',
].map((symbol) => {
  return {
    symbol,
    logo: `${ASSET_CDN}/web/onramp/currencies/${symbol}.png`,
  }
})

export function homePageChainsInfo() {
  const evms = [ChainId.ETHEREUM, ChainId.BSC, ChainId.ZKSYNC, ChainId.ARBITRUM_ONE, ChainId.LINEA, ChainId.BASE]

  const nonEvmChains = ['aptos', 'solana']
  const additionalEvmChains = [ChainId.OPBNB, ChainId.MONAD_MAINNET]

  const allChains = [...evms, ...nonEvmChains, ...additionalEvmChains]

  const chains: HomepageChain[] = allChains.map((chain) => {
    const chainId = typeof chain === 'string' ? chain : chain
    return {
      logo: `${ASSET_CDN}/web/chains/svg/${chainId}.svg`,
      logoM: `${ASSET_CDN}/web/chains/svg/${chainId}-m.svg`,
      logoL: `${ASSET_CDN}/web/chains/svg/${chainId}-l.svg`,
    }
  })

  return chains
}
