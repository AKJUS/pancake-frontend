import { ChainId, NonEVMChainId } from '@pancakeswap/chains'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { useQuery } from '@tanstack/react-query'
import BigNumber from 'bignumber.js'
import { useCallback, useMemo } from 'react'

import { useCombinedActiveList } from 'state/lists/hooks'
import { safeGetAddress } from 'utils/safeGetAddress'

import { WALLET_API } from 'config/constants/endpoints'
import { useAccountActiveChain } from './useAccountActiveChain'

export interface TokenData {
  address: string
  name: string
  symbol: string
  decimals: number
  isSpam: boolean
  logoURI?: string
}

export interface PriceData {
  totalUsd: number | null
  usd: number | null
  usd24h: number | null
}

export interface BalanceData {
  id: string
  chainId: number
  timestamp: string
  value: string
  quantity: string
  token: TokenData
  price: PriceData | null
}

interface UseAddressBalanceOptions {
  includeSpam?: boolean
  onlyWithPrice?: boolean
  filterByChainId?: ChainId | number
  enabled?: boolean
}

const API_BASE_URL = `${WALLET_API}/v1`

function isNative(address: string): boolean {
  return address === ZERO_ADDRESS
}

const useIsListedToken = () => {
  const list = useCombinedActiveList()
  return useCallback(
    (chainId: ChainId | NonEVMChainId, tokenAddress: string): boolean => {
      return (
        chainId === NonEVMChainId.SOLANA ||
        isNative(tokenAddress) ||
        Boolean(list[chainId]?.[safeGetAddress(tokenAddress) ?? ''])
      )
    },
    [list],
  )
}

/**
 * Hook to fetch and manage token balances for a specific address using React Query
 */
export const useAddressBalance = (
  address?: string | null,
  chainId?: number,
  options: UseAddressBalanceOptions = {},
) => {
  // const { chainId } = useActiveChainId()
  const { includeSpam = false, onlyWithPrice = false, filterByChainId, enabled = true } = options
  const list = useCombinedActiveList()

  const isListedToken = useIsListedToken()

  // Fetch balances from the API
  const fetchBalances = useCallback(async (): Promise<BalanceData[]> => {
    if (!address) return []

    const response = await fetch(`${API_BASE_URL}${chainId === NonEVMChainId.SOLANA ? '/sol' : ''}/balances/${address}`)

    if (!response.ok) {
      throw new Error(`Error fetching balances: ${response.statusText}`)
    }

    const data = (await response.json()) || []

    return data
  }, [address])

  const {
    data: balances,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['addressBalances', address],
    queryFn: fetchBalances,
    enabled: Boolean(address) && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })

  // Filter balances based on options
  const filteredBalances = useMemo(() => {
    return balances
      ? balances
          .map((b) => ({
            ...b,
            token: {
              ...b.token,
              logoURI: b.token.logoURI ?? list[b.chainId]?.[safeGetAddress(b.token.address)]?.token.logoURI,
            },
          }))
          .filter((balance) => {
            // Filter out spam tokens if includeSpam is false
            if (!includeSpam && balance.token.isSpam) {
              return false
            }

            // Filter by chain ID if specified
            if (filterByChainId !== undefined && balance.chainId !== filterByChainId) {
              return false
            }

            // Filter out tokens without price data if onlyWithPrice is true
            if (onlyWithPrice && !balance.price?.usd) {
              return false
            }

            return true
          })
          .sort((a, b) => {
            const aListed = isListedToken(a.chainId, a.token.address)
            const bListed = isListedToken(b.chainId, b.token.address)
            if (aListed && !bListed) return -1
            if (!aListed && bListed) return 1
            return (b.price?.totalUsd ?? 0) - (a.price?.totalUsd ?? 0)
          })
      : []
  }, [balances, includeSpam, filterByChainId, onlyWithPrice, isListedToken, list])

  // Calculate total balance in USD for all tokens
  const totalBalanceUsd = useMemo(() => {
    return balances
      ? balances.reduce((sum, item) => {
          if (item.price?.totalUsd) {
            return sum + item.price.totalUsd
          }
          return sum
        }, 0)
      : 0
  }, [balances])

  // Calculate total balance in USD for filtered tokens
  const filteredTotalBalanceUsd = useMemo(() => {
    return filteredBalances.reduce((sum, item) => {
      if (isListedToken(item.chainId, item.token.address) && item.price?.totalUsd) {
        return sum + item.price.totalUsd
      }
      return sum
    }, 0)
  }, [filteredBalances, isListedToken])

  // Get balances for a specific chain
  const getBalancesByChain = useCallback(
    (chainId: ChainId | number) => {
      return filteredBalances.filter((balance) => balance.chainId === chainId)
    },
    [filteredBalances],
  )

  // Get the top balances by USD value
  const getTopBalances = useCallback(
    (limit: number = 5) => {
      return [...filteredBalances]
        .filter((balance) => balance.price?.totalUsd)
        .sort((a, b) => {
          const aValue = a.price?.totalUsd || 0
          const bValue = b.price?.totalUsd || 0
          return bValue - aValue
        })
        .slice(0, limit)
    },
    [filteredBalances],
  )

  // Get native token balance for a specific chain
  const getNativeBalance = useCallback(
    (chainId: ChainId | number) => {
      return filteredBalances.find((balance) => balance.chainId === chainId && isNative(balance.token.address))
    },
    [filteredBalances],
  )

  // Get token balance by token address and chain
  const getTokenBalance = useCallback(
    (tokenAddress: string, chainId: ChainId | number) => {
      return filteredBalances.find(
        (balance) => balance.chainId === chainId && balance.token.address.toLowerCase() === tokenAddress.toLowerCase(),
      )
    },
    [filteredBalances],
  )

  // Get balance in BigNumber format with proper decimals
  const getBalanceAmount = useCallback((balance: BalanceData) => {
    return new BigNumber(balance.value).shiftedBy(-balance.token.decimals)
  }, [])

  return {
    balances: filteredBalances,
    isLoading,
    error,
    totalBalanceUsd: filteredTotalBalanceUsd,
    allTokensUsdValue: totalBalanceUsd,
    refresh: refetch,
    getBalancesByChain,
    getTopBalances,
    getNativeBalance,
    getTokenBalance,
    getBalanceAmount,
  }
}

export const useMultichainAddressBalance = () => {
  const { account: evmAccount, solanaAccount } = useAccountActiveChain()
  const isListedToken = useIsListedToken()

  const {
    balances: evmBalances,
    isLoading: isEvmLoading,
    totalBalanceUsd: evmTotalBalanceUsd,
  } = useAddressBalance(evmAccount, ChainId.BSC, {
    includeSpam: false,
    onlyWithPrice: false,
    enabled: Boolean(evmAccount),
  })

  const {
    balances: solanaBalances,
    isLoading: isSolanaLoading,
    totalBalanceUsd: solanaTotalBalanceUsd,
  } = useAddressBalance(solanaAccount ?? undefined, NonEVMChainId.SOLANA, {
    includeSpam: false,
    onlyWithPrice: false,
    enabled: Boolean(solanaAccount),
  })

  return useMemo(() => {
    return {
      balances: [...(evmBalances ?? []), ...(solanaBalances ?? [])].sort((a, b) => {
        const aListed = isListedToken(a.chainId, a.token.address)
        const bListed = isListedToken(b.chainId, b.token.address)
        if (aListed && !bListed) return -1
        if (!aListed && bListed) return 1
        return (b.price?.totalUsd ?? 0) - (a.price?.totalUsd ?? 0)
      }),
      isLoading: isEvmLoading || isSolanaLoading,
      totalBalanceUsd: (evmTotalBalanceUsd ?? 0) + (solanaTotalBalanceUsd ?? 0),
    }
  }, [evmBalances, solanaBalances, isEvmLoading, isSolanaLoading, evmTotalBalanceUsd, solanaTotalBalanceUsd])
}

export default useAddressBalance
