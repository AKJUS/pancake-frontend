import { MIN_SAFE_TICK, MAX_SAFE_TICK } from '../constants'

/**
 * Clamps a tick value to the safe range to prevent TICK invariant errors.
 * Returns 0 if tick is undefined or not finite.
 */
export function clampTick(tick: number | undefined): number {
  if (tick === undefined || !Number.isFinite(tick)) return 0
  return Math.max(MIN_SAFE_TICK, Math.min(MAX_SAFE_TICK, tick))
}

/**
 * Checks if a tick value is within the safe range.
 */
export function isTickValid(tick: number | undefined): boolean {
  if (tick === undefined) return false
  return tick >= MIN_SAFE_TICK && tick <= MAX_SAFE_TICK
}

/**
 * Logs a warning if a tick value had to be clamped.
 * Used for debugging tick-related issues.
 */
export function warnIfTickClamped(tick: number | undefined, clampedTick: number, tickName: string): void {
  if (tick !== undefined && tick !== clampedTick) {
    console.warn(`${tickName} was clamped from ${tick} to ${clampedTick}`)
  }
}
