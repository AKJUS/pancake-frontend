import { UnifiedPositionDetail } from 'state/farmsV4/state/accountPositions/type'

/**
 * Generate a unique key for a position across different protocols
 * @param position - The unified position detail
 * @returns A unique string key for the position
 */
export function getPositionKey(position: UnifiedPositionDetail): string {
  // V3 (EVM) and InfinityCL positions use tokenId
  if ('tokenId' in position) {
    return position.tokenId.toString()
  }

  // Solana V3 positions use nftMint as the unique identifier
  if ('nftMint' in position && position.nftMint) {
    return position.nftMint.toBase58()
  }

  // InfinityBin positions use poolId
  if ('poolId' in position && position.poolId) {
    // Handle PublicKey objects (Solana) vs strings
    return typeof position.poolId === 'string'
      ? position.poolId
      : position.poolId.toBase58?.() ?? position.poolId.toString()
  }

  // V2/Stable positions use pair liquidity token address
  return position.pair?.liquidityToken?.address ?? 'unknown'
}
