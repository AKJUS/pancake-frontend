import { useCallback } from 'react'
import { isEvm, NonEVMChainId } from '@pancakeswap/chains'
import { INFINITY_SUPPORTED_CHAINS } from '@pancakeswap/infinity-sdk'
import { isStableSwapSupported as isStableSwapSupported_ } from '@pancakeswap/stable-swap-sdk'

export const useProtocolSupported = () => {
  const isInfinitySupported = useCallback((chainId: number) => INFINITY_SUPPORTED_CHAINS.includes(chainId), [])
  const isV3Supported = useCallback((chainId: number) => isEvm(chainId) || [NonEVMChainId.SOLANA].includes(chainId), [])
  const isV2Supported = useCallback((chainId: number) => isEvm(chainId), [])
  const isStableSwapSupported = useCallback((chainId: number) => isStableSwapSupported_(chainId), [])
  return {
    isInfinitySupported,
    isV2Supported,
    isV3Supported,
    isStableSwapSupported,
  }
}
