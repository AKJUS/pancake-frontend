import { Protocol } from '@pancakeswap/farms'
import { useMatchBreakpoints } from '@pancakeswap/uikit'
import { PoolInfoHeader } from 'components/PoolInfoHeader'
import { useCurrencyByPoolId } from 'hooks/infinity/useCurrencyByPoolId'
import { useHookByPoolId } from 'hooks/infinity/useHooksList'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { useMemo } from 'react'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { useInverted } from 'state/infinity/shared'
import { getTokenSymbolAlias } from 'utils/getTokenAlias'
import {
  InfinityBinPoolDerivedAprButton,
  InfinityCLPoolDerivedAprButton,
} from 'views/universalFarms/components/PoolAprButtonV3/PoolPositionAprButtonV3'
import { usePoolById } from 'hooks/infinity/usePool'
import { usePoolCurrentPrice } from 'hooks/infinity/usePoolCurrentPrice'

export const StableInfinityPoolInfoHeader = ({
  hookAddress,
  chainId,
}: {
  hookAddress: `0x${string}`
  chainId: number
}) => {
  const poolInfo = usePoolInfo({ poolAddress: hookAddress, chainId })

  const currency0 = useCurrencyByChainId(poolInfo?.token0?.wrapped?.address, chainId) ?? undefined
  const currency1 = useCurrencyByChainId(poolInfo?.token1?.wrapped?.address, chainId) ?? undefined

  const [inverted, setInverted] = useInverted()

  const symbol0 = useMemo(
    () => getTokenSymbolAlias(currency0?.wrapped?.address, currency0?.chainId, currency0?.symbol),
    [currency0],
  )
  const symbol1 = useMemo(
    () => getTokenSymbolAlias(currency1?.wrapped?.address, currency1?.chainId, currency1?.symbol),
    [currency1],
  )

  return (
    <PoolInfoHeader
      isStableInfinity
      poolId={hookAddress}
      poolInfo={poolInfo}
      currency0={currency0}
      currency1={currency1}
      symbol0={symbol0}
      symbol1={symbol1}
      chainId={chainId}
      isInverted={Boolean(inverted)}
      onInvertPrices={() => setInverted(!inverted)}
      linkType="addLiquidity"
      overrideAprDisplay={{
        aprDisplay: null,
        roiCalculator: <></>,
      }}
    />
  )
}

export const InfinityPoolInfoHeader = ({ poolId, chainId }: { poolId: `0x${string}`; chainId: number }) => {
  const { isMobile } = useMatchBreakpoints()
  const poolInfo = usePoolInfo({ poolAddress: poolId, chainId })
  const hookData = useHookByPoolId(chainId, poolId)
  const { currency0, currency1 } = useCurrencyByPoolId({ chainId, poolId })
  // Fetch on-chain pool data for live price
  const [, onChainPool] = usePoolById(poolId, chainId)
  const onChainPrice = usePoolCurrentPrice(onChainPool)

  const [inverted, setInverted] = useInverted()

  const symbol0 = useMemo(
    () => getTokenSymbolAlias(currency0?.wrapped?.address, currency0?.chainId, currency0?.symbol),
    [currency0],
  )
  const symbol1 = useMemo(
    () => getTokenSymbolAlias(currency1?.wrapped?.address, currency1?.chainId, currency1?.symbol),
    [currency1],
  )

  // Use on-chain prices as primary, API prices as fallback
  // Wrapped in try-catch because toFixed/invert can throw on invalid prices
  const poolInfoWithOnChainPrice = useMemo(() => {
    if (!poolInfo) return null

    let onChainToken0Price: string | undefined
    let onChainToken1Price: string | undefined

    try {
      onChainToken0Price = onChainPrice?.invert().toFixed(18)
      onChainToken1Price = onChainPrice?.toFixed(18)
    } catch (error) {
      console.error('Error formatting on-chain price:', error)
    }

    return {
      ...poolInfo,
      token0Price: (onChainToken0Price ?? poolInfo.token0Price) as `${number}`,
      token1Price: (onChainToken1Price ?? poolInfo.token1Price) as `${number}`,
    }
  }, [poolInfo, onChainPrice])

  return (
    <PoolInfoHeader
      poolId={poolId}
      poolInfo={poolInfoWithOnChainPrice}
      currency0={currency0}
      currency1={currency1}
      symbol0={symbol0}
      symbol1={symbol1}
      chainId={chainId}
      isInverted={Boolean(inverted)}
      onInvertPrices={() => setInverted(!inverted)}
      hookData={hookData}
      linkType="addLiquidity"
      overrideAprDisplay={{
        aprDisplay: poolInfo ? (
          poolInfo.protocol === Protocol.InfinityCLAMM ? (
            <InfinityCLPoolDerivedAprButton pool={poolInfo} fontSize={isMobile ? '20px' : '24px'} />
          ) : poolInfo.protocol === Protocol.InfinityBIN ? (
            <InfinityBinPoolDerivedAprButton pool={poolInfo} fontSize={isMobile ? '20px' : '24px'} />
          ) : (
            '-'
          )
        ) : null,
        roiCalculator: <></>,
      }}
    />
  )
}
