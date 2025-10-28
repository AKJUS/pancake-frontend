import { ChainId } from '@pancakeswap/chains'
import { PredictionUser, Profile } from 'state/types'

type TokenBase = {
  id: `0x${string}`
  symbol: string
  chainId: ChainId
  icon: string
}
export type HomePageToken = TokenBase & {
  price: number
  percent: number
}

export type HomepageChain = {
  logo: string
  logoM: string
  logoL: string
}

export type HomePagePartner = {
  logo: string
  link: string
  name: string
}

export type SiteStats = {
  totalUsers: number
  totalTrades: number
  totalValueLocked: number
  community: number
}

export type HomePagePoolInfo = {
  id: `0x${string}`
  token0: TokenBase
  token1: TokenBase
  chainId: ChainId
  apr24h: number
  protocol: string
  link: string
}

export type HomePageCurrency = {
  symbol: string
  logo: string
}

export type HomePageUser = {
  user: PredictionUser
  hasRegistered: boolean
  profile?: Profile
}

export type HomePageData = {
  tokens: HomePageToken[]
  pools: HomePagePoolInfo[]
  currencies: HomePageCurrency[]
  chains: HomepageChain[]
  stats: SiteStats
  partners: HomePagePartner[]
  topWinner: HomePageUser
}

// Supporting types (you may need to adjust according to your actual implementation)
