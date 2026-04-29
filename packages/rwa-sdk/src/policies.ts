import { getTradeFamilies } from './lookup'
import { MarketStatusPolicy, RWATokenIdentifier, RWATokensByFamily, SelectionPolicy } from './types'

export const requiresXRouting = (
  base: RWATokenIdentifier | undefined,
  quote: RWATokenIdentifier | undefined,
  tokensByFamily: RWATokensByFamily,
): boolean => getTradeFamilies(base, quote, tokensByFamily).some((family) => family.routing.mode === 'x-only')

export const getSelectionPolicy = (
  base: RWATokenIdentifier | undefined,
  quote: RWATokenIdentifier | undefined,
  tokensByFamily: RWATokensByFamily,
): SelectionPolicy | undefined => getTradeFamilies(base, quote, tokensByFamily)[0]?.selection

export const getMarketStatusPolicy = (
  base: RWATokenIdentifier | undefined,
  quote: RWATokenIdentifier | undefined,
  tokensByFamily: RWATokensByFamily,
): MarketStatusPolicy | undefined => getTradeFamilies(base, quote, tokensByFamily)[0]?.marketStatus
