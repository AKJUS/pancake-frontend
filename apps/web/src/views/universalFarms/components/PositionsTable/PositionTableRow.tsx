import { memo } from 'react'
import { Protocol } from '@pancakeswap/farms'
import { isSolana } from '@pancakeswap/chains'
import {
  UnifiedPositionDetail,
  V2LPDetail,
  StableLPDetail,
  PositionDetail,
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  SolanaV3PositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import { InfinityBinPositionRow } from './rows/InfinityBinPositionRow'
import { InfinityCLPositionRow } from './rows/InfinityCLPositionRow'
import { V3PositionRow } from './rows/V3PositionRow'
import { V2StablePositionRow } from './rows/V2StablePositionRow'
import { SolanaV3PositionRow } from './rows/SolanaV3PositionRow'
import { getPositionChainId } from '../../utils'

type PositionTableRowProps = {
  position: UnifiedPositionDetail
  poolLength?: number
  hideEarningsColumn?: boolean
}

// Simple router component
export const PositionTableRow: React.FC<PositionTableRowProps> = memo(({ position, hideEarningsColumn }) => {
  const chainId = getPositionChainId(position)

  // Route to the correct protocol-specific row component
  switch (position.protocol) {
    case Protocol.InfinityBIN:
      return (
        <InfinityBinPositionRow
          position={position as InfinityBinPositionDetail}
          chainId={chainId}
          hideEarningsColumn={hideEarningsColumn}
        />
      )

    case Protocol.InfinityCLAMM:
      return (
        <InfinityCLPositionRow
          position={position as InfinityCLPositionDetail}
          chainId={chainId}
          hideEarningsColumn={hideEarningsColumn}
        />
      )

    case Protocol.V3:
      // Route Solana V3 positions to the Solana-specific row component
      if (isSolana(chainId)) {
        return (
          <SolanaV3PositionRow
            position={position as SolanaV3PositionDetail}
            chainId={chainId}
            hideEarningsColumn={hideEarningsColumn}
          />
        )
      }
      return (
        <V3PositionRow
          position={position as PositionDetail}
          chainId={chainId}
          hideEarningsColumn={hideEarningsColumn}
        />
      )

    case Protocol.V2:
    case Protocol.STABLE:
    case Protocol.InfinitySTABLE:
      return (
        <V2StablePositionRow
          position={position as V2LPDetail | StableLPDetail}
          chainId={chainId}
          protocol={position.protocol}
          hideEarningsColumn={hideEarningsColumn}
        />
      )

    default:
      return null
  }
})
