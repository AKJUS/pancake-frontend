import { Protocol } from '@pancakeswap/farms'
import { useMemo, memo } from 'react'
import { UnifiedPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { UnifiedPoolInfo } from 'state/farmsV4/state/type'
import { Address } from 'viem'
import { V3PositionActions } from 'views/universalFarms/components/PositionActions/V3PositionActions'
import { V2PositionActions } from 'views/universalFarms/components/PositionActions/V2PositionActions'
import { InfinityPositionActions } from 'views/universalFarms/components/PositionActions/InfinityPositionActions'
import { SolanaV3PositionActions } from 'views/universalFarms/components/PositionActions/SolanaV3PositionActions'
import { V3UnstakeModalContent } from 'views/universalFarms/components/PositionActions/V3UnstakeModalContent'
import { useExtraV3PositionInfo } from 'state/farmsV4/hooks'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { PriceRange } from 'views/universalFarms/components'
import { isSolana } from '@pancakeswap/chains'
import { V3_FEE_TIER_BASE } from '../../constants'

type PositionActionButtonsProps = {
  position: UnifiedPositionDetail
  pool?: UnifiedPoolInfo | null
  chainId: number
  isFarmLive?: boolean
  isStaked?: boolean
  removed?: boolean
  outOfRange?: boolean
  totalLiquidityUSD?: number
  amount0?: any
  amount1?: any
  /** Show Collect (LP fees) button - only used in universalFarms PositionsTable */
  showCollectButton?: boolean
  /** Hide Stake and Unstake buttons - used in mobile PositionListCard */
  hideStakeButtons?: boolean
  /** SDK V3 Pool for cross-chain fee fetching - pass poolForFees from parent */
  v3SdkPool?: any
}

export const PositionActionButtons = memo(function PositionActionButtons({
  position,
  pool,
  chainId,
  isFarmLive,
  isStaked,
  removed: removedProp,
  outOfRange: outOfRangeProp,
  totalLiquidityUSD,
  amount0,
  amount1,
  showCollectButton = false,
  hideStakeButtons = false,
  v3SdkPool,
}: PositionActionButtonsProps) {
  const { protocol } = position

  // For V3 positions (excluding Solana), we need extra info
  const v3ExtraInfo = useExtraV3PositionInfo(
    protocol === Protocol.V3 && !isSolana(chainId) ? (position as any) : undefined,
  )

  // Use the passed SDK pool as fallback if v3ExtraInfo.pool is not available (e.g., when viewing from another chain)
  const v3Pool = v3ExtraInfo?.pool ?? v3SdkPool

  const removed = removedProp ?? v3ExtraInfo?.removed ?? false
  const outOfRange = outOfRangeProp ?? v3ExtraInfo?.outOfRange ?? false

  // Prepare V3 modal content (must be called before early returns to satisfy React Hooks rules)
  const evmPosition = protocol === Protocol.V3 && !isSolana(chainId) ? (position as any) : null
  const tokenId = evmPosition?.tokenId ? BigInt(evmPosition.tokenId) : undefined
  const { quote, base, priceUpper, priceLower, tickAtLimit } = v3ExtraInfo || {}

  const v3ModalContent = useMemo(() => {
    if (protocol !== Protocol.V3 || isSolana(chainId) || !pool || !tokenId || !evmPosition) return null

    const desc =
      base && quote ? (
        <PriceRange
          base={base}
          quote={quote}
          priceLower={priceLower}
          priceUpper={priceUpper}
          tickAtLimit={tickAtLimit}
        />
      ) : null

    return (
      <V3UnstakeModalContent
        chainId={chainId}
        userPosition={evmPosition}
        link={`/liquidity/${tokenId}?chain=${CHAIN_QUERY_NAME[chainId]}&${PERSIST_CHAIN_KEY}=1`}
        pool={pool as any}
        totalPriceUSD={totalLiquidityUSD ?? 0}
        desc={desc}
        amount0={amount0}
        amount1={amount1}
        currency0={pool.token0}
        currency1={pool.token1}
        removed={removed}
        outOfRange={outOfRange}
        fee={evmPosition.fee}
        feeTierBase={V3_FEE_TIER_BASE}
        protocol={evmPosition.protocol}
        isStaked={isStaked ?? false}
        tokenId={tokenId}
      />
    )
  }, [
    protocol,
    chainId,
    pool,
    tokenId,
    evmPosition,
    base,
    quote,
    priceUpper,
    priceLower,
    tickAtLimit,
    totalLiquidityUSD,
    amount0,
    amount1,
    removed,
    outOfRange,
    isStaked,
  ])

  // Solana V3 (check chainId first as Solana positions also use Protocol.V3)
  if (protocol === Protocol.V3 && isSolana(chainId)) {
    return (
      <SolanaV3PositionActions
        position={position as any}
        poolInfo={pool as any}
        removed={removed}
        hideAddRemoveButtons={hideStakeButtons}
      />
    )
  }

  // V3 Protocol (EVM chains)
  if (protocol === Protocol.V3) {
    return (
      <V3PositionActions
        chainId={chainId}
        isStaked={isStaked}
        isFarmLive={isFarmLive}
        removed={removed}
        outOfRange={outOfRange}
        tokenId={tokenId}
        modalContent={v3ModalContent}
        pool={v3Pool ?? undefined}
        currency0={pool?.token0 as any}
        currency1={pool?.token1 as any}
        showCollectButton={showCollectButton}
        hideStakeButtons={hideStakeButtons}
      />
    )
  }

  // V2 and StableSwap Protocols
  if (protocol === Protocol.V2 || protocol === Protocol.STABLE) {
    const v2Data = position as any
    // Prefer stableSwapAddress (hook / pool contract) over lpAddress when both exist
    const v2Pool = pool as any
    const lpAddressFromPool = (v2Pool?.stableSwapAddress ?? v2Pool?.lpAddress) as Address | undefined
    const lpAddressFromPosition =
      protocol === Protocol.V2
        ? (v2Data.pair?.liquidityToken?.address as Address | undefined)
        : (v2Data.pair?.stableSwapAddress as Address | undefined)
    const lpAddress = lpAddressFromPool ?? lpAddressFromPosition
    const pid = pool?.pid

    // Only render if we have pool info (required for bCakeWrapperAddress) and lpAddress
    if (!pool || !lpAddress || !isStaked) {
      return null
    }

    return (
      <>
        <V2PositionActions
          data={v2Data}
          chainId={chainId}
          lpAddress={lpAddress}
          pid={pid}
          isStaked // already returning func above if isStaked is false
          tvlUsd={totalLiquidityUSD}
          poolInfo={pool as any}
          isFarmLive={isFarmLive}
        />
      </>
    )
  }

  // Infinity Protocols
  if (protocol === Protocol.InfinityCLAMM || protocol === Protocol.InfinityBIN) {
    return (
      <InfinityPositionActions
        pos={position as any}
        chainId={chainId}
        showPositionFees
        showCollectButton={showCollectButton}
      />
    )
  }

  // If no matching protocol, return null
  return null
})
