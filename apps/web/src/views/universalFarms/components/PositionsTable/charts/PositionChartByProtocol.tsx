import { Protocol } from '@pancakeswap/farms'
import { isSolana } from '@pancakeswap/chains'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import type { Currency } from '@pancakeswap/swap-sdk-core'
import type { Address } from 'viem'
import type {
  PositionDetail,
  InfinityCLPositionDetail,
  InfinityBinPositionDetail,
  SolanaV3PositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import { useSolanaV3Pool } from 'hooks/solana/useSolanaV3Pools'
import type { PositionChartByProtocolProps } from './types'
import { convertFeeRateToFeeAmount } from '../../../utils'
import { InfinityBinPositionChart } from './InfinityBinPositionChart'
import { InfinityCLPositionChart } from './InfinityCLPositionChart'
import { V3PositionChart } from './V3PositionChart'
import { SolanaV3PositionChart } from './SolanaV3PositionChart'

/**
 * Wrapper for SolanaV3PositionChart that fetches pool info from position data.
 */
function SolanaV3PositionChartWrapper({
  position,
  currency0,
  currency1,
  inverted,
}: {
  position: SolanaV3PositionDetail
  currency0?: Currency
  currency1?: Currency
  inverted?: boolean
}) {
  const poolInfo = useSolanaV3Pool(position.poolId.toBase58()) ?? undefined

  // Map Solana feeRate to FeeAmount enum
  // Raydium uses 10000 as base, so feeRate of 25 = 0.25% = FeeAmount.LOWEST
  const feeAmount = poolInfo?.feeRate ? (convertFeeRateToFeeAmount(poolInfo.feeRate) as FeeAmount) : undefined

  return (
    <SolanaV3PositionChart
      currency0={currency0 as Parameters<typeof SolanaV3PositionChart>[0]['currency0']}
      currency1={currency1 as Parameters<typeof SolanaV3PositionChart>[0]['currency1']}
      feeAmount={feeAmount}
      tickLower={position.tickLower}
      tickUpper={position.tickUpper}
      poolInfo={poolInfo}
      inverted={inverted}
    />
  )
}

/**
 * Renders the liquidity distribution chart for the current position's protocol.
 * Only one protocol-specific chart (and thus one data hook) is mounted per row.
 */
export function PositionChartByProtocol({
  protocol,
  position,
  currency0,
  currency1,
  chainId,
  poolId,
  inverted,
  priceLower,
  priceUpper,
}: PositionChartByProtocolProps) {
  if (protocol === Protocol.V3) {
    // Handle Solana V3 positions with Solana-specific chart
    if (isSolana(chainId)) {
      const p = position as SolanaV3PositionDetail
      return (
        <SolanaV3PositionChartWrapper position={p} currency0={currency0} currency1={currency1} inverted={inverted} />
      )
    }

    // EVM V3 positions
    const p = position as PositionDetail
    return (
      <V3PositionChart
        currency0={currency0}
        currency1={currency1}
        feeAmount={'fee' in p ? p.fee : undefined}
        tickLower={'tickLower' in p ? p.tickLower : undefined}
        tickUpper={'tickUpper' in p ? p.tickUpper : undefined}
        inverted={inverted}
      />
    )
  }

  if (protocol === Protocol.InfinityCLAMM) {
    const p = position as InfinityCLPositionDetail
    return (
      <InfinityCLPositionChart
        poolId={poolId as Address | undefined}
        chainId={chainId}
        baseCurrency={currency0}
        quoteCurrency={currency1}
        tickLower={'tickLower' in p ? p.tickLower : undefined}
        tickUpper={'tickUpper' in p ? p.tickUpper : undefined}
        tickSpacing={'tickSpacing' in p ? p.tickSpacing : undefined}
        inverted={inverted}
        priceLower={priceLower}
        priceUpper={priceUpper}
      />
    )
  }

  if (protocol === Protocol.InfinityBIN) {
    const p = position as InfinityBinPositionDetail
    return (
      <InfinityBinPositionChart
        poolId={poolId as Address | undefined}
        chainId={chainId}
        baseCurrency={currency0}
        quoteCurrency={currency1}
        tickLower={'tickLower' in p ? (p.tickLower as number) : undefined}
        tickUpper={'tickUpper' in p ? (p.tickUpper as number) : undefined}
        tickSpacing={'tickSpacing' in p ? (p.tickSpacing as number) : undefined}
        inverted={inverted}
        priceLower={priceLower}
        priceUpper={priceUpper}
      />
    )
  }

  return null
}
