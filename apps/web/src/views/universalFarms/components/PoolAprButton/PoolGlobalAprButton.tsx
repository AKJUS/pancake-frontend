import { isSolana } from '@pancakeswap/chains'
import { getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import { useModalV2 } from '@pancakeswap/uikit'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import BigNumber from 'bignumber.js'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { useEffect, useMemo } from 'react'
import { AprInfo, usePoolApr } from 'state/farmsV4/hooks'
import { InfinityPoolInfo, PoolInfo } from 'state/farmsV4/state/type'
import { isInfinityProtocol } from 'utils/protocols'
import { useMyPositions } from 'views/PoolDetail/components/MyPositionsContext'
import { Protocol } from '@pancakeswap/farms'

import { APRBreakdownModal } from './AprBreakdownModal'
import { PoolAprButton } from './PoolAprButton'

type PoolGlobalAprButtonProps = {
  pool: PoolInfo
  detailMode?: boolean
  aprInfo?: AprInfo
  loading?: boolean
}

export const PoolGlobalAprButton: React.FC<PoolGlobalAprButtonProps> = ({ pool, detailMode, aprInfo, loading }) => {
  if (aprInfo) {
    return <PoolGlobalAprButtonDisplay pool={pool} aprInfo={aprInfo} detailMode={detailMode} loading={loading} />
  }
  return <PoolGlobalAprButtonWithLoadApr pool={pool} detailMode={detailMode} />
}

const PoolGlobalAprButtonWithLoadApr: React.FC<PoolGlobalAprButtonProps> = ({ pool, detailMode }) => {
  const key = useMemo(() => `${pool.chainId}:${pool.lpAddress}` as const, [pool.chainId, pool.lpAddress])
  const has24Apr = !pool.stableSwapAddress
  const hookAprInfo = usePoolApr(key, pool, has24Apr)
  const { totalApr, updateTotalApr } = useMyPositions()
  const { lpApr, cakeApr, merklApr, incentraApr } = hookAprInfo

  const numerator = useMemo(() => {
    const lpAprNumerator = new BigNumber(lpApr).times(cakeApr?.userTvlUsd ?? BIG_ZERO)
    return lpAprNumerator
  }, [lpApr, cakeApr?.userTvlUsd])
  const denominator = useMemo(() => {
    return cakeApr?.userTvlUsd ?? BIG_ZERO
  }, [cakeApr?.userTvlUsd])

  useEffect(() => {
    if (
      detailMode &&
      (pool.protocol === 'v2' || pool.protocol === 'stable') &&
      (totalApr[key]?.numerator !== numerator || totalApr[key]?.denominator !== denominator)
    ) {
      updateTotalApr(key, numerator, denominator)
    }
  }, [
    cakeApr,
    denominator,
    detailMode,
    key,
    lpApr,
    merklApr,
    incentraApr,
    numerator,
    pool.protocol,
    updateTotalApr,
    totalApr,
  ])
  return <PoolGlobalAprButtonDisplay pool={pool} aprInfo={hookAprInfo} detailMode={detailMode} />
}

const PoolGlobalAprButtonDisplay: React.FC<PoolGlobalAprButtonProps> = ({ pool, aprInfo, loading }) => {
  const { lpApr, cakeApr, merklApr, incentraApr } = aprInfo!

  const { chainId, token0, token1 } = pool
  const currency0 = useCurrencyByChainId(getCurrencyAddress(token0), chainId)
  const currency1 = useCurrencyByChainId(getCurrencyAddress(token1), chainId)

  const APRBreakdownModalState = useModalV2()

  const poolWithFarming = useMemo(() => ({ ...pool, isFarming: Number(cakeApr?.value) > 0 }), [pool, cakeApr])
  const isSolanaChain = isSolana(chainId)

  if (!isInfinityProtocol(pool.protocol)) {
    return (
      <PoolAprButton
        pool={poolWithFarming}
        lpApr={parseFloat(lpApr) || 0}
        cakeApr={cakeApr}
        merklApr={parseFloat(merklApr) ?? 0}
        incentraApr={parseFloat(incentraApr) ?? 0}
        showApyButton={!isSolanaChain}
        loading={loading}
      />
    )
  }

  return (
    <>
      <PoolAprButton
        pool={poolWithFarming}
        lpApr={parseFloat(lpApr) || 0}
        cakeApr={cakeApr}
        merklApr={parseFloat(merklApr) ?? 0}
        incentraApr={parseFloat(incentraApr) ?? 0}
        onAPRTextClick={APRBreakdownModalState.onOpen}
        showApyButton={false}
        loading={loading}
      />
      {APRBreakdownModalState.isOpen ? (
        <APRBreakdownModal
          currency0={currency0}
          currency1={currency1}
          poolId={(pool as InfinityPoolInfo).poolId}
          lpApr={lpApr}
          cakeApr={cakeApr}
          tvlUSD={pool.tvlUsd}
          {...APRBreakdownModalState}
        />
      ) : null}
    </>
  )
}
