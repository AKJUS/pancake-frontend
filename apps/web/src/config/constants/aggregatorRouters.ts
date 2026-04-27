import { ChainId } from '@pancakeswap/chains'
import { Address, getAddress } from 'viem'
import { isAddressEqual } from 'utils'

// PancakeSwap aggregator router contracts. Deterministic deployments (CREATE2) so
// ETH, Base, and BSC share the same address. Addresses here must be on-chain-verified
// before landing (bytecode review, Ownable/upgradeable audit).
const AGGREGATOR_V1 = getAddress('0x40A1Fe393A7F566F27dF6acE18e6773be844dAfc')

export const AGGREGATOR_ROUTERS: Partial<Record<ChainId, readonly Address[]>> = {
  [ChainId.ETHEREUM]: [AGGREGATOR_V1],
  [ChainId.BASE]: [AGGREGATOR_V1],
  [ChainId.BSC]: [AGGREGATOR_V1],
}

// Derived so the supported-chain set cannot drift from the allowlist.
// A chain is "supported" iff it has at least one allowlisted router.
// Kill-switch: clearing a chain's entry above disables both routing-strategy offering
// and all execution-time checks in one shot.
export const AGGREGATOR_SUPPORTED_CHAIN_IDS: readonly number[] = Object.entries(AGGREGATOR_ROUTERS)
  .filter(([, list]) => (list?.length ?? 0) > 0)
  .map(([chainId]) => Number(chainId))

export function isAllowedAggregatorRouter(chainId: number | undefined, address: string | undefined): boolean {
  if (!chainId || !address) return false
  const list = AGGREGATOR_ROUTERS[chainId as ChainId]
  if (!list || list.length === 0) return false
  let candidate: Address
  try {
    candidate = getAddress(address)
  } catch {
    return false
  }
  return list.some((allowed) => isAddressEqual(allowed, candidate))
}
