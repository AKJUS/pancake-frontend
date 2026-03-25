import { Currency } from '@pancakeswap/swap-sdk-core'
import { getTokenByAddress } from '@pancakeswap/tokens'
import { FeeAmount, Pool } from '@pancakeswap/v3-sdk'
import { INetworkProps, ITokenProps, toTokenValue } from '@pancakeswap/widgets-internal'
import { usePoolsWithMultiChains } from 'hooks/v3/usePools'
import { useMemo } from 'react'
import { useAccountV3Positions, useV3PoolsLength } from 'state/farmsV4/hooks'
import { POSITION_STATUS, PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { useAccount } from 'wagmi'
import { atom, useAtomValue } from 'jotai'
import { currencyByChainIdAtom } from 'hooks/Tokens'
import { UnsafeCurrency } from 'config/constants/types'
import { loadable } from 'jotai/utils'
import { useAllEvmChainIds } from './useMultiChains'

const getPoolStatus = (pos: PositionDetail, pool: Pool | null) => {
  if (pos.liquidity === 0n) {
    return POSITION_STATUS.CLOSED
  }
  if (pool && (pool.tickCurrent < pos.tickLower || pool.tickCurrent >= pos.tickUpper)) {
    return POSITION_STATUS.INACTIVE
  }
  return POSITION_STATUS.ACTIVE
}

const v3PositionTokensAtom = (v3Positions: PositionDetail[]) =>
  atom(async (get) => {
    const seen = new Set<string>()
    const result: Record<number, Record<string, UnsafeCurrency>> = {}
    const unknownToFetch: { currencyId: string; chainId: number }[] = []

    v3Positions.forEach((pos) => {
      ;[pos.token0, pos.token1].forEach((currencyId) => {
        const key = `${pos.chainId}-${currencyId}`
        if (seen.has(key)) return
        seen.add(key)

        const known = getTokenByAddress(pos.chainId, currencyId)
        if (known) {
          if (!result[pos.chainId]) result[pos.chainId] = {}
          result[pos.chainId][currencyId] = known
        } else {
          unknownToFetch.push({ currencyId, chainId: pos.chainId })
        }
      })
    })

    if (unknownToFetch.length) {
      const tokenEntries = await Promise.all(
        unknownToFetch.map(async ({ currencyId, chainId }) => {
          try {
            const token = await get(currencyByChainIdAtom({ currencyId, chainId }))
            return [chainId, currencyId, token] as const
          } catch {
            return [chainId, currencyId, null] as const
          }
        }),
      )

      tokenEntries.forEach(([chainId, address, token]) => {
        if (!result[chainId]) result[chainId] = {}
        result[chainId][address] = token
      })
    }

    return result
  })

export const useV3Positions = ({
  selectedNetwork,
  selectedTokens,
  positionStatus,
  farmsOnly,
}: {
  selectedNetwork: INetworkProps['value']
  selectedTokens: ITokenProps['value']
  positionStatus: POSITION_STATUS
  farmsOnly: boolean
}) => {
  const { address: account } = useAccount()
  const allChainIds = useAllEvmChainIds()
  // Fetch only from selected networks to reduce unnecessary API calls
  const { data: v3Positions, pending: v3Loading } = useAccountV3Positions(selectedNetwork, account)
  const fetchedTokens = useAtomValue(useMemo(() => loadable(v3PositionTokensAtom(v3Positions)), [v3Positions]))

  const v3PoolKeys = useMemo(() => {
    if (fetchedTokens.state !== 'hasData') return []

    return v3Positions.map((pos): [Currency | null, Currency | null, FeeAmount] => {
      const token0 = fetchedTokens.data?.[pos.chainId]?.[pos.token0]
      const token1 = fetchedTokens.data?.[pos.chainId]?.[pos.token1]
      return [token0 ?? null, token1 ?? null, pos.fee]
    })
  }, [v3Positions, fetchedTokens])

  const pools = usePoolsWithMultiChains(v3PoolKeys)
  const sortedV3Positions = useMemo(() => {
    if (!pools.length) return []

    return v3Positions
      .map((pos, idx) => ({
        ...pos,
        status: getPoolStatus(pos, pools[idx][1]),
      }))
      .filter(
        (pos) =>
          selectedNetwork.includes(pos.chainId) &&
          (!selectedTokens?.length ||
            selectedTokens.some(
              (token) =>
                token === toTokenValue({ chainId: pos.chainId, address: pos.token0 }) ||
                token === toTokenValue({ chainId: pos.chainId, address: pos.token1 }),
            )) &&
          (positionStatus === POSITION_STATUS.ALL || pos.status === positionStatus) &&
          (!farmsOnly || pos.isStaked),
      )
      .sort((a, b) => a.status - b.status)
  }, [selectedNetwork, selectedTokens, v3Positions, pools, positionStatus, farmsOnly])

  const { data: poolsLength } = useV3PoolsLength(allChainIds)

  return {
    v3Loading: v3Loading || fetchedTokens.state === 'loading',
    v3Positions: sortedV3Positions,
    v3PoolsLength: poolsLength as Record<number, number>,
  }
}
