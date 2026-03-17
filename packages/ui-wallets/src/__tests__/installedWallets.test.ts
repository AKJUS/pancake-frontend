import { beforeEach, describe, expect, it, vi } from 'vitest'
import safeGetWindow from '@pancakeswap/utils/safeGetWindow'
import { isBitgetWalletInstalled, isPhantomWalletInstalled } from 'src/config/installed'

vi.mock('@pancakeswap/utils/safeGetWindow', () => ({
  default: vi.fn(),
}))

const safeGetWindowMock = vi.mocked(safeGetWindow)

describe('wallet installed detection', () => {
  beforeEach(() => {
    safeGetWindowMock.mockReset()
  })

  it('detects Phantom via window.phantom.ethereum', () => {
    safeGetWindowMock.mockReturnValue({
      phantom: {
        ethereum: {
          isPhantom: true,
        },
      },
    })

    expect(isPhantomWalletInstalled()).toBe(true)
  })

  it('detects Phantom via ethereum.providers', () => {
    safeGetWindowMock.mockReturnValue({
      ethereum: {
        providers: [{ isPhantom: true }],
      },
    })

    expect(isPhantomWalletInstalled()).toBe(true)
  })

  it('detects Bitget via window.bitkeep.ethereum', () => {
    safeGetWindowMock.mockReturnValue({
      bitkeep: {
        ethereum: {},
      },
    })

    expect(isBitgetWalletInstalled()).toBe(true)
  })

  it('detects Bitget via ethereum providers aliases', () => {
    safeGetWindowMock.mockReturnValue({
      ethereum: {
        providers: [{ isBitgetWallet: true }],
      },
    })

    expect(isBitgetWalletInstalled()).toBe(true)
  })
})
