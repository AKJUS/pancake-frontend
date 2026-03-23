import { render, screen } from '@testing-library/react'
import { Protocol } from '@pancakeswap/farms'
import type { PoolInfo } from 'state/farmsV4/state/type'
import { describe, expect, it, vi } from 'vitest'
import { useAPRConfig } from './useColumnConfig'

const poolGlobalAprButtonSpy = vi.fn()

vi.mock('@pancakeswap/localization', async () => {
  const actual = await vi.importActual<object>('@pancakeswap/localization')
  return {
    ...actual,
    Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useTranslation: () => ({
      t: (value: string) => value,
    }),
  }
})

vi.mock('@pancakeswap/uikit', async () => {
  const actual = await vi.importActual<object>('@pancakeswap/uikit')
  return {
    ...actual,
    Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Skeleton: ({ width }: { width: number }) => <div data-testid={`skeleton-${width}`} />,
    useMatchBreakpoints: () => ({
      isXl: true,
      isXxl: true,
      isLg: true,
    }),
    useTooltip: () => ({
      targetRef: { current: null },
      tooltip: null,
      tooltipVisible: false,
    }),
  }
})

vi.mock('hooks/infinity/useHooksList', () => ({
  useHookByPoolId: () => undefined,
}))

vi.mock('hooks/Tokens', () => ({
  useUnifiedToken: () => null,
}))

vi.mock('./FarmStatusDisplay', () => ({
  RewardStatusDisplay: () => null,
}))

vi.mock('./FarmStatusDisplay/hooks', () => ({
  getRewardProvider: () => undefined,
  getRewardMultiplier: () => undefined,
}))

vi.mock('../atom/tokensMapAtom', () => ({
  tokensMapAtom: {},
}))

vi.mock('jotai', async () => {
  const actual = await vi.importActual<object>('jotai')
  return {
    ...actual,
    useAtomValue: () => ({ tokensMap: {} }),
  }
})

vi.mock('./PoolAprButton', () => ({
  PoolGlobalAprButton: (props: unknown) => {
    poolGlobalAprButtonSpy(props)
    return <div data-testid="pool-global-apr-button" />
  },
}))

vi.mock('components/TokenImage', () => ({
  TokenPairLogo: () => null,
}))

const createPool = (merklApr: string): PoolInfo =>
  ({
    chainId: 143,
    protocol: Protocol.V3,
    lpAddress: '0x63e48B725540A3Db24ACF6682a29f877808C53F2',
    token0: { symbol: 'WMON' },
    token1: { symbol: 'USDC' },
    feeTier: 500,
    feeTierBase: 1_000_000,
    isFarming: false,
    lpApr: '0.532478779319039',
    farm: {
      id: '0x63e48B725540A3Db24ACF6682a29f877808C53F2',
      chainId: 143,
      protocol: Protocol.V3,
      lpAddress: '0x63e48B725540A3Db24ACF6682a29f877808C53F2',
      feeTier: 500,
      apr24h: 0.533204544057555,
      vol24hUsd: '2166655.3022336185',
      tvlUSD: '744994.7928246392',
      feeTierBase: 1_000_000,
      pool: {} as any,
      cakeApr: { value: '0' },
      lpApr: '0.532478779319039',
      merklApr,
      incentraApr: '0',
    },
  } as PoolInfo)

const TestHarness = ({ pool }: { pool: PoolInfo }) => {
  const aprColumn = useAPRConfig()
  const content = aprColumn.render?.(pool.lpApr, pool, 0)
  return <>{content}</>
}

describe('useAPRConfig', () => {
  it('passes updated farm merklApr into PoolGlobalAprButton for list rows', () => {
    const pool = createPool('15646014069.24865')

    render(<TestHarness pool={pool} />)

    expect(screen.getByTestId('pool-global-apr-button')).toBeTruthy()
    expect(poolGlobalAprButtonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        aprInfo: expect.objectContaining({
          lpApr: '0.532478779319039',
          merklApr: '15646014069.24865',
          incentraApr: '0',
        }),
      }),
    )
  })
})
