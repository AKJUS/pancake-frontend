import { getLiquidityDetailURL } from 'config/constants/liquidity'
import { useTotalPriceUSD } from 'hooks/useTotalPriceUSD'
import { memo, useMemo } from 'react'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { InfinityBinPositionDetail, POSITION_STATUS } from 'state/farmsV4/state/accountPositions/type'

import { getCurrencyPriceFromId } from '@pancakeswap/infinity-sdk'
import { CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { maxUint24 } from 'viem'
import { PositionItem } from './PositionItem'
import { PriceRange } from './PriceRange'
import { V3_FEE_TIER_BASE } from '../../constants'

type InfinityPositionItemProps = {
  data: InfinityBinPositionDetail
  action?: React.ReactElement | null
  detailMode?: boolean
  showAPR?: boolean
  miniMode?: boolean
}

export const InfinityBinPositionItem = memo(
  ({ data, detailMode, action, showAPR, miniMode }: InfinityPositionItemProps) => {
    const { chainId, poolId } = data

    const pool = usePoolInfo({ poolAddress: poolId, chainId })

    const currency0 = pool?.token0
    const currency1 = pool?.token1
    const amount0 = useMemo(
      () => (currency0 ? CurrencyAmount.fromRawAmount(currency0, data.reserveX) : undefined),
      [currency0, data.reserveX],
    )
    const amount1 = useMemo(
      () => (currency1 ? CurrencyAmount.fromRawAmount(currency1, data.reserveY) : undefined),
      [currency1, data.reserveY],
    )

    const totalPriceUSD = useTotalPriceUSD({
      currency0: pool?.token0,
      currency1: pool?.token1,
      amount0,
      amount1,
    })

    const binStep = data.poolKey?.parameters.binStep

    const priceLower = useMemo(
      () =>
        currency0 && currency1 && data.minBinId !== null && binStep
          ? getCurrencyPriceFromId(data.minBinId, binStep, currency0, currency1)
          : undefined,
      [currency0, currency1, data.minBinId, binStep],
    )
    const priceUpper = useMemo(
      () =>
        currency0 && currency1 && data.maxBinId !== null && binStep
          ? getCurrencyPriceFromId(data.maxBinId, binStep, currency0, currency1)
          : undefined,
      [currency0, currency1, data.maxBinId, binStep],
    )

    const desc = useMemo(
      () =>
        currency0 && currency1 && priceLower && priceUpper ? (
          <PriceRange
            base={currency0}
            quote={currency1}
            priceLower={priceLower}
            priceUpper={priceUpper}
            tickAtLimit={{
              LOWER: Boolean(data.minBinId && BigInt(data.minBinId) === 1n),
              UPPER: Boolean(data.maxBinId && BigInt(data.maxBinId) === maxUint24 - 1n),
            }}
          />
        ) : null,
      [currency0, currency1, priceLower, priceUpper, data.minBinId, data.maxBinId],
    )

    const link = useMemo(
      () =>
        getLiquidityDetailURL({
          chainId,
          poolId,
          protocol: data.protocol,
        }),
      [chainId, data.protocol, poolId],
    )

    return (
      <PositionItem
        chainId={chainId}
        link={link}
        pool={pool}
        poolId={poolId}
        totalPriceUSD={totalPriceUSD}
        amount0={amount0}
        amount1={amount1}
        desc={desc}
        currency0={currency0}
        currency1={currency1}
        outOfRange={data.status === POSITION_STATUS.INACTIVE}
        removed={data.status === POSITION_STATUS.CLOSED}
        fee={pool?.feeTier ?? 0}
        feeTierBase={V3_FEE_TIER_BASE}
        protocol={data.protocol}
        isStaked={data.isStaked}
        detailMode={detailMode}
        userPosition={data}
        showAPR={showAPR}
        miniMode={miniMode}
      >
        {action}
      </PositionItem>
    )
  },
)
