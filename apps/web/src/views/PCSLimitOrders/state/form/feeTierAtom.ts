import { atom } from 'jotai'

export interface FeeTierOption {
  /** Fee percentage (e.g. 0.1 for 0.1%) */
  value: number
  label: string
  icon: string
  /** Raw (untranslated) badge text — pass through t() before rendering */
  badgeText: string
  /** Corresponding lpFee integer stored on-chain (value / 100 * 1e6) */
  lpFee: number
}

export const LIMIT_ORDER_FEE_OPTIONS: FeeTierOption[] = [
  { value: 0.01, label: '0.01%', icon: '⚡', badgeText: 'Faster Execution', lpFee: 100 },
  { value: 0.1, label: '0.1%', icon: '🔥', badgeText: 'Best Returns', lpFee: 1000 },
]

/** Set of supported lpFee values for quick membership checks */
export const LIMIT_ORDER_SUPPORTED_LP_FEES = new Set(LIMIT_ORDER_FEE_OPTIONS.map((o) => o.lpFee))

/**
 * Stores the selected fee tier percentage value from LIMIT_ORDER_FEE_OPTIONS.
 * Default: first option (0.01% / Faster Execution).
 */
export const selectedFeeTierAtom = atom(LIMIT_ORDER_FEE_OPTIONS[0].value)
