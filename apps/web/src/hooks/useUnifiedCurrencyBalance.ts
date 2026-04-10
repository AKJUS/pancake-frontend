import { Currency, CurrencyAmount, SPLToken, UnifiedCurrency, UnifiedCurrencyAmount } from '@pancakeswap/sdk'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'
import { NonEVMChainId } from '@pancakeswap/chains'
import { useSolanaTokenBalance, useSolanaTokenBalances } from 'state/token/solanaTokenBalances'
import { useCurrencyBalance, useCurrencyBalances } from '../state/wallet/hooks'
import { useAccountActiveChain } from './useAccountActiveChain'
import { useSolanaConnectionWithRpcAtom } from './solana/useSolanaConnectionWithRpcAtom'

export type UnifiedBalance = CurrencyAmount<Currency> | UnifiedCurrencyAmount<UnifiedCurrency>

export function useUnifiedCurrencyBalance(currency?: UnifiedCurrency | null): UnifiedBalance | undefined {
  const { account: evmAccount, solanaAccount } = useAccountActiveChain()
  const connection = useSolanaConnectionWithRpcAtom()

  const isSolanaToken = Boolean(currency && 'programId' in currency)
  const isSolanaNative = Boolean(currency?.isNative && currency?.chainId === NonEVMChainId.SOLANA)

  const solanaTokenBalance = useSolanaTokenBalance(
    solanaAccount,
    isSolanaToken ? (currency as SPLToken).address : undefined,
  )

  // Native SOL balance — same cache key as useMultichainNativeBalances, so this hits the cache
  // when that hook has already fetched the balance (e.g. from the multichain token modal).
  const { data: solanaNativeLamports } = useQuery({
    queryKey: ['nativeBalance', solanaAccount, NonEVMChainId.SOLANA] as const,
    queryFn: async (): Promise<bigint> => {
      const lamports = await connection.getBalance(new PublicKey(solanaAccount!))
      return BigInt(lamports)
    },
    enabled: Boolean(isSolanaNative && solanaAccount),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const evmBalance = useCurrencyBalance(evmAccount, currency as Currency)

  return useMemo(() => {
    if (isSolanaToken && solanaTokenBalance) {
      return UnifiedCurrencyAmount.fromRawAmount(currency as UnifiedCurrency, solanaTokenBalance.balance.toString())
    }
    if (isSolanaNative && solanaNativeLamports !== undefined) {
      return UnifiedCurrencyAmount.fromRawAmount(currency as UnifiedCurrency, solanaNativeLamports.toString())
    }
    if (evmBalance) {
      return evmBalance
    }
    return undefined
  }, [currency, isSolanaToken, solanaTokenBalance, isSolanaNative, solanaNativeLamports, evmBalance])
}

export function useUnifiedCurrencyBalances(
  currencies?: (UnifiedCurrency | undefined)[],
): (UnifiedBalance | undefined)[] {
  const { account: evmAccount, solanaAccount } = useAccountActiveChain()

  // Separate Solana and EVM currencies while keeping track of their original positions
  const solanaCurrencies = useMemo(() => {
    return currencies?.filter((currency) => currency && SPLToken.isSPLToken(currency)) as SPLToken[]
  }, [currencies])

  const evmCurrencies = useMemo(() => {
    return currencies?.filter((currency) => currency && !SPLToken.isSPLToken(currency)) as Currency[]
  }, [currencies])

  // Get addresses for Solana tokens
  const solanaCurrenciesAddresses = useMemo(() => {
    return solanaCurrencies?.map((currency) => currency.address) || []
  }, [solanaCurrencies])

  // Fetch balances for each currency type
  const solanaBalances = useSolanaTokenBalances(
    solanaAccount,
    solanaCurrencies?.length > 0 ? solanaCurrenciesAddresses : undefined,
  )
  const evmBalances = useCurrencyBalances(evmAccount, evmCurrencies?.length > 0 ? evmCurrencies : undefined)

  // Map each currency to its balance, preserving original order
  return useMemo(() => {
    if (!currencies) return []

    return currencies.map((currency) => {
      if (!currency) return undefined

      // Handle Solana currencies
      if (SPLToken.isSPLToken(currency)) {
        const balance = solanaBalances?.balances.get((currency as SPLToken)?.address || '')
        return balance ? UnifiedCurrencyAmount.fromRawAmount(currency, balance.toString()) : undefined
      }

      // Handle EVM currencies
      const evmIndex = evmCurrencies?.findIndex((evmCurrency) => evmCurrency === currency)
      return evmIndex !== undefined && evmIndex >= 0 ? evmBalances?.[evmIndex] : undefined
    })
  }, [currencies, solanaBalances, evmBalances, evmCurrencies])
}
