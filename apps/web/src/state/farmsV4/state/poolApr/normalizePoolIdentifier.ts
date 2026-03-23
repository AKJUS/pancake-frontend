import { safeGetAddress } from 'utils/safeGetAddress'
import { ChainIdAddressKey } from '../type'

const isHexIdentifier = (value: string) => /^0x[0-9a-fA-F]+$/.test(value)

export const normalizePoolIdentifier = (value?: string): string | undefined => {
  if (!value) return undefined

  const address = safeGetAddress(value)
  if (address) return address.toLowerCase()

  // Infinity pools use bytes32 ids, not EVM addresses.
  if (isHexIdentifier(value)) return value.toLowerCase()

  return undefined
}

export const buildPoolAprKey = (chainId?: number, value?: string): ChainIdAddressKey | undefined => {
  if (typeof chainId === 'undefined' || !value) return undefined

  const normalizedIdentifier = normalizePoolIdentifier(value) ?? value
  return `${chainId}:${normalizedIdentifier}`
}

export const normalizePoolAprKey = (key?: ChainIdAddressKey | null): ChainIdAddressKey | undefined => {
  if (!key) return undefined

  const delimiterIndex = key.indexOf(':')
  if (delimiterIndex === -1) return undefined

  const chainId = Number(key.slice(0, delimiterIndex))
  const identifier = key.slice(delimiterIndex + 1)

  return buildPoolAprKey(chainId, identifier)
}
