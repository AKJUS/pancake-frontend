/* eslint-disable no-param-reassign */
import { ChainId, NonEVMChainId } from '@pancakeswap/chains'
import {
  Currency,
  ERC20Token,
  isWSol,
  Native,
  NativeCurrency,
  SOL,
  SPLToken,
  Token,
  UnifiedCurrency,
  UnifiedNativeCurrency,
  UnifiedToken,
} from '@pancakeswap/sdk'
import { type Address, erc20Abi, zeroAddress } from 'viem'

import { TokenAddressMap } from '@pancakeswap/token-lists'
import { useReadContracts } from '@pancakeswap/wagmi'
import { GELATO_NATIVE } from 'config/constants'
import { UnsafeCurrency } from 'config/constants/types'
import { atom, useAtomValue } from 'jotai'
import memoize from 'lodash/memoize'
import uniqueId from 'lodash/uniqueId'
import { useMemo } from 'react'
import {
  combinedCurrenciesMapFromActiveUrlsAtom,
  combinedTokenMapFromActiveUrlsAtom,
  combinedTokenMapFromOfficialsUrlsAtom,
  combinedTokenMapFromUnsupportedUrlsAtom,
  useUnsupportedTokenList,
  useWarningTokenList,
} from 'state/lists/hooks'
import { SOLANA_NATIVE_TOKEN_ADDRESS } from 'quoter/consts'
import { safeGetAddress, safeGetUnifiedAddress } from 'utils'
import { accountActiveChainAtom } from 'wallet/atoms/accountStateAtoms'
import { atomFamily } from 'jotai/utils'
import isEqual from 'lodash/isEqual'
import { multicall } from 'viem/actions'
import { publicClient } from 'utils/viem'
import useUserAddedTokens, { useUserAddedTokensByChainIds } from '../state/user/hooks/useUserAddedTokens'
import { useActiveChainId } from './useActiveChainId'
import useNativeCurrency, { useUnifiedNativeCurrency } from './useNativeCurrency'
import { useAccountActiveChain } from './useAccountActiveChain'
import { useSolanaTokenList } from './solana/useSolanaTokenList'
import { useSolanaToken } from './solana/useSolanaToken'

export const mapWithoutUrls = (tokenMap?: TokenAddressMap<ChainId>, chainId?: number) => {
  if (!tokenMap || !chainId) return {}
  return Object.keys(tokenMap[chainId] || {}).reduce<{ [address: string]: ERC20Token }>((newMap, address) => {
    const checksumAddress = safeGetAddress(address)

    if (checksumAddress && !newMap[checksumAddress]) {
      newMap[checksumAddress] = tokenMap[chainId][address].token
    }

    return newMap
  }, {})
}

const mapWithoutUrlsBySymbol = (tokenMap?: TokenAddressMap<ChainId>, chainId?: number) => {
  if (!tokenMap || !chainId) return {}
  return Object.keys(tokenMap[chainId] || {}).reduce<{ [symbol: string]: ERC20Token }>((newMap, symbol) => {
    newMap[symbol] = tokenMap[chainId][symbol].token

    return newMap
  }, {})
}

/**
 * Returns all tokens of activeChain that are from active urls and user added tokens
 */
export function useAllTokens(overrideChainId?: number): { [address: string]: ERC20Token } {
  const { chainId: activeChainId } = useActiveChainId()
  const chainId = overrideChainId || activeChainId

  const tokenMap = useAtomValue(combinedTokenMapFromActiveUrlsAtom)
  const userAddedTokens = useUserAddedTokens(chainId)
  return useMemo(() => {
    const allTokens = userAddedTokens
      // reduce into all ALL_TOKENS filtered by the current chain
      .reduce<{ [address: string]: ERC20Token }>(
        (tokenMap_, token) => {
          const checksumAddress = safeGetAddress(token.address)

          if (checksumAddress) {
            tokenMap_[checksumAddress] = token
          }

          return tokenMap_
        },
        // must make a copy because reduce modifies the map, and we do not
        // want to make a copy in every iteration
        mapWithoutUrls(tokenMap, chainId),
      )

    return allTokens
  }, [userAddedTokens, tokenMap, chainId])
}

export type TokenChainAddressMap<TChainId extends number = number> = {
  [chainId in TChainId]: {
    [tokenAddress: Address]: ERC20Token
  }
}

const tokenMapCache = new WeakMap<TokenAddressMap<ChainId>, string>()

const memoizedTokenMap = memoize(
  (
    chainIds: ChainId[],
    tokenMap: TokenAddressMap<ChainId>,
    userAddedTokenMap: { [p: number]: Token[] },
  ): TokenChainAddressMap => {
    return chainIds.reduce<TokenChainAddressMap>((tokenMap_, chainId) => {
      tokenMap_[chainId] = tokenMap_[chainId] || {}
      userAddedTokenMap[chainId].forEach((token) => {
        const checksumAddress = safeGetAddress(token.address)
        if (checksumAddress) {
          tokenMap_[chainId][checksumAddress] = token
        }
      })
      Object.keys(tokenMap[chainId] || {}).forEach((address) => {
        const checksumAddress = safeGetAddress(address)
        if (checksumAddress && !tokenMap_[chainId][checksumAddress]) {
          tokenMap_[chainId][checksumAddress] = tokenMap[chainId][address].token
        }
      })

      return tokenMap_
    }, {})
  },
  (chainIds, tokenMap, userAddedTokenMap) => {
    let tokenMapId = tokenMapCache.get(tokenMap)
    if (!tokenMapId) {
      tokenMapId = uniqueId()
      tokenMapCache.set(tokenMap, tokenMapId)
    }
    const chainIdsKey = chainIds.join(',')
    // User-added tokens are small and contain only the token; stringify can be used.
    const userAddedTokenMapKey = JSON.stringify(
      Object.keys(userAddedTokenMap).reduce((acc, chainId) => {
        acc[chainId] = userAddedTokenMap[chainId].map((token) => token.address || '')
        return acc
      }, {} as { [p: number]: string[] }),
    )
    return `${chainIdsKey}:${tokenMapId}:${userAddedTokenMapKey}`
  },
)

export function useTokensByChainIds(chainIds: number[], tokenMap: TokenAddressMap<ChainId>): TokenChainAddressMap {
  const userAddedTokenMap = useUserAddedTokensByChainIds(chainIds)

  return memoizedTokenMap(chainIds, tokenMap, userAddedTokenMap)
}

/**
 * Returns all tokens that are from active urls and user added tokens
 */
export function useAllTokensByChainIds(chainIds: number[]): TokenChainAddressMap {
  const allTokenMap = useAtomValue(combinedTokenMapFromActiveUrlsAtom)
  return useTokensByChainIds(chainIds, allTokenMap)
}

export function useOfficialsAndUserAddedTokensByChainIds(chainIds: number[]): TokenChainAddressMap {
  const tokenMap = useAtomValue(combinedTokenMapFromOfficialsUrlsAtom)
  return useTokensByChainIds(chainIds, tokenMap)
}

export function useAllOnRampTokens(): { [address: string]: Currency } {
  const { chainId } = useActiveChainId()
  const tokenMap = useAtomValue(combinedCurrenciesMapFromActiveUrlsAtom)
  return useMemo(() => {
    return mapWithoutUrlsBySymbol(tokenMap, chainId)
  }, [tokenMap, chainId])
}

/**
 * Returns all tokens that are from officials token list and user added tokens
 */
export function useOfficialsAndUserAddedTokens(): { [address: string]: ERC20Token } {
  const { chainId } = useActiveChainId()
  const tokenMap = useAtomValue(combinedTokenMapFromOfficialsUrlsAtom)

  const userAddedTokens = useUserAddedTokens()
  return useMemo(() => {
    return (
      userAddedTokens
        // reduce into all ALL_TOKENS filtered by the current chain
        .reduce<{ [address: string]: ERC20Token }>(
          (tokenMap_, token) => {
            const checksumAddress = safeGetAddress(token.address)

            if (checksumAddress) {
              tokenMap_[checksumAddress] = token
            }

            return tokenMap_
          },
          // must make a copy because reduce modifies the map, and we do not
          // want to make a copy in every iteration
          mapWithoutUrls(tokenMap, chainId),
        )
    )
  }, [userAddedTokens, tokenMap, chainId])
}

export function useUnsupportedTokens(overrideChainId?: number): { [address: string]: ERC20Token } {
  const { chainId: activeChainId } = useActiveChainId()
  const chainId = overrideChainId || activeChainId

  const unsupportedTokensMap = useUnsupportedTokenList()
  return useMemo(() => mapWithoutUrls(unsupportedTokensMap, chainId), [unsupportedTokensMap, chainId])
}

export function useWarningTokens(chainId?: ChainId): { [address: string]: ERC20Token } {
  const { chainId: activeChainId } = useActiveChainId()
  const selectedChainId = chainId ?? activeChainId
  const warningTokensMap = useWarningTokenList()
  return useMemo(() => mapWithoutUrls(warningTokensMap, selectedChainId), [warningTokensMap, selectedChainId])
}

export function useIsTokenActive(token: UnifiedToken | undefined | null, chainId?: number): boolean {
  const activeEvmTokens = useAllTokens(chainId)
  const { tokenList: solanaTokens } = useSolanaTokenList()

  return useMemo(() => {
    if (
      (chainId && chainId in ChainId && !activeEvmTokens) ||
      (chainId === NonEVMChainId.SOLANA && !solanaTokens.length) ||
      !token
    ) {
      return false
    }

    const tokenAddress = safeGetUnifiedAddress(chainId, token.address)

    return Boolean((tokenAddress && !!activeEvmTokens[tokenAddress]) || solanaTokens.find((t) => t.equals(token)))
  }, [activeEvmTokens, chainId, solanaTokens, token])
}

// Check if currency is included in custom list from user storage
export function useIsUserAddedToken(currency: UnifiedCurrency | undefined | null, chainId?: number): boolean {
  const userAddedTokens = useUserAddedTokens(chainId)

  if (!currency?.equals) {
    return false
  }

  return !!userAddedTokens.find((token) => currency?.equals(token))
}

export function useUnifiedToken(
  tokenAddress?: string,
  chainId?: number,
  options?: {
    unwrapWSol: boolean
  },
): UnifiedToken | undefined {
  const { chainId: activeChainId } = useAccountActiveChain()
  const chainIdToUse = chainId ?? activeChainId
  const spl = useSolanaToken(tokenAddress)
  const ercToken = useTokenByChainId(tokenAddress, chainIdToUse)
  if (chainIdToUse === NonEVMChainId.SOLANA) {
    if (options?.unwrapWSol && spl && isWSol(spl.address)) {
      return SOL as unknown as SPLToken
    }
    return spl
  }
  return ercToken ?? undefined
}

export function useToken(tokenAddress?: string, chainId?: number): ERC20Token | undefined | null {
  const { chainId: activeChainId } = useActiveChainId()
  const chainIdToUse = chainId ?? activeChainId
  return useTokenByChainId(tokenAddress, chainIdToUse)
}
// undefined if invalid or does not exist
// null if loading
// otherwise returns the token
export function useTokenByChainId(tokenAddress?: string, chainId?: number): ERC20Token | undefined | null {
  const unsupportedTokens = useUnsupportedTokens()
  const tokens = useAllTokensByChainIds(useMemo(() => (chainId ? [chainId] : []), [chainId]))

  const address = safeGetAddress(tokenAddress)

  const token: ERC20Token | undefined = address && chainId ? tokens[chainId][address] : undefined

  const { data, isLoading } = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        chainId,
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      },
      {
        chainId,
        address,
        abi: erc20Abi,
        functionName: 'symbol',
      },
      {
        chainId,
        address,
        abi: erc20Abi,
        functionName: 'name',
      },
    ],
    query: {
      enabled: Boolean(!token && address),
      staleTime: Infinity,
    },
  })

  return useMemo(() => {
    if (token) return token
    if (!chainId || !address) return undefined
    if (unsupportedTokens[address]) return undefined
    if (isLoading) return null
    if (data) {
      return new ERC20Token(chainId, address, data[0], data[1] ?? 'UNKNOWN', data[2] ?? 'Unknown Token')
    }
    return undefined
  }, [token, chainId, address, isLoading, data, unsupportedTokens])
}

// Batch version of useTokenByChainId
// Returns a map of address -> token for multiple token addresses
export function useTokensByChainId(
  tokenAddresses: string[],
  chainId?: number,
): Record<string, ERC20Token | undefined | null> {
  const unsupportedTokens = useUnsupportedTokens()
  const tokens = useAllTokensByChainIds(useMemo(() => (chainId ? [chainId] : []), [chainId]))

  // Process addresses and separate existing tokens from ones that need to be fetched
  const processedData = useMemo(() => {
    const validAddresses: Address[] = []
    const existingTokens: Record<string, ERC20Token> = {}
    const addressesToFetch: Address[] = []

    tokenAddresses.forEach((tokenAddress) => {
      const address = safeGetAddress(tokenAddress)
      if (!address) return

      validAddresses.push(address)

      const existingToken = chainId ? tokens[chainId]?.[address] : undefined
      if (existingToken) {
        existingTokens[address] = existingToken
      } else if (!unsupportedTokens[address]) {
        addressesToFetch.push(address)
      }
    })

    return { validAddresses, existingTokens, addressesToFetch }
  }, [tokenAddresses, chainId, tokens, unsupportedTokens])

  // Build contracts array for addresses that need to be fetched
  const contracts = useMemo(() => {
    const contractsArray: any[] = []

    processedData.addressesToFetch.forEach((address) => {
      contractsArray.push(
        {
          chainId,
          address,
          abi: erc20Abi,
          functionName: 'decimals',
        },
        {
          chainId,
          address,
          abi: erc20Abi,
          functionName: 'symbol',
        },
        {
          chainId,
          address,
          abi: erc20Abi,
          functionName: 'name',
        },
      )
    })

    return contractsArray
  }, [processedData.addressesToFetch, chainId])

  const { data, isLoading } = useReadContracts({
    allowFailure: false,
    contracts,
    query: {
      enabled: Boolean(processedData.addressesToFetch.length > 0 && chainId),
      staleTime: Infinity,
    },
  })

  return useMemo(() => {
    const result: Record<string, ERC20Token | undefined | null> = {}

    // Add existing tokens
    Object.entries(processedData.existingTokens).forEach(([address, token]) => {
      result[address] = token
    })

    // Handle unsupported tokens
    processedData.validAddresses.forEach((address) => {
      if (unsupportedTokens[address]) {
        result[address] = undefined
      }
    })

    // Handle loading state for addresses being fetched
    if (isLoading && processedData.addressesToFetch.length > 0) {
      processedData.addressesToFetch.forEach((address) => {
        if (!(address in result)) {
          result[address] = null
        }
      })
    }

    // Handle fetched data
    if (data && chainId) {
      processedData.addressesToFetch.forEach((address, index) => {
        const dataIndex = index * 3
        if (dataIndex + 2 < data.length) {
          const decimals = data[dataIndex] as number
          const symbol = data[dataIndex + 1] as string
          const name = data[dataIndex + 2] as string

          result[address] = new ERC20Token(chainId, address, decimals, symbol ?? 'UNKNOWN', name ?? 'Unknown Token')
        }
      })
    }

    // Set undefined for addresses that weren't found in any category
    processedData.validAddresses.forEach((address) => {
      if (!(address in result)) {
        result[address] = undefined
      }
    })

    return result
  }, [processedData, unsupportedTokens, isLoading, data, chainId])
}

export function useOnRampToken(currencyId?: string): Currency | undefined {
  const { chainId } = useActiveChainId()
  const tokens = useAllOnRampTokens()
  const token = currencyId && tokens[currencyId]

  return useMemo(() => {
    if (token) return token
    if (!chainId || !currencyId) return undefined
    return undefined
  }, [token, chainId, currencyId])
}

export function useUnifiedCurrency(currencyId: string | undefined, chainId?: number): UnifiedCurrency | undefined {
  const native: UnifiedNativeCurrency = useUnifiedNativeCurrency(chainId)

  const isNative =
    currencyId?.toUpperCase() === native.symbol?.toUpperCase() ||
    currencyId?.toLowerCase() === GELATO_NATIVE ||
    currencyId?.toLowerCase() === zeroAddress ||
    currencyId?.toLowerCase() === SOLANA_NATIVE_TOKEN_ADDRESS

  const token = useUnifiedToken(isNative ? undefined : currencyId, chainId)
  return isNative ? native : token
}

export function useCurrency(currencyId: string | undefined, chainId?: number): UnsafeCurrency {
  const native: NativeCurrency = useNativeCurrency(chainId)

  const isNative =
    currencyId?.toUpperCase() === native.symbol?.toUpperCase() ||
    currencyId?.toLowerCase() === GELATO_NATIVE ||
    currencyId?.toLowerCase() === zeroAddress

  const token = useToken(isNative ? undefined : currencyId, chainId)
  return isNative ? native : token
}

export function useCurrencyByChainId(
  currencyId: string | undefined,
  chainId?: number,
): Currency | ERC20Token | undefined {
  const native: NativeCurrency = useNativeCurrency(chainId)
  const isNative =
    currencyId?.toUpperCase() === native.symbol?.toUpperCase() ||
    currencyId?.toLowerCase() === GELATO_NATIVE ||
    currencyId?.toLowerCase() === zeroAddress

  const token = useTokenByChainId(isNative ? undefined : currencyId, chainId) ?? undefined
  return isNative ? native : token
}

export function useOnRampCurrency(currencyId: string | undefined): NativeCurrency | Currency | null | undefined {
  const native: NativeCurrency = useNativeCurrency()
  const isNative =
    currencyId?.toUpperCase() === native.symbol?.toUpperCase() ||
    currencyId?.toLowerCase() === GELATO_NATIVE ||
    currencyId?.toLowerCase() === zeroAddress
  const token = useOnRampToken(currencyId)

  return isNative ? native : token
}

export function convertTokenToCurrency(token: ERC20Token): Currency {
  const native = Native.onChain(token.chainId)

  const isNative =
    token.symbol?.toUpperCase() === native.symbol?.toUpperCase() ||
    token.symbol?.toLowerCase() === GELATO_NATIVE ||
    token.symbol?.toLowerCase() === zeroAddress

  return isNative ? native : token
}

export const currencyByChainIdAtom = atomFamily(
  ({ currencyId, chainId }: { currencyId: string; chainId: number }) =>
    atom<Promise<UnsafeCurrency>>(async (get) => {
      if (!chainId) return undefined

      const native = Native.onChain(chainId)

      if (
        currencyId?.toUpperCase() === native.symbol?.toUpperCase() ||
        currencyId?.toLowerCase() === GELATO_NATIVE ||
        currencyId?.toLowerCase() === zeroAddress
      ) {
        return native
      }

      const address = safeGetAddress(currencyId)

      // Check if unsupported token
      const unsupportedTokenMap = get(combinedTokenMapFromUnsupportedUrlsAtom)
      if (address && unsupportedTokenMap[address]) return undefined

      // TODO: Check for list of user-added tokens
      const tokens = get(combinedTokenMapFromActiveUrlsAtom)

      // Token found in list
      const tokenData = tokens[chainId][address]
      if (tokenData) return tokenData.token

      // Fallback to fetching info from erc20 contract
      if (address) {
        const client = publicClient({ chainId })
        const [name, symbol, decimals] = await multicall(client, {
          allowFailure: false,
          contracts: [
            {
              address,
              abi: erc20Abi,
              functionName: 'name',
            },
            {
              address,
              abi: erc20Abi,
              functionName: 'symbol',
            },
            {
              address,
              abi: erc20Abi,
              functionName: 'decimals',
            },
          ],
        })

        return new ERC20Token(chainId, address, decimals, symbol ?? 'UNKNOWN', name ?? 'Unknown Token')
      }

      // no token found
      return undefined
    }),
  isEqual,
)

export const currencyAtom = atomFamily(
  (currencyId: string) =>
    atom((get) => {
      const { chainId } = get(accountActiveChainAtom)
      return get(currencyByChainIdAtom({ currencyId, chainId }))
    }),
  isEqual,
)
