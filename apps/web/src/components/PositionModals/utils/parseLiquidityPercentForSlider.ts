/**
 * Maps the remove-liquidity % label to a 0–100 slider value.
 * Display uses '<1' when percent is under 1%; Number.parseInt('<1') is NaN.
 */
export function parseLiquidityPercentForSlider(display: string): number {
  if (display === '<1') return 1
  const n = Number.parseInt(display, 10)
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, n))
}
