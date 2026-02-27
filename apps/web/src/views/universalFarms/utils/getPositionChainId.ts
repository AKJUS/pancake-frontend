import { Protocol } from '@pancakeswap/farms'
import { UnifiedPositionDetail, V2LPDetail, StableLPDetail } from 'state/farmsV4/state/accountPositions/type'

/**
 * Extracts the chainId from a unified position detail.
 * Handles different position types (V3, V2, Stable, Infinity, Solana).
 * Returns 0 if chainId cannot be determined.
 */
export function getPositionChainId(position: UnifiedPositionDetail): number {
  if ('chainId' in position) {
    return position.chainId
  }
  if (position.protocol === Protocol.V2 && 'pair' in position) {
    return (position as V2LPDetail).pair.chainId
  }

  if ([Protocol.STABLE, Protocol.InfinitySTABLE].includes(position.protocol) && 'pair' in position) {
    return (position as StableLPDetail).pair.liquidityToken.chainId
  }
  return 0
}
