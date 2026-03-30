import { Protocol } from '@pancakeswap/farms'
import { useQuery } from '@tanstack/react-query'
import { chainIdToExplorerInfoChainName } from 'state/info/api/client'
import { components } from 'state/info/api/schema'
import { fetchPoolTransactions } from 'views/PoolDetail/hooks/usePoolTransactions'

export const usePoolHistory = (poolId?: string, chainId?: number) => {
  const chainName = chainId ? chainIdToExplorerInfoChainName[chainId] : undefined
  return useQuery({
    queryKey: ['poolHistory', chainName, poolId],
    queryFn: ({ signal }) =>
      fetchPoolTransactions(poolId!, Protocol.V3, chainName! as components['schemas']['ChainName'], chainId!, signal),
    enabled: !!poolId && !!chainName && !!chainId,
  })
}
