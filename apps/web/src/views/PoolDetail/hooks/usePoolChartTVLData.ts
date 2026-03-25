import { Protocol } from '@pancakeswap/farms'
import { useQuery } from '@tanstack/react-query'
import { QUERY_SETTINGS_IMMUTABLE, QUERY_SETTINGS_WITHOUT_INTERVAL_REFETCH } from 'config/constants'
import dayjs from 'dayjs'
import { explorerApiClient } from 'state/info/api/client'
import { useExplorerChainNameByQuery } from 'state/info/api/hooks'
import { components } from 'state/info/api/schema'

// PAN-9313: Pools with known bad TVL data points from the API.
// Key: `${chainName}:${lowercaseAddress}`, Value: set of bucket timestamps to skip
const TVL_DATA_BLACKLIST: Record<string, Set<string>> = {
  'bsc:0x54c27041dfa246727d9351613eb35da028ddf377225d8db9e68ca3b569b5ba24': new Set(['2025-05-05T00:00:00.000Z']),
  'bsc:0x47516855520496b84a169f7bb92ace7ffb6e8c535bccb52a308ccff113aeccfb': new Set(['2025-05-05T00:00:00.000Z']),
  'bsc:0xaf12088595c0d5615f1e9da6033a435705d60037c2a4230dd5e135aab9dcfeb5': new Set(['2025-05-05T00:00:00.000Z']),
  'bsc:0x737a7d974a19bafb34c8d74d898188c9b59689b91f291fa6ade69f71fa0f5afa': new Set(['2025-05-05T00:00:00.000Z']),
}

const fetchChartTVLData = async (
  address: string,
  chainName: components['schemas']['ChainName'],
  protocol: Protocol,
  period: components['schemas']['ChartPeriod'] = '1Y',
  signal?: AbortSignal,
) => {
  try {
    const resp = await explorerApiClient.GET('/cached/pools/chart/{protocol}/{chainName}/{address}/tvl', {
      signal,
      params: {
        path: {
          address,
          chainName,
          protocol,
        },
        query: {
          period,
        },
      },
    })
    if (!resp.data) {
      return []
    }

    const blacklistedBuckets = TVL_DATA_BLACKLIST[`${chainName}:${address.toLowerCase()}`]

    return resp.data
      .filter((d) => !blacklistedBuckets?.has(d.bucket as string))
      .map((d) => ({
        time: dayjs(d.bucket as string).toDate(),
        value: d.tvlUSD ? parseFloat(d.tvlUSD) ?? 0 : 0,
      }))
  } catch (error) {
    console.error('debug fetchChartTvlData error', error)
    return []
  }
}

export const usePoolChartTVLData = (
  address?: string,
  protocol?: Protocol,
  period: components['schemas']['ChartPeriod'] = '1Y',
) => {
  const chainName = useExplorerChainNameByQuery()

  return useQuery({
    queryKey: ['poolChartTVLData', chainName, address, protocol, period],
    queryFn: () => fetchChartTVLData(address!, chainName!, protocol!, period),
    enabled: !!address && !!protocol && !!chainName,
    ...QUERY_SETTINGS_IMMUTABLE,
    ...QUERY_SETTINGS_WITHOUT_INTERVAL_REFETCH,
  })
}
