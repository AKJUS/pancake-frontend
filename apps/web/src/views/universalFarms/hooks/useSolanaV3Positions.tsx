import { ClmmPositionLayout, PositionUtils, TokenInfo } from '@pancakeswap/solana-core-sdk'
import { INetworkProps, ITokenProps } from '@pancakeswap/widgets-internal'
import { useMemo } from 'react'
import { POSITION_STATUS } from 'state/farmsV4/state/accountPositions/type'
import { useSolanaPositionsInfoByAccount } from 'state/token/solanaPositionsInfo'
import { useWallet } from '@solana/wallet-adapter-react'
import { useSolanaV3Pools } from 'hooks/solana/useSolanaV3Pools'
import { NonEVMChainId } from '@pancakeswap/chains'
import { SolanaV3Pool } from 'state/pools/solana'
import { useSolanaV3PoolsUpdater } from 'hooks/solana/useSolanaV3PoolsUpdater'
import { Protocol } from '@pancakeswap/farms'
import { convertRawTokenInfoIntoSPLToken } from 'config/solana-list'

export const getSolanaPoolStatus = (pos: ClmmPositionLayout, pool: SolanaV3Pool | undefined) => {
  if (pos.liquidity.isZero()) {
    return POSITION_STATUS.CLOSED
  }
  // Check if position is in range by comparing pool's current tick with position's tick range
  if (pool) {
    try {
      if (typeof pool.tickCurrent === 'number') {
        if (pool.tickCurrent < pos.tickLower || pool.tickCurrent >= pos.tickUpper) {
          return POSITION_STATUS.INACTIVE
        }
        return POSITION_STATUS.ACTIVE
      }
      if (pool.price > 0) {
        const { price } = pool
        const tickCurrent = Math.floor(Math.log(price) / Math.log(1.0001))

        // Check if position is in range
        if (tickCurrent < pos.tickLower || tickCurrent >= pos.tickUpper) {
          return POSITION_STATUS.INACTIVE
        }
        return POSITION_STATUS.ACTIVE
      }

      const { amountA, amountB } = PositionUtils.getAmountsFromLiquidity({
        poolInfo: pool,
        ownerPosition: pos,
        liquidity: pos.liquidity,
        slippage: 0,
        add: false,
        epochInfo: {
          epoch: 0,
          slotIndex: 0,
          slotsInEpoch: 0,
          absoluteSlot: 0,
        },
      })

      if (amountA.amount.isZero() || amountB.amount.isZero()) {
        return POSITION_STATUS.INACTIVE
      }

      return POSITION_STATUS.ACTIVE
    } catch (error) {
      console.warn('Error calculating Solana position status:', error)
      return POSITION_STATUS.ACTIVE
    }
  }

  return POSITION_STATUS.ACTIVE
}

export const useSolanaV3PositionItems = ({
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
  const { publicKey } = useWallet()
  const walletAddress = useMemo(() => publicKey?.toBase58(), [publicKey])

  const { data: positionInfos, isLoading: solanaLoading } = useSolanaPositionsInfoByAccount(walletAddress)

  const poolIds = useMemo(() => positionInfos?.map((pos) => pos.poolId.toBase58()) || [], [positionInfos])

  const pools = useSolanaV3Pools(poolIds)
  const { loading: poolsLoading } = useSolanaV3PoolsUpdater(useMemo(() => pools.filter((pool) => !!pool), [pools]))

  const poolsMap = useMemo(() => new Map(pools.filter((pool) => !!pool).map((pool) => [pool.id, pool])), [pools])

  const v3PositionsWithStatus = useMemo(() => {
    return positionInfos?.map((pos) => {
      const pool = poolsMap.get(pos.poolId.toBase58())
      return Object.assign(pos, {
        status: getSolanaPoolStatus(pos, pool),
        protocol: Protocol.V3,
        chainId: NonEVMChainId.SOLANA,
        token0: pool ? convertRawTokenInfoIntoSPLToken(pool?.mintA as TokenInfo) : undefined,
        token1: pool ? convertRawTokenInfoIntoSPLToken(pool?.mintB as TokenInfo) : undefined,
      })
    })
  }, [positionInfos, poolsMap])

  // Filter positions based on criteria (similar to useV3Positions)
  const filteredSolanaPositions = useMemo(() => {
    return v3PositionsWithStatus?.filter((pos) => {
      const matchesNetwork = selectedNetwork.includes(NonEVMChainId.SOLANA)
      const pool = poolsMap.get(pos.poolId.toBase58())
      if (!pool) return false

      // Token filter
      const matchesTokens =
        !selectedTokens?.length ||
        selectedTokens.some(
          (token) =>
            token === `${NonEVMChainId.SOLANA}:${pool.mintA.address}` ||
            token === `${NonEVMChainId.SOLANA}:${pool.mintB.address}`,
        )

      // Status filter
      const matchesStatus = positionStatus === POSITION_STATUS.ALL || pos.status === positionStatus

      // Farms only filter
      const matchesFarms = farmsOnly ? pool.isFarming && pos.status === POSITION_STATUS.ACTIVE : true

      return matchesNetwork && matchesTokens && matchesStatus && matchesFarms
    })
  }, [v3PositionsWithStatus, selectedNetwork, selectedTokens, positionStatus, farmsOnly, poolsMap])

  // Sort positions by status
  const sortedSolanaPositions = useMemo(
    () => (filteredSolanaPositions ? [...filteredSolanaPositions].sort((a, b) => a.status - b.status) : []),
    [filteredSolanaPositions],
  )

  return {
    solanaLoading: solanaLoading || poolsLoading,
    solanaPositions: sortedSolanaPositions,
    poolsLength: poolsMap.size,
  }
}
