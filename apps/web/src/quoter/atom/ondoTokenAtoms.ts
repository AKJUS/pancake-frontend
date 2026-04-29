import { ChainId, Token } from '@pancakeswap/sdk'
import { RWA } from '@pancakeswap/rwa-sdk'
import type { TokenInfo } from '@pancakeswap/token-lists'
import { memoizeAsync } from '@pancakeswap/utils/memoize'
import { normalizeAddress } from '@pancakeswap/utils/normalizeAddress'
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { rwaFamilyByTokenAtom, rwaFamilyTokenListAtom } from 'rwa/familyTokenAtoms'

const ondoFamily = RWA.getFamily('ondo')
const ONDO_STATUS_ENDPOINT =
  ondoFamily.marketStatus.type === 'ondo-status' ? ondoFamily.marketStatus.endpoints.assetStatus : ''
const ONDO_MARKET_STATUS_ENDPOINT =
  ondoFamily.marketStatus.type === 'ondo-status' ? ondoFamily.marketStatus.endpoints.marketStatus : ''
const MEMOIZE_TTL_MS = 30 * 1000

export const USDON_TOKEN_ADDRESS: Partial<Record<number, string>> = {
  [ChainId.BSC]: '0x1f8955E640Cbd9abc3C3Bb408c9E2E1f5F20DfE6',
  [ChainId.ETHEREUM]: '0xAcE8E719899F6E91831B18AE746C9A965c2119F1',
}

interface OndoAssetStatus {
  symbol: string
  status?: string
  type?: string
  reason?: {
    code?: string
    message?: string
    documentation?: string
  }
  start?: string
  end?: string
}

interface OndoMarketStatus {
  isOpen?: boolean
}

type OndoPauseCode = 'MARKET_CLOSED' | 'MARKET_PAUSED' | 'ASSET_PAUSED'

type OndoTokenStatusInfo = {
  status: 'active' | 'upcoming'
  code?: OndoPauseCode
}

const parsePauseCode = (rawCode?: string): OndoPauseCode | undefined => {
  if (rawCode === 'MARKET_CLOSED' || rawCode === 'MARKET_PAUSED' || rawCode === 'ASSET_PAUSED') {
    return rawCode
  }
  return undefined
}

const fetchOndoStatuses = memoizeAsync(
  async (): Promise<OndoAssetStatus[]> => {
    if (typeof window === 'undefined') {
      return []
    }
    const response = await fetch(ONDO_STATUS_ENDPOINT, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ONDO statuses: ${response.status}`)
    }

    const data = (await response.json()) as OndoAssetStatus[]
    return Array.isArray(data) ? data : []
  },
  {
    isValid: (result) => Array.isArray(result),
    resolver: () => Math.floor(Date.now() / MEMOIZE_TTL_MS),
  },
)

const fetchOndoMarketStatus = memoizeAsync(
  async (): Promise<OndoMarketStatus | undefined> => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const response = await fetch(ONDO_MARKET_STATUS_ENDPOINT, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ONDO market status: ${response.status}`)
    }

    const data = (await response.json()) as OndoMarketStatus | undefined
    return data && typeof data === 'object' ? data : undefined
  },
  {
    isValid: () => true,
    resolver: () => Math.floor(Date.now() / MEMOIZE_TTL_MS),
  },
)

export const ondoMarketStatusAtom = atom(async () => fetchOndoMarketStatus())

export const isOndoMarketOpen = async (): Promise<boolean> => {
  const marketStatus = await fetchOndoMarketStatus()
  return marketStatus?.isOpen !== false
}

const tokenInfoToToken = (tokenInfo: TokenInfo): Token =>
  new Token(tokenInfo.chainId, tokenInfo.address, tokenInfo.decimals, tokenInfo.symbol, tokenInfo.name)

export const ondoTokenListAtom = atom((get) => get(rwaFamilyTokenListAtom('ondo')) as TokenInfo[])

export const isOndoTokenFnAtom = atom((get) => {
  const tokens = get(ondoTokenListAtom)
  const lookup = new Set(tokens.map((token) => `${token.chainId}:${normalizeAddress(token.address)}`))
  return (chainId?: number, address?: string): boolean => {
    if (!chainId || !address) {
      return false
    }
    return lookup.has(`${chainId}:${normalizeAddress(address)}`)
  }
})

export const usdonTokenAtom = atomFamily(
  (chainId: number | undefined) =>
    atom((get) => {
      if (!chainId || chainId <= 0) {
        return undefined
      }

      const tokens = get(ondoTokenListAtom)
      const usdonAddress = USDON_TOKEN_ADDRESS[chainId]
      if (!usdonAddress) {
        return undefined
      }

      const match = tokens.find(
        (token) => token.chainId === chainId && normalizeAddress(token.address) === normalizeAddress(usdonAddress),
      )
      return match ? tokenInfoToToken(match) : undefined
    }),
  (a, b) => a === b,
)

const findOndoToken = (tokens: TokenInfo[], chainId: number, address: string): TokenInfo | undefined => {
  if (!tokens.length) {
    return undefined
  }

  const normalized = normalizeAddress(address)
  return tokens.find((token) => token.chainId === chainId && normalizeAddress(token.address) === normalized)
}

const DEFAULT_STATUS: OndoTokenStatusInfo = { status: 'active' }

const parseTimestamp = (value?: string): number | undefined => {
  if (!value) {
    return undefined
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const selectStatusForCurrentTime = (statuses: OndoAssetStatus[], now: number): OndoAssetStatus | undefined => {
  if (!statuses.length) {
    return undefined
  }

  const withTimestamps = statuses.map((item) => ({
    item,
    startTime: parseTimestamp(item.start),
    endTime: parseTimestamp(item.end),
  }))

  const active = withTimestamps
    .filter(({ startTime, endTime }) => {
      if (startTime !== undefined && now < startTime) {
        return false
      }
      if (endTime !== undefined && now >= endTime) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      const aStart = a.startTime ?? Number.NEGATIVE_INFINITY
      const bStart = b.startTime ?? Number.NEGATIVE_INFINITY
      return bStart - aStart
    })[0]

  if (active) {
    return active.item
  }
  return undefined
}

export const isOndoTokenAtom = atomFamily(
  ({ chainId, address }: { chainId: number; address: string }) =>
    atom((get) => {
      return get(rwaFamilyByTokenAtom({ chainId, address }))?.type === 'ondo'
    }),
  (a, b) => a.chainId === b.chainId && normalizeAddress(a.address) === normalizeAddress(b.address),
)

export const getOndoTokenStatus = async (
  tokens: TokenInfo[],
  chainId: number,
  address: string,
): Promise<OndoTokenStatusInfo | undefined> => {
  if (!address) {
    return DEFAULT_STATUS
  }
  const token = findOndoToken(tokens, chainId, address)
  if (!token) {
    return undefined
  }

  const marketOpen = await isOndoMarketOpen()
  if (!marketOpen) {
    return { status: 'upcoming', code: 'MARKET_CLOSED' }
  }

  const statuses = await fetchOndoStatuses()
  const matchingStatuses = statuses.filter((item) => item.symbol?.toLowerCase() === token.symbol.toLowerCase())
  const status = selectStatusForCurrentTime(matchingStatuses, Date.now())
  if (!status) {
    return { status: 'active' }
  }

  const { reason, status: apiStatus } = status
  const code = parsePauseCode(reason?.code)

  if (apiStatus === 'active' || apiStatus === 'upcoming') {
    return { status: apiStatus, code }
  }

  return DEFAULT_STATUS
}
