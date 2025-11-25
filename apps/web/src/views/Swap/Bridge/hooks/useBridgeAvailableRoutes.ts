import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { CROSSCHAIN_SUPPORTED_CHAINS } from 'quoter/utils/crosschain-utils/config'
import { ChainId, isSolana, NonEVMChainId } from '@pancakeswap/chains'
import { usePrivyWalletAddress } from 'wallet/Privy/hooks/usePrivyWalletAddress'
import { useExperimentalFeatureEnabled } from 'hooks/useExperimentalFeatureEnabled'
import { EXPERIMENTAL_FEATURES } from 'config/experimentalFeatures'
import { GetAvailableRoutesParams, getBridgeAvailableRoutes } from '../api'

function useBridgeAvailableRoutes() {
  return useQuery({
    queryKey: ['bridge-available-routes'],
    queryFn: () => getBridgeAvailableRoutes({}),
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

export function useBridgeAvailableChains(params?: GetAvailableRoutesParams) {
  const { data, isLoading } = useBridgeAvailableRoutes()
  const { address: privyAddress } = usePrivyWalletAddress()
  const isBridgeV2Enabled = useExperimentalFeatureEnabled(EXPERIMENTAL_FEATURES.BRIDGE_V2)

  // only return chains array,add origin chain id to the array
  const chains = useMemo(() => {
    if (!params?.originChainId || isSolana(params?.originChainId)) {
      if (!isBridgeV2Enabled && isSolana(params?.originChainId)) {
        return []
      }

      return CROSSCHAIN_SUPPORTED_CHAINS
    }

    if (!data) return []

    const acrossSupportedChains = [
      ...new Set(
        data.filter((route) => route.originChainId === params.originChainId).map((route) => route.destinationChainId),
      ),
    ]

    return [
      params.originChainId,
      ...(acrossSupportedChains.length > 0 && isBridgeV2Enabled ? [NonEVMChainId.SOLANA] : []),
      ...acrossSupportedChains,
    ]
  }, [data, params?.originChainId, privyAddress, isBridgeV2Enabled])

  return useMemo(() => {
    return {
      // if privy login, exclude zkSync because social login is not supported
      chains: chains.filter((chain) => (privyAddress ? chain !== ChainId.ZKSYNC : true)),
      loading: isLoading,
    }
  }, [chains, isLoading, privyAddress])
}
