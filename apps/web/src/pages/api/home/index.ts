import { cacheByLRU } from '@pancakeswap/utils/cacheByLRU'
import { NextApiHandler } from 'next'
import { homePageChainsInfo, homePageCurrencies, partners } from 'edge/home/homePageDataQuery'
import { queryPools } from 'edge/home/queries/queryPools'
import { queryPredictionUser } from 'edge/home/queries/queryPrediction'
import { queryTokens } from 'edge/home/queries/queryTokens'
import { querySiteStats } from 'edge/home/querySiteStats'
import { HomePageData } from 'edge/home/types'

async function _load() {
  const [tokensResult, statsResult, topWinnerResult, poolsResult] = await Promise.allSettled([
    queryTokens(),
    querySiteStats(),
    queryPredictionUser(),
    queryPools(),
  ])

  const topTokens = tokensResult.status === 'fulfilled' ? tokensResult.value.topTokens : []
  const stats = statsResult.status === 'fulfilled' ? statsResult.value : undefined
  const topWinner = topWinnerResult.status === 'fulfilled' ? topWinnerResult.value : undefined
  const pools = poolsResult.status === 'fulfilled' ? poolsResult.value : []
  const currencies = homePageCurrencies
  const chains = homePageChainsInfo()
  return {
    tokens: topTokens,
    pools,
    currencies,
    chains,
    stats,
    partners,
    topWinner,
  } as HomePageData
}
export const loadHomePageData = cacheByLRU(_load, {
  ttl: 300 * 1000, // 5 minutes for update
  maxAge: 60 * 60 * 1000, // 1 hour
})

const handler: NextApiHandler = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60, max-age=30, stale-while-revalidate=300')
  const data = await loadHomePageData()
  return res.status(200).json(data)
}

export default handler
