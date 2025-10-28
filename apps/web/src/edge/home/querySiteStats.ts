import { cacheByLRU } from '@pancakeswap/utils/cacheByLRU'
import { getTotalTvl } from 'utils/getTotalTVL'
import { getHomeCacheSettings } from './queries/settings'
import { SiteStats } from './types'

export const querySiteStats = cacheByLRU(async () => {
  const results = await getTotalTvl()

  return {
    totalUsers: results.addressCount30Days,
    totalTrades: results.totalTx30Days,
    totalValueLocked: results.tvl,
    community: 2_400_000,
  } as SiteStats
}, getHomeCacheSettings('site-stats'))
