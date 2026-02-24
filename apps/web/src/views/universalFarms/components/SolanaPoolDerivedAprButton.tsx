import React, { useMemo } from 'react'
import BN from 'bn.js'
import { Text, useTooltip } from '@pancakeswap/uikit'
import type { SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { useSolanaOnchainClmmPool } from 'hooks/solana/useSolanaOnchainPool'
import { useBirdeyeTokenPrice } from 'hooks/solana/useBirdeyeTokenPrice'
import { AprKey, useClmmApr } from 'hooks/solana/useClmmApr'
import { useV3FormState } from 'views/AddLiquidityV3/formViews/V3FormView/form/reducer'
import { useSolanaDerivedInfo } from 'hooks/solana/useSolanaDerivedInfo'
import { AprTooltipContent } from './PoolAprButtonV3/AprTooltipContent'
import { AprButton } from './PoolAprButton/AprButton'

export const SolanaPoolDerivedAprText: React.FC<{ pool: SolanaV3PoolInfo; fontSize?: string }> = ({
  pool,
  fontSize = '24px',
}) => {
  const { data: onchain } = useSolanaOnchainClmmPool(pool.poolId)

  // Derive ticks from current form state
  const formState = useV3FormState()
  const { ticks } = useSolanaDerivedInfo(pool.token0, pool.token1, pool.feeTier, pool.token0, undefined, formState)

  // Token + reward mints for price map
  const rewardMints = useMemo(
    () =>
      (onchain?.computePoolInfo?.rewardInfos || [])
        .map((ri: any) => ri?.tokenMint?.toBase58?.())
        .filter(Boolean) as string[],
    [onchain?.computePoolInfo?.rewardInfos],
  )
  const mintA = pool?.rawPool?.mintA?.address
  const mintB = pool?.rawPool?.mintB?.address

  const mintList = useMemo(() => [mintA, mintB, ...rewardMints], [mintA, mintB, rewardMints])

  const { data: birdeyePrices } = useBirdeyeTokenPrice({ mintList })

  const tokenPrices = useMemo(() => {
    const rec: Record<string, { value: number }> = {}
    if (mintA && birdeyePrices?.[mintA]?.value !== undefined) rec[mintA] = { value: birdeyePrices[mintA].value }
    if (mintB && birdeyePrices?.[mintB]?.value !== undefined) rec[mintB] = { value: birdeyePrices[mintB].value }
    rewardMints?.forEach((m) => {
      if (m && birdeyePrices?.[m]?.value !== undefined) rec[m] = { value: birdeyePrices[m].value }
    })
    return rec
  }, [birdeyePrices, mintA, mintB, rewardMints])

  const aprData = useClmmApr({
    poolInfo: pool.rawPool,
    poolLiquidity: (onchain?.computePoolInfo?.liquidity as BN) ?? new BN(0),
    positionInfo: { tickLower: ticks?.LOWER, tickUpper: ticks?.UPPER, liquidity: new BN(1) },
    timeBasis: AprKey.Day,
    planType: 'D',
    tokenPrices,
  })

  const { combinedApr, feeApr, rewardApr } = useMemo(
    () => ({
      combinedApr: Number(aprData?.apr || 0) / 100,
      feeApr: Number(aprData?.fee?.apr || 0) / 100,
      rewardApr: { value: aprData?.rewards.reduce((acc, r) => acc + Number(r.apr) / 100, 0) ?? 0 },
    }),
    [aprData],
  )

  const { tooltip, targetRef, tooltipVisible } = useTooltip(
    <AprTooltipContent cakeApr={rewardApr} combinedApr={combinedApr} lpFeeApr={feeApr} showDesc />,
  )

  return (
    <>
      <Text ref={targetRef}>
        <AprButton
          showApyButton={false}
          hasFarm={rewardApr.value > 0}
          baseApr={combinedApr}
          textProps={{ fontSize, fontWeight: '600' }}
        />
      </Text>
      {tooltipVisible && tooltip}
    </>
  )
}
