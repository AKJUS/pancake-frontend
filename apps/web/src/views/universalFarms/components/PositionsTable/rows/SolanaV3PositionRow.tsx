import { useMemo, useState, memo, useCallback } from 'react'
import { TokenInfo } from '@pancakeswap/solana-core-sdk'
import { NonEVMChainId } from '@pancakeswap/chains'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { Protocol } from '@pancakeswap/farms'
import { BigNumber as BN } from 'bignumber.js'
import { SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { POSITION_STATUS, SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { useSolanaV3Pool } from 'state/pools/solana'
import { useSolanaTokenPrice } from 'hooks/solana/useSolanaTokenPrice'
import { convertRawTokenInfoIntoSPLToken } from 'config/solana-list'
import { usePriceRangeData } from 'hooks/solana/usePriceRange'
import { useLiquidityAmount } from 'hooks/solana/useLiquidityAmount'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { SOLANA_FEE_TIER_BASE } from 'utils/normalizeSolanaPoolInfo'
import { formatPriceRange } from 'views/PoolDetail/utils/formatting'
import { useSolanaV3RewardInfoFromSimulation } from '../../../hooks/useSolanaV3RewardInfoFromSimulation'
import { useSolanaV3PositionApr } from '../../../hooks/usePositionAPR'
import { SolanaV3PoolPositionAprButton } from '../../PoolAprButton'
import { PositionRowDisplay, PositionDisplayData } from '../PositionRowDisplay'

interface SolanaV3PositionRowProps {
  position: SolanaV3PositionDetail
  chainId?: number
  hideEarningsColumn?: boolean
}

export const SolanaV3PositionRow: React.FC<SolanaV3PositionRowProps> = memo(({ position, hideEarningsColumn }) => {
  const [expanded, setExpanded] = useState(false)

  // Get pool info from Solana
  const poolInfo = useSolanaV3Pool(position.poolId.toBase58()) ?? undefined

  // Convert TokenInfo to SPL tokens (currencies)
  const currency0 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo?.mintA as TokenInfo), [poolInfo?.mintA])
  const currency1 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo?.mintB as TokenInfo), [poolInfo?.mintB])

  // Get token amounts using Solana liquidity hook
  const { amount0, amount1 } = useLiquidityAmount({
    poolInfo,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    liquidity: position.liquidity,
  })

  // Token prices
  const { data: currency0Price } = useSolanaTokenPrice({
    mint: currency0?.wrapped.address,
    enabled: Boolean(currency0),
  })
  const { data: currency1Price } = useSolanaTokenPrice({
    mint: currency1?.wrapped.address,
    enabled: Boolean(currency1),
  })

  // Total liquidity in USD
  const totalPriceUSD = useMemo(() => {
    return (
      Number(currency0Price ?? 0) * Number(amount0?.toExact() ?? 0) +
      Number(currency1Price ?? 0) * Number(amount1?.toExact() ?? 0)
    )
  }, [currency0Price, currency1Price, amount0, amount1])

  // Position status
  const removed = position.liquidity.isZero()
  const outOfRange = position.status === POSITION_STATUS.INACTIVE

  // Build pool object for APR and actions
  // Note: lpAddress is undefined for Solana so poolDetailUrl uses poolId instead
  const pool = useMemo(() => {
    if (!currency0 || !currency1 || !poolInfo) {
      return undefined
    }
    return {
      pid: 0,
      nftMint: position.nftMint,
      lpAddress: undefined as unknown as typeof ZERO_ADDRESS, // Use poolId for URL instead
      protocol: Protocol.V3,
      token0: currency0,
      token1: currency1,
      // Convert decimal feeRate to integer for proper percentage calculation
      feeTier: Math.round(poolInfo.feeRate * SOLANA_FEE_TIER_BASE),
      feeTierBase: SOLANA_FEE_TIER_BASE,
      isFarming: poolInfo.isFarming ?? false,
      poolId: position.poolId.toBase58(),
      liquidity: BigInt(position.liquidity.toString()),
      chainId: NonEVMChainId.SOLANA,
      tvlUsd: poolInfo.tvl.toString() as `${number}`,
      rawPool: poolInfo,
    } satisfies SolanaV3PoolInfo
  }, [currency0, currency1, poolInfo, position.liquidity, position.poolId, position.nftMint])

  // Fees and rewards from simulation
  const { breakdownRewardInfo, totalPendingYield } = useSolanaV3RewardInfoFromSimulation({
    poolInfo: pool,
    position,
  })

  // Earnings breakdown for tooltip
  const earningsBreakdown = useMemo(() => {
    if (removed || !breakdownRewardInfo) return undefined

    const fee0Amount = breakdownRewardInfo.fee.A ? BN(breakdownRewardInfo.fee.A.amount).toNumber() : 0
    const fee1Amount = breakdownRewardInfo.fee.B ? BN(breakdownRewardInfo.fee.B.amount).toNumber() : 0
    const fee0USD = breakdownRewardInfo.fee.A ? BN(breakdownRewardInfo.fee.A.amountUSD).toNumber() : 0
    const fee1USD = breakdownRewardInfo.fee.B ? BN(breakdownRewardInfo.fee.B.amountUSD).toNumber() : 0

    // Build farm rewards array with individual tokens
    const farmRewards = breakdownRewardInfo.rewards
      .filter((r) => BN(r.amount).gt(0))
      .map((r) => ({
        amount: BN(r.amount).toNumber(),
        amountUSD: BN(r.amountUSD).toNumber(),
        currency: convertRawTokenInfoIntoSPLToken(r.mint as TokenInfo),
      }))
      .filter((r) => r.currency) // Filter out any failed conversions

    // Sum up farm rewards for legacy fields
    const totalFarmRewardsUSD = farmRewards.reduce((acc, r) => acc + r.amountUSD, 0)
    const farmRewardsAmount = farmRewards.reduce((acc, r) => acc + r.amount, 0)

    return {
      fee0Amount: fee0Amount > 0 ? fee0Amount : undefined,
      fee1Amount: fee1Amount > 0 ? fee1Amount : undefined,
      fee0USD: fee0USD > 0 ? fee0USD : undefined,
      fee1USD: fee1USD > 0 ? fee1USD : undefined,
      // New: Multiple reward tokens
      farmRewards: farmRewards.length > 0 ? farmRewards : undefined,
      // Legacy fields for backward compatibility
      farmRewardsAmount: farmRewardsAmount > 0 ? farmRewardsAmount : undefined,
      farmRewardsUSD: totalFarmRewardsUSD > 0 ? totalFarmRewardsUSD : undefined,
      rewardCurrency: farmRewards[0]?.currency, // First token as primary
    }
  }, [breakdownRewardInfo, removed])

  // Earnings display
  const earnings = useMemo(() => {
    const totalUSD = totalPendingYield ? totalPendingYield.toNumber() : 0
    const display = totalUSD > 0 ? `~${formatDollarAmount(totalUSD)}` : '-'
    return { display }
  }, [totalPendingYield])

  // Price range display using Solana-specific hook
  const poolId = position.poolId.toBase58()
  const pairSymbols = currency0 && currency1 ? `${currency0.symbol}/${currency1.symbol}` : undefined
  const priceRangeDisplayRaw = usePriceRangeData({
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    baseIn: true,
    poolInfo,
    debugMeta: { poolId, pairSymbols },
  })

  // Price range display - hook now returns raw numeric values directly
  const priceRangeDisplay = useMemo(() => {
    if (!priceRangeDisplayRaw) return null

    // Apply smart formatting for valid price ranges
    let { minPriceFormatted, maxPriceFormatted } = priceRangeDisplayRaw
    const { minPrice, maxPrice } = priceRangeDisplayRaw

    if (
      minPrice &&
      maxPrice &&
      Number.isFinite(minPrice) &&
      Number.isFinite(maxPrice) &&
      minPrice > 0 &&
      maxPrice > 0
    ) {
      const formatted = formatPriceRange(minPrice, maxPrice)
      minPriceFormatted = formatted.minFormatted
      maxPriceFormatted = formatted.maxFormatted
    }

    return {
      ...priceRangeDisplayRaw,
      minPriceFormatted,
      maxPriceFormatted,
    }
  }, [priceRangeDisplayRaw])

  // APR calculation
  const { apr: solanaApr } = useSolanaV3PositionApr(pool ?? ({} as SolanaV3PoolInfo), position)

  const lpApr = useMemo(() => solanaApr?.fee?.apr ?? 0, [solanaApr])
  const farmApr = useMemo(() => solanaApr?.rewards?.reduce((acc, r) => acc + r.apr, 0) ?? 0, [solanaApr])
  const totalApr = useMemo(() => solanaApr?.apr ?? 0, [solanaApr])
  // Check if pool has an active farm
  // Only use farmApr as fallback when pool info is not available (farmApr can be stale)
  // Note: Solana pools don't have isActiveFarm, only isFarming
  const hasFarm = useMemo(() => Boolean(pool?.isFarming) || (!pool && farmApr > 0), [pool?.isFarming, pool, farmApr])

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  // APR button component - memoized to prevent data object from being recreated every render
  const aprButton = useMemo(
    () =>
      pool ? <SolanaV3PoolPositionAprButton pool={pool} userPosition={position} textProps={{ bold: true }} /> : null,
    [pool, position],
  )

  // Build display data
  const data: PositionDisplayData = useMemo(
    () => ({
      currency0,
      currency1,
      removed,
      outOfRange,
      pool: pool ?? null,
      totalPriceUSD,
      aprButton,
      hookData: undefined,
      chainId: NonEVMChainId.SOLANA,
      earnings,
      earningsBreakdown,
      amount0,
      amount1,
      price0Usd: currency0Price,
      price1Usd: currency1Price,
      priceRangeDisplay,
      lpApr,
      farmApr,
      totalApr,
      hasFarm,
      // Fee tier for Solana: convert decimal feeRate to integer representation
      // e.g., 0.0025 (0.25%) -> 2500, with base SOLANA_FEE_TIER_BASE for proper percentage calculation
      feeTier: poolInfo?.feeRate ? Math.round(poolInfo.feeRate * SOLANA_FEE_TIER_BASE) : undefined,
      feeTierBase: SOLANA_FEE_TIER_BASE,
    }),
    [
      currency0,
      currency1,
      removed,
      outOfRange,
      pool,
      totalPriceUSD,
      aprButton,
      earnings,
      earningsBreakdown,
      amount0,
      amount1,
      currency0Price,
      currency1Price,
      priceRangeDisplay,
      lpApr,
      farmApr,
      totalApr,
      hasFarm,
      poolInfo?.feeRate,
    ],
  )

  return (
    <PositionRowDisplay
      position={position}
      data={data}
      expanded={expanded}
      onToggleExpand={handleToggleExpand}
      hideEarningsColumn={hideEarningsColumn}
    />
  )
})
