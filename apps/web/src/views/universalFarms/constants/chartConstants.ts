/**
 * Chart-related constants for position charts
 */
import { TickMath } from '@pancakeswap/v3-sdk'

/** Minimum safe tick value for position charts (from v3-sdk) */
export const MIN_SAFE_TICK = TickMath.MIN_TICK

/** Maximum safe tick value for position charts (from v3-sdk) */
export const MAX_SAFE_TICK = TickMath.MAX_TICK

/** Default chart height in pixels */
export const CHART_HEIGHT = 200

/** Default chart width */
export const CHART_WIDTH = '100%'
