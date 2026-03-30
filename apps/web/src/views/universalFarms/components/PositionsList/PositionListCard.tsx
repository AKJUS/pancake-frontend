import { Protocol } from '@pancakeswap/farms'
import { getPoolId } from '@pancakeswap/infinity-sdk'
import { Box, Flex, FlexGap, Text, FeeTier, Button, useMatchBreakpoints, useModalV2 } from '@pancakeswap/uikit'
import { FiatNumberDisplay, NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { TokenPairLogo } from 'components/TokenImage'
import { unwrappedToken } from '@pancakeswap/tokens'
import { InfinityFeeTierBreakdown } from 'components/FeeTierBreakdown'
import { RangeTag } from 'components/RangeTag'
import { MerklTag } from 'components/Merkl/MerklTag'
import { IncentraTag } from 'components/Incentra/IncentraTag'
import { useHookByPoolId } from 'hooks/infinity/useHooksList'
import { usePoolById } from 'hooks/infinity/usePool'
import { useInfinityBinPosition } from 'hooks/infinity/useInfinityPositions'
import { useUnclaimedFarmRewardsUSDByPoolId, useUnclaimedFarmRewardsUSDByTokenId } from 'hooks/infinity/useFarmReward'
import { useFeesEarnedUSD } from 'hooks/infinity/useFeesEarned'
import { useUnifiedTokenUsdPrice } from 'hooks/useUnifiedTokenUsdPrice'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useV3PositionFees } from 'hooks/v3/useV3PositionFees'
import { usePoolByChainId } from 'hooks/v3/usePools'
import { useV3CakeEarning } from 'views/universalFarms/hooks/useCakeEarning'
import { useSolanaV3RewardInfoFromSimulation } from 'views/universalFarms/hooks/useSolanaV3RewardInfoFromSimulation'
import dayjs from 'dayjs'
import { useTranslation } from '@pancakeswap/localization'
import { BigNumber as BN } from 'bignumber.js'
import { CurrencyAmount, ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { Currency } from '@pancakeswap/sdk'
import { useAccount } from 'wagmi'
import { getLiquidityDetailURL } from 'config/constants/liquidity'
import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPoolDetailPageLink } from 'utils/getPoolLink'
import {
  useExtraInfinityPositionInfo,
  useExtraV3PositionInfo,
  usePoolInfo,
  getPoolAddressByToken,
} from 'state/farmsV4/hooks'
import { PriceRangeDisplay } from 'views/PoolDetail/components/ProtocolPositionsTables/PriceRangeDisplay'
import {
  calculateTickBasedPriceRange,
  calculateBinBasedPriceRange,
  getTickAtLimitStatus,
  calculateTickLimits,
  getTickSpacing,
} from 'views/PoolDetail/utils'
import { formatPriceRange } from 'views/PoolDetail/utils/formatting'
import { usePriceRangeData, PriceRangeData } from 'hooks/solana/usePriceRange'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  PositionDetail,
  UnifiedPositionDetail,
  V2LPDetail,
  StableLPDetail,
  SolanaV3PositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import { InfinityPoolInfo, type PoolInfo, V2PoolInfo, StablePoolInfo, SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { isInfinityProtocol } from 'utils/protocols'
import { PositionModal } from 'components/PositionModals'
import { PositionTabType } from 'components/PositionModals/types'
import styled from 'styled-components'
import { isSolana, NonEVMChainId } from '@pancakeswap/chains'
import { TokenInfo } from '@pancakeswap/solana-core-sdk'
import { convertRawTokenInfoIntoSPLToken } from 'config/solana-list'
import { useSolanaV3Pool, SolanaV3Pool } from 'state/pools/solana'
import { SOLANA_FEE_TIER_BASE } from 'utils/normalizeSolanaPoolInfo'
import { SolanaV3AddPositionModal } from '../Modals/solana/SolanaV3AddPositionModal'
import { getPositionChainId } from '../../utils'
import {
  InfinityCLPoolPositionAprButton,
  InfinityBinPoolPositionAprButton,
  V3PoolPositionAprButton,
  V2PoolPositionAprButton,
  SolanaV3PoolPositionAprButton,
  PoolGlobalAprButton,
} from '../PoolAprButton'
import { PositionActionButtons } from '../PositionsTable/PositionActionButtons'
import { V2_FEE_TIER_BASE, V2_FEE_TIER, V3_FEE_TIER_BASE } from '../../constants'

type PositionListCardProps = {
  position: UnifiedPositionDetail
  poolLength?: number
}

const Card = styled(Box)`
  padding: 16px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  background: ${({ theme }) => theme.card.background};
`

const CardHeader = styled(Flex)`
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`

const PoolInfo = styled(Flex)`
  flex-direction: column;
  gap: 8px;
  flex: 1;
`

const CardBody = styled(Flex)`
  flex-direction: column;
  gap: 12px;
`

const InfoRow = styled(Flex)`
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
`

const InfoColumn = styled(Flex)<{ $align?: 'left' | 'center' | 'right' }>`
  flex-direction: column;
  gap: 2px;
  align-items: ${({ $align }) => ($align === 'right' ? 'flex-end' : $align === 'center' ? 'center' : 'flex-start')};
`

const InfoLabel = styled(Text)`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondary};
  text-transform: uppercase;
  letter-spacing: 0.24px;
`

const InfoValue = styled(Text)`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`

const PriceRangeRow = styled(Flex)`
  flex-direction: column;
  padding-top: 12px;
  width: 100%;
`

const ActionsRow = styled(Flex)`
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
`

export const PositionListCard: React.FC<PositionListCardProps> = ({ position, poolLength }) => {
  const { t } = useTranslation()
  const { isMobile, isMd } = useMatchBreakpoints()
  const chainId = getPositionChainId(position)
  const isSolanaPosition = isSolana(chainId)

  // Get Solana pool info for price range calculation
  const solanaPoolId =
    isSolanaPosition && 'poolId' in position ? (position as SolanaV3PositionDetail).poolId.toBase58() : undefined
  const solanaPoolInfo = useSolanaV3Pool(solanaPoolId)

  // Solana price range - use state to store result from conditional hook component
  const [solanaPriceRangeData, setSolanaPriceRangeData] = useState<PriceRangeData | null>(null)

  // Check if we have valid Solana data
  const hasValidSolanaData = Boolean(
    isSolanaPosition &&
      position.protocol === Protocol.V3 &&
      solanaPoolInfo &&
      solanaPoolInfo.mintA &&
      solanaPoolInfo.mintB &&
      'tickLower' in position &&
      'tickUpper' in position,
  )

  const {
    currency0,
    currency1,
    removed,
    outOfRange,
    pool,
    totalPriceUSD,
    aprButton,
    hookData,
    feeTier,
    feeTierBase,
    amount0,
    amount1,
    isStaked,
    isFarmLive,
    priceRangeDisplay: evmPriceRangeDisplay,
    earnings,
  } = usePositionData({
    position,
    poolLength,
  })

  // For V3 positions, get the SDK pool for cross-chain fee fetching
  const isEVMV3 = position.protocol === Protocol.V3 && !isSolanaPosition
  const v3Info = useExtraV3PositionInfo(isEVMV3 ? (position as PositionDetail) : undefined)
  const evmCurrency0 = isEVMV3 ? (currency0 as Currency | undefined) : undefined
  const evmCurrency1 = isEVMV3 ? (currency1 as Currency | undefined) : undefined
  const [, evmV3Pool] = usePoolByChainId(
    evmCurrency0?.wrapped,
    evmCurrency1?.wrapped,
    isEVMV3 && 'fee' in position ? position.fee : undefined,
  )
  const poolForFees = isEVMV3 ? v3Info.pool ?? evmV3Pool : undefined

  // Position Modal state (same as desktop ExpandedRowContent)
  const {
    isOpen: isPositionModalOpen,
    setIsOpen: setPositionModalOpen,
    onDismiss: onPositionModalDismiss,
  } = useModalV2()
  const [modalPresetTab, setModalPresetTab] = useState<PositionTabType>('Add')
  const openPositionModal = useCallback(
    (tab: PositionTabType) => {
      setModalPresetTab(tab)
      setPositionModalOpen(true)
    },
    [setPositionModalOpen],
  )

  const isSolanaV3 = isSolanaPosition && position.protocol === Protocol.V3
  const solanaV3PoolForAdd =
    isSolanaV3 && pool && 'rawPool' in pool && pool.rawPool ? (pool as SolanaV3PoolInfo) : undefined

  const {
    isOpen: isSolanaAddModalOpen,
    onOpen: onSolanaAddModalOpen,
    onDismiss: onSolanaAddModalDismiss,
  } = useModalV2()

  // Combine Solana price range with EVM price range
  // Extract raw numeric values from formatted strings for inversion support (matching SolanaV3PositionRow)
  // const solanaDebugMeta =
  //   hasValidSolanaData && solanaPoolId && currency0 && currency1
  //     ? { poolId: solanaPoolId, pairSymbols: `${currency0.symbol}/${currency1.symbol}` }
  //     : undefined
  const priceRangeDisplay = useMemo(() => {
    // Use Solana price range if available, otherwise use EVM price range
    if (hasValidSolanaData && solanaPriceRangeData) {
      // Safeguard: Replace NaN strings with '-'
      // Note: "∞" and "0" are valid special values, don't treat them as NaN
      let safeMinPrice =
        solanaPriceRangeData.minPriceFormatted?.includes('NaN') ||
        solanaPriceRangeData.minPriceFormatted === 'NaN' ||
        (solanaPriceRangeData.minPriceFormatted !== '0' &&
          solanaPriceRangeData.minPriceFormatted !== '∞' &&
          Number.isNaN(Number(solanaPriceRangeData.minPriceFormatted)))
          ? '-'
          : solanaPriceRangeData.minPriceFormatted

      let safeMaxPrice =
        solanaPriceRangeData.maxPriceFormatted?.includes('NaN') ||
        solanaPriceRangeData.maxPriceFormatted === 'NaN' ||
        (solanaPriceRangeData.maxPriceFormatted !== '0' &&
          solanaPriceRangeData.maxPriceFormatted !== '∞' &&
          Number.isNaN(Number(solanaPriceRangeData.maxPriceFormatted)))
          ? '-'
          : solanaPriceRangeData.maxPriceFormatted

      // Extract raw numeric values for calculations
      let rawMinPrice: number | undefined
      let rawMaxPrice: number | undefined
      let rawCurrentPrice: number | undefined

      if (safeMinPrice !== '-' && safeMinPrice !== '0') {
        const parsed = parseFloat(safeMinPrice)
        if (Number.isFinite(parsed) && !Number.isNaN(parsed)) {
          rawMinPrice = parsed
        }
      } else if (safeMinPrice === '0') {
        rawMinPrice = 0
      }

      if (safeMaxPrice !== '-' && safeMaxPrice !== '∞') {
        const parsed = parseFloat(safeMaxPrice)
        if (Number.isFinite(parsed) && !Number.isNaN(parsed)) {
          rawMaxPrice = parsed
        }
      }

      if (solanaPriceRangeData.currentPrice) {
        const parsed = parseFloat(solanaPriceRangeData.currentPrice)
        if (Number.isFinite(parsed) && !Number.isNaN(parsed)) {
          rawCurrentPrice = parsed
        }
      }

      // Apply smart formatting for valid price ranges (not special values, valid numbers)
      // This matches the desktop formatting in SolanaV3PositionRow
      if (
        rawMinPrice !== undefined &&
        rawMaxPrice !== undefined &&
        safeMinPrice !== '-' &&
        safeMinPrice !== '0' &&
        safeMaxPrice !== '-' &&
        safeMaxPrice !== '∞' &&
        Number.isFinite(rawMinPrice) &&
        Number.isFinite(rawMaxPrice) &&
        rawMinPrice > 0 &&
        rawMaxPrice > 0
      ) {
        const formatted = formatPriceRange(rawMinPrice, rawMaxPrice)
        safeMinPrice = formatted.minFormatted
        safeMaxPrice = formatted.maxFormatted
      }

      const result = {
        ...solanaPriceRangeData,
        minPriceFormatted: safeMinPrice,
        maxPriceFormatted: safeMaxPrice,
        minPrice: rawMinPrice,
        maxPrice: rawMaxPrice,
        currentPriceValue: rawCurrentPrice,
      }

      return result
    }
    return evmPriceRangeDisplay
  }, [hasValidSolanaData, solanaPriceRangeData, evmPriceRangeDisplay])

  // Get pool detail URL for Details button (same as Full Page button in ExpandedRowContent)
  const { data: poolDetailUrl } = useQuery({
    // Use serializable identifiers instead of the whole pool object to avoid BigInt serialization issues
    queryKey: ['poolDetailUrl', pool?.chainId, pool?.lpAddress ?? pool?.poolId, pool?.protocol],
    queryFn: () => {
      if (!pool) return undefined
      return getPoolDetailPageLink(pool)
    },
  })

  return (
    <>
      {/* Conditionally render Solana price range hook only when we have valid data */}
      {hasValidSolanaData && solanaPoolInfo && (
        <SolanaPriceRangeHook
          tickLower={(position as SolanaV3PositionDetail).tickLower}
          tickUpper={(position as SolanaV3PositionDetail).tickUpper}
          poolInfo={solanaPoolInfo}
          onDataReady={setSolanaPriceRangeData}
          poolId={solanaPoolId}
          pairSymbols={currency0 && currency1 ? `${currency0.symbol}/${currency1.symbol}` : undefined}
        />
      )}
      <Card>
        <CardHeader>
          <FlexGap alignItems="center" gap="12px" flex="1">
            {currency0 && currency1 ? (
              <TokenPairLogo
                width={40}
                height={40}
                variant="inverted"
                primaryToken={currency0}
                secondaryToken={currency1}
                withChainLogo
              />
            ) : null}
            <PoolInfo>
              <FlexGap alignItems="center" gap="8px" flexWrap="wrap">
                {currency0 && currency1 ? (
                  <>
                    <Text bold fontSize="16px">
                      {currency0.symbol} / {currency1.symbol}
                    </Text>
                    {'tokenId' in position && position.tokenId && (
                      <Text color="textSubtle" fontSize="12px">
                        #{position.tokenId.toString()}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text color="textSubtle" fontSize="16px">
                    {t('Loading')}...
                  </Text>
                )}
              </FlexGap>
              <FlexGap alignItems="center" gap="4px" flexWrap="wrap">
                {isInfinityProtocol(position.protocol) ? (
                  <InfinityFeeTierBreakdown
                    poolId={(pool as InfinityPoolInfo)?.poolId}
                    chainId={chainId}
                    hookData={hookData}
                    infoIconVisible={false}
                  />
                ) : (
                  <FeeTier
                    type={position.protocol}
                    fee={feeTier ?? ('fee' in position ? position.fee : 0)}
                    denominator={feeTierBase ?? ('fee' in position ? V3_FEE_TIER_BASE : undefined)}
                  />
                )}
                <MerklTag poolAddress={pool?.lpAddress} />
                <IncentraTag poolAddress={pool?.lpAddress} />
                {![Protocol.V2, Protocol.STABLE, Protocol.InfinitySTABLE].includes(position.protocol) && (
                  <RangeTag lowContrast removed={removed} outOfRange={outOfRange} protocol={position.protocol} />
                )}
              </FlexGap>
            </PoolInfo>
          </FlexGap>
        </CardHeader>

        <CardBody mt="24px" px="8px">
          {/* Info row: Liquidity | Earnings | APR */}
          <InfoRow>
            <InfoColumn>
              <InfoLabel>{t('Liquidity')}</InfoLabel>
              <InfoValue>
                <FiatNumberDisplay
                  value={totalPriceUSD}
                  style={{ fontSize: '14px', fontWeight: 600 }}
                  showFullDigitsTooltip={false}
                />
              </InfoValue>
            </InfoColumn>

            {position.protocol !== Protocol.V2 &&
              position.protocol !== Protocol.STABLE &&
              position.protocol !== Protocol.InfinitySTABLE && (
                <InfoColumn $align="center">
                  <InfoLabel>{t('Earnings')}</InfoLabel>
                  <InfoValue>{earnings?.display ?? '-'}</InfoValue>
                </InfoColumn>
              )}

            <InfoColumn $align="right">
              <InfoLabel>{t('APR')}</InfoLabel>
              {aprButton}
            </InfoColumn>
          </InfoRow>

          {/* Price Range - only for concentrated liquidity positions and non-removed positions */}
          {![Protocol.V2, Protocol.STABLE, Protocol.InfinitySTABLE].includes(position.protocol) && !removed && (
            <PriceRangeRow>
              <InfoLabel style={{ marginBottom: '8px' }}>{t('Price Range')}</InfoLabel>
              {priceRangeDisplay ? (
                <Box px="16px">
                  <PriceRangeDisplay
                    minPrice={priceRangeDisplay.minPriceFormatted}
                    maxPrice={priceRangeDisplay.maxPriceFormatted}
                    currentPrice={priceRangeDisplay.currentPrice}
                    minPercentage={priceRangeDisplay.minPercentage}
                    maxPercentage={priceRangeDisplay.maxPercentage}
                    rangePosition={priceRangeDisplay.rangePosition}
                    outOfRange={outOfRange}
                    removed={removed}
                    showPercentages={priceRangeDisplay.showPercentages}
                    maxWidth="100%"
                    minPriceRaw={priceRangeDisplay.minPrice}
                    maxPriceRaw={priceRangeDisplay.maxPrice}
                    currentPriceRaw={priceRangeDisplay.currentPriceValue}
                  />
                </Box>
              ) : (
                <Text fontSize="12px" color="textSubtle">
                  -
                </Text>
              )}
            </PriceRangeRow>
          )}

          {/* Action buttons using unified PositionActionButtons component */}
          <ActionsRow>
            {!removed && pool?.protocol && (!isSolanaV3 || solanaV3PoolForAdd) && (
              <Button
                width="100%"
                onClick={() => {
                  if (isSolanaV3 && solanaV3PoolForAdd) {
                    onSolanaAddModalOpen()
                  } else {
                    openPositionModal('Add')
                  }
                }}
              >
                {t('Add Liquidity')}
              </Button>
            )}
            <PositionActionButtons
              position={position}
              pool={pool}
              chainId={chainId}
              isFarmLive={isFarmLive}
              isStaked={isStaked}
              removed={removed}
              outOfRange={outOfRange}
              totalLiquidityUSD={totalPriceUSD}
              amount0={amount0}
              amount1={amount1}
              showCollectButton
              hideStakeButtons
              v3SdkPool={poolForFees}
            />

            {/* Details button - same functionality as Full Page button */}
            {poolDetailUrl && (
              <Button
                variant="primary60"
                scale="md"
                width="100%"
                as={NextLinkFromReactRouter}
                to={poolDetailUrl}
                {...(!isMobile &&
                  !isMd && {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  })}
              >
                {t('Details')}
              </Button>
            )}
          </ActionsRow>
        </CardBody>
      </Card>
      {solanaV3PoolForAdd && (
        <SolanaV3AddPositionModal
          isOpen={isSolanaAddModalOpen}
          onClose={onSolanaAddModalDismiss}
          pool={solanaV3PoolForAdd}
          position={position as SolanaV3PositionDetail}
        />
      )}
      {!isSolanaV3 && (
        <PositionModal
          key={modalPresetTab}
          isOpen={isPositionModalOpen}
          onDismiss={onPositionModalDismiss}
          poolId={pool?.poolId ?? pool?.stableSwapAddress ?? pool?.lpAddress}
          protocol={pool?.protocol}
          chainId={pool?.chainId ?? chainId}
          position={position}
          presetTab={modalPresetTab}
        />
      )}
    </>
  )
}

// Component that only renders when we have valid Solana data
// This ensures usePriceRangeData is only called when poolInfo is defined
const SolanaPriceRangeHook: React.FC<{
  tickLower: number
  tickUpper: number
  poolInfo: SolanaV3Pool
  onDataReady: (data: PriceRangeData) => void
  poolId?: string
  pairSymbols?: string
}> = ({ tickLower, tickUpper, poolInfo, onDataReady, poolId, pairSymbols }) => {
  // Memoize debugMeta to prevent infinite re-renders caused by creating new object on every render
  const debugMeta = useMemo(() => ({ poolId, pairSymbols }), [poolId, pairSymbols])

  const data = usePriceRangeData({
    tickLower,
    tickUpper,
    baseIn: true,
    poolInfo,
    debugMeta,
  })

  useEffect(() => {
    onDataReady(data)
  }, [data, onDataReady])

  return null
}

function usePositionData({ position, poolLength }: { position: UnifiedPositionDetail; poolLength?: number }) {
  const chainId = getPositionChainId(position)
  const isSolanaPosition = isSolana(chainId)
  const { address } = useAccount()

  // Pool ID resolution (needed early for usePoolById)
  const infinityPoolId = useMemo(() => {
    if (position.protocol === Protocol.InfinityCLAMM || position.protocol === Protocol.InfinityBIN) {
      const infinityPos = position as InfinityCLPositionDetail | InfinityBinPositionDetail
      if (infinityPos.poolKey) {
        return getPoolId(infinityPos.poolKey)
      }
      if ('poolId' in infinityPos && infinityPos.poolId) {
        return infinityPos.poolId
      }
    }
    return undefined
  }, [position])

  // Use usePoolById for Infinity positions (works for both CL and BIN)
  const [, infinityCLPool] = usePoolById<'CL'>(
    position.protocol === Protocol.InfinityCLAMM ? (infinityPoolId as `0x${string}`) : undefined,
    chainId,
  )
  const [, infinityBinPool] = usePoolById<'Bin'>(
    position.protocol === Protocol.InfinityBIN ? (infinityPoolId as `0x${string}`) : undefined,
    chainId,
  )

  // Use usePoolInfo for Infinity pools to get tokens in on-chain order (not re-sorted)
  // This is needed because usePoolById's getBinPoolWithCache/getClPoolWithCache calls sortCurrencies which
  // can reorder native tokens differently than on-chain, causing price inversion
  const infinityBinPoolInfo = usePoolInfo({
    poolAddress: position.protocol === Protocol.InfinityBIN ? infinityPoolId : undefined,
    chainId: position.protocol === Protocol.InfinityBIN ? chainId : undefined,
  })
  const infinityCLPoolInfo = usePoolInfo({
    poolAddress: position.protocol === Protocol.InfinityCLAMM ? infinityPoolId : undefined,
    chainId: position.protocol === Protocol.InfinityCLAMM ? chainId : undefined,
  })

  // Only use useExtraInfinityPositionInfo for CL positions (it doesn't work for BIN)
  const infinityInfo = useExtraInfinityPositionInfo(
    position.protocol === Protocol.InfinityCLAMM ? (position as InfinityCLPositionDetail) : undefined,
  )
  const v3Info = useExtraV3PositionInfo(
    position.protocol === Protocol.V3 && !isSolanaPosition ? (position as PositionDetail) : undefined,
  )

  // Solana V3 pool data
  const solanaPoolId =
    isSolanaPosition && 'poolId' in position ? (position as SolanaV3PositionDetail).poolId.toBase58() : undefined
  const solanaPoolInfo = useSolanaV3Pool(solanaPoolId)

  // Currency resolution
  const currency0 = useMemo(() => {
    // Infinity CL - prefer poolInfo tokens (on-chain order) over hook/pool tokens (re-sorted)
    if (position.protocol === Protocol.InfinityCLAMM) {
      return infinityCLPoolInfo?.token0 || infinityInfo.currency0 || infinityCLPool?.token0
    }
    // Infinity BIN - prefer poolInfo tokens (on-chain order) over binPool tokens (re-sorted)
    if (position.protocol === Protocol.InfinityBIN) {
      return infinityBinPoolInfo?.token0 || infinityBinPool?.token0
    }
    if (v3Info.currency0) return v3Info.currency0
    if (isSolanaPosition && solanaPoolInfo?.mintA) {
      return convertRawTokenInfoIntoSPLToken(solanaPoolInfo.mintA as TokenInfo)
    }
    if (position.protocol === Protocol.V2 && 'pair' in position) {
      return unwrappedToken((position as V2LPDetail).pair.token0)
    }
    if (
      (position.protocol === Protocol.STABLE || position.protocol === Protocol.InfinitySTABLE) &&
      'pair' in position
    ) {
      return (position as StableLPDetail).pair.token0
    }
    return undefined
  }, [
    infinityInfo.currency0,
    infinityCLPool,
    infinityCLPoolInfo,
    infinityBinPool,
    infinityBinPoolInfo,
    v3Info.currency0,
    position,
    isSolanaPosition,
    solanaPoolInfo,
  ])

  const currency1 = useMemo(() => {
    // Infinity CL - prefer poolInfo tokens (on-chain order) over hook/pool tokens (re-sorted)
    if (position.protocol === Protocol.InfinityCLAMM) {
      return infinityCLPoolInfo?.token1 || infinityInfo.currency1 || infinityCLPool?.token1
    }
    // Infinity BIN - prefer poolInfo tokens (on-chain order) over binPool tokens (re-sorted)
    if (position.protocol === Protocol.InfinityBIN) {
      return infinityBinPoolInfo?.token1 || infinityBinPool?.token1
    }
    if (v3Info.currency1) return v3Info.currency1
    if (isSolanaPosition && solanaPoolInfo?.mintB) {
      return convertRawTokenInfoIntoSPLToken(solanaPoolInfo.mintB as TokenInfo)
    }
    if (position.protocol === Protocol.V2 && 'pair' in position) {
      return unwrappedToken((position as V2LPDetail).pair.token1)
    }
    if (
      (position.protocol === Protocol.STABLE || position.protocol === Protocol.InfinitySTABLE) &&
      'pair' in position
    ) {
      return (position as StableLPDetail).pair.token1
    }
    return undefined
  }, [
    infinityInfo.currency1,
    infinityCLPool,
    infinityCLPoolInfo,
    infinityBinPool,
    infinityBinPoolInfo,
    v3Info.currency1,
    position,
    isSolanaPosition,
    solanaPoolInfo,
  ])

  // Position status
  const removed = useMemo(() => {
    // Infinity CL
    if (position.protocol === Protocol.InfinityCLAMM && infinityInfo.removed) return true
    // Infinity BIN - check if reserveX and reserveY are both 0 or undefined
    if (position.protocol === Protocol.InfinityBIN) {
      const binPos = position as InfinityBinPositionDetail
      const hasLiquidity =
        (binPos.reserveX && BigInt(binPos.reserveX) > 0n) || (binPos.reserveY && BigInt(binPos.reserveY) > 0n)
      return !hasLiquidity
    }
    if (v3Info.removed) return true
    if (isSolanaPosition && 'liquidity' in position) {
      return (position as SolanaV3PositionDetail).liquidity.isZero()
    }
    return false
  }, [infinityInfo.removed, v3Info.removed, isSolanaPosition, position])

  const outOfRange = infinityInfo.outOfRange || v3Info.outOfRange || false

  // Pool ID resolution (non-infinity pools)
  const poolId = useMemo(() => {
    // Infinity pools already handled by infinityPoolId
    if (position.protocol === Protocol.InfinityCLAMM || position.protocol === Protocol.InfinityBIN) {
      return infinityPoolId
    }
    // V3 EVM positions - calculate pool address from token addresses and fee
    if (
      position.protocol === Protocol.V3 &&
      !isSolanaPosition &&
      'token0' in position &&
      'token1' in position &&
      'fee' in position
    ) {
      const v3Pos = position as PositionDetail
      return getPoolAddressByToken(chainId, v3Pos.token0, v3Pos.token1, v3Pos.fee)
    }
    if (position.protocol === Protocol.V2 && 'pair' in position) {
      return (position as V2LPDetail).pair.liquidityToken.address
    }
    if (
      (position.protocol === Protocol.STABLE || position.protocol === Protocol.InfinitySTABLE) &&
      'pair' in position
    ) {
      return (position as StableLPDetail).pair.stableSwapAddress
    }
    return undefined
  }, [position, isSolanaPosition, chainId, infinityPoolId])

  // Pool info (EVM only - Solana uses solanaPoolInfo)
  const evmPoolInfo = usePoolInfo({
    poolAddress: isSolanaPosition ? undefined : poolId,
    chainId: isSolanaPosition ? undefined : chainId,
  })

  // Build Solana V3 pool object
  const solanaPool = useMemo((): SolanaV3PoolInfo | undefined => {
    if (!isSolanaPosition || !currency0 || !currency1 || !solanaPoolInfo) {
      return undefined
    }
    const solanaPos = position as SolanaV3PositionDetail
    return {
      pid: 0,
      nftMint: solanaPos.nftMint,
      lpAddress: undefined as unknown as typeof ZERO_ADDRESS, // Use poolId for URL instead
      protocol: Protocol.V3,
      token0: currency0,
      token1: currency1,
      feeTier: Math.round(solanaPoolInfo.feeRate * SOLANA_FEE_TIER_BASE),
      feeTierBase: SOLANA_FEE_TIER_BASE,
      isFarming: solanaPoolInfo.isFarming ?? false,
      poolId: solanaPos.poolId.toBase58(),
      liquidity: BigInt(solanaPos.liquidity.toString()),
      chainId: NonEVMChainId.SOLANA,
      tvlUsd: solanaPoolInfo.tvl.toString() as `${number}`,
      rawPool: solanaPoolInfo,
    }
  }, [isSolanaPosition, currency0, currency1, solanaPoolInfo, position])

  // Build EVM V3 pool object with tokens (usePoolInfo may not have token0/token1 populated)
  const evmV3Pool = useMemo((): PoolInfo | undefined => {
    if (isSolanaPosition || position.protocol !== Protocol.V3) return undefined
    if (!currency0 || !currency1 || !poolId) return undefined

    const v3Pos = position as PositionDetail
    // If evmPoolInfo exists and has tokens, use it; otherwise build minimal pool
    if (evmPoolInfo && evmPoolInfo.token0 && evmPoolInfo.token1) {
      return evmPoolInfo as PoolInfo
    }
    return {
      chainId,
      lpAddress: poolId,
      token0: currency0,
      token1: currency1,
      protocol: Protocol.V3,
      feeTier: v3Pos.fee,
      pid: evmPoolInfo?.pid,
    } as PoolInfo
  }, [isSolanaPosition, position, currency0, currency1, poolId, chainId, evmPoolInfo])

  // Unified pool
  const pool = useMemo(() => {
    if (isSolanaPosition) return solanaPool
    if (position.protocol === Protocol.V3) return evmV3Pool
    return evmPoolInfo
  }, [isSolanaPosition, position.protocol, solanaPool, evmV3Pool, evmPoolInfo])

  const hookData = useHookByPoolId(
    chainId,
    isInfinityProtocol(position.protocol) ? (pool as InfinityPoolInfo)?.poolId : undefined,
  )

  // Fetch fresh on-chain position data for InfinityBIN to get accurate liquidity values
  const { data: freshBinPosition } = useInfinityBinPosition(
    position.protocol === Protocol.InfinityBIN ? infinityPoolId : undefined,
    chainId,
    address,
  )

  // Amounts
  const amount0 = useMemo(() => {
    // Infinity CL - from hook
    if (position.protocol === Protocol.InfinityCLAMM && infinityInfo.amount0) {
      return infinityInfo.amount0
    }
    // Infinity BIN - from reserveX - use ?? 0n fallback like liquidity view page
    if (position.protocol === Protocol.InfinityBIN && infinityBinPool?.token0) {
      const binPos = position as InfinityBinPositionDetail
      return CurrencyAmount.fromRawAmount(infinityBinPool.token0, freshBinPosition?.reserveX ?? binPos.reserveX ?? 0n)
    }
    if (v3Info.position?.amount0) return v3Info.position.amount0
    if (position.protocol === Protocol.V2 && 'nativeDeposited0' in position) {
      const v2Pos = position as V2LPDetail
      return v2Pos.nativeDeposited0.add(v2Pos.farmingDeposited0)
    }
    if (
      (position.protocol === Protocol.STABLE || position.protocol === Protocol.InfinitySTABLE) &&
      'nativeDeposited0' in position
    ) {
      const stablePos = position as StableLPDetail
      return stablePos.nativeDeposited0.add(stablePos.farmingDeposited0)
    }
    return undefined
  }, [infinityInfo.amount0, infinityBinPool, freshBinPosition, v3Info.position?.amount0, position])

  const amount1 = useMemo(() => {
    // Infinity CL - from hook
    if (position.protocol === Protocol.InfinityCLAMM && infinityInfo.amount1) {
      return infinityInfo.amount1
    }
    // Infinity BIN - from reserveY - use ?? 0n fallback like liquidity view page
    if (position.protocol === Protocol.InfinityBIN && infinityBinPool?.token1) {
      const binPos = position as InfinityBinPositionDetail
      return CurrencyAmount.fromRawAmount(infinityBinPool.token1, freshBinPosition?.reserveY ?? binPos.reserveY ?? 0n)
    }
    if (v3Info.position?.amount1) return v3Info.position.amount1
    if (position.protocol === Protocol.V2 && 'nativeDeposited1' in position) {
      const v2Pos = position as V2LPDetail
      return v2Pos.nativeDeposited1.add(v2Pos.farmingDeposited1)
    }
    if (
      (position.protocol === Protocol.STABLE || position.protocol === Protocol.InfinitySTABLE) &&
      'nativeDeposited1' in position
    ) {
      const stablePos = position as StableLPDetail
      return stablePos.nativeDeposited1.add(stablePos.farmingDeposited1)
    }
    return undefined
  }, [infinityInfo.amount1, infinityBinPool, freshBinPosition, v3Info.position?.amount1, position])

  // Use unified token price hooks for both EVM and Solana
  const { data: currency0Price } = useUnifiedTokenUsdPrice(currency0, Boolean(currency0))
  const { data: currency1Price } = useUnifiedTokenUsdPrice(currency1, Boolean(currency1))

  const totalPriceUSD = useMemo(() => {
    return BN(currency0Price ?? 0)
      .times(amount0?.toExact() ?? 0)
      .plus(BN(currency1Price ?? 0).times(amount1?.toExact() ?? 0))
      .toNumber()
  }, [currency0Price, currency1Price, amount0, amount1])

  // Earnings calculation per protocol
  // Infinity CL earnings
  const infinityCLEarnings = useUnclaimedFarmRewardsUSDByTokenId({
    chainId: position.protocol === Protocol.InfinityCLAMM ? chainId : undefined,
    tokenId:
      position.protocol === Protocol.InfinityCLAMM && 'tokenId' in position
        ? (position as InfinityCLPositionDetail).tokenId
        : undefined,
    poolId: position.protocol === Protocol.InfinityCLAMM ? infinityPoolId : undefined,
    address,
    timestamp: dayjs().startOf('hour').unix(),
  })

  const infinityCLFees = useFeesEarnedUSD({
    currency0: position.protocol === Protocol.InfinityCLAMM ? (currency0 as Currency | undefined) : undefined,
    currency1: position.protocol === Protocol.InfinityCLAMM ? (currency1 as Currency | undefined) : undefined,
    tokenId:
      position.protocol === Protocol.InfinityCLAMM && 'tokenId' in position
        ? (position as InfinityCLPositionDetail).tokenId
        : undefined,
    poolId: position.protocol === Protocol.InfinityCLAMM ? infinityPoolId : undefined,
    tickLower:
      position.protocol === Protocol.InfinityCLAMM && 'tickLower' in position
        ? (position as InfinityCLPositionDetail).tickLower
        : undefined,
    tickUpper:
      position.protocol === Protocol.InfinityCLAMM && 'tickUpper' in position
        ? (position as InfinityCLPositionDetail).tickUpper
        : undefined,
    enabled: position.protocol === Protocol.InfinityCLAMM && !removed,
  })

  // Infinity BIN earnings
  const infinityBinEarnings = useUnclaimedFarmRewardsUSDByPoolId({
    chainId: position.protocol === Protocol.InfinityBIN ? chainId : undefined,
    poolId: position.protocol === Protocol.InfinityBIN ? infinityPoolId : undefined,
    address,
    timestamp: dayjs().startOf('hour').unix(),
  })

  // V3 earnings
  const isEVMV3 = position.protocol === Protocol.V3 && !isSolanaPosition
  const tokenIds = useMemo(() => (isEVMV3 && 'tokenId' in position ? [position.tokenId] : []), [isEVMV3, position])
  const v3Earnings = useV3CakeEarning(
    tokenIds,
    chainId,
    // Always pass chainId, hook will handle empty tokenIds array
  )

  // V3 LP fees
  const poolForFees = isEVMV3 ? v3Info.pool ?? evmV3Pool : undefined
  const [feeValue0, feeValue1] = useV3PositionFees(
    poolForFees as any,
    isEVMV3 && 'tokenId' in position ? (position as PositionDetail).tokenId : undefined,
    false,
    isEVMV3 && !removed,
  )

  // Get price in USD for V3 fees calculation
  const evmCurrency0 = currency0 as unknown as Currency
  const evmCurrency1 = currency1 as unknown as Currency
  const { data: price0Usd } = useCurrencyUsdPrice(evmCurrency0, {
    enabled: Boolean(evmCurrency0 && (position.protocol === Protocol.V3 || isInfinityProtocol(position.protocol))),
  })
  const { data: price1Usd } = useCurrencyUsdPrice(evmCurrency1, {
    enabled: Boolean(evmCurrency1 && (position.protocol === Protocol.V3 || isInfinityProtocol(position.protocol))),
  })

  // Solana V3 earnings
  const isSolanaV3 = isSolanaPosition && position.protocol === Protocol.V3 && 'poolId' in position
  // We must call hooks unconditionally
  const solanaRewardInfo = useSolanaV3RewardInfoFromSimulation({
    poolInfo: isSolanaV3 && solanaPool ? (solanaPool as SolanaV3PoolInfo) : undefined,
    position: isSolanaV3 ? (position as SolanaV3PositionDetail) : ({} as SolanaV3PositionDetail),
  })

  // Calculate earnings display
  const earnings = useMemo(() => {
    // V2/Stable - no earnings
    if (
      position.protocol === Protocol.V2 ||
      position.protocol === Protocol.STABLE ||
      position.protocol === Protocol.InfinitySTABLE
    ) {
      return null
    }

    // Solana V3
    if (isSolanaPosition && position.protocol === Protocol.V3) {
      const totalUSD = solanaRewardInfo.totalPendingYield ? solanaRewardInfo.totalPendingYield.toNumber() : 0
      const display = totalUSD > 0 ? `~${formatDollarAmount(totalUSD)}` : '-'
      return { display }
    }

    // Infinity CL
    if (position.protocol === Protocol.InfinityCLAMM) {
      const fee0Amount = infinityCLFees.feeAmount0 ? BN(infinityCLFees.feeAmount0.toExact()).toNumber() : 0
      const fee1Amount = infinityCLFees.feeAmount1 ? BN(infinityCLFees.feeAmount1.toExact()).toNumber() : 0
      const fee0USD = fee0Amount > 0 && price0Usd != null ? BN(fee0Amount).times(price0Usd).toNumber() : 0
      const fee1USD = fee1Amount > 0 && price1Usd != null ? BN(fee1Amount).times(price1Usd).toNumber() : 0
      const lpFeesUSD = fee0USD + fee1USD
      const farmRewardsUSD =
        infinityCLEarnings.data?.rewardsUSD && infinityCLEarnings.data.rewardsUSD > 0
          ? infinityCLEarnings.data.rewardsUSD
          : 0
      const totalUSD = lpFeesUSD + farmRewardsUSD
      const display = totalUSD > 0 ? `~${formatDollarAmount(totalUSD)}` : '$0'
      return { display }
    }

    // Infinity BIN
    if (position.protocol === Protocol.InfinityBIN) {
      const usd =
        typeof infinityBinEarnings.data?.rewardsUSD === 'number' && infinityBinEarnings.data.rewardsUSD > 0
          ? infinityBinEarnings.data.rewardsUSD
          : null
      const display = usd ? `~${formatDollarAmount(usd)}` : '$0'
      return { display }
    }

    // V3 EVM
    if (position.protocol === Protocol.V3) {
      const fee0Amount = feeValue0 ? BN(feeValue0.toExact()).toNumber() : 0
      const fee1Amount = feeValue1 ? BN(feeValue1.toExact()).toNumber() : 0
      const fee0USD = price0Usd && feeValue0 ? BN(fee0Amount).times(price0Usd).toNumber() : 0
      const fee1USD = price1Usd && feeValue1 ? BN(fee1Amount).times(price1Usd).toNumber() : 0
      const lpFeesUSD = fee0USD + fee1USD
      const totalUSD = (v3Earnings.earningsBusd || 0) + lpFeesUSD
      const display = totalUSD > 0 ? `~${formatDollarAmount(totalUSD)}` : '$0'
      return { display }
    }

    return null
  }, [
    position.protocol,
    isSolanaPosition,
    solanaRewardInfo,
    infinityCLEarnings,
    infinityCLFees,
    infinityBinEarnings,
    v3Earnings,
    feeValue0,
    feeValue1,
    price0Usd,
    price1Usd,
  ])

  // Link to detail page
  const link = useMemo(() => {
    if (position.protocol === Protocol.InfinityCLAMM || position.protocol === Protocol.InfinityBIN) {
      return getLiquidityDetailURL({
        chainId,
        tokenId: 'tokenId' in position ? Number(position.tokenId) : undefined,
        poolId,
        protocol: position.protocol,
      })
    }
    if (position.protocol === Protocol.V3) {
      if (isSolanaPosition && solanaPool) {
        const solanaPos = position as SolanaV3PositionDetail
        return `/liquidity/position/v3/solana/${solanaPool.poolId}/${solanaPos.nftMint.toBase58()}`
      }
      if ('tokenId' in position) {
        return `/liquidity/${position.tokenId}`
      }
    }
    return undefined
  }, [position, poolId, chainId, isSolanaPosition, solanaPool])

  // Type guards
  const isInfinityPool = (
    p: PoolInfo | InfinityPoolInfo | SolanaV3PoolInfo | null | undefined,
  ): p is InfinityPoolInfo => {
    return (
      p !== null &&
      p !== undefined &&
      'poolId' in p &&
      (p.protocol === Protocol.InfinityBIN || p.protocol === Protocol.InfinityCLAMM)
    )
  }

  const isV2OrStablePool = (p: PoolInfo | null | undefined): p is V2PoolInfo | StablePoolInfo => {
    return (
      p !== null &&
      p !== undefined &&
      (p.protocol === Protocol.V2 || p.protocol === Protocol.STABLE || p.protocol === Protocol.InfinitySTABLE)
    )
  }

  const infinityPool = isInfinityPool(pool) ? pool : null
  const v2OrStablePool = isV2OrStablePool(pool as PoolInfo) ? (pool as V2PoolInfo | StablePoolInfo) : null

  // APR button
  const aprButton = useMemo(() => {
    if (!pool) return null

    // Solana V3
    if (position.protocol === Protocol.V3 && isSolanaPosition) {
      return (
        <SolanaV3PoolPositionAprButton
          pool={pool as SolanaV3PoolInfo}
          userPosition={position as SolanaV3PositionDetail}
          textProps={{ bold: true }}
        />
      )
    }

    // EVM V3
    if (position.protocol === Protocol.V3) {
      return <V3PoolPositionAprButton pool={pool as PoolInfo} userPosition={position as PositionDetail} />
    }

    if (position.protocol === Protocol.InfinityCLAMM && infinityPool) {
      return <InfinityCLPoolPositionAprButton pool={infinityPool} userPosition={position as InfinityCLPositionDetail} />
    }

    if (position.protocol === Protocol.InfinityBIN && infinityPool) {
      return (
        <InfinityBinPoolPositionAprButton pool={infinityPool} userPosition={position as InfinityBinPositionDetail} />
      )
    }

    if ((position.protocol === Protocol.V2 || position.protocol === Protocol.STABLE) && v2OrStablePool) {
      return <V2PoolPositionAprButton pool={v2OrStablePool} userPosition={position as V2LPDetail | StableLPDetail} />
    }

    return <PoolGlobalAprButton pool={pool as PoolInfo} />
  }, [pool, position, isSolanaPosition, infinityPool, v2OrStablePool])

  // Staking status
  const isStaked = useMemo(() => {
    if ('isStaked' in position) return position.isStaked
    if (isSolanaPosition && solanaPoolInfo?.isFarming) return true
    return false
  }, [position, isSolanaPosition, solanaPoolInfo])

  // Farm live status
  const isFarmLive = useMemo(() => {
    if (isSolanaPosition && solanaPoolInfo?.isFarming) return true
    if (pool && 'pid' in pool && pool.pid !== undefined) {
      return !poolLength || pool.pid <= poolLength
    }
    return false
  }, [isSolanaPosition, solanaPoolInfo, pool, poolLength])

  // Fee tier
  const feeTier = useMemo(() => {
    if (position.protocol === Protocol.V2) return V2_FEE_TIER
    if (
      (position.protocol === Protocol.STABLE || position.protocol === Protocol.InfinitySTABLE) &&
      'pair' in position
    ) {
      return Number((position as StableLPDetail).pair.stableTotalFee ?? 0) * V2_FEE_TIER_BASE
    }
    if (isSolanaPosition && solanaPoolInfo?.feeRate) {
      return Math.round(solanaPoolInfo.feeRate * SOLANA_FEE_TIER_BASE)
    }
    return undefined
  }, [position, isSolanaPosition, solanaPoolInfo])

  const feeTierBase = useMemo(() => {
    if (
      position.protocol === Protocol.V2 ||
      position.protocol === Protocol.STABLE ||
      position.protocol === Protocol.InfinitySTABLE
    )
      return V2_FEE_TIER_BASE
    if (isSolanaPosition) return SOLANA_FEE_TIER_BASE
    return undefined
  }, [position.protocol, isSolanaPosition])

  // Price range display calculation (Solana handled separately in component)
  const priceRangeDisplay = useMemo(() => {
    // V2/Stable - full range, no price range
    if (
      position.protocol === Protocol.V2 ||
      position.protocol === Protocol.STABLE ||
      position.protocol === Protocol.InfinitySTABLE
    ) {
      return null
    }

    // Solana V3 - handled separately in component to avoid calling hook with undefined poolInfo
    if (isSolanaPosition && position.protocol === Protocol.V3) {
      return null // Will be handled by SolanaPriceRangeHook component
    }

    // Infinity CL - tick-based
    if (position.protocol === Protocol.InfinityCLAMM) {
      const clPos = position as InfinityCLPositionDetail
      const poolForCalc = infinityCLPool || infinityInfo.pool
      if (!poolForCalc || clPos.tickLower === undefined || clPos.tickUpper === undefined) return null
      if (!currency0 || !currency1) return null

      const ticksLimit = calculateTickLimits(clPos.tickSpacing)
      const isTickAtLimit = getTickAtLimitStatus(clPos.tickLower, clPos.tickUpper, ticksLimit)

      const isFlipped = Boolean(
        currency0?.wrapped?.address &&
          poolForCalc.token1?.address &&
          currency0.wrapped.address.toLowerCase() === poolForCalc.token1.address.toLowerCase(),
      )

      return calculateTickBasedPriceRange(
        clPos.tickLower,
        clPos.tickUpper,
        currency0,
        currency1,
        poolForCalc,
        isTickAtLimit,
        isFlipped,
      )
    }

    // Infinity BIN - bin-based
    if (position.protocol === Protocol.InfinityBIN) {
      const binPos = position as InfinityBinPositionDetail
      const binStep = infinityBinPool?.binStep
      const activeId = infinityBinPool?.activeId

      if (
        binStep === null ||
        binStep === undefined ||
        activeId === null ||
        activeId === undefined ||
        binPos.minBinId === null ||
        binPos.minBinId === undefined ||
        binPos.maxBinId === null ||
        binPos.maxBinId === undefined
      )
        return null
      if (!currency0 || !currency1) return null

      return calculateBinBasedPriceRange(binPos.minBinId, binPos.maxBinId, binStep, activeId, currency0, currency1)
    }

    // EVM V3
    if (position.protocol === Protocol.V3 && !isSolanaPosition) {
      const v3Pos = position as PositionDetail
      const poolForCalc = v3Info.pool
      if (!poolForCalc || v3Pos.tickLower === undefined || v3Pos.tickUpper === undefined) return null
      if (!currency0 || !currency1) return null

      const tickSpacing = getTickSpacing(poolForCalc, v3Pos.fee)
      const ticksLimit = calculateTickLimits(tickSpacing)
      const isTickAtLimit = getTickAtLimitStatus(v3Pos.tickLower, v3Pos.tickUpper, ticksLimit)

      const isFlipped = Boolean(
        currency0?.wrapped?.address &&
          poolForCalc.token1?.address &&
          currency0.wrapped.address.toLowerCase() === poolForCalc.token1.address.toLowerCase(),
      )

      return calculateTickBasedPriceRange(
        v3Pos.tickLower,
        v3Pos.tickUpper,
        currency0?.wrapped,
        currency1?.wrapped,
        poolForCalc,
        isTickAtLimit,
        isFlipped,
      )
    }

    return null
  }, [
    position,
    isSolanaPosition,
    infinityCLPool,
    infinityInfo.pool,
    infinityBinPool,
    v3Info.pool,
    currency0,
    currency1,
  ])

  return {
    currency0,
    currency1,
    removed,
    outOfRange,
    pool,
    totalPriceUSD,
    aprButton,
    link,
    hookData,
    chainId,
    feeTier,
    feeTierBase,
    amount0,
    amount1,
    isStaked,
    isFarmLive,
    priceRangeDisplay,
    earnings,
  }
}
