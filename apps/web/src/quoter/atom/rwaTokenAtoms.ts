import { ChainId, Token } from '@pancakeswap/sdk'
import type { TokenInfo } from '@pancakeswap/token-lists'
import { memoizeAsync } from '@pancakeswap/utils/memoize'
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { RWA_URLS } from 'config/constants/lists'
import { listsAtom } from 'state/lists/lists'

const RWA_STATUS_ENDPOINT = 'https://raw-api.pancakeswap.com/ondo/status'
const RWA_MARKET_STATUS_ENDPOINT = 'https://raw-api.pancakeswap.com/ondo/market-status'
const MEMOIZE_TTL_MS = 30 * 1000

export const USDON_TOKEN_ADDRESS: Partial<Record<number, string>> = {
  [ChainId.BSC]: '0x1f8955E640Cbd9abc3C3Bb408c9E2E1f5F20DfE6',
  [ChainId.ETHEREUM]: '0xAcE8E719899F6E91831B18AE746C9A965c2119F1',
}

interface RwaAssetStatus {
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

interface RwaMarketStatus {
  isOpen?: boolean
}

type RwaPauseCode = 'MARKET_CLOSED' | 'MARKET_PAUSED' | 'ASSET_PAUSED'

type RwaTokenStatusInfo = {
  status: 'active' | 'upcoming'
  code?: RwaPauseCode
}

const parsePauseCode = (rawCode?: string): RwaPauseCode | undefined => {
  if (rawCode === 'MARKET_CLOSED' || rawCode === 'MARKET_PAUSED' || rawCode === 'ASSET_PAUSED') {
    return rawCode
  }
  return undefined
}

const fetchRwaStatuses = memoizeAsync(
  async (): Promise<RwaAssetStatus[]> => {
    if (typeof window === 'undefined') {
      return []
    }
    const response = await fetch(RWA_STATUS_ENDPOINT, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch RWA statuses: ${response.status}`)
    }

    const data = (await response.json()) as RwaAssetStatus[]
    return Array.isArray(data) ? data : []
  },
  {
    isValid: (result) => Array.isArray(result),
    resolver: () => Math.floor(Date.now() / MEMOIZE_TTL_MS),
  },
)

const fetchRwaMarketStatus = memoizeAsync(
  async (): Promise<RwaMarketStatus | undefined> => {
    if (typeof window === 'undefined') {
      return undefined
    }
    const response = await fetch(RWA_MARKET_STATUS_ENDPOINT, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch RWA market status: ${response.status}`)
    }

    const data = (await response.json()) as RwaMarketStatus | undefined
    return data && typeof data === 'object' ? data : undefined
  },
  {
    isValid: () => true,
    resolver: () => Math.floor(Date.now() / MEMOIZE_TTL_MS),
  },
)

export const rwaMarketStatusAtom = atom(async () => fetchRwaMarketStatus())

export const isMarketOpen = async (): Promise<boolean> => {
  const marketStatus = await fetchRwaMarketStatus()
  return marketStatus?.isOpen !== false
}

const normalizeAddress = (address: string) => address.toLowerCase()

const tokenInfoToToken = (tokenInfo: TokenInfo): Token =>
  new Token(tokenInfo.chainId, tokenInfo.address, tokenInfo.decimals, tokenInfo.symbol, tokenInfo.name)

export const rwaTokenListAtom = atom((get) => {
  const lists = get(listsAtom)
  if (!lists?.byUrl) {
    return [] as TokenInfo[]
  }

  const tokens: TokenInfo[] = []
  const seen = new Set<string>()

  for (const url of RWA_URLS) {
    const tokenList = lists.byUrl[url]?.current
    if (!tokenList?.tokens?.length) {
      continue
    }

    for (const token of tokenList.tokens) {
      const normalizedAddress = normalizeAddress(token.address)
      const key = `${token.chainId}:${normalizedAddress}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      tokens.push(token)
    }
  }

  return tokens
})

export const isRwaTokenFnAtom = atom((get) => {
  const tokens = get(rwaTokenListAtom)
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

      const tokens = get(rwaTokenListAtom)
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

const findRwaToken = (tokens: TokenInfo[], chainId: number, address: string): TokenInfo | undefined => {
  if (!tokens.length) {
    return undefined
  }

  const normalized = normalizeAddress(address)
  return tokens.find((token) => token.chainId === chainId && token.address.toLowerCase() === normalized)
}

const DEFAULT_STATUS: RwaTokenStatusInfo = { status: 'active' }

const parseTimestamp = (value?: string): number | undefined => {
  if (!value) {
    return undefined
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

const selectStatusForCurrentTime = (statuses: RwaAssetStatus[], now: number): RwaAssetStatus | undefined => {
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

export const isRwaTokenAtom = atomFamily(
  ({ chainId, address }: { chainId: number; address: string }) =>
    atom((get) => {
      const tokens = get(rwaTokenListAtom)
      return Boolean(findRwaToken(tokens, chainId, address))
    }),
  (a, b) => a.chainId === b.chainId && normalizeAddress(a.address) === normalizeAddress(b.address),
)

export const getRwaTokenStatus = async (
  tokens: TokenInfo[],
  chainId: number,
  address: string,
): Promise<RwaTokenStatusInfo | undefined> => {
  if (!address) {
    return DEFAULT_STATUS
  }
  const token = findRwaToken(tokens, chainId, address)
  if (!token) {
    return undefined
  }

  const marketOpen = await isMarketOpen()
  if (!marketOpen) {
    return { status: 'upcoming', code: 'MARKET_CLOSED' }
  }

  const statuses = await fetchRwaStatuses()
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
