/**
 * Converts a fee rate to FeeAmount format.
 * Example: feeRate of 25 (0.25%) → FeeAmount 2500
 */
export function convertFeeRateToFeeAmount(feeRate: number): number {
  return feeRate * 100
}
