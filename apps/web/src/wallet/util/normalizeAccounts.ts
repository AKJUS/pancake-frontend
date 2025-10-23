import { safeGetAddress } from 'utils'

export const normalizeAccounts = (accounts: unknown): `0x${string}`[] => {
  if (!Array.isArray(accounts)) return []

  return accounts.map((account) => safeGetAddress(account)).filter((addr): addr is `0x${string}` => !!addr)
}
