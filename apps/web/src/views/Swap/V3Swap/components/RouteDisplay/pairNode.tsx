import { findHook, HOOK_CATEGORY, parseProtocolFeesToNumbers } from '@pancakeswap/infinity-sdk'
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

  return pairs.length > 0
    ? pairs.map((p, index) => {
        const [input, output] = p
        const pool = pools[index]
        const isInfinityClPool = SmartRouter.isInfinityClPool(pool)
        const isInfinityBinPool = SmartRouter.isInfinityBinPool(pool)
        const isInfinityStablePool = SmartRouter.isInfinityStablePool(pool)
        const isInfinityPool = isInfinityBinPool || isInfinityClPool
        const useDiscountHooks = isInfinityPool && pool.hooks && hookDiscount[pool.hooks]
        let infinityFee = 0
        let infinityDiscountFee = 0
        if (isInfinityPool) {
          const protocolFee = parseProtocolFeesToNumbers(pool.protocolFee)?.[0] ?? 0
          if (useDiscountHooks) {
            const { discountFee, originalFee } = hookDiscount[pool.hooks!]
            infinityFee = originalFee + protocolFee
            infinityDiscountFee = discountFee + protocolFee
          } else {
            infinityFee = pool.fee + protocolFee
            infinityDiscountFee = infinityFee
          }
          if (pool.hooks) {
            const hookData = findHook(pool.hooks, input.chainId)
            if (hookData) {
              const isDynamicHook = hookData.category?.includes(HOOK_CATEGORY.DynamicFees)
              if (isDynamicHook) {
                infinityFee = hookData.defaultFee || 0
                infinityDiscountFee = infinityFee
              }
            }
            // eslint-disable-next-line no-console
            console.log('[infi]', pool.hooks, hookData, input.chainId)
          }
          // infinityFee = hookData?.defaultFee || 0
        }
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
          : isV3Pool || isInfinityPool
          ? v3FeeToPercent((isV3Pool ? pool.fee : infinityDiscountFee) || 0)
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
