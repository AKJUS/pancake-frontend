import { useMemo, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQueries } from '@tanstack/react-query'
import { NonEVMChainId } from '@pancakeswap/chains'
import { Protocol } from '@pancakeswap/farms'
import { TokenInfo } from '@pancakeswap/solana-core-sdk'
import BigNumber from 'bignumber.js'
import uniq from 'lodash/uniq'

import { useAtomValue } from 'jotai'
import { useSolanaPositionsInfoByAccount } from 'state/token/solanaPositionsInfo'
import { useSolanaV3Pools } from 'hooks/solana/useSolanaV3Pools'
import { useSolanaV3PoolsUpdater } from 'hooks/solana/useSolanaV3PoolsUpdater'
import { useSolanaTokenPrices } from 'hooks/solana/useSolanaTokenPrice'
import { useRaydium } from 'hooks/solana/useRaydium'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import type { SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import type { SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { SolanaV3Pool } from 'state/pools/solana'
import { convertRawTokenInfoIntoSPLToken } from 'config/solana-list'
import { getSolanaPoolStatus } from 'views/universalFarms/hooks/useSolanaV3Positions'
import { SOLANA_FEE_TIER_BASE } from 'utils/normalizeSolanaPoolInfo'
import { removeLiquidity } from 'state/pools/solana/actions'
import { QUERY_SETTINGS_IMMUTABLE } from 'config/constants'

import type { SolanaHarvestTarget } from 'hooks/solana/useSolanaClmmHarvestAllRewards'
import type { SolanaPositionItem } from '../SolanaHarvestPanel'
import type { RewardInfo } from '../shared/PositionCard'
import { solanaOptimisticallyRemovedKeysAtom } from '../state/atoms'

interface SolanaPositionWithPool {
  key: string
  position: SolanaV3PositionDetail
  pool: SolanaV3Pool
  poolInfo: SolanaV3PoolInfo
}

export interface SolanaHarvestModalData {
  solanaPositions: SolanaPositionItem[]
  solanaTotalEarningsUSD: number
  solanaHarvestTargets: SolanaHarvestTarget[]
  /** True only when we have nothing to show yet (first load). */
  solanaInitialLoading: boolean
  /** True when background refetching is happening but UI should remain usable. */
  solanaRefreshing: boolean
}

export function useSolanaHarvestModalData(): SolanaHarvestModalData {
  const { publicKey } = useWallet()
  const walletAddress = useMemo(() => publicKey?.toBase58(), [publicKey])
  const raydium = useRaydium()
  const [latestTxReceipt] = useLatestTxReceipt()
  const optimisticallyRemovedKeys = useAtomValue(solanaOptimisticallyRemovedKeysAtom)

  const {
    data: positionInfos,
    isLoading: positionsLoading,
    isFetching: positionsFetching,
  } = useSolanaPositionsInfoByAccount(walletAddress)

  const poolIds = useMemo(() => positionInfos?.map((pos) => pos.poolId.toBase58()) || [], [positionInfos])

  const pools = useSolanaV3Pools(poolIds)
  const { loading: poolsLoading } = useSolanaV3PoolsUpdater(useMemo(() => pools.filter((p) => !!p), [pools]))

  const poolsMap = useMemo(() => new Map(pools.filter((p): p is SolanaV3Pool => !!p).map((p) => [p.id, p])), [pools])

  const positionsWithPool = useMemo((): SolanaPositionWithPool[] => {
    if (!positionInfos) return []

    return positionInfos
      .map((pos) => {
        const pool = poolsMap.get(pos.poolId.toBase58())
        if (!pool || pos.liquidity.isZero()) return null

        const currency0 = convertRawTokenInfoIntoSPLToken(pool.mintA as TokenInfo)
        const currency1 = convertRawTokenInfoIntoSPLToken(pool.mintB as TokenInfo)
        if (!currency0 || !currency1) return null

        const enrichedPos: SolanaV3PositionDetail = {
          ...pos,
          status: getSolanaPoolStatus(pos, pool),
          protocol: Protocol.V3 as const,
          chainId: NonEVMChainId.SOLANA,
          token0: currency0,
          token1: currency1,
        }

        const poolInfo: SolanaV3PoolInfo = {
          pid: 0,
          nftMint: pos.nftMint,
          lpAddress: undefined as unknown as string,
          protocol: Protocol.V3,
          token0: currency0,
          token1: currency1,
          feeTier: Math.round(pool.feeRate * SOLANA_FEE_TIER_BASE),
          feeTierBase: SOLANA_FEE_TIER_BASE,
          isFarming: pool.isFarming ?? false,
          poolId: pos.poolId.toBase58(),
          liquidity: BigInt(pos.liquidity.toString()),
          chainId: NonEVMChainId.SOLANA,
          tvlUsd: pool.tvl.toString() as `${number}`,
          rawPool: pool,
        }

        const key = `sol-${pos.nftMint.toBase58()}`
        return { key, position: enrichedPos, pool, poolInfo }
      })
      .filter((x): x is SolanaPositionWithPool => x !== null)
  }, [positionInfos, poolsMap])

  // Collect all unique mints for price fetching
  const allMints = useMemo(() => {
    const mints: string[] = []
    for (const { pool } of positionsWithPool) {
      mints.push(pool.mintA.address, pool.mintB.address)
      for (const r of pool.rewardDefaultInfos ?? []) {
        mints.push(r.mint.address)
      }
    }
    return uniq(mints)
  }, [positionsWithPool])

  const { data: tokenPrices } = useSolanaTokenPrices({
    mints: allMints,
    enabled: allMints.length > 0,
  })

  // Batch simulate rewards for all positions
  const rewardQueries = useQueries({
    queries: positionsWithPool.map(({ position, poolInfo }) => ({
      queryKey: [
        'solana-harvest-modal-reward',
        poolInfo.poolId,
        position.nftMint.toBase58(),
        latestTxReceipt?.blockHash,
      ],
      queryFn: async () => {
        if (!raydium || !poolInfo) return null
        const result = await removeLiquidity({
          simulateOnly: true,
          poolInfo,
          raydium,
          position,
          liquidity: 0n,
          amountMinA: 0n,
          amountMinB: 0n,
        })
        return result ?? null
      },
      enabled: Boolean(raydium && poolInfo),
      ...QUERY_SETTINGS_IMMUTABLE,
    })),
  })

  const rewardsLoading = rewardQueries.some((q) => q.isPending)
  const rewardsFetching = rewardQueries.some((q) => q.isFetching)

  type Derived = {
    solanaPositions: SolanaPositionItem[]
    solanaHarvestTargets: SolanaHarvestTarget[]
    solanaTotalEarningsUSD: number
  }

  const lastGoodRef = useRef<Derived>({ solanaPositions: [], solanaHarvestTargets: [], solanaTotalEarningsUSD: 0 })

  // Build final Solana positions and targets from simulation results.
  // Keep last-good results while background refresh is happening so the list doesn't collapse.
  const derived = useMemo((): { next: Derived; ready: boolean } => {
    const items: SolanaPositionItem[] = []
    const targets: SolanaHarvestTarget[] = []
    let totalUSD = 0

    // If any reward simulation is still pending (loading or disabled-awaiting-raydium),
    // avoid replacing the list with partial/empty results.
    // We'll keep rendering the last "good" snapshot until all simulations are resolved.
    // NOTE: isPending covers both actively-loading AND disabled-but-no-data queries (React Query v5),
    // which is critical when raydium is not yet initialized — isLoading would be false for those.
    if (rewardQueries.some((q) => q.isPending)) {
      return { next: lastGoodRef.current, ready: false }
    }

    for (let i = 0; i < positionsWithPool.length; i++) {
      const { key, position, pool } = positionsWithPool[i]
      const simResult = rewardQueries[i]?.data

      const prices = tokenPrices ?? {}
      const mintAPrice = prices[pool.mintA.address.toLowerCase()] ?? 0
      const mintBPrice = prices[pool.mintB.address.toLowerCase()] ?? 0

      let earningsUSD = 0
      const rewards: RewardInfo[] = []

      if (simResult) {
        // Fee earnings
        const feeA = new BigNumber(simResult.feeAmount0?.toString() ?? '0')
          .div(10 ** pool.mintA.decimals)
          .times(mintAPrice)
        const feeB = new BigNumber(simResult.feeAmount1?.toString() ?? '0')
          .div(10 ** pool.mintB.decimals)
          .times(mintBPrice)
        earningsUSD += feeA.plus(feeB).toNumber()

        // Fee amounts as reward entries
        const feeAAmount = new BigNumber(simResult.feeAmount0?.toString() ?? '0').div(10 ** pool.mintA.decimals)
        const feeBAmount = new BigNumber(simResult.feeAmount1?.toString() ?? '0').div(10 ** pool.mintB.decimals)

        const currency0 = convertRawTokenInfoIntoSPLToken(pool.mintA as TokenInfo)
        const currency1 = convertRawTokenInfoIntoSPLToken(pool.mintB as TokenInfo)

        if (feeAAmount.gt(0) && currency0) {
          rewards.push({ currency: currency0, amount: feeAAmount.toNumber() })
        }
        if (feeBAmount.gt(0) && currency1) {
          rewards.push({ currency: currency1, amount: feeBAmount.toNumber() })
        }

        // Farm reward earnings
        const rewardAmounts = simResult.rewardAmounts ?? []
        for (let j = 0; j < rewardAmounts.length; j++) {
          const rewardMint = pool.rewardDefaultInfos?.[j]?.mint
          if (!rewardMint) continue
          const amount = new BigNumber(rewardAmounts[j].toString()).div(10 ** (rewardMint.decimals || 0))
          const rewardPrice = prices[rewardMint.address.toLowerCase()] ?? 0
          earningsUSD += amount.times(rewardPrice).toNumber()

          if (amount.gt(0)) {
            const rewardCurrency = convertRawTokenInfoIntoSPLToken(rewardMint as TokenInfo)
            if (rewardCurrency) {
              rewards.push({ currency: rewardCurrency, amount: amount.toNumber() })
            }
          }
        }
      }

      if (earningsUSD > 0 || rewards.length > 0) {
        const currency0 = position.token0
        const currency1 = position.token1
        if (currency0 && currency1) {
          items.push({ key, currency0, currency1, earningsUSD, rewards })
          targets.push({ key, position, poolInfo: pool })
          totalUSD += earningsUSD
        }
      }
    }

    return {
      next: { solanaPositions: items, solanaHarvestTargets: targets, solanaTotalEarningsUSD: totalUSD },
      ready: true,
    }
  }, [positionsWithPool, rewardQueries, tokenPrices])

  if (derived.ready) {
    lastGoodRef.current = derived.next
  }

  const filtered = useMemo((): Derived => {
    const base = derived.ready ? derived.next : lastGoodRef.current
    if (!optimisticallyRemovedKeys.size) return base
    const positions = base.solanaPositions.filter((p) => !optimisticallyRemovedKeys.has(p.key))
    const targets = base.solanaHarvestTargets.filter((t) => !optimisticallyRemovedKeys.has(t.key))
    const removedUSD = base.solanaPositions.reduce(
      (acc, p) => (optimisticallyRemovedKeys.has(p.key) ? acc + p.earningsUSD : acc),
      0,
    )
    return {
      solanaPositions: positions,
      solanaHarvestTargets: targets,
      solanaTotalEarningsUSD: Math.max(0, base.solanaTotalEarningsUSD - removedUSD),
    }
  }, [optimisticallyRemovedKeys, derived])

  const solanaRefreshing = Boolean(positionsFetching || poolsLoading || rewardsFetching)
  const solanaInitialLoading =
    (positionsLoading || poolsLoading || rewardsLoading) && filtered.solanaPositions.length === 0

  return {
    solanaPositions: filtered.solanaPositions,
    solanaTotalEarningsUSD: filtered.solanaTotalEarningsUSD,
    solanaHarvestTargets: filtered.solanaHarvestTargets,
    solanaInitialLoading,
    solanaRefreshing: !solanaInitialLoading && solanaRefreshing,
  }
}
