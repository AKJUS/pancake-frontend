import { useTranslation } from '@pancakeswap/localization'
import { AddIcon, IconButton, AutoRow, useModal, useToast, MinusIcon, Button } from '@pancakeswap/uikit'
import { BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { FarmWidget } from '@pancakeswap/widgets-internal'
import BigNumber from 'bignumber.js'
import { ToastDescriptionWithTx } from 'components/Toast'
import { useCakePrice } from 'hooks/useCakePrice'
import useCatchTxError from 'hooks/useCatchTxError'
import { useTokenAllowanceByChainId } from 'hooks/useTokenAllowance'
import React, { useCallback, useEffect, useMemo, useState, memo } from 'react'
import { usePoolApr } from 'state/farmsV4/hooks'
import { getBCakeWrapperAddress } from 'state/farmsV4/state/accountPositions/fetcher'
import { useAccountV2PendingCakeReward } from 'state/farmsV4/state/accountPositions/hooks/useAccountV2PendingCakeReward'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { StableLPDetail, V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { StablePoolInfo, V2PoolInfo } from 'state/farmsV4/state/type'
import styled from 'styled-components'
import getLiquidityUrlPathParts from 'utils/getLiquidityUrlPathParts'
import { Address, Hash } from 'viem'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { useV2CakeEarning } from 'views/universalFarms/hooks/useCakeEarning'
import { useV2FarmActions } from 'views/universalFarms/hooks/useV2FarmActions'
import { sumApr } from 'views/universalFarms/utils/sumApr'
import { useAccount } from 'wagmi'
import { getCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import { fetchAllUniversalFarmsMap } from '@pancakeswap/farms'
import { useOpenHarvestModal } from 'components/HarvestPositionsModal'
import { StopPropagation } from '../StopPropagation'
import { DepositStakeAction, HarvestAction } from './StakeActions'

type V2PositionActionsProps = {
  data: V2LPDetail | StableLPDetail
  chainId: number
  lpAddress: Address
  pid?: number
  isStaked?: boolean
  tvlUsd?: `${number}` | number | undefined
  poolInfo: V2PoolInfo | StablePoolInfo
  isFarmLive?: boolean
}

const StyledAutoRow = styled(AutoRow)`
  flex-direction: row;
  gap: 8px;

  & button {
    flex: 1;
  }
`

interface StakeActionsProps {
  compact?: boolean
  increaseDisabled?: boolean
  decreaseDisabled?: boolean
  showIncreaseBtn?: boolean
  showDecreaseBtn?: boolean
  onIncrease: () => void
  onDecrease?: () => void
}
const StakeActions: React.FC<StakeActionsProps> = ({
  compact = false,
  increaseDisabled = false,
  decreaseDisabled = false,
  showIncreaseBtn = true,
  showDecreaseBtn = true,
  onIncrease,
  onDecrease,
}) => {
  const { t } = useTranslation()
  return (
    <>
      {showDecreaseBtn && (
        <Button variant="primary60Outline" scale="md" disabled={decreaseDisabled} onClick={onDecrease}>
          {compact ? <MinusIcon color="primary" width="24px" /> : t('Unstake')}
        </Button>
      )}
      {showIncreaseBtn && (
        <Button variant="primary60Outline" scale="md" disabled={increaseDisabled} onClick={onIncrease}>
          {compact ? <AddIcon color="primary" width="24px" /> : t('Stake')}
        </Button>
      )}
    </>
  )
}

export const V2PositionActions: React.FC<V2PositionActionsProps> = memo(({ isStaked, ...props }) => {
  return (
    <StopPropagation>
      <StyledAutoRow gap="sm">
        {isStaked ? (
          <>
            <V2FarmingAction {...props} />
            <V2HarvestAction {...props} />
          </>
        ) : (
          <V2NativeAction {...props} />
        )}
      </StyledAutoRow>
    </StopPropagation>
  )
})

const useDepositModal = (props: V2PositionActionsProps) => {
  const { chainId, data, pid, lpAddress, tvlUsd, poolInfo } = props
  const { address: account } = useAccount()
  const cakePrice = useCakePrice()
  const { toastSuccess } = useToast()
  const { fetchWithCatchTxError } = useCatchTxError()
  const { t } = useTranslation()
  const key = useMemo(() => `${chainId}:${lpAddress}` as const, [chainId, lpAddress])
  const { lpApr, cakeApr, merklApr, incentraApr } = usePoolApr(key, poolInfo)
  const displayApr = useMemo(() => {
    return sumApr(lpApr, cakeApr.value, merklApr, incentraApr)
  }, [lpApr, cakeApr.value, merklApr, incentraApr])

  const [bCakeAddress, setBCakeAddress] = useState<Address | undefined>()

  useEffect(() => {
    const fetchBCakeAddress = async () => {
      const farmsMap = await fetchAllUniversalFarmsMap()
      const address = await getBCakeWrapperAddress(lpAddress, chainId, farmsMap)
      setBCakeAddress(address)
    }

    fetchBCakeAddress()
  }, [lpAddress, chainId])

  const { allowance } = useTokenAllowanceByChainId({
    chainId,
    token: data.pair.liquidityToken,
    owner: account,
    spender: bCakeAddress,
  })

  const totalSupply = useMemo(() => {
    return new BigNumber(data.totalSupply.quotient.toString())
  }, [data.totalSupply])
  const nativeBalance = useMemo(() => {
    return new BigNumber(data.nativeBalance.quotient.toString())
  }, [data.nativeBalance])
  const stakedBalance = useMemo(() => {
    return new BigNumber(data.farmingBalance.quotient.toString())
  }, [data.farmingBalance])
  const { onStake, onApprove } = useV2FarmActions(lpAddress, poolInfo.bCakeWrapperAddress)
  const lpSymbol = useMemo(() => {
    return `${data.pair.token0.symbol}-${data.pair.token1.symbol} LP`
  }, [data.pair.token0.symbol, data.pair.token1.symbol])
  const lpTokenPrice = useMemo(() => {
    return new BigNumber(tvlUsd ?? 0).dividedBy(data.totalSupply.toExact())
  }, [data.totalSupply, tvlUsd])

  const [, setLatestTxReceipt] = useLatestTxReceipt()

  const handleStake = useCallback(
    async (amount: string) => {
      const receipt = await fetchWithCatchTxError(() => {
        return onStake(amount)
      })
      if (receipt?.status) {
        setLatestTxReceipt(receipt)
        toastSuccess(
          `${t('Staked')}!`,
          <ToastDescriptionWithTx txHash={receipt.transactionHash}>
            {t('Your funds have been staked in the farm')}
          </ToastDescriptionWithTx>,
        )
      }
    },
    [setLatestTxReceipt, fetchWithCatchTxError, onStake, t, toastSuccess],
  )

  const handleApprove = useCallback(async () => {
    if (!poolInfo.bCakeWrapperAddress) return
    const receipt = await fetchWithCatchTxError(() => {
      return onApprove() as Promise<{ hash: Hash }>
    })
    if (receipt?.status) {
      setLatestTxReceipt(receipt)
      toastSuccess(t('Contract Enabled'), <ToastDescriptionWithTx txHash={receipt.transactionHash} />)
    }
  }, [poolInfo.bCakeWrapperAddress, fetchWithCatchTxError, onApprove, setLatestTxReceipt, toastSuccess, t])

  const addLiquidityUrl = useMemo(() => {
    const liquidityUrlPathParts = getLiquidityUrlPathParts({
      quoteTokenAddress: getCurrencyAddress(poolInfo.token0),
      tokenAddress: getCurrencyAddress(poolInfo.token1),
      chainId: poolInfo.chainId,
    })
    return `/add/${liquidityUrlPathParts}`
  }, [poolInfo.chainId, poolInfo.token0, poolInfo.token1])

  const [onPresentDeposit] = useModal(
    <FarmWidget.DepositModal
      addLiquidityUrl={addLiquidityUrl}
      account={account}
      pid={pid ?? 0}
      lpTotalSupply={totalSupply}
      tokenName={lpSymbol}
      lpLabel={lpSymbol}
      hideTokenName
      max={nativeBalance}
      stakedBalance={stakedBalance}
      decimals={18}
      cakePrice={cakePrice}
      allowance={allowance ? new BigNumber(allowance.quotient.toString()) : BIG_ZERO}
      onConfirm={handleStake}
      handleApprove={handleApprove}
      lpPrice={lpTokenPrice}
      apr={parseFloat(cakeApr?.value ?? '0') * 100}
      displayApr={(displayApr * 100).toString()}
      lpRewardsApr={parseFloat(lpApr) * 100}
    />,
    true,
    true,
    `farm-deposit-modal-${pid}-${lpAddress}`,
  )

  return onPresentDeposit
}

const useWithdrawModal = (
  data: V2LPDetail | StableLPDetail,
  lpAddress: Address,
  bCakeWrapperAddress: Address | undefined,
  tvlUsd?: `${number}` | number | undefined,
) => {
  const { t } = useTranslation()
  const { onUnStake } = useV2FarmActions(lpAddress, bCakeWrapperAddress)
  const lpSymbol = useMemo(() => {
    return `${data.pair.token0.symbol}-${data.pair.token1.symbol} LP`
  }, [data.pair.token0.symbol, data.pair.token1.symbol])
  const lpTokenPrice = useMemo(() => {
    return new BigNumber(tvlUsd ?? 0).dividedBy(data.totalSupply.toExact())
  }, [data.totalSupply, tvlUsd])
  const stakedBalance = useMemo(() => {
    return new BigNumber(data.farmingBalance.quotient.toString())
  }, [data.farmingBalance])
  const { toastSuccess } = useToast()
  const { fetchWithCatchTxError } = useCatchTxError()
  const [, setLatestTxReceipt] = useLatestTxReceipt()
  const handleUnstake = useCallback(
    async (amount: string) => {
      const receipt = await fetchWithCatchTxError(() => onUnStake(amount))
      if (receipt?.status) {
        setLatestTxReceipt(receipt)
        toastSuccess(
          `${t('Unstaked.status')}!`,
          <ToastDescriptionWithTx txHash={receipt.transactionHash}>
            {t('Your earnings have also been harvested to your wallet')}
          </ToastDescriptionWithTx>,
        )
      }
    },
    [setLatestTxReceipt, fetchWithCatchTxError, onUnStake, t, toastSuccess],
  )
  const [onPresentWithdraw] = useModal(
    <FarmWidget.WithdrawModal
      max={stakedBalance ?? BIG_ZERO}
      onConfirm={handleUnstake}
      lpPrice={lpTokenPrice}
      tokenName={lpSymbol}
      decimals={18}
    />,
  )

  return onPresentWithdraw
}

const V2FarmingAction: React.FC<V2PositionActionsProps> = (props) => {
  const { data, chainId, lpAddress, tvlUsd, isFarmLive, poolInfo } = props
  const { switchNetworkIfNecessary } = useCheckShouldSwitchNetwork()
  const onPresentDeposit = useDepositModal(props)
  const onPresentWithdraw = useWithdrawModal(data, lpAddress, poolInfo.bCakeWrapperAddress, tvlUsd)

  const handleIncrease = useCallback(async () => {
    const shouldSwitch = await switchNetworkIfNecessary(chainId)
    if (!shouldSwitch) {
      onPresentDeposit()
    }
  }, [chainId, onPresentDeposit, switchNetworkIfNecessary])

  const handleDecrease = useCallback(async () => {
    const shouldSwitch = await switchNetworkIfNecessary(chainId)
    if (!shouldSwitch) {
      onPresentWithdraw()
    }
  }, [chainId, onPresentWithdraw, switchNetworkIfNecessary])

  const hasStakedBalance = data.farmingBalance.greaterThan(0)

  return (
    <StakeActions
      showIncreaseBtn={isFarmLive}
      showDecreaseBtn={hasStakedBalance}
      onIncrease={handleIncrease}
      onDecrease={handleDecrease}
    />
  )
}

const V2NativeAction: React.FC<V2PositionActionsProps> = (props) => {
  const { chainId, isFarmLive } = props
  const { switchNetworkIfNecessary } = useCheckShouldSwitchNetwork()
  const onPresentDeposit = useDepositModal(props)
  const handleDeposit = useCallback(async () => {
    const shouldSwitch = await switchNetworkIfNecessary(chainId)
    if (!shouldSwitch) {
      onPresentDeposit()
    }
  }, [chainId, switchNetworkIfNecessary, onPresentDeposit])
  if (!isFarmLive) {
    return null
  }
  return <DepositStakeAction onDeposit={handleDeposit} />
}

const V2HarvestAction: React.FC<V2PositionActionsProps> = ({ chainId, lpAddress, poolInfo }) => {
  const { address: account } = useAccount()
  const openHarvestModal = useOpenHarvestModal()
  const { data: pendingReward_ } = useAccountV2PendingCakeReward(account, {
    chainId,
    lpAddress,
    bCakeWrapperAddress: poolInfo.bCakeWrapperAddress,
  })
  const pendingReward = useMemo(() => {
    return new BigNumber(pendingReward_?.toString() ?? '0')
  }, [pendingReward_])

  if (!pendingReward || pendingReward.isZero()) {
    return null
  }

  return <HarvestAction onHarvest={() => openHarvestModal?.('evm', chainId)} />
}
