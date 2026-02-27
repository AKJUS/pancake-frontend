import { Protocol } from '@pancakeswap/farms'
import { BigNumber as BN } from 'bignumber.js'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { useState, useMemo, memo, useCallback } from 'react'
import type { Currency } from '@pancakeswap/sdk'
import { V2LPDetail, StableLPDetail } from 'state/farmsV4/state/accountPositions/type'
import { type PoolInfo, V2PoolInfo, StablePoolInfo } from 'state/farmsV4/state/type'
import { v2Fee } from 'views/PoolDetail/hooks/useStablePoolFee'
import { V2PoolPositionAprButton } from '../../PoolAprButton'
import { PositionRowDisplay, PositionDisplayData } from '../PositionRowDisplay'
import { useV2PositionApr } from '../../../hooks/usePositionAPR'
import { V2_FEE_TIER_BASE, V2_FEE_TIER } from '../../../constants'

interface V2StablePositionRowProps {
  position: V2LPDetail | StableLPDetail
  chainId: number
  protocol: Protocol.V2 | Protocol.STABLE | Protocol.InfinitySTABLE
  hideEarningsColumn?: boolean
}

export const V2StablePositionRow: React.FC<V2StablePositionRowProps> = memo(
  ({ position, chainId, protocol, hideEarningsColumn }) => {
    const [expanded, setExpanded] = useState(false)

    const isV2 = protocol === Protocol.V2
    const v2Position = position as V2LPDetail
    const stablePosition = position as StableLPDetail

    const pair = isV2 ? v2Position.pair : stablePosition.pair

    // V2/Stable pairs have token0/token1 as Token types
    const currency0 = pair.token0
    const currency1 = pair.token1

    const poolAddress = isV2 ? pair.liquidityToken.address : stablePosition.pair.stableSwapAddress

    const pool = usePoolInfo({
      poolAddress,
      chainId,
    })

    const amount0 = isV2
      ? v2Position.nativeDeposited0.add(v2Position.farmingDeposited0)
      : stablePosition.nativeDeposited0.add(stablePosition.farmingDeposited0)

    const amount1 = isV2
      ? v2Position.nativeDeposited1.add(v2Position.farmingDeposited1)
      : stablePosition.nativeDeposited1.add(stablePosition.farmingDeposited1)

    const evmCurrency0 = currency0 as unknown as Currency
    const evmCurrency1 = currency1 as unknown as Currency
    const { data: price0Usd } = useCurrencyUsdPrice(evmCurrency0, { enabled: Boolean(evmCurrency0) })
    const { data: price1Usd } = useCurrencyUsdPrice(evmCurrency1, { enabled: Boolean(evmCurrency1) })

    const totalPriceUSD = useMemo(() => {
      return BN(price0Usd ?? 0)
        .times(amount0?.toExact() ?? 0)
        .plus(BN(price1Usd ?? 0).times(amount1?.toExact() ?? 0))
        .toNumber()
    }, [price0Usd, price1Usd, amount0, amount1])

    // Type guard to check if pool is V2PoolInfo or StablePoolInfo
    const isV2OrStablePool = (p: PoolInfo | null | undefined): p is V2PoolInfo | StablePoolInfo => {
      return (
        p !== null &&
        p !== undefined &&
        (p.protocol === Protocol.V2 || p.protocol === Protocol.STABLE || p.protocol === Protocol.InfinitySTABLE)
      )
    }

    const v2OrStablePool = isV2OrStablePool(pool) ? pool : null

    const feeTier = useMemo(() => {
      if (isV2) return V2_FEE_TIER
      return Number((stablePosition.pair as { stableTotalFee?: number }).stableTotalFee ?? 0) * V2_FEE_TIER_BASE
    }, [isV2, stablePosition.pair])
    const feeTierBase = V2_FEE_TIER_BASE

    // Calculate APR
    const aprData = useV2PositionApr(v2OrStablePool || ({} as PoolInfo), isV2 ? v2Position : stablePosition)
    const lpApr = useMemo(
      () => (v2OrStablePool ? BN(aprData.lpApr || 0).toNumber() : 0),
      [aprData.lpApr, v2OrStablePool],
    )
    const merklApr = useMemo(
      () => (v2OrStablePool ? BN(aprData.merklApr ?? 0).toNumber() : 0),
      [aprData.merklApr, v2OrStablePool],
    )
    const incentraApr = useMemo(
      () => (v2OrStablePool ? BN(aprData.incentraApr ?? 0).toNumber() : 0),
      [aprData.incentraApr, v2OrStablePool],
    )
    const farmApr = useMemo(
      () => (v2OrStablePool ? BN(aprData.cakeApr?.value ?? '0').toNumber() || 0 : 0),
      [aprData.cakeApr?.value, v2OrStablePool],
    )
    const totalApr = useMemo(() => {
      return lpApr + merklApr + incentraApr + farmApr
    }, [lpApr, merklApr, incentraApr, farmApr])
    // Check if pool has an active farm
    // Only use farmApr as fallback when pool info is not available (farmApr can be stale)
    const hasFarm = useMemo(
      () => Boolean(pool?.isActiveFarm ?? pool?.isFarming) || (!pool && farmApr > 0),
      [pool?.isActiveFarm, pool?.isFarming, pool, farmApr],
    )

    const handleToggleExpand = useCallback(() => setExpanded((prev) => !prev), [])

    // APR button component - memoized to prevent data object from being recreated every render
    const aprButton = useMemo(
      () =>
        v2OrStablePool ? (
          <V2PoolPositionAprButton
            pool={v2OrStablePool}
            userPosition={isV2 ? v2Position : stablePosition}
            textProps={{ bold: true }}
          />
        ) : null,
      [v2OrStablePool, isV2, v2Position, stablePosition],
    )

    const data: PositionDisplayData = useMemo(
      () => ({
        currency0,
        currency1,
        // V2/Stable positions currently treated as always active; removed/outOfRange not yet derived from backend
        removed: false,
        outOfRange: false,
        pool: pool as PoolInfo | null,
        totalPriceUSD,
        aprButton,
        hookData: undefined,
        chainId,
        // V2/Stable earnings not shown in table; by design until earnings API/UX is defined for these protocols
        earnings: null,
        amount0,
        amount1,
        price0Usd,
        price1Usd,
        // V2/Stable is full range; no discrete price range to display
        priceRangeDisplay: null,
        lpApr,
        merklApr,
        incentraApr,
        farmApr,
        totalApr,
        hasFarm,
        feeTier,
        feeTierBase,
      }),
      [
        currency0,
        currency1,
        pool,
        totalPriceUSD,
        aprButton,
        chainId,
        amount0,
        amount1,
        price0Usd,
        price1Usd,
        lpApr,
        merklApr,
        incentraApr,
        farmApr,
        totalApr,
        hasFarm,
        feeTier,
        feeTierBase,
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
  },
)
