import { Ifo, SUPPORTED_CHAIN_IDS, getActiveIfo, getIfoConfig, getInActiveIfos } from '@pancakeswap/ifos'
import { useQuery } from '@tanstack/react-query'

import orderBy from 'lodash/orderBy'
import { useMemo } from 'react'
import { useActiveChainId } from 'hooks/useActiveChainId'

export function useIfoConfigs() {
  const { chainId } = useActiveChainId()
  const { data } = useQuery({
    queryKey: [chainId, 'ifo-configs'],
    queryFn: () => getIfoConfig(chainId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
  return data
}

export function useIfoConfigsAcrossChains() {
  const { data } = useQuery({
    queryKey: ['ifo-configs'],
    queryFn: async () => {
      const configs = await Promise.all(SUPPORTED_CHAIN_IDS.map(getIfoConfig))
      return configs.reduce<Ifo[]>((acc, cur) => [...acc, ...cur], [])
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
  return data
}

export function useActiveIfoConfig() {
  const { chainId } = useActiveChainId()
  const { data, isPending } = useQuery({
    queryKey: [chainId, 'active-ifo'],
    queryFn: () => getActiveIfo(chainId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
  return {
    activeIfo: data,
    isPending,
  }
}

export function useInActiveIfoConfigs() {
  const { data } = useQuery({
    queryKey: ['inactive-ifo-configs'],
    queryFn: () => getInActiveIfos(),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
  return data
}

export function useIfoConfigById(id: string) {
  const configs = useIfoConfigs()
  return useMemo(() => configs?.find((ifo) => ifo.id === id), [configs, id])
}

export function useIfoConfigAcrossChainsById(id: string) {
  const configs = useIfoConfigsAcrossChains()
  return useMemo(() => configs?.find((ifo) => ifo.id === id), [configs, id])
}

export function useActiveIfoConfigAcrossChains() {
  const configs = useIfoConfigsAcrossChains()
  return useMemo(() => {
    const sortedConfigs = orderBy(configs, 'plannedStartTime', 'desc')
    return sortedConfigs?.find((ifo) => ifo.isActive)
  }, [configs])
}
