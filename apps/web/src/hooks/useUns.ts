import { ChainId } from '@pancakeswap/chains'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { polygonRpcProvider } from 'utils/providers'
import { Address } from 'viem'
import { useUNSContract } from './useContract'

function getUnsAddress(networkId: number): Address | '' {
  if (networkId === ChainId.ETHEREUM) return '0x049aba7510f45BA5b64ea9E658E342F904DB358D'
  if (networkId === 137) return '0xa9a6A3626993D487d2Dbda3173cf58cA1a9D9e9f'
  if (networkId === ChainId.BASE) return '0xF6c1b83977DE3dEffC476f5048A0a84d3375d498'
  return ''
}

export const useUnsNameForAddress = (address: Address, fetchData = true) => {
  const unsEtherContract = useUNSContract(getUnsAddress(ChainId.ETHEREUM), ChainId.ETHEREUM, undefined)
  const unsPolygonContract = useUNSContract(getUnsAddress(137), undefined, polygonRpcProvider)
  const unsBaseContract = useUNSContract(getUnsAddress(ChainId.BASE), ChainId.BASE, undefined)

  const { data: unsName, status } = useQuery({
    queryKey: ['unsName', address?.toLowerCase()],

    queryFn: async () => {
      const etherDomainName = await unsEtherContract.read.reverseNameOf([address]).catch(() => null)
      if (etherDomainName) return { name: etherDomainName }

      const polyDomainName = await unsPolygonContract.read.reverseNameOf([address]).catch(() => null)
      if (polyDomainName) return { name: polyDomainName }

      const baseDomainName = await unsBaseContract.read.reverseNameOf([address]).catch(() => null)
      if (baseDomainName) return { name: baseDomainName }

      return { name: null }
    },

    enabled: Boolean(fetchData && address),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })

  return useMemo(() => {
    return { unsName: unsName?.name, isLoading: status === 'pending' }
  }, [unsName, status])
}
