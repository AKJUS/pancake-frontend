import { memo, useMemo } from 'react'
import { TokenInfo } from '@pancakeswap/solana-core-sdk'
import { NonEVMChainId } from '@pancakeswap/chains'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { Protocol } from '@pancakeswap/farms'
import { SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { POSITION_STATUS, SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { useSolanaV3Pool } from 'state/pools/solana'
import { useSolanaTokenPrice } from 'hooks/solana/useSolanaTokenPrice'
import { convertRawTokenInfoIntoSPLToken } from 'config/solana-list'
import { calculateSolanaTickLimits, getTickAtLimitStatus } from 'views/PoolDetail/utils'
import { usePriceRange } from 'hooks/solana/usePriceRange'
import { useLiquidityAmount } from 'hooks/solana/useLiquidityAmount'
import { SOLANA_FEE_TIER_BASE } from 'utils/normalizeSolanaPoolInfo'
import { PriceRange } from './PriceRange'
import { PositionItem } from './PositionItem'
import { SolanaV3PositionActions } from '../PositionActions/SolanaV3PositionActions'

type SolanaV3PositionItemProps = {
  position: SolanaV3PositionDetail
  // poolInfo: SolanaV3Pool | undefined
  detailMode?: boolean
}

export const SolanaV3PositionItem = memo(({ position, detailMode }: SolanaV3PositionItemProps) => {
  const poolInfo = useSolanaV3Pool(position.poolId.toBase58()) ?? undefined
  const currency0 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo?.mintA as TokenInfo), [poolInfo?.mintA])
  const currency1 = useMemo(() => convertRawTokenInfoIntoSPLToken(poolInfo?.mintB as TokenInfo), [poolInfo?.mintB])

  const { priceUpper, priceLower } = usePriceRange({
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    baseIn: true,
    poolInfo,
  })

  const { amount0, amount1 } = useLiquidityAmount({
    poolInfo,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    liquidity: position.liquidity,
  })

  const tickAtLimit = useMemo(() => {
    const tickLimits = calculateSolanaTickLimits(poolInfo?.config.tickSpacing)
    return getTickAtLimitStatus(position.tickLower, position.tickUpper, tickLimits)
  }, [poolInfo?.config.tickSpacing, position.tickLower, position.tickUpper])

  const pool = useMemo(() => {
    if (!currency0 || !currency1 || !poolInfo) {
      return undefined
    }
    return {
      pid: 0,
      nftMint: position.nftMint,
      lpAddress: ZERO_ADDRESS,
      protocol: Protocol.V3,
      token0: currency0,
      token1: currency1,
      // Convert decimal feeRate to integer for proper percentage calculation
      feeTier: Math.round(poolInfo.feeRate * SOLANA_FEE_TIER_BASE),
      feeTierBase: SOLANA_FEE_TIER_BASE,
      isFarming: false,
      poolId: position.poolId.toBase58(),
      liquidity: BigInt(position.liquidity.toString()),
      chainId: NonEVMChainId.SOLANA,
      tvlUsd: poolInfo.tvl.toString() as `${number}`,
      rawPool: poolInfo,
    } satisfies SolanaV3PoolInfo
  }, [currency0, currency1, poolInfo, position.liquidity, position.poolId, position.nftMint])

  const { data: currency0Price } = useSolanaTokenPrice({
    mint: currency0?.wrapped.address,
    enabled: Boolean(currency0),
  })
  const { data: currency1Price } = useSolanaTokenPrice({
    mint: currency1?.wrapped.address,
    enabled: Boolean(currency1),
  })

  const totalPriceUSD = useMemo(() => {
    return (
      Number(currency0Price ?? 0) * Number(amount0?.toExact() ?? 0) +
      Number(currency1Price ?? 0) * Number(amount1?.toExact() ?? 0)
    )
  }, [currency0Price, currency1Price, amount0, amount1])

  const desc = useMemo(() => {
    return (
      <PriceRange
        base={currency0 ?? undefined}
        quote={currency1 ?? undefined}
        priceLower={priceLower}
        priceUpper={priceUpper}
        tickAtLimit={tickAtLimit}
      />
    )
  }, [currency0, currency1, priceLower, priceUpper, tickAtLimit])

  return (
    <PositionItem
      link={`/liquidity/position/v3/solana/${pool?.poolId}/${position.nftMint.toBase58()}`}
      chainId={NonEVMChainId.SOLANA}
      pool={pool}
      totalPriceUSD={totalPriceUSD}
      amount0={amount0}
      amount1={amount1}
      desc={desc}
      currency0={currency0 ?? undefined}
      currency1={currency1 ?? undefined}
      removed={position.liquidity.isZero()}
      outOfRange={position.status === POSITION_STATUS.INACTIVE}
      fee={poolInfo?.feeRate ?? 0}
      feeTierBase={1}
      protocol={Protocol.V3}
      isStaked={poolInfo?.isFarming}
      detailMode={detailMode}
      userPosition={position}
    >
      {currency0 && currency1 && pool ? (
        <SolanaV3PositionActions
          removed={position.liquidity.isZero()}
          outOfRange={position.status === POSITION_STATUS.INACTIVE}
          chainId={NonEVMChainId.SOLANA}
          detailMode={detailMode}
          poolInfo={pool}
          position={position}
        />
      ) : null}
    </PositionItem>
  )
})

SolanaV3PositionItem.displayName = 'SolanaV3PositionItem'
