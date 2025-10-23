export const normalizeChainId = (chainId: unknown): number => {
  if (typeof chainId === 'number') {
    return chainId
  }
  if (typeof chainId === 'string') {
    return chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10)
  }
  throw new Error(`Invalid chainId: ${chainId} (type: ${typeof chainId})`)
}
