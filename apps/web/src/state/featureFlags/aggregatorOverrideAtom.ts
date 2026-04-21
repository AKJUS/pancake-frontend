import atomWithStorageWithErrorCatch from 'utils/atomWithStorageWithErrorCatch'

export const AGGREGATOR_OVERRIDE_QUERY_KEY = 'agg_override'
export const AGGREGATOR_OVERRIDE_STORAGE_KEY = 'pcs:aggregatorOverride'
export const AGGREGATOR_OVERRIDE_TTL_MS = 24 * 60 * 60 * 1000

export type AggregatorOverrideState = {
  enabled: true
  expiresAt: number
} | null

export const aggregatorOverrideAtom = atomWithStorageWithErrorCatch<AggregatorOverrideState>(
  AGGREGATOR_OVERRIDE_STORAGE_KEY,
  null,
)

export function getAggregatorOverrideQueryAction(value?: string | string[] | null): 'enable' | 'clear' | null {
  const normalized = Array.isArray(value) ? value[0] : value

  if (normalized === '1') {
    return 'enable'
  }

  if (normalized === '0') {
    return 'clear'
  }

  return null
}

export function createAggregatorOverrideState(
  now = Date.now(),
  ttlMs = AGGREGATOR_OVERRIDE_TTL_MS,
): Exclude<AggregatorOverrideState, null> {
  return {
    enabled: true,
    expiresAt: now + ttlMs,
  }
}

export function isAggregatorOverrideEnabled(state: AggregatorOverrideState, now = Date.now()): boolean {
  return Boolean(state?.enabled && state.expiresAt > now)
}
