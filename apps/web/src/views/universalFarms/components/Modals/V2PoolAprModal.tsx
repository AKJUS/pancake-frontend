import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { LegacyStableSwapPair } from '@pancakeswap/smart-router/legacy-router'
import { ModalV2, RoiCalculatorModal, UseModalV2Props } from '@pancakeswap/uikit'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { displayApr } from '@pancakeswap/utils/displayApr'
import BigNumber from 'bignumber.js'
import { useCakePrice } from 'hooks/useCakePrice'
import { useMemo } from 'react'
import { useAccountPositionDetailByPool } from 'state/farmsV4/hooks'
import { useStableSwapPairsByChainId } from 'state/farmsV4/state/accountPositions/hooks'
import { InfinityStablePoolInfo, StablePoolInfo, V2PoolInfo } from 'state/farmsV4/state/type'
import { isAddressEqual } from 'utils'
import { getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import getLiquidityUrlPathParts from 'utils/getLiquidityUrlPathParts'
import { Address } from 'viem'
import { useMasterChefV2Data } from 'views/Farms/hooks/useMasterChefV2Data'
import { useV2LpTokenTotalSupply } from 'views/Farms/hooks/useV2LpTokenTotalSupply'
import { useBCakeWrapperRewardPerSecond } from 'views/universalFarms/hooks/useBCakeWrapperInfo'
import { useAccount } from 'wagmi'

type V2PoolAprModalProps = {
  modal: UseModalV2Props
  poolInfo: V2PoolInfo | StablePoolInfo | InfinityStablePoolInfo
  combinedApr: number
  lpApr?: number
}

export const V2PoolAprModal: React.FC<V2PoolAprModalProps> = ({ modal, ...props }) => {
  return <ModalV2 {...modal}>{modal.isOpen && <AprModal {...props} />}</ModalV2>
}

const AprModal: React.FC<Omit<V2PoolAprModalProps, 'modal'>> = ({ poolInfo, combinedApr, lpApr }) => {
  const { t } = useTranslation()
  const { address: account } = useAccount()
  const lpSymbol = useMemo(
    () => (poolInfo ? `${poolInfo?.token0.symbol}-${poolInfo?.token1.symbol} LP` : ''),
    [poolInfo],
  )
  const lpLabel = useMemo(() => {
    return lpSymbol.replace(/pancake/gi, '')
  }, [lpSymbol])
  const { data: userPosition } = useAccountPositionDetailByPool<
    Protocol.STABLE | Protocol.V2 | Protocol.InfinitySTABLE
  >(poolInfo.chainId, account, poolInfo)

  const pairs = useStableSwapPairsByChainId(poolInfo?.chainId, poolInfo?.protocol === 'stable')

  const stakingTokenBalance = useMemo(() => {
    return BIG_ZERO.plus(userPosition?.farmingBalance?.quotient.toString() ?? 0).plus(
      userPosition?.nativeBalance?.quotient.toString() ?? 0,
    )
  }, [userPosition?.farmingBalance, userPosition?.nativeBalance])

  const { data: lpTokenTotalSupply } = useV2LpTokenTotalSupply(poolInfo.lpAddress, poolInfo.chainId)
  const lpTokenPrice = useMemo(() => {
    return new BigNumber(poolInfo.tvlUsd ?? 0).div((lpTokenTotalSupply ?? 1).toString()).times(1e18)
  }, [poolInfo.tvlUsd, lpTokenTotalSupply])
  const cakePrice = useCakePrice()

  const addLiquidityUrl = useMemo(() => {
    const liquidityUrlPathParts = getLiquidityUrlPathParts({
      quoteTokenAddress: getCurrencyAddress(poolInfo.token0),
      tokenAddress: getCurrencyAddress(poolInfo.token1),
      chainId: poolInfo.chainId,
    })
    return `/add/${liquidityUrlPathParts}`
  }, [poolInfo.chainId, poolInfo.token0, poolInfo.token1])

  const stableConfig = useMemo((): LegacyStableSwapPair | undefined => {
    if (poolInfo.protocol === Protocol.STABLE) {
      return pairs?.find((pair) => {
        return isAddressEqual(pair.stableSwapAddress, poolInfo?.lpAddress as Address)
      })
    }
    return undefined
  }, [pairs, poolInfo?.lpAddress, poolInfo.protocol])

  const { data: farmCakePerSecond } = useBCakeWrapperRewardPerSecond(
    poolInfo.chainId,
    poolInfo.protocol === Protocol.InfinitySTABLE ? undefined : poolInfo.bCakeWrapperAddress,
  )
  const { data: masterChefV2Data } = useMasterChefV2Data(poolInfo.chainId)
  const totalMultipliers = useMemo(() => {
    const { totalRegularAllocPoint } = masterChefV2Data ?? { totalRegularAllocPoint: 0n }
    const point = totalRegularAllocPoint.toString()
    return Number.isFinite(+point) ? (+point / 10).toString() : '-'
  }, [masterChefV2Data])

  return (
    <RoiCalculatorModal
      account={account}
      pid={poolInfo.pid}
      linkLabel={t('Add %symbol%', { symbol: lpLabel })}
      stakingTokenBalance={stakingTokenBalance}
      stakingTokenDecimals={18}
      stakingTokenSymbol={lpSymbol}
      stakingTokenPrice={lpTokenPrice.toNumber()}
      earningTokenPrice={cakePrice?.toNumber() ?? 0}
      apr={combinedApr * 100}
      displayApr={displayApr(combinedApr, { suffix: '' })}
      linkHref={addLiquidityUrl}
      lpRewardsApr={(lpApr ?? 0) * 100}
      isFarm={poolInfo.isFarming}
      stableSwapAddress={stableConfig?.stableSwapAddress}
      stableLpFee={stableConfig?.stableTotalFee}
      farmCakePerSecond={farmCakePerSecond ? farmCakePerSecond.toString() : '0'}
      totalMultipliers={totalMultipliers}
    />
  )
}
