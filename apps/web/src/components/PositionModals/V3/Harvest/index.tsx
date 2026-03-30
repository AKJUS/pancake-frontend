import { useTranslation } from '@pancakeswap/localization'
import { Currency } from '@pancakeswap/sdk'
import { Protocol } from '@pancakeswap/farms'
import { Box, Button } from '@pancakeswap/uikit'
import { CAKE } from '@pancakeswap/tokens'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useDerivedPositionInfo } from 'hooks/v3/useDerivedPositionInfo'
import { useV3PositionFees } from 'hooks/v3/useV3PositionFees'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useMasterchefV3ByChain } from 'hooks/useContract'
import { useV3TokenIdsByAccount } from 'hooks/v3/useV3Positions'
import { useCallback, useMemo } from 'react'
import { PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import useFarmV3Actions from 'views/Farms/hooks/v3/useFarmV3Actions'
import { useV3CakeEarning } from 'views/universalFarms/hooks/useCakeEarning'
import useV3CollectFeeAction from 'views/universalFarms/hooks/useV3CollectFeeAction'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { useAccount } from 'wagmi'
import { UnclaimedFeesDisplay } from '../../shared/UnclaimedFeesDisplay'
import { FarmingRewardsDisplay } from '../../shared/FarmingRewardsDisplay'
import { MerklRewardsDisplay } from '../../shared/MerklRewardsDisplay'
import { IncentraRewardsDisplay } from '../../shared/IncentraRewardsDisplay'

interface V3PositionHarvestProps {
  position: PositionDetail
  poolInfo: PoolInfo
}

export const V3PositionHarvest = ({ position, poolInfo }: V3PositionHarvestProps) => {
  const { t } = useTranslation()
  const { address: account } = useAccount()
  const { chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const [, setLatestTxReceipt] = useLatestTxReceipt()

  const chainId = position.chainId ?? poolInfo.chainId
  const needsSwitchNetwork = activeChainId !== chainId
  const currency0 = poolInfo.token0 as Currency
  const currency1 = poolInfo.token1 as Currency
  const { tokenId } = position

  const { pool } = useDerivedPositionInfo(position, chainId)

  const [feeValue0, feeValue1] = useV3PositionFees(pool, tokenId, false)

  const { data: price0Usd } = useCurrencyUsdPrice(currency0)
  const { data: price1Usd } = useCurrencyUsdPrice(currency1)

  const feeUsd0 = useMemo(() => {
    if (!price0Usd || !feeValue0) return undefined
    return Number(feeValue0.toExact()) * price0Usd
  }, [price0Usd, feeValue0])

  const feeUsd1 = useMemo(() => {
    if (!price1Usd || !feeValue1) return undefined
    return Number(feeValue1.toExact()) * price1Usd
  }, [price1Usd, feeValue1])

  const totalFeesUsd = useMemo(() => {
    if (feeUsd0 === undefined && feeUsd1 === undefined) return undefined
    return (feeUsd0 ?? 0) + (feeUsd1 ?? 0)
  }, [feeUsd0, feeUsd1])

  const { onCollect, attemptingTx: collectAttemptingTx } = useV3CollectFeeAction({
    chainId,
    onDone: (hash) => setLatestTxReceipt({ blockHash: hash, status: 'success' }),
  })

  const handleCollect = useCallback(async () => {
    if (!pool || !tokenId) return
    await onCollect({
      pool,
      tokenId,
      feeValue0,
      feeValue1,
      receiveWNATIVE: false,
    })
  }, [pool, tokenId, onCollect, feeValue0, feeValue1])

  const collectDisabled = collectAttemptingTx || !pool || !(feeValue0?.greaterThan(0) || feeValue1?.greaterThan(0))

  const masterchefV3 = useMasterchefV3ByChain(chainId)
  const isMasterChefV3Available = Boolean(masterchefV3?.address && masterchefV3?.address !== '0x')
  const { tokenIds: stakedTokenIds } = useV3TokenIdsByAccount(
    isMasterChefV3Available ? masterchefV3?.address : undefined,
    account,
    chainId,
  )
  const isStaked = useMemo(
    () => Boolean(tokenId && stakedTokenIds.find((id) => id === tokenId)),
    [tokenId, stakedTokenIds],
  )

  const { earningsAmount, earningsBusd, hasEarnings } = useV3CakeEarning(
    useMemo(() => (isStaked && tokenId ? [tokenId] : []), [tokenId, isStaked]),
    chainId,
  )

  const { onHarvest, attemptingTxn: harvestAttemptingTx } = useFarmV3Actions({
    tokenId: tokenId?.toString() ?? '',
    onDone: setLatestTxReceipt,
  })

  const showFarmRewards = isStaked && hasEarnings

  return (
    <Box>
      <UnclaimedFeesDisplay
        currency0={currency0}
        currency1={currency1}
        feeAmount0={feeValue0}
        feeAmount1={feeValue1}
        feeUsd0={feeUsd0}
        feeUsd1={feeUsd1}
        totalFeesUsd={totalFeesUsd}
        onCollect={handleCollect}
        collecting={collectAttemptingTx}
        disabled={collectDisabled}
        hideButton={needsSwitchNetwork}
      />

      {showFarmRewards ? (
        <Box mt="16px">
          <FarmingRewardsDisplay
            rewardToken={CAKE[chainId]}
            rewardsAmount={earningsAmount}
            rewardsUSD={earningsBusd}
            onHarvest={onHarvest}
            harvesting={harvestAttemptingTx}
            disabled={harvestAttemptingTx || !hasEarnings}
            hideButton={needsSwitchNetwork}
          />
        </Box>
      ) : null}

      <MerklRewardsDisplay
        poolAddress={poolInfo.lpAddress}
        poolProtocol={Protocol.V3}
        chainId={chainId}
        disabled={needsSwitchNetwork}
        hideButton={needsSwitchNetwork}
      />

      <IncentraRewardsDisplay poolAddress={poolInfo.lpAddress} chainId={chainId} />

      {needsSwitchNetwork && (
        <Button
          mt="16px"
          width="100%"
          onClick={() => (chainId ? switchNetworkIfNecessary(chainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      )}
    </Box>
  )
}
