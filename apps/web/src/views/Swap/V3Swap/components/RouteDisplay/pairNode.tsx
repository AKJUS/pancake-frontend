import { HOOK_CATEGORY } from '@pancakeswap/infinity-sdk'
import { Percent, Rounding } from '@pancakeswap/sdk'
import { InfinityBinPool, InfinityClPool, SmartRouter } from '@pancakeswap/smart-router'
import { Column } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import React, { Fragment } from 'react'
import { INFINITY_STABLE_POOL_FEE_DENOMINATOR } from '@pancakeswap/infinity-stable-sdk'
import { v3FeeToPercent } from '../../utils/exchange'
import { HookDiscountFeeDisplay } from './HookDiscountFeeDisplay'
import { PairNode } from '../PairNode'
import { Pair } from './types'
import { resolveInfinityPoolFee } from './resolveInfinityPoolFee'

export interface PairNodeProps {
  pair: Pair
  text: string | React.ReactNode
  className: string
  tooltipText: string
}

interface Params {
  pairs: Pair[]
  pools: any[]
  routePoolsLength: number
  hookDiscount: Record<string, { discountFee: number; originalFee: number }>
  category?: HOOK_CATEGORY.BrevisDiscount | HOOK_CATEGORY.PrimusDiscount
  pairNode?: (props: PairNodeProps) => React.ReactNode
}

export function EVMPairNodes({
  pairs,
  pools,
  routePoolsLength,
  hookDiscount,
  category,
  pairNode,
}: Params): React.ReactNode[] | null {
  const { t } = useTranslation()
  const getDisplayFee = (pool: { displayFee?: number }): number | undefined =>
    typeof pool.displayFee === 'number' ? pool.displayFee : undefined

  return pairs.length > 0
    ? pairs.map((p, index) => {
        const [input, output] = p
        const pool = pools[index]
        const isInfinityClPool = SmartRouter.isInfinityClPool(pool)
        const isInfinityBinPool = SmartRouter.isInfinityBinPool(pool)
        const isInfinityStablePool = SmartRouter.isInfinityStablePool(pool)
        const isInfinityPool = isInfinityBinPool || isInfinityClPool
        let infinityFee = 0
        let infinityDiscountFee = 0
        if (isInfinityPool) {
          const resolved = resolveInfinityPoolFee(pool, hookDiscount, input.chainId)
          infinityFee = resolved.fee
          infinityDiscountFee = resolved.discountFee
        }
        const quotedDisplayFee = getDisplayFee(pool)
        const useDiscountHooks =
          isInfinityPool && quotedDisplayFee === undefined && pool.hooks && hookDiscount[pool.hooks]
        const isV3Pool = SmartRouter.isV3Pool(pool)
        const isV2Pool = SmartRouter.isV2Pool(pool)
        const key = isV2Pool
          ? `v2_${pool.reserve0.currency.symbol}_${pool.reserve1.currency.symbol}`
          : SmartRouter.isStablePool(pool) || isV3Pool
          ? pool.address
          : isInfinityPool || isInfinityStablePool
          ? pool.id
          : undefined
        if (!key) return null
        const feePercent = isInfinityStablePool
          ? new Percent(pool.stableFee, INFINITY_STABLE_POOL_FEE_DENOMINATOR)
          : isV3Pool
          ? v3FeeToPercent((quotedDisplayFee ?? pool.fee) || 0)
          : isInfinityPool
          ? v3FeeToPercent((quotedDisplayFee ?? infinityDiscountFee) || 0)
          : undefined

        const feeDisplay = feePercent ? Number(feePercent.toSignificant(3, {}, Rounding.ROUND_HALF_UP)).toString() : '-'

        const originalFeeDisplay = Number(
          v3FeeToPercent(infinityFee).toSignificant(3, {}, Rounding.ROUND_HALF_UP),
        ).toString()
        const feeDisplayWithDiscount = (
          <HookDiscountFeeDisplay
            showIcon={routePoolsLength === 1}
            feeDisplay={feeDisplay}
            originalFeeDisplay={originalFeeDisplay}
            hookDiscount={hookDiscount[(pool as InfinityBinPool | InfinityClPool).hooks!]}
            hookCategory={category}
          />
        )

        const text = isV2Pool ? (
          'V2'
        ) : isV3Pool ? (
          `V3 (${feeDisplay}%)`
        ) : isInfinityClPool ? (
          <Column alignItems="center">
            <span>Infinity CL</span>
            {useDiscountHooks ? feeDisplayWithDiscount : <span>({feeDisplay}%)</span>}
          </Column>
        ) : isInfinityBinPool ? (
          <Column alignItems="center">
            <span>Infinity Bin</span>
            {useDiscountHooks ? feeDisplayWithDiscount : <span>({feeDisplay}%)</span>}
          </Column>
        ) : isInfinityStablePool ? (
          <Column alignItems="center">
            <span>Infinity SS</span>
            <span>({feeDisplay}%)</span>
          </Column>
        ) : (
          t('StableSwap')
        )
        const tooltipText = `${input.symbol}/${output.symbol}${
          isV3Pool || isInfinityPool || isInfinityStablePool ? ` (${feeDisplay}%)` : ''
        }`

        if (pairNode) {
          return (
            <Fragment key={key}>
              {React.createElement(pairNode, {
                pair: p,
                text,
                className: isInfinityPool || isV3Pool || isInfinityStablePool ? 'highlight' : '',
                tooltipText,
              })}
            </Fragment>
          )
        }

        return (
          <PairNode
            pair={p}
            key={key}
            text={text}
            className={isInfinityPool || isV3Pool || isInfinityStablePool ? 'highlight' : ''}
            tooltipText={tooltipText}
          />
        )
      })
    : null
}
