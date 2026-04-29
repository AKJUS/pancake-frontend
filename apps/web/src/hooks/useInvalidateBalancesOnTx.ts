import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SOLANA_BALANCES_QUERY_KEY } from 'state/token/atomFamily'
import { NonEVMChainId } from '@pancakeswap/chains'
import { ADDRESS_BALANCE_QUERY_KEY, NATIVE_BALANCE_QUERY_KEY } from 'config/constants'

export const useInvalidateBalancesOnTx = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handler = (e: Event) => {
      const { chainId } = (e as CustomEvent<{ chainId: number }>).detail
      queryClient.invalidateQueries({
        queryKey: [ADDRESS_BALANCE_QUERY_KEY],
        refetchType: 'active',
        exact: false,
      })
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === NATIVE_BALANCE_QUERY_KEY && query.queryKey[2] === chainId,
        refetchType: 'active',
      })
      if (chainId === NonEVMChainId.SOLANA) {
        queryClient.invalidateQueries({ queryKey: [SOLANA_BALANCES_QUERY_KEY], refetchType: 'active', exact: false })
      }
    }

    const events = ['pcs:successSolTx', 'pcs:refetchBlockData']
    events.forEach((event) => window.addEventListener(event, handler))
    return () => events.forEach((event) => window.removeEventListener(event, handler))
  }, [queryClient])
}
