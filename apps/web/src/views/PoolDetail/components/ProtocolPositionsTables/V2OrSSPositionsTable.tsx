import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { AddIcon, Flex, FlexGap, MinusIcon, Text, useToast } from '@pancakeswap/uikit'
import { displayApr } from '@pancakeswap/utils/displayApr'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { ToastDescriptionWithTx } from 'components/Toast'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import useCatchTxError from 'hooks/useCatchTxError'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import router from 'next/router'
import { useCallback, useMemo } from 'react'
import { useAccountPositionDetailByPool } from 'state/farmsV4/hooks'
import { StableLPDetail, V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { InfinityStablePoolInfo, StablePoolInfo, V2PoolInfo } from 'state/farmsV4/state/type'
import { useChainIdByQuery } from 'state/info/hooks'
import { Tooltips } from 'components/Tooltips'
import {
  calculateTotalApr,
  calculateV2LiquidityUSD,
  convertAprDataToNumbers,
  formatPoolDetailFiatNumber,
} from 'views/PoolDetail/utils'
import { AprTooltipContent } from 'views/universalFarms/components/PoolAprButtonV3/AprTooltipContent'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { useV2CakeEarning } from 'views/universalFarms/hooks/useCakeEarning'
import { useV2PositionApr } from 'views/universalFarms/hooks/usePositionAPR'
import { useV2FarmActions } from 'views/universalFarms/hooks/useV2FarmActions'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { useAccount } from 'wagmi'
import { V2_MIGRATE_PAGE_SUPPORTED_CHAINS } from 'config/constants/supportChains'
import { StopPropagation } from 'views/universalFarms/components/StopPropagation'
import { ActionButton, PrimaryOutlineButton } from '../styles'
import { PositionsTable } from './PositionsTable'
import { EmptyPositionCard, LoadingCard } from './UtilityCards'

interface V2PositionsTableProps {
  poolInfo: V2PoolInfo | StablePoolInfo
}

// Component that only renders when position data exists
const V2PositionWithApr: React.FC<{
  poolInfo: V2PoolInfo | StablePoolInfo | InfinityStablePoolInfo
  v2OrStableData: V2LPDetail | StableLPDetail
  harvestAllButton?: React.ReactNode
}> = ({ poolInfo, v2OrStableData, harvestAllButton }) => {
  const { t } = useTranslation()

  // Get USD prices for both tokens
  const { data: token0Price } = useCurrencyUsdPrice(poolInfo.token0?.wrapped, {
    enabled: Boolean(poolInfo.token0),
  })
  const { data: token1Price } = useCurrencyUsdPrice(poolInfo.token1?.wrapped, {
    enabled: Boolean(poolInfo.token1),
  })

  // Get APR data for the single position - safe to call since v2OrStableData is guaranteed to exist
  const aprData = useV2PositionApr(poolInfo, v2OrStableData)

  // V2 earnings for the table
  const { earningsBusd } = useV2CakeEarning(poolInfo)

  const transformedPosition = useMemo(() => {
    // Use utility function for V2 liquidity calculation
    const liquidityUSD = calculateV2LiquidityUSD(
      v2OrStableData.nativeDeposited0,
      v2OrStableData.nativeDeposited1,
      v2OrStableData.farmingDeposited0,
      v2OrStableData.farmingDeposited1,
      token0Price,
      token1Price,
    )

    // Calculate individual amounts for display
    const amount0 = v2OrStableData.nativeDeposited0.add(v2OrStableData.farmingDeposited0)
    const amount1 = v2OrStableData.nativeDeposited1.add(v2OrStableData.farmingDeposited1)
    const amount0Usd = Number(amount0.toExact()) * (token0Price ?? 0)
    const amount1Usd = Number(amount1.toExact()) * (token1Price ?? 0)

    const tokenInfo = (
      <FlexGap flexDirection="column" gap="4px">
        <Text bold fontSize="16px">
          {poolInfo.token0?.symbol} / {poolInfo.token1?.symbol}
        </Text>
      </FlexGap>
    )

    const liquidity = (
      <Flex flexDirection="column" alignItems="flex-start">
        <Tooltips
          content={
            <FlexGap flexDirection="column" alignItems="flex-start" gap="8px">
              <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
                <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                  <FlexGap alignItems="center" gap="8px">
                    <CurrencyLogo currency={poolInfo.token0} size="16px" mb="-3px" />
                    <Text fontSize="14px" bold>
                      {poolInfo.token0?.symbol}
                    </Text>
                  </FlexGap>
                  <Text fontSize="14px" bold>
                    {amount0.toSignificant(6)}
                  </Text>
                </FlexGap>
                <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                  {formatDollarAmount(amount0Usd)}
                </Text>
              </FlexGap>
              <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
                <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                  <FlexGap alignItems="center" gap="8px">
                    <CurrencyLogo currency={poolInfo.token1} size="16px" mb="-3px" />
                    <Text fontSize="14px" bold>
                      {poolInfo.token1?.symbol}
                    </Text>
                  </FlexGap>
                  <Text fontSize="14px" bold>
                    {amount1.toSignificant(6)}
                  </Text>
                </FlexGap>
                <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                  {formatDollarAmount(amount1Usd)}
                </Text>
              </FlexGap>
            </FlexGap>
          }
        >
          <Text bold fontSize="16px" style={{ cursor: 'default' }}>
            {formatDollarAmount(liquidityUSD)}
          </Text>
        </Tooltips>
      </Flex>
    )

    // Use utility function for APR calculation
    const totalApr = calculateTotalApr(convertAprDataToNumbers(aprData))
    const aprDisplay = (
      <Flex flexDirection="column" alignItems="flex-start" style={{ cursor: 'default' }}>
        <Tooltips
          content={
            <AprTooltipContent
              combinedApr={totalApr}
              lpFeeApr={Number(aprData.lpApr)}
              cakeApr={aprData.cakeApr ? { value: Number(aprData.cakeApr.value) } : undefined}
              merklApr={Number(aprData.merklApr)}
            />
          }
        >
          <Text bold fontSize="16px" color={totalApr > 0 ? 'success' : 'text'}>
            {displayApr(totalApr)}
          </Text>
        </Tooltips>
      </Flex>
    )

    // Construct URLs for V2/Stable actions
    const token0Address = poolInfo.token0?.wrapped.address
    const token1Address = poolInfo.token1?.wrapped.address
    const baseUrl = poolInfo.protocol === 'v2' ? '/v2' : '/stable'
    const chainPersistQuery = `chain=${CHAIN_QUERY_NAME[poolInfo.chainId]}&${[PERSIST_CHAIN_KEY]}=1`

    const addLiquidityUrl = `${baseUrl}/add/${token0Address}/${token1Address}?increase=1&${chainPersistQuery}`
    const removeLiquidityUrl = `${baseUrl}/remove/${token0Address}/${token1Address}?${chainPersistQuery}`
    const migrateUrl = `/v2/migrate/${poolInfo.lpAddress}?${chainPersistQuery}`

    const infinityStableAddLiquidityUrl = `/infinityStable/add/${poolInfo.poolId}?${chainPersistQuery}`
    const infinityStableRemoveLiquidityUrl = `/infinityStable/remove/${poolInfo.poolId}?${chainPersistQuery}`

    const handleRemove = () => {
      if (poolInfo.protocol === Protocol.InfinitySTABLE) {
        router.push(infinityStableRemoveLiquidityUrl)
      } else {
        router.push(removeLiquidityUrl)
      }
    }
    const handleAdd = () => {
      if (poolInfo.protocol === Protocol.InfinitySTABLE) {
        router.push(infinityStableAddLiquidityUrl)
      } else {
        router.push(addLiquidityUrl)
      }
    }
    const handleMigrate = () => router.push(migrateUrl)

    const actions = (
      <StopPropagation>
        <FlexGap gap="8px" alignItems="center" justifyContent="flex-end">
          <ActionButton isIcon onClick={handleRemove}>
            <MinusIcon />
          </ActionButton>

          <ActionButton isIcon onClick={handleAdd}>
            <AddIcon />
          </ActionButton>

          {poolInfo.protocol === 'v2' && V2_MIGRATE_PAGE_SUPPORTED_CHAINS.includes(poolInfo.chainId) && (
            <ActionButton onClick={handleMigrate}>{t('Migrate')}</ActionButton>
          )}
        </FlexGap>
      </StopPropagation>
    )

    return {
      tableRow: {
        tokenInfo,
        liquidity,
        apr: aprDisplay,
        actions,
      },
      liquidityUSD,
      totalApr,
    }
  }, [v2OrStableData, poolInfo, aprData, t, token0Price, token1Price])

  return (
    <PositionsTable
      poolInfo={poolInfo}
      totalLiquidityUSD={transformedPosition.liquidityUSD}
      totalApr={transformedPosition.totalApr}
      totalEarnings={formatPoolDetailFiatNumber(earningsBusd)}
      data={[transformedPosition.tableRow]}
      harvestAllButton={harvestAllButton}
      // On row click, navigate to the appropriate V2/Stable page
      onRowClick={() => {
        const token0Address = poolInfo.token0?.wrapped.address
        const token1Address = poolInfo.token1?.wrapped.address
        const baseUrl =
          poolInfo.protocol === 'v2'
            ? `/v2/pair/${token0Address}/${token1Address}`
            : `/${poolInfo.protocol === Protocol.InfinitySTABLE ? 'infinityStable' : 'stable'}/${poolInfo.lpAddress}`
        const detailUrl = `${baseUrl}?chain=${CHAIN_QUERY_NAME[poolInfo.chainId]}&${[PERSIST_CHAIN_KEY]}=1`
        router.push(detailUrl)
      }}
    />
  )
}

export const V2OrSSPositionsTable: React.FC<V2PositionsTableProps> = ({ poolInfo }) => {
  const { t } = useTranslation()
  const { address: account } = useAccount()
  const chainId = useChainIdByQuery()
  const { toastSuccess } = useToast()
  const { fetchWithCatchTxError, loading } = useCatchTxError()
  const { switchNetworkIfNecessary, isLoading: isSwitchingNetwork } = useCheckShouldSwitchNetwork()

  const { data: v2OrStableData, isLoading } = useAccountPositionDetailByPool<Protocol.V2 | Protocol.STABLE>(
    chainId,
    account,
    poolInfo,
  )

  // V2 farm actions and earnings
  const { onHarvest } = useV2FarmActions(poolInfo.lpAddress!, poolInfo.bCakeWrapperAddress)
  const { earningsBusd, hasEarnings, isLoading: isEarningsLoading } = useV2CakeEarning(poolInfo)

  const handleHarvestAll = useCallback(async () => {
    if (loading || !onHarvest || !earningsBusd) return

    const shouldSwitch = await switchNetworkIfNecessary(chainId)
    if (shouldSwitch) {
      return
    }

    try {
      const receipt = await fetchWithCatchTxError(() => onHarvest())
      if (receipt?.status) {
        toastSuccess(
          `${t('Harvested')}!`,
          <ToastDescriptionWithTx txHash={receipt.transactionHash}>
            {t('Your %symbol% earnings have been sent to your wallet!', { symbol: 'CAKE' })}
          </ToastDescriptionWithTx>,
        )
      }
    } catch (error) {
      console.error(error)
    }
  }, [loading, onHarvest, earningsBusd, switchNetworkIfNecessary, chainId, fetchWithCatchTxError, toastSuccess, t])

  if (isLoading) {
    return <LoadingCard />
  }

  if (!v2OrStableData) {
    return <EmptyPositionCard />
  }

  // Create harvest all button
  const harvestAllButton = (
    <PrimaryOutlineButton
      onClick={handleHarvestAll}
      disabled={loading || isEarningsLoading || isSwitchingNetwork || !hasEarnings}
    >
      {loading ? t('Harvesting...') : t('Harvest All')}
    </PrimaryOutlineButton>
  )

  // Render the position component with harvest all button
  return <V2PositionWithApr poolInfo={poolInfo} v2OrStableData={v2OrStableData} harvestAllButton={harvestAllButton} />
}
