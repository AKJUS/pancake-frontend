import { getPoolId } from '@pancakeswap/infinity-sdk'
import { getLiquidityDetailURL } from 'config/constants/liquidity'
import { useTotalPriceUSD } from 'hooks/useTotalPriceUSD'
import { memo, useMemo } from 'react'
import { useExtraInfinityPositionInfo, usePoolInfo } from 'state/farmsV4/hooks'
import { InfinityCLPositionDetail, PositionDetail } from 'state/farmsV4/state/accountPositions/type'

import { PositionItem } from './PositionItem'
import { PriceRange } from './PriceRange'
import { V3_FEE_TIER_BASE } from '../../constants'

type InfinityPositionItemProps = {
  data: InfinityCLPositionDetail
  action?: React.ReactElement | null
  detailMode?: boolean
  showAPR?: boolean
  miniMode?: boolean
}

export const InfinityCLPositionItem = memo(
  ({ data, detailMode, action, showAPR, miniMode }: InfinityPositionItemProps) => {
    const {
      quote,
      base,
      currency0,
      currency1,
      removed,
      outOfRange,
      priceUpper,
      priceLower,
      tickAtLimit,
      amount0,
      amount1,
    } = useExtraInfinityPositionInfo(data)

    const { chainId, tokenId } = data

    const poolId = getPoolId(data.poolKey)
    const pool = usePoolInfo({ poolAddress: poolId, chainId })

    const totalPriceUSD = useTotalPriceUSD({
      currency0,
      currency1,
      amount0,
      amount1,
    })

    const desc = useMemo(
      () =>
        base && quote ? (
          <PriceRange
            base={base}
            quote={quote}
            priceLower={priceLower}
            priceUpper={priceUpper}
            tickAtLimit={tickAtLimit}
          />
        ) : null,
      [base, quote, priceLower, priceUpper, tickAtLimit],
    )

    const link = useMemo(
      () =>
        getLiquidityDetailURL({
          chainId,
          tokenId: Number(tokenId),
          poolId,
          protocol: data.protocol,
        }),
      [chainId, data.protocol, poolId, tokenId],
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
        removed={removed}
        outOfRange={outOfRange}
        fee={data.fee}
        feeTierBase={V3_FEE_TIER_BASE}
        protocol={data.protocol}
        isStaked={data.isStaked && !outOfRange}
        tokenId={data.tokenId}
        detailMode={detailMode}
        userPosition={data as unknown as PositionDetail}
        showAPR={showAPR}
        miniMode={miniMode}
      >
        {action}
      </PositionItem>
    )
  },
)
