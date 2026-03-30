import { Protocol, fetchAllUniversalFarmsMap, type BCakeWrapperFarmConfig } from '@pancakeswap/farms'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { BigNumber as BN } from 'bignumber.js'
import { ChainId, isSolana } from '@pancakeswap/chains'
import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import dayjs from 'dayjs'
import { getTokenByAddress } from '@pancakeswap/tokens'

import { useActiveChainId } from 'hooks/useActiveChainId'
import { useCakePrice } from 'hooks/useCakePrice'
import { usePoolFarmRewardsFormAPI } from 'hooks/infinity/useFarmReward'
import { useStakedPositionsByUser } from 'state/farmsV3/hooks'
import {
  useAccountInfinityCLPositions,
  useAccountInfinityBinPositions,
  useAccountV3Positions,
  useAccountV2LpDetails,
  useAccountStableLpDetails,
} from 'state/farmsV4/state/accountPositions/hooks'
import { useAccountInfinityStablePositions } from 'state/farmsV4/state/accountPositions/hooks/useAccountInfinityStablePositions'
import type {
  PositionDetail,
  V2LPDetail,
  StableLPDetail,
  InfinityCLPositionDetail,
  InfinityBinPositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import type { V2PoolInfo, StablePoolInfo } from 'state/farmsV4/state/type'
import { formatBigInt } from '@pancakeswap/utils/formatBalance'
import { getAccountV2FarmingBCakeWrapperEarning } from 'state/farmsV4/state/accountPositions/fetcher'
import { rewardApiClient } from 'state/farmsV4/api/client'
import { useAllEvmChainIds } from 'views/universalFarms/hooks/useMultiChains'
import { DEFAULT_EVM_CHAIN_ID } from '../constants'

import type { V2HarvestTarget } from './useEvmHarvestAll'
import { useSolanaHarvestModalData, type SolanaHarvestModalData } from './useSolanaHarvestModalData'
import {
  flushHarvestModalEvmPositionsCache,
  harvestModalCurrentChainEvmPositionsPending,
  harvestModalEvmPositionsCacheAtom,
  harvestModalOtherChainsScanSatisfied,
  mergeHarvestModalChainSlice,
  mergeHarvestModalOtherChainsSlice,
} from '../state/harvestModalEvmPositionsCache'

export interface V3HarvestPositionEnriched {
  position: PositionDetail
  pendingCakeAmount: number
  earningsUSD: number
}

export interface InfinityHarvestPositionEnriched {
  position: InfinityCLPositionDetail | InfinityBinPositionDetail
  earningsUSD: number
  cakeAmount: number
}

/** Per-position V2 / stable-swap bCake wrapper pending reward (USD + human CAKE), keyed like V2HarvestTarget.key */
export type V2StableHarvestEarningsByKey = Record<string, { earningsUSD: number; pendingCakeAmount: number }>

export interface HarvestModalData {
  v3HarvestPositions: V3HarvestPositionEnriched[]
  infinityHarvestPositions: InfinityHarvestPositionEnriched[]
  v2Positions: V2LPDetail[]
  stablePositions: StableLPDetail[]
  evmTotalEarningsUSD: number
  v3StakedTokenIds: string[]
  v2Targets: V2HarvestTarget[]
  /** Pending CAKE from bCake wrappers (V2 + stable), for list rows + totals */
  v2StableEarningsByKey: V2StableHarvestEarningsByKey
  otherChainsWithRewards: number[]
  solanaPositions: SolanaHarvestModalData['solanaPositions']
  solanaTotalEarningsUSD: number
  solanaHarvestTargets: SolanaHarvestModalData['solanaHarvestTargets']
  totalEarningsUSD: number
  /** EVM chain id used for all harvest-modal position + reward fetches (focused chain or wallet EVM / default). */
  effectiveEvmChainId: number
  /** True while fetching EVM position data for the active chain only */
  isCurrentChainEvmLoading: boolean
  /** True while scanning other EVM chains for the switch-network alert */
  isOtherChainsEvmLoading: boolean
  solanaInitialLoading: boolean
  solanaRefreshing: boolean
}

/**
 * Fetches EVM positions for the active chain first (for immediate UI), other EVM chains
 * in parallel for the switch-network alert, and Solana via useSolanaHarvestModalData.
 *
 * @param focusedChainId - When provided (e.g. the chain of the position the user clicked Harvest on),
 *   overrides the wallet's active chain so the modal fetches and displays positions for that chain instead.
 */
export function useHarvestModalData(focusedChainId?: number): HarvestModalData {
  const { chainId } = useActiveChainId()
  const { address: account } = useAccount()
  const cakePrice = useCakePrice()
  const allEvmChainIds = useAllEvmChainIds()
  const harvestEvmCache = useAtomValue(harvestModalEvmPositionsCacheAtom)
  const setHarvestEvmCache = useSetAtom(harvestModalEvmPositionsCacheAtom)

  // When on a non-EVM chain (e.g. Solana), default to BSC so EVM positions are always shown.
  // If a focusedChainId is provided (opened from a specific position), use that chain instead
  // so the modal immediately shows positions for the position's chain regardless of wallet chain.
  const effectiveEvmChainId: number =
    focusedChainId ?? (chainId != null && !isSolana(chainId) ? chainId : DEFAULT_EVM_CHAIN_ID)

  const currentEvmChainIds = useMemo(() => [effectiveEvmChainId], [effectiveEvmChainId])
  const otherEvmChainIds = useMemo(
    () => allEvmChainIds.filter((id) => id !== effectiveEvmChainId),
    [allEvmChainIds, effectiveEvmChainId],
  )

  // --- Current chain: show harvest UI as soon as this completes ---
  const { data: infinityCLCurrent, pending: p1c } = useAccountInfinityCLPositions(currentEvmChainIds, account)
  const { data: infinityBinCurrent, pending: p2c } = useAccountInfinityBinPositions(account, currentEvmChainIds)
  const { data: v3Current, pending: p3c } = useAccountV3Positions(currentEvmChainIds, account)
  const { data: v2Current, pending: p4c } = useAccountV2LpDetails(currentEvmChainIds, account)
  const { data: stableCurrent, pending: p5c } = useAccountStableLpDetails(currentEvmChainIds, account)
  const { data: infinityStableCurrent, pending: p6c } = useAccountInfinityStablePositions(currentEvmChainIds, account)

  // --- Other chains: background scan for “switch network” message ---
  const { data: infinityCLOther, pending: p1o } = useAccountInfinityCLPositions(otherEvmChainIds, account)
  const { data: infinityBinOther, pending: p2o } = useAccountInfinityBinPositions(account, otherEvmChainIds)
  const { data: v3Other, pending: p3o } = useAccountV3Positions(otherEvmChainIds, account)

  useEffect(() => {
    setHarvestEvmCache((prev) =>
      flushHarvestModalEvmPositionsCache(prev, {
        account,
        chainId: effectiveEvmChainId,
        current: {
          p1c,
          p2c,
          p3c,
          p4c,
          p5c,
          p6c,
          infinityCL: infinityCLCurrent,
          infinityBin: infinityBinCurrent,
          v3: v3Current,
          v2: v2Current,
          stable: stableCurrent,
          infinityStable: infinityStableCurrent,
        },
        otherChainIds: otherEvmChainIds,
        other: {
          p1o,
          p2o,
          p3o,
          infinityCL: infinityCLOther,
          infinityBin: infinityBinOther,
          v3: v3Other,
        },
      }),
    )
  }, [
    account,
    effectiveEvmChainId,
    p1c,
    p2c,
    p3c,
    p4c,
    p5c,
    p6c,
    infinityCLCurrent,
    infinityBinCurrent,
    v3Current,
    v2Current,
    stableCurrent,
    infinityStableCurrent,
    p1o,
    p2o,
    p3o,
    infinityCLOther,
    infinityBinOther,
    v3Other,
    otherEvmChainIds,
    setHarvestEvmCache,
  ])

  const {
    infinityCL: infinityCLForCurrent,
    infinityBin: infinityBinForCurrent,
    v3: v3ForCurrent,
    v2: v2ForCurrent,
    stable: stableForCurrent,
    infinityStable: infinityStableForCurrent,
  } = useMemo(
    () => ({
      infinityCL: mergeHarvestModalChainSlice(
        account,
        harvestEvmCache,
        effectiveEvmChainId,
        p1c,
        infinityCLCurrent,
        'infinityCL',
      ),
      infinityBin: mergeHarvestModalChainSlice(
        account,
        harvestEvmCache,
        effectiveEvmChainId,
        p2c,
        infinityBinCurrent,
        'infinityBin',
      ),
      v3: mergeHarvestModalChainSlice(account, harvestEvmCache, effectiveEvmChainId, p3c, v3Current, 'v3'),
      v2: mergeHarvestModalChainSlice(account, harvestEvmCache, effectiveEvmChainId, p4c, v2Current, 'v2'),
      stable: mergeHarvestModalChainSlice(account, harvestEvmCache, effectiveEvmChainId, p5c, stableCurrent, 'stable'),
      infinityStable: mergeHarvestModalChainSlice(
        account,
        harvestEvmCache,
        effectiveEvmChainId,
        p6c,
        infinityStableCurrent,
        'infinityStable',
      ),
    }),
    [
      account,
      harvestEvmCache,
      effectiveEvmChainId,
      p1c,
      p2c,
      p3c,
      p4c,
      p5c,
      p6c,
      infinityCLCurrent,
      infinityBinCurrent,
      v3Current,
      v2Current,
      stableCurrent,
      infinityStableCurrent,
    ],
  )

  const {
    v3: v3OtherMerged,
    infinityCL: infinityCLOtherMerged,
    infinityBin: infinityBinOtherMerged,
  } = useMemo(
    () => ({
      v3: mergeHarvestModalOtherChainsSlice(account, harvestEvmCache, otherEvmChainIds, p3o, v3Other, 'v3'),
      infinityCL: mergeHarvestModalOtherChainsSlice(
        account,
        harvestEvmCache,
        otherEvmChainIds,
        p1o,
        infinityCLOther,
        'infinityCL',
      ),
      infinityBin: mergeHarvestModalOtherChainsSlice(
        account,
        harvestEvmCache,
        otherEvmChainIds,
        p2o,
        infinityBinOther,
        'infinityBin',
      ),
    }),
    [account, harvestEvmCache, otherEvmChainIds, p1o, p2o, p3o, infinityCLOther, infinityBinOther, v3Other],
  )

  const isCurrentChainPositionsLayerLoading = useMemo(
    () =>
      harvestModalCurrentChainEvmPositionsPending(account, harvestEvmCache, effectiveEvmChainId, {
        p1c,
        p2c,
        p3c,
        p4c,
        p5c,
        p6c,
      }),
    [account, harvestEvmCache, effectiveEvmChainId, p1c, p2c, p3c, p4c, p5c, p6c],
  )

  const isOtherChainsEvmLoading =
    (p1o || p2o || p3o) && !harvestModalOtherChainsScanSatisfied(account, harvestEvmCache, otherEvmChainIds)

  const { data: farmsMap } = useQuery({
    queryKey: ['fetchAllUniversalFarmsMap'],
    queryFn: fetchAllUniversalFarmsMap,
    staleTime: 60_000,
  })

  // --- Infinity: positions on current chain (including closed/zero-liquidity positions that may still have unclaimed rewards) ---
  const infinityPositions = useMemo(
    () =>
      [...infinityCLForCurrent, ...infinityBinForCurrent].filter(
        (p): p is InfinityCLPositionDetail | InfinityBinPositionDetail => p.chainId === effectiveEvmChainId,
      ),
    [infinityCLForCurrent, infinityBinForCurrent, effectiveEvmChainId],
  )

  // --- Per-position Infinity earnings: fetch ALL pool rewards in one call ---
  // usePoolFarmRewardsFormAPI without poolId → calls /farms/user-rewards/{chainId}/{address}
  // which returns per-pool, per-tokenId reward data for all positions at once.
  const hourTimestamp = useMemo(() => dayjs().startOf('hour').unix(), [])
  const { data: allPoolRewards } = usePoolFarmRewardsFormAPI({
    chainId: effectiveEvmChainId,
    address: account,
    timestamp: hourTimestamp,
  })

  // Build a map: poolId → tokenId → cakeAmount (human-readable, cumulative from API).
  // Per-position UNCLAIMED amounts are computed in InfinityHarvestRow using
  // useUnclaimedFarmRewardsUSDByTokenId (same hook as the positions table), which correctly
  // subtracts the before-last-claimed snapshot via the per-pool snapshot endpoint.
  // The all-pools endpoint used here does not support timestamp-based snapshots.
  const infinityEarningsMap = useMemo(() => {
    if (!allPoolRewards) return {}
    const map: Record<string, Record<string, number>> = {}
    for (const reward of allPoolRewards) {
      const { poolId, tokenIds, rewardAmounts, rewardTokenAddress } = reward
      const token = getTokenByAddress(effectiveEvmChainId, rewardTokenAddress)
      const decimals = token?.decimals ?? 18
      if (!map[poolId]) map[poolId] = {}
      tokenIds.forEach((tokenId, idx) => {
        const humanAmount = BN(rewardAmounts[idx]).div(BN(10).pow(decimals)).toNumber()
        map[poolId][tokenId] = (map[poolId][tokenId] ?? 0) + humanAmount
      })
    }
    return map
  }, [allPoolRewards, effectiveEvmChainId])

  // --- Infinity positions enriched with per-position earnings (zero-reward positions excluded) ---
  const infinityHarvestPositions = useMemo((): InfinityHarvestPositionEnriched[] => {
    return infinityPositions
      .map((pos) => {
        let cakeAmount = 0
        const poolMap = infinityEarningsMap[pos.poolId]
        if (poolMap) {
          if (pos.protocol === Protocol.InfinityCLAMM) {
            const clPos = pos as InfinityCLPositionDetail
            cakeAmount = poolMap[clPos.tokenId.toString()] ?? 0
          } else {
            // BIN: sum all tokenId entries for this pool (one user = one position per pool)
            cakeAmount = Object.values(poolMap).reduce((acc, v) => acc + v, 0)
          }
        }
        const earningsUSD =
          cakeAmount > 0 && cakePrice.gt(0) ? BN(cakeAmount).times(cakePrice.toString()).toNumber() : 0
        return { position: pos, earningsUSD, cakeAmount }
      })
      .filter((p) => p.cakeAmount > 0)
  }, [infinityPositions, infinityEarningsMap, cakePrice])

  // --- V3: staked on current chain ---
  const v3StakedPositions = useMemo(
    () =>
      v3ForCurrent.filter(
        (p): p is PositionDetail =>
          !isSolana(p.chainId) && p.chainId === effectiveEvmChainId && Boolean(p.isStaked) && p.tokenId !== undefined,
      ),
    [v3ForCurrent, effectiveEvmChainId],
  )

  // All staked IDs (needed to query pending rewards for every position)
  const stakedBigIntIds = useMemo(
    () => v3StakedPositions.map((p) => BigInt(p.tokenId!.toString())),
    [v3StakedPositions],
  )

  const { tokenIdResults: v3PendingCakes, isLoading: v3EarningsLoading } = useStakedPositionsByUser(
    stakedBigIntIds,
    effectiveEvmChainId,
  )

  const v3HarvestPositions = useMemo((): V3HarvestPositionEnriched[] => {
    return v3StakedPositions
      .map((pos, idx) => {
        const pendingCake = v3PendingCakes?.[idx] ?? 0n
        const amount = +formatBigInt(pendingCake, 18) // 18-decimal precision
        const usd = BN(amount).times(cakePrice.toString()).toNumber()
        return { position: pos, pendingCakeAmount: amount, earningsUSD: usd }
      })
      .filter((p) => p.pendingCakeAmount > 0)
  }, [v3StakedPositions, v3PendingCakes, cakePrice])

  // Only harvest positions with actual rewards
  const v3StakedTokenIds = useMemo(
    () => v3HarvestPositions.map((p) => p.position.tokenId!.toString()),
    [v3HarvestPositions],
  )

  // --- V2: staked on current chain ---
  const v2Positions = useMemo(
    () =>
      v2ForCurrent.filter(
        (p) => p.pair.chainId === effectiveEvmChainId && Boolean(p.isStaked) && p.farmingBalance.greaterThan(0),
      ),
    [v2ForCurrent, effectiveEvmChainId],
  )

  // --- Stable: staked on current chain (regular + Infinity stable) ---
  const stablePositions = useMemo(() => {
    const all = [...stableForCurrent, ...infinityStableForCurrent]
    return all.filter(
      (p) =>
        p.pair.liquidityToken.chainId === effectiveEvmChainId && Boolean(p.isStaked) && p.farmingBalance.greaterThan(0),
    )
  }, [stableForCurrent, infinityStableForCurrent, effectiveEvmChainId])

  // --- V2/Stable harvest targets ---
  const v2Targets = useMemo((): V2HarvestTarget[] => {
    if (!farmsMap) return []
    const targets: V2HarvestTarget[] = []
    const addTarget = (key: string, lpAddress: string) => {
      const configKey = `${lpAddress.toLowerCase()}-${effectiveEvmChainId}`
      const farmConfig = farmsMap[configKey] as
        | ({ bCakeWrapperAddress?: Address } & (V2PoolInfo | StablePoolInfo))
        | undefined
      if (!farmConfig?.bCakeWrapperAddress) return
      targets.push({
        key,
        lpAddress: lpAddress as Address,
        bCakeWrapperAddress: farmConfig.bCakeWrapperAddress,
      })
    }
    for (const pos of v2Positions) {
      const lp = pos.pair?.liquidityToken?.address
      if (lp) addTarget(`v2-${lp}`, lp)
    }
    for (const pos of stablePositions) {
      const lp: string | undefined = (pos as any).pair?.stableSwapAddress ?? pos.pair?.liquidityToken?.address
      if (lp) addTarget(`ss-${lp}`, lp)
    }
    return targets
  }, [v2Positions, stablePositions, farmsMap, effectiveEvmChainId])

  const bCakeWrapperConfigs = useMemo((): BCakeWrapperFarmConfig[] => {
    return v2Targets.map((t) => ({
      chainId: effectiveEvmChainId,
      lpAddress: t.lpAddress,
      bCakeWrapperAddress: t.bCakeWrapperAddress,
    }))
  }, [effectiveEvmChainId, v2Targets])

  const v2TargetsKey = useMemo(() => v2Targets.map((t) => `${t.bCakeWrapperAddress}`).join(','), [v2Targets])

  const { data: v2StablePendingWeiStrings, isPending: v2StablePendingLoading } = useQuery({
    queryKey: ['harvestModalV2StablePendingCake', effectiveEvmChainId, account, v2TargetsKey],
    queryFn: () => getAccountV2FarmingBCakeWrapperEarning(effectiveEvmChainId, account!, bCakeWrapperConfigs),
    enabled: Boolean(account && bCakeWrapperConfigs.length > 0),
  })

  const v2StableEarningsByKey = useMemo((): V2StableHarvestEarningsByKey => {
    const out: V2StableHarvestEarningsByKey = {}
    if (!v2StablePendingWeiStrings?.length || !cakePrice.gt(0)) return out
    v2Targets.forEach((target, i) => {
      const weiStr = v2StablePendingWeiStrings[i]
      if (!weiStr) return
      const wei = BigInt(weiStr)
      if (wei === 0n) return
      const pendingCakeAmount = +formatBigInt(wei, 18) // 18-decimal precision
      const earningsUSD = BN(pendingCakeAmount).times(cakePrice.toString()).toNumber()
      out[target.key] = { earningsUSD, pendingCakeAmount }
    })
    return out
  }, [v2Targets, v2StablePendingWeiStrings, cakePrice])

  const isCurrentChainEvmLoading =
    isCurrentChainPositionsLayerLoading || v3EarningsLoading || (v2Targets.length > 0 && v2StablePendingLoading)

  // --- Infinity rewards check for other chains ---
  // Batch-fetch the user merkle reward payload for each other chain that has Infinity positions
  // (liquidity > 0). This eliminates false positives in the "switch network" alert -- a chain is
  // only surfaced if the API confirms there are rewards with a positive totalRewardAmount.
  // We intentionally skip the on-chain claimedAmounts subtraction (too expensive for background
  // per-chain RPC calls); a positive API amount is a reliable-enough proxy.
  const otherInfinityChainIds = useMemo(() => {
    const ids = new Set<number>()
    for (const p of [...infinityCLOtherMerged, ...infinityBinOtherMerged]) {
      if (!isSolana(p.chainId)) ids.add(p.chainId)
    }
    return [...ids]
  }, [infinityCLOtherMerged, infinityBinOtherMerged])

  const otherInfinityChainIdsKey = otherInfinityChainIds.join(',')

  const { data: otherChainsInfinityHasRewards } = useQuery<Record<number, boolean>>({
    queryKey: ['otherChainsInfinityHasRewards', otherInfinityChainIdsKey, account],
    queryFn: async ({ signal }) => {
      if (!account || otherInfinityChainIds.length === 0) return {}
      const now = Math.floor(Date.now() / 1000).toString()
      const results = await Promise.all(
        otherInfinityChainIds.map(async (cId) => {
          try {
            const resp = await rewardApiClient.GET('/farms/users/{chainId}/{address}/{timestamp}', {
              baseUrl:
                cId === ChainId.BSC_TESTNET ? 'https://test.v4.pancakeswap.com/' : 'https://infinity.pancakeswap.com/',
              params: { path: { chainId: cId, address: account, timestamp: now } },
              signal,
            })
            const rewards = resp.data?.rewards ?? []
            return { cId, hasRewards: rewards.some((r) => BigInt(r.totalRewardAmount) > 0n) }
          } catch {
            return { cId, hasRewards: false }
          }
        }),
      )
      return Object.fromEntries(results.map(({ cId, hasRewards }) => [cId, hasRewards]))
    },
    enabled: !!account && otherInfinityChainIds.length > 0,
    staleTime: 60_000,
  })

  // --- Other EVM chains with staked / Infinity liquidity (from background scan) ---
  // When the active chain is Solana, otherEvmChainIds is all EVM chains, so this still surfaces
  // "switch network" targets. When active is EVM, v3Other / infinity*Other exclude the current chain.
  // Infinity is additionally gated on the rewards API check above; V3 uses isStaked as proxy
  // (pending cake per other chain would require expensive per-chain on-chain multicalls).
  const otherChainsWithRewards = useMemo(() => {
    const others = new Set<number>()
    for (const p of v3OtherMerged) {
      if (!isSolana(p.chainId) && p.isStaked) others.add(p.chainId)
    }
    for (const p of [...infinityCLOtherMerged, ...infinityBinOtherMerged]) {
      if (!isSolana(p.chainId) && otherChainsInfinityHasRewards?.[p.chainId]) {
        others.add(p.chainId)
      }
    }
    return Array.from(others)
  }, [v3OtherMerged, infinityCLOtherMerged, infinityBinOtherMerged, otherChainsInfinityHasRewards])

  const evmTotalEarningsUSD = useMemo(
    () =>
      infinityHarvestPositions.reduce((acc, p) => acc + p.earningsUSD, 0) +
      v3HarvestPositions.reduce((acc, p) => acc + p.earningsUSD, 0) +
      Object.values(v2StableEarningsByKey).reduce((acc, v) => acc + v.earningsUSD, 0),
    [infinityHarvestPositions, v3HarvestPositions, v2StableEarningsByKey],
  )

  const { solanaPositions, solanaTotalEarningsUSD, solanaHarvestTargets, solanaInitialLoading, solanaRefreshing } =
    useSolanaHarvestModalData()

  return {
    v3HarvestPositions,
    infinityHarvestPositions,
    v2Positions,
    stablePositions,
    evmTotalEarningsUSD,
    v3StakedTokenIds,
    v2Targets,
    v2StableEarningsByKey,
    otherChainsWithRewards,
    solanaPositions,
    solanaTotalEarningsUSD,
    solanaHarvestTargets,
    totalEarningsUSD: evmTotalEarningsUSD + solanaTotalEarningsUSD,
    effectiveEvmChainId,
    isCurrentChainEvmLoading,
    isOtherChainsEvmLoading,
    solanaInitialLoading,
    solanaRefreshing,
  }
}
