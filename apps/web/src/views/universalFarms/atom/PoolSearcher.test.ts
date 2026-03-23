import { Protocol } from '@pancakeswap/farms'
import { getFarmKey } from 'state/farmsV4/search/farm.util'
import type { PoolInfo } from 'state/farmsV4/state/type'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PoolSearcher } from './PoolSearcher'

const batchGetCakeAprMock = vi.fn()
const batchGetLpAprDataMock = vi.fn()
const batchGetMerklAprDataMock = vi.fn()
const batchGetIncentraAprDataMock = vi.fn()

vi.mock('state/farmsV4/search/batchFarmDataFiller', () => ({
  fillOnchainPoolData: vi.fn(),
  batchGetCakeApr: (...args: unknown[]) => batchGetCakeAprMock(...args),
  batchGetLpAprData: (...args: unknown[]) => batchGetLpAprDataMock(...args),
  batchGetMerklAprData: (...args: unknown[]) => batchGetMerklAprDataMock(...args),
  batchGetIncentraAprData: (...args: unknown[]) => batchGetIncentraAprDataMock(...args),
}))

const targetFarmId = '0x63e48B725540A3Db24ACF6682a29f877808C53F2'
const targetFarmKey = getFarmKey({
  chainId: 143,
  id: targetFarmId,
})

const createPoolInfo = (): PoolInfo =>
  ({
    chainId: 143,
    protocol: Protocol.V3,
    lpAddress: targetFarmId,
    token0: { symbol: 'WMON' },
    token1: { symbol: 'USDC' },
    feeTier: 500,
    feeTierBase: 1_000_000,
    isFarming: false,
    farm: {
      id: targetFarmId,
      chainId: 143,
      protocol: Protocol.V3,
      lpAddress: targetFarmId,
      feeTier: 500,
      apr24h: 0.533204544057555,
      vol24hUsd: '2166655.3022336185',
      tvlUSD: '744994.7928246392',
      feeTierBase: 1_000_000,
      pool: {} as any,
      cakeApr: { value: '0' },
    },
  } as PoolInfo)

describe('PoolSearcher.updateAprs', () => {
  beforeEach(() => {
    batchGetCakeAprMock.mockReset()
    batchGetLpAprDataMock.mockReset()
    batchGetMerklAprDataMock.mockReset()
    batchGetIncentraAprDataMock.mockReset()

    batchGetCakeAprMock.mockResolvedValue([
      {
        id: targetFarmKey,
        value: { value: '0' },
      },
    ])
    batchGetLpAprDataMock.mockResolvedValue([
      {
        id: targetFarmKey,
        value: 0.532478779319039,
      },
    ])
    batchGetMerklAprDataMock.mockResolvedValue([
      {
        id: targetFarmKey,
        value: '15646014069.24865',
      },
    ])
    batchGetIncentraAprDataMock.mockResolvedValue([
      {
        id: targetFarmKey,
        value: '0',
      },
    ])
  })

  it('stores the non-zero Monad Merkl APR in the searcher apr map', async () => {
    const searcher = new PoolSearcher() as unknown as {
      updateAprs: (poolInfos: PoolInfo[]) => Promise<void>
      aprs: Record<string, { lpApr: string; merklApr?: string; incentraApr?: number }>
    }

    await searcher.updateAprs([createPoolInfo()])

    expect(batchGetMerklAprDataMock).toHaveBeenCalledWith([
      expect.objectContaining({
        chainId: 143,
        lpAddress: targetFarmId,
      }),
    ])
    expect(searcher.aprs[targetFarmKey]).toEqual(
      expect.objectContaining({
        lpApr: '0.532478779319039',
        merklApr: '15646014069.24865',
        incentraApr: '0',
      }),
    )
  })
})
