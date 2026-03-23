import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { useQuery } from '@tanstack/react-query'
import { SLOW_INTERVAL } from 'config/constants'
import sha256 from 'crypto-js/sha256'
import { useInfinityCakeAPR } from 'hooks/infinity/useInfinityCakeAPR'
import { useCakePrice } from 'hooks/useCakePrice'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import memoize from 'lodash/memoize'
import { useCallback, useEffect } from 'react'
import { useExtendPoolsAtom } from 'state/farmsV4/state/extendPools/atom'
import { isInfinityProtocol } from 'utils/protocols'
import { ChainIdAddressKey, InfinityPoolInfo, PoolInfo } from '../type'
import {
  CakeApr,
  cakeAprSetterAtom,
  CakeAprValue,
  emptyCakeAprPoolsAtom,
  incentraAprAtom,
  merklAprAtom,
  poolAprAtom,
} from './atom'
import { getAllNetworkIncentraApr, getAllNetworkMerklApr, getCakeApr, getLpApr } from './fetcher'
import { buildPoolAprKey, normalizePoolAprKey } from './normalizePoolIdentifier'

const generatePoolKey = memoize((pools: PoolInfo[]) => {
  const poolData = pools.map((pool) => `${pool.chainId}:${pool.lpAddress}`).join(',')
  return sha256(poolData).toString()
})

const useCakeAPR = (key: ChainIdAddressKey | null, pool: PoolInfo | null) => {
  const updateCakeApr = useSetAtom(cakeAprSetterAtom)
  const normalizedKey = normalizePoolAprKey(key) ?? buildPoolAprKey(pool?.chainId, pool?.lpAddress)
  const poolApr = useAtomValue(poolAprAtom)[normalizedKey ?? '']
  const cakePrice = useCakePrice()

  // for infinity
  const infinityCakeAPR = useInfinityCakeAPR({
    chainId: pool?.chainId,
    poolId: (pool as InfinityPoolInfo)?.poolId,
    cakePrice,
    tvlUSD: pool?.tvlUsd,
  })
  useEffect(() => {
    if (normalizedKey && pool && isInfinityProtocol(pool?.protocol) && infinityCakeAPR.value) {
      updateCakeApr({ [normalizedKey]: infinityCakeAPR })
    }
  }, [normalizedKey, pool, updateCakeApr, infinityCakeAPR])

  // for v3,v2,ss
  useQuery({
    queryKey: ['cake apr', normalizedKey],
    queryFn: () => {
      if (!pool) {
        return undefined
      }
      return getCakeApr(pool, cakePrice).then((apr) => {
        updateCakeApr(apr)
        return apr
      })
    },
    enabled:
      !isInfinityProtocol(pool?.protocol) &&
      typeof pool?.tvlUsd !== 'undefined' &&
      !!normalizedKey &&
      cakePrice &&
      cakePrice.gt(BIG_ZERO),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return poolApr?.cakeApr
}

export type AprInfo = {
  lpApr: `${number}`
  cakeApr: CakeAprValue
  merklApr: `${number}`
  incentraApr: `${number}`
}

export const usePoolApr = (
  key: ChainIdAddressKey | null,
  pool: PoolInfo | null,
  apr24h: boolean = false,
  enabled: boolean = true,
): {
  lpApr: `${number}`
  cakeApr: CakeApr[keyof CakeApr]
  merklApr: `${number}`
  incentraApr: `${number}`
  apr24h?: boolean
} => {
  const { setPools } = useExtendPoolsAtom()
  const normalizedKey = normalizePoolAprKey(key) ?? buildPoolAprKey(pool?.chainId, pool?.lpAddress)
  const poolApr = useAtomValue(poolAprAtom)[normalizedKey ?? '']
  const [merklAprs, updateMerklApr] = useAtom(merklAprAtom)
  const [incentraAprs, updateIncentraApr] = useAtom(incentraAprAtom)
  const cakePrice = useCakePrice()
  const cakeAPR = useCakeAPR(normalizedKey ?? null, pool)

  const getMerklApr = useCallback(async () => {
    if (Object.values(merklAprs).length === 0) {
      return getAllNetworkMerklApr()
        .then((aprs) => {
          updateMerklApr(aprs)
          return normalizedKey ? aprs[normalizedKey] ?? '0' : '0'
        })
        .catch((error) => {
          console.error('Error fetching Merkl APR:', error)
          return '0'
        })
    }
    return normalizedKey ? merklAprs[normalizedKey] ?? '0' : '0'
  }, [normalizedKey, merklAprs, updateMerklApr])

  const getIncentraApr = useCallback(async () => {
    if (Object.values(incentraAprs).length === 0) {
      return getAllNetworkIncentraApr()
        .then((aprs) => {
          updateIncentraApr(aprs)
          return normalizedKey ? aprs[normalizedKey] ?? '0' : '0'
        })
        .catch((error) => {
          console.error('Error fetching Incentra APR:', error)
          return '0'
        })
    }
    return normalizedKey ? incentraAprs[normalizedKey] ?? '0' : '0'
  }, [normalizedKey, incentraAprs, updateIncentraApr])

  const updateCallback = useCallback(async () => {
    try {
      if (!pool) {
        throw new Error('Pool not found')
      }
      const [lpApr, merklApr, incentraApr] = await Promise.all([
        getLpApr(pool, apr24h)
          .then((apr) => {
            setPools([{ ...pool, lpApr: `${apr}` }])
            return `${apr}`
          })
          .catch(() => {
            console.warn('error getLpApr', pool)
            setPools([{ ...pool, lpApr: '0' }])
            return '0'
          }),
        getMerklApr(),
        getIncentraApr(),
      ])
      return {
        lpApr: `${lpApr}`,
        merklApr,
        incentraApr,
      } as const
    } catch (error) {
      console.warn('error usePoolApr', error)
      return {
        lpApr: '0',
        merklApr: '0',
        incentraApr: '0',
      } as const
    }
  }, [getMerklApr, getIncentraApr, pool, setPools, apr24h])

  useQuery({
    queryKey: ['apr', normalizedKey],
    queryFn: updateCallback,
    // calcV3PoolApr depend on pool's TvlUsd
    // so if there are local pool without tvlUsd, don't to fetch queryFn
    // issue: PAN-3698
    enabled:
      enabled &&
      typeof pool?.tvlUsd !== 'undefined' &&
      !poolApr?.lpApr &&
      !!normalizedKey &&
      cakePrice &&
      cakePrice.gt(BIG_ZERO),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return {
    lpApr: poolApr?.lpApr ?? '0',
    cakeApr: poolApr?.cakeApr ?? cakeAPR ?? { value: '0' },
    merklApr: poolApr?.merklApr ?? '0',
    incentraApr: poolApr?.incentraApr ?? '0',
  }
}

export const usePoolAprUpdater = () => {
  const pools = useAtomValue(emptyCakeAprPoolsAtom)
  const updateCakeApr = useSetAtom(cakeAprSetterAtom)
  const updateMerklApr = useSetAtom(merklAprAtom)
  const updateIncentraApr = useSetAtom(incentraAprAtom)
  const cakePrice = useCakePrice()

  useQuery({
    queryKey: ['apr', 'merkl', 'fetchMerklApr'],
    queryFn: ({ signal }) => getAllNetworkMerklApr(signal).then(updateMerklApr),
    refetchInterval: SLOW_INTERVAL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useQuery({
    queryKey: ['apr', 'incentra', 'fetchIncentraApr'],
    queryFn: ({ signal }) => getAllNetworkIncentraApr(signal).then(updateIncentraApr),
    refetchInterval: SLOW_INTERVAL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useQuery({
    queryKey: ['apr', 'cake', 'fetchCakeApr', generatePoolKey(pools)],
    queryFn: () =>
      // we already get infinity apr by useCakeAPR, so filter infinity here
      Promise.all(pools.filter((p) => !isInfinityProtocol(p.protocol)).map((pool) => getCakeApr(pool, cakePrice))).then(
        (aprList) => {
          updateCakeApr(aprList.reduce((acc, apr) => Object.assign(acc, apr), {}))
        },
      ),
    enabled: pools?.length > 0 && cakePrice && cakePrice.gt(BIG_ZERO),
    refetchInterval: SLOW_INTERVAL,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}
