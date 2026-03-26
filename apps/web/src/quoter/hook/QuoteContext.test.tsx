import { renderHook } from '@testing-library/react-hooks'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QuoteContextProvider, useQuoteContext } from './QuoteContext'

vi.mock('hooks/useActiveChainId', () => ({
  useActiveChainId: () => ({ chainId: 56 }),
}))

vi.mock('hooks/usePCSX', () => ({
  usePCSX: () => [true, vi.fn()],
  usePCSXEnabledOnChain: () => true,
}))

vi.mock('hooks/useSpeedQuote', () => ({
  useSpeedQuote: () => [true, vi.fn()],
}))

vi.mock('state/user/smartRouter', () => ({
  useUserInfinitySwapEnable: () => [true, vi.fn()],
  useUserInfinityStableSwapEnable: () => true,
  useUserSplitRouteEnable: () => [true, vi.fn()],
  useUserStableSwapEnable: () => [true, vi.fn()],
  useUserV2SwapEnable: () => [true, vi.fn()],
  useUserV3SwapEnable: () => [true, vi.fn()],
}))

vi.mock('@pancakeswap/utils/user', () => ({
  useUserSingleHopOnly: () => [false, vi.fn()],
}))

vi.mock('jotai', async () => {
  const actual = await vi.importActual<typeof import('jotai')>('jotai')
  return {
    ...actual,
    useAtomValue: () => ({ loading: false, error: false }),
  }
})

vi.mock('quoter/atom/routingStrategy', () => ({
  tokenRoutingConfigForInitAtom: {},
}))

vi.mock('./useMulticallGasLimit', () => ({
  useMulticallGasLimit: () => 123n,
}))

describe('QuoteContextProvider', () => {
  it('forces Infinity Stable routing off while preserving other routing flags', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <QuoteContextProvider>{children}</QuoteContextProvider>

    const { result } = renderHook(() => useQuoteContext(), { wrapper })

    expect(result.current.infinityStableSwap).toBe(false)
    expect(result.current.infinitySwap).toBe(true)
    expect(result.current.stableSwap).toBe(true)
    expect(result.current.v2Swap).toBe(true)
    expect(result.current.v3Swap).toBe(true)
    expect(result.current.split).toBe(true)
    expect(result.current.singleHopOnly).toBe(false)
    expect(result.current.multicallGasLimit).toBe(123n)
    expect(result.current.speedQuoteEnabled).toBe(true)
    expect(result.current.xEnabled).toBe(true)
  })
})
