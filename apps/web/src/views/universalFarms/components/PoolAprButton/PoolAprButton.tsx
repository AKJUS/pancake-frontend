import { Protocol } from '@pancakeswap/farms'
import { TextProps, useModalV2, useTooltip } from '@pancakeswap/uikit'
import { useMemo } from 'react'
import { CakeApr } from 'state/farmsV4/atom'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  PositionDetail,
  SolanaV3PositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import { ChainIdAddressKey, PoolInfo, SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { getMerklLink } from 'utils/getMerklLink'
import { isInfinityProtocol } from 'utils/protocols'

import { getIncentraLink } from 'utils/getIncentraLink'
import { isEvm } from '@pancakeswap/chains'
import { sumApr } from '../../utils/sumApr'
import { InfinityPoolAprModal } from '../Modals/InfinityPoolAprModal'
import { V2PoolAprModal } from '../Modals/V2PoolAprModal'
import { V3PoolAprModal } from '../Modals/V3PoolAprModal'
import { StopPropagation } from '../StopPropagation'
import { AprButton } from './AprButton'
import { AprTooltipContent, BCakeWrapperFarmAprTipContent } from './AprTooltipContent'

type PoolGlobalAprButtonProps = {
  pool: PoolInfo | SolanaV3PoolInfo
  lpApr: number
  cakeApr: CakeApr[ChainIdAddressKey]
  solanaRewardsApr?: number
  merklApr?: number
  incentraApr?: number
  userPosition?: PositionDetail | InfinityBinPositionDetail | InfinityCLPositionDetail | SolanaV3PositionDetail
  onAPRTextClick?: () => void
  showApyButton?: boolean
  loading?: boolean
  textProps?: TextProps
}

export const PoolAprButton: React.FC<PoolGlobalAprButtonProps> = ({
  pool,
  lpApr,
  cakeApr,
  merklApr,
  incentraApr,
  userPosition,
  onAPRTextClick,
  showApyButton,
  textProps,
  loading = false,
}) => {
  const baseApr = useMemo(() => {
    return sumApr(lpApr, cakeApr?.value, merklApr, incentraApr)
  }, [lpApr, cakeApr?.value, merklApr, incentraApr])

  const hasBCake =
    pool.protocol === Protocol.V2 || pool.protocol === Protocol.STABLE || pool.protocol === Protocol.InfinitySTABLE
  const merklLink = getMerklLink({
    hasMerkl: Boolean(merklApr),
    chainId: pool.chainId,
    lpAddress: pool.lpAddress,
    poolProtocol: pool.protocol,
  })
  const incentraCampaignType = useMemo(() => {
    switch (pool.protocol) {
      case Protocol.V2:
        return 4
      case Protocol.V3:
        return 3
      case Protocol.InfinityCLAMM:
        return 8
      default:
        return undefined
    }
  }, [pool.protocol])
  const incentraLink = getIncentraLink({
    hasIncentra: Boolean(incentraApr),
    chainId: pool.chainId,
    lpAddress: pool.lpAddress as `0x${string}`,
    campaignType: incentraCampaignType,
  })

  const modal = useModalV2()

  const { tooltip, targetRef, tooltipVisible } = useTooltip(
    <AprTooltipContent
      combinedApr={baseApr}
      cakeApr={cakeApr}
      lpFeeApr={Number(lpApr) ?? 0}
      merklApr={Number(merklApr) ?? 0}
      merklLink={merklLink}
      incentraApr={Number(incentraApr) ?? 0}
      incentraLink={incentraLink}
      showDesc
    >
      {hasBCake ? <BCakeWrapperFarmAprTipContent /> : null}
    </AprTooltipContent>,
  )

  return (
    <StopPropagation>
      <AprButton
        hasFarm={Number(cakeApr?.value) > 0}
        ref={targetRef}
        loading={loading}
        baseApr={baseApr}
        onClick={modal.onOpen}
        onAPRTextClick={onAPRTextClick ?? modal.onOpen}
        showApyButton={showApyButton}
        textProps={textProps}
      />
      {tooltipVisible && tooltip}
      {modal.isOpen && (
        <>
          {hasBCake ? (
            <V2PoolAprModal modal={modal} poolInfo={pool} combinedApr={baseApr} lpApr={Number(lpApr ?? 0)} />
          ) : pool.protocol === Protocol.V3 ? (
            isEvm(pool.chainId) ? (
              <V3PoolAprModal
                modal={modal}
                poolInfo={pool as PoolInfo}
                cakeApr={cakeApr}
                positionDetail={userPosition as PositionDetail}
              />
            ) : null
          ) : isInfinityProtocol(pool.protocol) ? (
            <InfinityPoolAprModal
              modal={modal}
              poolInfo={pool}
              cakeApr={cakeApr}
              positionDetail={userPosition as InfinityCLPositionDetail}
            />
          ) : null}
        </>
      )}
    </StopPropagation>
  )
}
