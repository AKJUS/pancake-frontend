import { ChainId, getChainName } from '@pancakeswap/chains'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { cacheByLRU } from '@pancakeswap/utils/cacheByLRU'
import BN from 'bignumber.js'
import { fetchExplorerFarmPools } from 'state/farmsV4/state/farmPools/fetcher'
import { getCakeApr } from 'state/farmsV4/state/poolApr/fetcher'
import { PoolInfo } from 'state/farmsV4/state/type'
import { checksumAddress } from 'utils/checksumAddress'
import { HomePagePoolInfo } from '../types'
import { queryTokens } from './queryTokens'
import { getHomeCacheSettings } from './settings'

function scorePools(
  pools: PoolInfo[],
  weights = {
    tvlUsd: 8,
    apr: 2,
  },
) {
  const liquidityValues = pools.map((p) => Number(p.tvlUsd))
  const aprValues = pools.map((p) => parseFloat(p.lpApr || '0'))

  const minLiquidity = Math.min(...liquidityValues)
  const maxLiquidity = Math.max(...liquidityValues)

  const minApr = Math.min(...aprValues)
  const maxApr = Math.max(...aprValues)

  const normalize = (value: number, min: number, max: number) => (max === min ? 0 : (value - min) / (max - min))

  return pools
    .map((pool) => {
      const liquidityScore = normalize(Number(pool.tvlUsd), minLiquidity, maxLiquidity)
      const aprScore = normalize(Number(pool.lpApr), minApr, maxApr)
      const score = liquidityScore * weights.tvlUsd + aprScore * weights.apr

      return { pool, score }
    })
    .sort((a, b) => b.score - a.score)
}

export const queryPools = cacheByLRU(async () => {
  const { tokenMap, topTokens } = await queryTokens()
  const cake = topTokens.find((x) => x.symbol === 'CAKE')!
  const cakePrice = cake.price

  const poolsInfo = await fetchExplorerFarmPools()
  let filtered = poolsInfo.filter((x) => x.lpApr && x.tvlUsd)

  const uniq = new Set<string>()
  filtered = filtered.slice(0, 10).filter((p) => {
    const pair = `${p.token0.symbol}:${p.token1.symbol}`
    if (uniq.has(pair)) {
      return false
    }
    uniq.add(pair)
    return true
  })
  scorePools(filtered)
  const tops = filtered.slice(0, 3)

  const cakeAprs = await Promise.all(tops.map((p) => getCakeApr(p, BN(cakePrice))))
  const aprs = cakeAprs.map((x) => {
    const obj = Object.values(x)[0]
    if (!obj) return 0
    return Number.parseFloat(obj.value || '0')
  })

  function tokenLogo(chainId: ChainId, address: `0x${string}`) {
    const key = `${chainId}-${checksumAddress(address)}`
    return tokenMap[key]?.logoURI
  }
  return tops
    .filter((p) => p.lpAddress)
    .map((p, i) => {
      const chain = getChainName(p.chainId)
      const link = `/liquidity/pool/${chain}/${p.lpAddress}`
      return {
        id: checksumAddress(p.lpAddress!),
        link,
        protocol: p.protocol,
        token0: {
          id: p.token0.wrapped.address,
          symbol: p.token0.wrapped.symbol,
          chainId: p.chainId,
          icon: tokenLogo(p.chainId, p.token0.isNative ? ZERO_ADDRESS : p.token0.wrapped.address),
        },
        token1: {
          id: p.token1.wrapped.address,
          symbol: p.token1.wrapped.symbol,
          chainId: p.chainId,
          icon: tokenLogo(p.chainId, p.token1.isNative ? ZERO_ADDRESS : p.token1.wrapped.address),
        },
        chainId: p.chainId,
        apr24h: Number(p.lpApr) + aprs[i],
      } as HomePagePoolInfo
    })
}, getHomeCacheSettings('pools'))
