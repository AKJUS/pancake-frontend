import { Currency } from '@pancakeswap/swap-sdk-core'
import { getTokenByAddress } from '@pancakeswap/tokens'
import { Pool } from '@pancakeswap/v3-sdk'
import { INetworkProps, ITokenProps, toTokenValue } from '@pancakeswap/widgets-internal'
import { usePoolsWithMultiChains } from 'hooks/v3/usePools'
import { useMemo } from 'react'
import { useAccountV3Positions, useV3PoolsLength } from 'state/farmsV4/hooks'
import { POSITION_STATUS, PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { useAccount } from 'wagmi'
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
  const v3PoolKeys = useMemo(
    () =>
      v3Positions.map(
        (pos) =>
          [getTokenByAddress(pos.chainId, pos.token0), getTokenByAddress(pos.chainId, pos.token1), pos.fee] as [
            Currency,
            Currency,
            number,
          ],
      ),
    [v3Positions],
  )
  const pools = usePoolsWithMultiChains(v3PoolKeys)

  const sortedV3Positions = useMemo(
    () =>
      v3Positions
        .map((pos, idx) =>
          Object.assign(pos, {
            status: getPoolStatus(pos, pools[idx][1]),
          }),
        )
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
        .sort((a, b) => a.status - b.status),
    [selectedNetwork, selectedTokens, v3Positions, pools, positionStatus, farmsOnly],
  )

  const { data: poolsLength } = useV3PoolsLength(allChainIds)

  return {
    v3Loading,
    v3Positions: sortedV3Positions,
    v3PoolsLength: poolsLength as Record<number, number>,
  }
}
