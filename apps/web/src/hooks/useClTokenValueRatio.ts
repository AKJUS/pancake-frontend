import { useMemo } from 'react'
import { SqrtPriceMath, TickMath } from '@pancakeswap/v3-sdk'

/**
 * Computes the fraction of total USD value that goes to token0
 * for a CL position at the given tick range and pool price.
 *
 * Returns a number between 0 and 1:
 *  - 1 = all value in token0 (price below lower tick → out of range above)
 *  - 0 = all value in token1 (price above upper tick → out of range below)
 *  - ~0.5 = balanced (typical for full range or when price is centered)
 */
export function computeClToken0ValueRatio(
  sqrtRatioX96: bigint,
  lowerTick: number,
  upperTick: number,
  token0Decimals: number,
  token1Decimals: number,
  price0Usd: number,
  price1Usd: number,
): number {
  if (price0Usd <= 0 || price1Usd <= 0) return 0.5

  const sqrtLower = TickMath.getSqrtRatioAtTick(lowerTick)
  const sqrtUpper = TickMath.getSqrtRatioAtTick(upperTick)

  // Check out-of-range
  if (sqrtRatioX96 <= sqrtLower) return 1 // All token0
  if (sqrtRatioX96 >= sqrtUpper) return 0 // All token1

  // Use a reference liquidity to compute amounts
  // Choose a moderate value to avoid overflow
  const refLiquidity = 10n ** 15n

  const amount0Raw = SqrtPriceMath.getAmount0Delta(sqrtRatioX96, sqrtUpper, refLiquidity, true)
  const amount1Raw = SqrtPriceMath.getAmount1Delta(sqrtLower, sqrtRatioX96, refLiquidity, true)

  const amount0Dec = Number(amount0Raw) / 10 ** token0Decimals
  const amount1Dec = Number(amount1Raw) / 10 ** token1Decimals

  const usd0 = amount0Dec * price0Usd
  const usd1 = amount1Dec * price1Usd
  const total = usd0 + usd1

  if (total === 0) return 0.5
  return usd0 / total
}

/**
 * React hook version — computes the token0 value ratio for a CL pool position.
 */
export function useClTokenValueRatio(
  sqrtRatioX96: bigint | undefined,
  lowerTick: number | null | undefined,
  upperTick: number | null | undefined,
  token0Decimals: number | undefined,
  token1Decimals: number | undefined,
  price0Usd: number,
  price1Usd: number,
): number {
  return useMemo(() => {
    if (!sqrtRatioX96 || lowerTick == null || upperTick == null || token0Decimals == null || token1Decimals == null) {
      return 0.5
    }
    try {
      return computeClToken0ValueRatio(
        sqrtRatioX96,
        lowerTick,
        upperTick,
        token0Decimals,
        token1Decimals,
        price0Usd,
        price1Usd,
      )
    } catch {
      return 0.5
    }
  }, [sqrtRatioX96, lowerTick, upperTick, token0Decimals, token1Decimals, price0Usd, price1Usd])
}
