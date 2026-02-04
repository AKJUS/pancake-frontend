import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { TextProps, useModalV2 } from '@pancakeswap/uikit'
import { getCurrencyAddress } from '@pancakeswap/widgets-internal'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { useEffect } from 'react'
import noop from 'lodash/noop'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  PositionDetail,
  SolanaV3PositionDetail,
  StableLPDetail,
  V2LPDetail,
} from 'state/farmsV4/state/accountPositions/type'
import {
  ChainIdAddressKey,
  InfinityBinPoolInfo,
  InfinityCLPoolInfo,
  InfinityPoolInfo,
  PoolInfo,
  SolanaV3PoolInfo,
} from 'state/farmsV4/state/type'
import { useMyPositions } from 'views/PoolDetail/components/MyPositionsContext'
import {
  InfinityPositionAPR,
  useInfinityBinDerivedApr,
  useInfinityBinPositionApr,
  useInfinityCLDerivedApr,
  useInfinityCLPositionApr,
  useSolanaV3PositionApr,
  useV2PositionApr,
  useV3PositionApr,
} from 'views/universalFarms/hooks/usePositionAPR'

import { CakeApr } from 'state/farmsV4/atom'
import { APRBreakdownModal } from './AprBreakdownModal'
import { PoolAprButton } from './PoolAprButton'

type PoolPositionAprButtonProps<TPosition, TPoolInfo = PoolInfo> = {
  pool: TPoolInfo
  userPosition: TPosition
  inverted?: boolean
  textProps?: TextProps
}

export const V2PoolPositionAprButton: React.FC<PoolPositionAprButtonProps<StableLPDetail | V2LPDetail>> = ({
  pool,
  userPosition,
  textProps,
}) => {
  const { lpApr, cakeApr, merklApr, numerator, denominator } = useV2PositionApr(pool, userPosition)
  const { updateTotalApr } = useMyPositions()

  useEffect(() => {
    if (!numerator.isZero())
      updateTotalApr(`${pool.chainId}:${pool.lpAddress}:${userPosition.isStaked}`, numerator, denominator)
  }, [denominator, numerator, pool.chainId, pool.lpAddress, updateTotalApr, userPosition.isStaked])

  return <PoolAprButton pool={pool} lpApr={lpApr} cakeApr={cakeApr} merklApr={merklApr} textProps={textProps} />
}

export const V3PoolPositionAprButton: React.FC<PoolPositionAprButtonProps<PositionDetail>> = ({
  pool,
  userPosition,
  textProps,
}) => {
  const { lpApr, cakeApr, merklApr, incentraApr, numerator, denominator } = useV3PositionApr(pool, userPosition)
  const { updateTotalApr } = useMyPositions()

  useEffect(() => {
    if (!numerator.isZero())
      updateTotalApr(`${pool.chainId}:${pool.lpAddress}:${userPosition.tokenId}`, numerator, denominator)
  }, [denominator, numerator, pool.chainId, pool.lpAddress, updateTotalApr, userPosition.tokenId])

  return (
    <PoolAprButton
      pool={pool}
      lpApr={lpApr}
      cakeApr={cakeApr}
      merklApr={merklApr}
      incentraApr={incentraApr}
      userPosition={userPosition}
      textProps={textProps}
    />
  )
}

export const SolanaV3PoolPositionAprButton: React.FC<
  PoolPositionAprButtonProps<SolanaV3PositionDetail, SolanaV3PoolInfo>
> = ({ pool, userPosition, textProps }) => {
  const { apr: solanaApr, isLoading } = useSolanaV3PositionApr(pool, userPosition)
  const { fee, rewards, apr } = solanaApr ?? {}
  const farmApr = rewards?.reduce((acc, reward) => acc + reward.apr, 0)

  return (
    <PoolAprButton
      loading={isLoading}
      cakeApr={{ value: Math.max(apr - fee?.apr, 0).toString() as `${number}` } as CakeApr[ChainIdAddressKey]}
      pool={pool}
      lpApr={fee.apr}
      solanaRewardsApr={farmApr}
      userPosition={userPosition}
      showApyButton={false}
      textProps={textProps}
    />
  )
}

export const InfinityCLPoolPositionAprButton: React.FC<
  PoolPositionAprButtonProps<InfinityCLPositionDetail, InfinityPoolInfo>
> = ({ pool, userPosition, textProps }) => {
  const apr = useInfinityCLPositionApr(pool, userPosition)
  return <InfinityPoolPositionAprButton apr={apr} pool={pool} userPosition={userPosition} textProps={textProps} />
}

export const InfinityBinPoolPositionAprButton: React.FC<
  PoolPositionAprButtonProps<InfinityBinPositionDetail, InfinityPoolInfo>
> = ({ pool, userPosition, textProps }) => {
  const apr = useInfinityBinPositionApr(pool, userPosition)
  return <InfinityPoolPositionAprButton apr={apr} pool={pool} userPosition={userPosition} textProps={textProps} />
}

type InfinityPoolPositionAprButtonProps<
  TPosition extends InfinityCLPositionDetail | InfinityBinPositionDetail = InfinityCLPositionDetail,
  TPoolInfo = PoolInfo,
> = {
  pool: TPoolInfo
  userPosition: TPosition
  apr: InfinityPositionAPR
  textProps?: TextProps
}

export const InfinityPoolPositionAprButton = <T extends InfinityCLPositionDetail | InfinityBinPositionDetail>({
  pool,
  userPosition,
  apr,
  textProps,
}: InfinityPoolPositionAprButtonProps<T>) => {
  const { lpApr, cakeApr, merklApr, incentraApr, numerator, denominator } = apr
  const { updateTotalApr } = useMyPositions()

  useEffect(() => {
    const key = `${pool.chainId}:${pool.lpAddress}:${'tokenId' in userPosition ? userPosition.tokenId : ''}`
    updateTotalApr(key, numerator, denominator, lpApr, cakeApr)
  }, [denominator, numerator, pool.chainId, pool.lpAddress, updateTotalApr, userPosition, lpApr, cakeApr])

  useEffect(
    () => () => {
      const key = `${pool.chainId}:${pool.lpAddress}:${'tokenId' in userPosition ? userPosition.tokenId : ''}`
      updateTotalApr(key, BIG_ZERO, BIG_ZERO, '0', { value: '0' })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const { chainId } = userPosition
  const currency0 = useCurrencyByChainId(getCurrencyAddress(pool.token0), chainId)
  const currency1 = useCurrencyByChainId(getCurrencyAddress(pool.token1), chainId)

  const APRBreakdownModalState = useModalV2()

  return (
    <>
      <PoolAprButton
        pool={pool}
        lpApr={Number(lpApr)}
        cakeApr={cakeApr}
        merklApr={merklApr}
        incentraApr={incentraApr}
        userPosition={userPosition}
        onAPRTextClick={APRBreakdownModalState.onOpen}
        showApyButton={false}
        textProps={textProps}
      />
      {APRBreakdownModalState.isOpen ? (
        <APRBreakdownModal
          currency0={currency0}
          currency1={currency1}
          poolId={(pool as InfinityPoolInfo).poolId}
          lpApr={lpApr}
          cakeApr={cakeApr}
          tvlUSD={denominator.toFixed() as `${number}`}
          {...APRBreakdownModalState}
        />
      ) : null}
    </>
  )
}
export const InfinityCLPoolDerivedAprButton: React.FC<{ pool: InfinityCLPoolInfo }> = ({ pool }) => {
  const { lpApr, cakeApr, merklApr, incentraApr } = useInfinityCLDerivedApr(pool)

  return (
    <PoolAprButton
      showApyButton={false}
      pool={pool}
      lpApr={lpApr}
      cakeApr={cakeApr}
      merklApr={merklApr}
      incentraApr={incentraApr}
      onAPRTextClick={noop}
    />
  )
}

export const InfinityBinPoolDerivedAprButton: React.FC<{ pool: InfinityBinPoolInfo }> = ({ pool }) => {
  const { lpApr, cakeApr, merklApr, incentraApr } = useInfinityBinDerivedApr(pool)

  return (
    <PoolAprButton
      showApyButton={false}
      pool={pool}
      lpApr={lpApr}
      cakeApr={cakeApr}
      merklApr={merklApr}
      incentraApr={incentraApr}
      onAPRTextClick={noop}
    />
  )
}
