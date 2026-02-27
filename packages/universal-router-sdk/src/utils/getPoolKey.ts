import {
  BinPoolParameter,
  CLPoolParameter,
  decodeHooksRegistration,
  DYNAMIC_FEE_FLAG,
  isDynamicFeeHook,
  PoolKey,
} from '@pancakeswap/infinity-sdk'
import { InfinityBinPool, InfinityClPool, SmartRouter } from '@pancakeswap/smart-router'
import { zeroAddress } from 'viem'
import { currencyAddressInfinity } from './currencyAddressInfinity'

export const getPoolKey = (pool: InfinityBinPool | InfinityClPool): PoolKey => {
  const base = {
    currency0: currencyAddressInfinity(pool.currency0),
    currency1: currencyAddressInfinity(pool.currency1),
    hooks: pool.hooks || zeroAddress,
    poolManager: pool.poolManager,
    fee: pool.fee,
  }

  const { chainId } = pool.currency0

  if (isDynamicFeeHook(chainId, pool.hooks)) {
    base.fee = DYNAMIC_FEE_FLAG
  }

  const hooksRegistration =
    pool.hooksRegistrationBitmap !== undefined ? decodeHooksRegistration(pool.hooksRegistrationBitmap) : undefined

  if (SmartRouter.isInfinityClPool(pool) || SmartRouter.isInfinityStablePool(pool)) {
    const params: CLPoolParameter = {
      tickSpacing: pool.tickSpacing,
      hooksRegistration,
    }
    return { ...base, parameters: params } as PoolKey<'CL'>
  }

  if (SmartRouter.isInfinityBinPool(pool)) {
    const params: BinPoolParameter = {
      binStep: pool.binStep,
      hooksRegistration,
    }
    return { ...base, parameters: params } as PoolKey<'Bin'>
  }

  throw new Error('Invalid pool type')
}
