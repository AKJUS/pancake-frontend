import { render, screen } from '@testing-library/react'
import { Protocol } from '@pancakeswap/farms'
import type { PoolInfo } from 'state/farmsV4/state/type'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PoolGlobalAprButton } from './PoolGlobalAprButton'

const usePoolAprMock = vi.fn()
const poolAprButtonSpy = vi.fn()

vi.mock('state/farmsV4/hooks', () => ({
  usePoolApr: (...args: unknown[]) => usePoolAprMock(...args),
}))

vi.mock('hooks/Tokens', () => ({
  useCurrencyByChainId: () => null,
}))

vi.mock('views/PoolDetail/components/MyPositionsContext', () => ({
  useMyPositions: () => ({
    totalApr: {},
    updateTotalApr: vi.fn(),
  }),
}))

vi.mock('./PoolAprButton', () => ({
  PoolAprButton: (props: unknown) => {
    poolAprButtonSpy(props)
    return <div data-testid="pool-apr-button" />
  },
}))

const createPool = (): PoolInfo =>
  ({
    chainId: 143,
    protocol: Protocol.V3,
    lpAddress: '0x63e48B725540A3Db24ACF6682a29f877808C53F2',
    token0: { symbol: 'WMON' },
    token1: { symbol: 'USDC' },
    feeTier: 500,
    feeTierBase: 1_000_000,
    isFarming: false,
    tvlUsd: '744994.79',
  } as PoolInfo)

describe('PoolGlobalAprButton', () => {
  beforeEach(() => {
    usePoolAprMock.mockReset()
    poolAprButtonSpy.mockReset()

    usePoolAprMock.mockReturnValue({
      lpApr: '0.53',
      cakeApr: { value: '0' },
      merklApr: '12.47',
      incentraApr: '0',
    })
  })

  it('uses provided aprInfo without calling the live apr hook', () => {
    render(
      <PoolGlobalAprButton
        pool={createPool()}
        aprInfo={{
          lpApr: '0.53',
          cakeApr: { value: '0' },
          merklApr: '0',
          incentraApr: '0',
        }}
      />,
    )

    expect(screen.getByTestId('pool-apr-button')).toBeTruthy()
    expect(usePoolAprMock).not.toHaveBeenCalled()
    expect(poolAprButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        lpApr: 0.53,
        merklApr: 0,
        incentraApr: 0,
      }),
    )
  })

  it('loads live apr data when aprInfo is not provided', () => {
    render(<PoolGlobalAprButton pool={createPool()} />)

    expect(screen.getByTestId('pool-apr-button')).toBeTruthy()
    expect(usePoolAprMock).toHaveBeenCalledWith(
      '143:0x63e48B725540A3Db24ACF6682a29f877808C53F2',
      expect.objectContaining({
        chainId: 143,
      }),
      true,
    )
    expect(poolAprButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        lpApr: 0.53,
        merklApr: 12.47,
        incentraApr: 0,
      }),
    )
  })
})
