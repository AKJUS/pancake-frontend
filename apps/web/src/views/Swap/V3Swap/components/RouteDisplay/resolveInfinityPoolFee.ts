import { findHook, HOOK_CATEGORY, parseProtocolFeesToNumbers } from '@pancakeswap/infinity-sdk'

/**
 * Resolve the display fee for an Infinity pool.
 *
 * Quoted aggregator pools can provide a display-ready fee directly; otherwise
 * fall back to the existing protocolFee + hook discount logic.
 */
export function resolveInfinityPoolFee(
  pool: { fee: number; protocolFee?: number; hooks?: string; displayFee?: number },
  hookDiscount: Record<string, { discountFee: number; originalFee: number }>,
  chainId: number,
): { fee: number; discountFee: number } {
  if (typeof pool.displayFee === 'number') {
    return {
      fee: pool.displayFee,
      discountFee: pool.displayFee,
    }
  }

  if (pool.protocolFee === undefined || pool.protocolFee === null) {
    throw new Error('Infinity pool missing protocolFee')
  }

  const protocolFee = parseProtocolFeesToNumbers(pool.protocolFee)?.[0] ?? 0
  const hasHookDiscount = pool.hooks && hookDiscount[pool.hooks]

  let fee: number
  let discountFee: number

  if (hasHookDiscount) {
    const hd = hookDiscount[pool.hooks!]
    fee = hd.originalFee + protocolFee
    discountFee = hd.discountFee + protocolFee
  } else {
    fee = pool.fee + protocolFee
    discountFee = fee
  }

  if (pool.hooks) {
    const hookData = findHook(pool.hooks, chainId)
    if (hookData) {
      const isDynamicHook = hookData.category?.includes(HOOK_CATEGORY.DynamicFees)
      if (isDynamicHook) {
        fee = hookData.defaultFee || 0
        discountFee = fee
      }
    }
  }

  return { fee, discountFee }
}
