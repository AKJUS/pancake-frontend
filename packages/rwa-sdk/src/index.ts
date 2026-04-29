import { getFamily, getFamilyByToken, getTradeFamilies, isToken } from './lookup'
import { getRWAFamily, rwaFamilies, rwaRegistry } from './registry'
import { getMarketStatusPolicy, getSelectionPolicy, requiresXRouting } from './policies'

export * from './types'

export const RWA = {
  families: rwaFamilies,
  registry: rwaRegistry,
  getFamily,
  getRWAFamily,
  getFamilyByToken,
  getTradeFamilies,
  isToken,
  requiresXRouting,
  getSelectionPolicy,
  getMarketStatusPolicy,
}
