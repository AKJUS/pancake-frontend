import { safeGetAddress } from 'utils/safeGetAddress'

const isHexIdentifier = (value: string) => /^0x[0-9a-fA-F]+$/.test(value)

export const normalizePoolIdentifier = (value?: string): string | undefined => {
  if (!value) return undefined

  const address = safeGetAddress(value)
  if (address) return address.toLowerCase()

  // Infinity pools use bytes32 ids, not EVM addresses.
  if (isHexIdentifier(value)) return value.toLowerCase()

  return undefined
}
