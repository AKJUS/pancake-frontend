import { ChainId } from '@pancakeswap/chains'
import { useUserSingleHopOnly } from '@pancakeswap/utils/user'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { usePCSX, usePCSXEnabledOnChain } from 'hooks/usePCSX'
import { useSpeedQuote } from 'hooks/useSpeedQuote'
import { useAtomValue } from 'jotai'
import { tokenRoutingConfigForInitAtom } from 'quoter/atom/routingStrategy'
import { createContext, useContext } from 'react'
import {
  useUserInfinitySwapEnable,
  useUserInfinityStableSwapEnable,
  useUserSplitRouteEnable,
  useUserStableSwapEnable,
  useUserV2SwapEnable,
  useUserV3SwapEnable,
} from 'state/user/smartRouter'
import { useMulticallGasLimit } from './useMulticallGasLimit'

export interface QuoteContext {
  multicallGasLimit?: bigint
  singleHopOnly?: boolean
  split?: boolean
  v2Swap?: boolean
  v3Swap?: boolean
  infinitySwap: boolean
  infinityStableSwap?: boolean
  stableSwap?: boolean
  maxHops: number
  chainId: number
  speedQuoteEnabled: boolean
  xEnabled: boolean
}

const QuoteContext = createContext<QuoteContext>({
  multicallGasLimit: undefined,
  singleHopOnly: false,
  split: false,
  v2Swap: true,
  v3Swap: true,
  xEnabled: false,
  infinitySwap: true,
  infinityStableSwap: true,
  stableSwap: true,
  maxHops: 3,
  chainId: ChainId.BSC,
  speedQuoteEnabled: false,
})

const TEMP_DISABLE_INFINITY_STABLE_ROUTING = true

export const QuoteContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { chainId } = useActiveChainId()
  const limit = useMulticallGasLimit()
  const [speedQuoteEnabled] = useSpeedQuote()

  const [xEnabled] = usePCSX()
  const xEnabledOnChain = usePCSXEnabledOnChain(chainId)
  const [singleHopOnly] = useUserSingleHopOnly()
  const [split] = useUserSplitRouteEnable()
  const [v2Swap] = useUserV2SwapEnable()
  const [v3Swap] = useUserV3SwapEnable()
  const [infinitySwap] = useUserInfinitySwapEnable()
  const infinityStableSwap = useUserInfinityStableSwapEnable()
  const [stableSwap] = useUserStableSwapEnable()
  const config = useAtomValue(tokenRoutingConfigForInitAtom)
  if (config.loading || config.error) {
    return null
  }

  return (
    <QuoteContext.Provider
      value={{
        multicallGasLimit: limit,
        singleHopOnly,
        split,
        v2Swap,
        v3Swap,
        infinitySwap,
        // Temporary runtime override: Infinity Stable routing is disabled in swap quoting.
        infinityStableSwap: TEMP_DISABLE_INFINITY_STABLE_ROUTING ? false : infinityStableSwap,
        stableSwap,
        maxHops: 3,
        chainId,
        speedQuoteEnabled,
        xEnabled: Boolean(xEnabled && xEnabledOnChain),
      }}
      key={chainId}
    >
      {children}
    </QuoteContext.Provider>
  )
}

export const useQuoteContext = () => {
  const context = useContext(QuoteContext)
  if (!context) {
    throw new Error('useQuoteContext must be used within a QuoteProvider')
  }
  return context
}
