import { Protocol } from '@pancakeswap/farms'
import { getPoolId } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { UnifiedCurrency } from '@pancakeswap/sdk'
import { Currency, CurrencyAmount, UnifiedCurrencyAmount } from '@pancakeswap/swap-sdk-core'
import {
  AddIcon,
  Box,
  Button,
  Flex,
  FlexGap,
  MinusIcon,
  OpenNewIcon,
  Skeleton,
  SwapVertIcon,
  Text,
  useModalV2,
} from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { displayApr } from '@pancakeswap/utils/displayApr'
import { CurrencyLogo } from 'components/Logo'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { getPoolAddLiquidityLink, getPoolDetailPageLink } from 'utils/getPoolLink'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { usePoolByChainId } from 'hooks/v3/usePools'
import { useMemo, useState, memo, useCallback } from 'react'
import { useExtraInfinityPositionInfo, useExtraV3PositionInfo } from 'state/farmsV4/hooks'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  PositionDetail,
  UnifiedPositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import type { PoolInfo, UnifiedPoolInfo } from 'state/farmsV4/state/type'
import styled from 'styled-components'
import { isInfinityProtocol } from 'utils/protocols'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import {
  calculateTickBasedPriceRange,
  calculateTickLimits,
  getTickAtLimitStatus,
  getTickSpacing,
} from 'views/PoolDetail/utils'
import { BigNumber as BN } from 'bignumber.js'
import { isSolana } from '@pancakeswap/chains'
import { useQuery } from '@tanstack/react-query'
import { PositionModal } from 'components/PositionModals'
import { PositionTabType } from 'components/PositionModals/types'
import { getPositionChainId } from '../../utils'
import { PositionChartByProtocol } from './charts'
import { PositionActionButtons } from './PositionActionButtons'

type FarmRewardInfo = {
  amount: number
  amountUSD: number
  currency: UnifiedCurrency
}

type EarningsBreakdown = {
  fee0Amount?: number
  fee1Amount?: number
  fee0USD?: number
  fee1USD?: number
  // Legacy single reward (for backward compatibility)
  farmRewardsAmount?: number
  farmRewardsUSD?: number
  rewardCurrency?: UnifiedCurrency
  // New: support multiple reward tokens
  farmRewards?: FarmRewardInfo[]
}

type ExpandedRowContentProps = {
  position: UnifiedPositionDetail
  pool?: UnifiedPoolInfo | null
  currency0?: UnifiedCurrency
  currency1?: UnifiedCurrency
  amount0?: CurrencyAmount<Currency> | UnifiedCurrencyAmount<UnifiedCurrency> | undefined
  amount1?: CurrencyAmount<Currency> | UnifiedCurrencyAmount<UnifiedCurrency> | undefined
  earnings?: { display: string } | null
  earningsBreakdown?: EarningsBreakdown
  totalLiquidityUSD?: number
  lpApr?: number
  merklApr?: number
  incentraApr?: number
  farmApr?: number
  totalApr?: number
  price0Usd?: number
  price1Usd?: number
  /** Current price from parent (for Solana positions) */
  currentPrice?: number
  onAddLiquidity?: () => void
  onRemoveLiquidity?: () => void
  onHarvest?: () => void
  onViewDetails?: () => void
  /** Whether the price display is inverted (controlled by parent) */
  inverted?: boolean
  /** Callback to toggle inverted state (controlled by parent) */
  onToggleInverted?: () => void
  /** Whether the pool has an active farm (from parent calculation) */
  hasFarm?: boolean
  /** V3 SDK Pool for cross-chain fee fetching */
  v3SdkPool?: any
}

const Container = styled(Box)`
  padding: 16px 24px;
  background: ${({ theme }) => theme.card.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.cardBorder};
`

const MainContent = styled(Flex)`
  gap: 6px;
  flex-wrap: wrap;
`

const Column = styled(Box)<{ $hasBorder?: boolean; $flex?: string; $minWidth?: string }>`
  padding: 16px;
  border-right: ${({ $hasBorder, theme }) => ($hasBorder ? `1px solid ${theme.colors.cardBorder}` : 'none')};
  flex: ${({ $flex }) => $flex || 'none'};
  min-width: ${({ $minWidth }) => $minWidth || 'auto'};
`

const ColumnHeader = styled(Text)`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 8px;
`

const SectionLabel = styled(Text)`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSubtle};
  letter-spacing: 0.12px;
  margin-bottom: 4px;
`

const TokenRow = styled(Flex)`
  gap: 8px;
  align-items: flex-start;
`

const TokenValue = styled(Text)`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  letter-spacing: 0.12px;
`

const TokenUsdValue = styled(Text)`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSubtle};
  letter-spacing: 0.12px;
`

const AprLabel = styled(Text)`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textSubtle};
  letter-spacing: 0.12px;
`

const AprValue = styled(Text)`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  letter-spacing: 0.12px;
`

const CurrentPriceLabel = styled(Text)`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.secondary};
  letter-spacing: 0.24px;
  text-transform: uppercase;
`

const CurrentPriceValue = styled(Text)`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  letter-spacing: 0.12px;
`

const CurrentPriceUnit = styled(Text)`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary60};
  letter-spacing: 0.12px;
  margin-left: 4px;
`

const ActionButtonsContainer = styled(Flex)`
  gap: 8px;
  justify-content: flex-end;
  margin-top: 26px;
`

const NoPriceRangeMessage = styled(Box)`
  background: ${({ theme }) => theme.colors.secondary10};
  border: 1px solid ${({ theme }) => theme.colors.secondary};
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: fit-content;
  margin-left: auto;
`

const NoPriceRangeText = styled(Text)`
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
`

export const ExpandedRowContent: React.FC<ExpandedRowContentProps> = memo(
  ({
    position,
    pool,
    currency0: propCurrency0,
    currency1: propCurrency1,
    amount0: propAmount0,
    amount1: propAmount1,
    earnings: propEarnings,
    earningsBreakdown: propEarningsBreakdown,
    totalLiquidityUSD = 0,
    lpApr = 0,
    merklApr = 0,
    incentraApr = 0,
    farmApr = 0,
    totalApr = 0,
    price0Usd: propPrice0Usd,
    price1Usd: propPrice1Usd,
    currentPrice: propCurrentPrice,
    onAddLiquidity: _onAddLiquidity,
    onRemoveLiquidity: _onRemoveLiquidity,
    onHarvest: _onHarvest,
    onViewDetails: _onViewDetails,
    inverted: propInverted,
    onToggleInverted: propOnToggleInverted,
    hasFarm: propHasFarm,
    v3SdkPool,
  }) => {
    const { t } = useTranslation()

    // Use props if provided (controlled mode), otherwise use local state (fallback)
    const [localInverted, setLocalInverted] = useState(false)
    const inverted = propInverted ?? localInverted
    const handleToggleInverted = useCallback(() => {
      if (propOnToggleInverted) {
        propOnToggleInverted()
      } else {
        setLocalInverted((prev) => !prev)
      }
    }, [propOnToggleInverted])

    const {
      currency0: hookCurrency0,
      currency1: hookCurrency1,
      currentPrice: hookCurrentPrice,
      chainId,
      poolId,
      tokenId,
      tickLower: _tickLower,
      tickUpper: _tickUpper,
      priceLower: hookPriceLower,
      priceUpper: hookPriceUpper,
      v3Pool,
      removed,
      outOfRange,
    } = useExpandedData(position)

    const currency0 = propCurrency0 ?? hookCurrency0
    const currency1 = propCurrency1 ?? hookCurrency1

    // Use currentPrice from props if available (for Solana positions), otherwise use hook value
    const currentPrice = propCurrentPrice !== undefined ? String(propCurrentPrice) : hookCurrentPrice

    // Use price data from props if available (avoid duplicate fetching), otherwise fetch
    const { data: fetchedPrice0Usd } = useCurrencyUsdPrice(propPrice0Usd !== undefined ? undefined : currency0)
    const { data: fetchedPrice1Usd } = useCurrencyUsdPrice(propPrice1Usd !== undefined ? undefined : currency1)
    const price0Usd = propPrice0Usd ?? fetchedPrice0Usd
    const price1Usd = propPrice1Usd ?? fetchedPrice1Usd

    const depositDisplay = useMemo(() => {
      if (propAmount0 && propAmount1 && currency0 && currency1) {
        return {
          amount0Str: propAmount0.toSignificant(6),
          amount1Str: propAmount1.toSignificant(6),
          amount0Usd: price0Usd ? BN(propAmount0.toExact()).times(price0Usd).toNumber() : 0,
          amount1Usd: price1Usd ? BN(propAmount1.toExact()).times(price1Usd).toNumber() : 0,
        }
      }
      return null
    }, [propAmount0, propAmount1, currency0, currency1, price0Usd, price1Usd])

    const showChart = useMemo(() => {
      return (
        position.protocol === Protocol.V3 ||
        position.protocol === Protocol.InfinityCLAMM ||
        position.protocol === Protocol.InfinityBIN
      )
    }, [position.protocol])

    const priceUnit = useMemo(() => {
      if (!currency0 || !currency1) return ''
      return inverted ? `${currency0.symbol} per ${currency1.symbol}` : `${currency1.symbol} per ${currency0.symbol}`
    }, [currency0, currency1, inverted])

    const displayCurrentPrice = useMemo(() => {
      if (!currentPrice) return '-'
      try {
        const priceBN = new BN(currentPrice)

        // Check for invalid values
        if (!priceBN.isFinite() || priceBN.isNaN()) {
          console.warn('[ExpandedRowContent] Invalid current price:', currentPrice)
          return '-'
        }

        // Invert if needed
        const finalPriceBN = inverted && priceBN.gt(0) ? new BN(1).div(priceBN) : priceBN

        // Check if result is valid
        if (!finalPriceBN.isFinite() || finalPriceBN.isNaN()) {
          console.warn('[ExpandedRowContent] Invalid computed price:', finalPriceBN.toString())
          return '-'
        }

        return formatNumber(finalPriceBN.toNumber(), { maxDecimalDisplayDigits: 6 })
      } catch (error) {
        console.error('[ExpandedRowContent] Error computing display price:', error, currentPrice)
        return '-'
      }
    }, [currentPrice, inverted])

    // APR data (passed from parent)
    // Use hasFarm from parent if provided (uses old logic with allocPoint check)
    // Otherwise fallback to pool flags (for non-V3 positions)
    const hasFarm =
      propHasFarm !== undefined
        ? propHasFarm
        : Boolean(pool?.isActiveFarm ?? pool?.isFarming) || (!pool && (farmApr ?? 0) > 0)

    const earningsDisplay = useMemo(() => {
      if (propEarningsBreakdown) {
        const total =
          (propEarningsBreakdown.fee0USD ?? 0) +
          (propEarningsBreakdown.fee1USD ?? 0) +
          (propEarningsBreakdown.farmRewardsUSD ?? 0)
        return {
          header: propEarnings?.display ?? (total > 0 ? formatDollarAmount(total) : '$0'),
          fee0Amount: propEarningsBreakdown.fee0Amount ?? 0,
          fee1Amount: propEarningsBreakdown.fee1Amount ?? 0,
          fee0USD: propEarningsBreakdown.fee0USD ?? 0,
          fee1USD: propEarningsBreakdown.fee1USD ?? 0,
          farmRewardsAmount: propEarningsBreakdown.farmRewardsAmount ?? 0,
          farmRewardsUSD: propEarningsBreakdown.farmRewardsUSD ?? 0,
          rewardCurrency: propEarningsBreakdown.rewardCurrency,
          farmRewards: propEarningsBreakdown.farmRewards,
        }
      }
      return null
    }, [propEarningsBreakdown, propEarnings])

    const earningsHeaderText = earningsDisplay?.header ?? '$0'

    const { data: poolDetailUrl } = useQuery({
      // Use serializable identifiers instead of the whole pool object to avoid BigInt serialization issues
      queryKey: ['poolDetailUrl', pool?.chainId, pool?.lpAddress ?? pool?.poolId, pool?.protocol],
      queryFn: () => {
        if (!pool) return undefined
        return getPoolDetailPageLink(pool)
      },
    })

    const addLiquidityUrl = useMemo(() => {
      if (!pool || !('token0' in pool && pool.token0)) return undefined
      try {
        return getPoolAddLiquidityLink(pool as PoolInfo)
      } catch {
        return undefined
      }
    }, [pool])

    const showPriceRange =
      position.protocol !== Protocol.V2 &&
      position.protocol !== Protocol.STABLE &&
      position.protocol !== Protocol.InfinitySTABLE

    // Hide hardcoded plus/minus buttons for Solana V3 positions (they have their own action buttons)
    const isSolanaV3Position = position.protocol === Protocol.V3 && isSolana(chainId)
    // Prefer pool.protocol; when pool is missing from farm config (e.g. Monad), use position.protocol so +/- still show
    const protocolForActions = pool?.protocol ?? position.protocol
    const isV2OrStablePosition =
      position.protocol === Protocol.V2 ||
      position.protocol === Protocol.STABLE ||
      position.protocol === Protocol.InfinitySTABLE

    const { isOpen, setIsOpen, onDismiss } = useModalV2()
    const [modalPresetTab, setModalPresetTab] = useState<PositionTabType>('Add')
    const openModal = useCallback(
      (tab: PositionTabType) => {
        setModalPresetTab(tab)
        setIsOpen(true)
      },
      [setIsOpen],
    )

    return (
      <Container>
        <MainContent>
          {/* Price Range & Current PriceColumn */}
          <Column $flex="1" $minWidth="240px" $hasBorder>
            {showPriceRange && (
              <>
                {showChart && (
                  <PositionChartByProtocol
                    protocol={position.protocol}
                    position={position}
                    currency0={currency0 as Currency}
                    currency1={currency1 as Currency}
                    chainId={chainId}
                    poolId={poolId}
                    inverted={inverted}
                    priceLower={hookPriceLower}
                    priceUpper={hookPriceUpper}
                  />
                )}

                <FlexGap flexDirection="column" gap="0px" mt="64px">
                  <CurrentPriceLabel>{t('Current Price')}</CurrentPriceLabel>
                  <Flex alignItems="center">
                    <CurrentPriceValue>{displayCurrentPrice}</CurrentPriceValue>
                    <CurrentPriceUnit>{priceUnit}</CurrentPriceUnit>
                    <Box
                      as="button"
                      ml="4px"
                      onClick={handleToggleInverted}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <SwapVertIcon color="primary60" width="18px" />
                    </Box>
                  </Flex>
                </FlexGap>
              </>
            )}
            {!showPriceRange && (
              <NoPriceRangeMessage>
                <NoPriceRangeText>{t('No price range for this pool.')}</NoPriceRangeText>
                <NoPriceRangeText>{t('Liquidity is spread evenly')}</NoPriceRangeText>
              </NoPriceRangeMessage>
            )}
          </Column>

          {/* Liquidity Column */}
          <Column $hasBorder $minWidth="150px">
            <ColumnHeader>${totalLiquidityUSD.toFixed(2)}</ColumnHeader>
            <FlexGap flexDirection="column" gap="4px">
              <SectionLabel>{t('Deposited Tokens:')}</SectionLabel>
              {depositDisplay ? (
                <FlexGap flexDirection="column" gap="4px">
                  <TokenRow>
                    {currency0 && <CurrencyLogo currency={currency0} size="16px" />}
                    <FlexGap flexDirection="column" gap="0px">
                      <TokenValue>
                        {formatNumber(BN(depositDisplay.amount0Str).toNumber(), {
                          maxDecimalDisplayDigits: 6,
                          maximumDecimalTrailingZeroes: 3,
                        })}{' '}
                        {currency0?.symbol}
                      </TokenValue>
                      <TokenUsdValue>~{formatDollarAmount(depositDisplay.amount0Usd)}</TokenUsdValue>
                    </FlexGap>
                  </TokenRow>
                  <TokenRow>
                    {currency1 && <CurrencyLogo currency={currency1} size="16px" />}
                    <FlexGap flexDirection="column" gap="0px">
                      <TokenValue>
                        {formatNumber(BN(depositDisplay.amount1Str).toNumber(), {
                          maxDecimalDisplayDigits: 6,
                          maximumDecimalTrailingZeroes: 3,
                        })}{' '}
                        {currency1?.symbol}
                      </TokenValue>
                      <TokenUsdValue>~{formatDollarAmount(depositDisplay.amount1Usd)}</TokenUsdValue>
                    </FlexGap>
                  </TokenRow>
                </FlexGap>
              ) : (
                <Skeleton height={68} />
              )}
            </FlexGap>
          </Column>

          {/* Earnings Column */}
          <Column $hasBorder $minWidth="130px">
            <ColumnHeader>{earningsHeaderText}</ColumnHeader>
            <FlexGap flexDirection="column" gap="12px">
              <FlexGap flexDirection="column" gap="4px">
                <SectionLabel>{t('LP Fees')}</SectionLabel>
                <FlexGap flexDirection="column" gap="4px">
                  <TokenRow>
                    {currency0 && <CurrencyLogo currency={currency0} size="16px" />}
                    <FlexGap flexDirection="column" gap="0px">
                      <TokenValue>
                        {earningsDisplay?.fee0Amount
                          ? formatNumber(earningsDisplay.fee0Amount, {
                              maxDecimalDisplayDigits: 6,
                              maximumDecimalTrailingZeroes: 3,
                            })
                          : '0'}{' '}
                        {currency0?.symbol}
                      </TokenValue>
                      <TokenUsdValue>~{formatDollarAmount(earningsDisplay?.fee0USD ?? 0)}</TokenUsdValue>
                    </FlexGap>
                  </TokenRow>
                  <TokenRow>
                    {currency1 && <CurrencyLogo currency={currency1} size="16px" />}
                    <FlexGap flexDirection="column" gap="0px">
                      <TokenValue>
                        {earningsDisplay?.fee1Amount
                          ? formatNumber(earningsDisplay.fee1Amount, {
                              maxDecimalDisplayDigits: 6,
                              maximumDecimalTrailingZeroes: 3,
                            })
                          : '0'}{' '}
                        {currency1?.symbol}
                      </TokenValue>
                      <TokenUsdValue>~{formatDollarAmount(earningsDisplay?.fee1USD ?? 0)}</TokenUsdValue>
                    </FlexGap>
                  </TokenRow>
                </FlexGap>
              </FlexGap>
              {earningsDisplay &&
                (earningsDisplay.farmRewards?.length || (earningsDisplay.farmRewardsAmount ?? 0) > 0) && (
                  <FlexGap flexDirection="column" gap="4px">
                    <SectionLabel>{t('Farm Rewards')}</SectionLabel>
                    <FlexGap flexDirection="column" gap="4px">
                      {earningsDisplay.farmRewards?.length
                        ? earningsDisplay.farmRewards.map((reward, idx) => (
                            <TokenRow key={idx}>
                              <CurrencyLogo currency={reward.currency} size="16px" />
                              <FlexGap flexDirection="column" gap="0px">
                                <TokenValue>
                                  {formatNumber(reward.amount, {
                                    maxDecimalDisplayDigits: 6,
                                    maximumDecimalTrailingZeroes: 3,
                                  })}{' '}
                                  {reward.currency.symbol}
                                </TokenValue>
                                <TokenUsdValue>~{formatDollarAmount(reward.amountUSD)}</TokenUsdValue>
                              </FlexGap>
                            </TokenRow>
                          ))
                        : (earningsDisplay.farmRewardsAmount ?? 0) > 0 &&
                          earningsDisplay.rewardCurrency && (
                            <TokenRow>
                              <CurrencyLogo currency={earningsDisplay.rewardCurrency} size="16px" />
                              <FlexGap flexDirection="column" gap="0px">
                                <TokenValue>
                                  {formatNumber(earningsDisplay.farmRewardsAmount, {
                                    maxDecimalDisplayDigits: 6,
                                    maximumDecimalTrailingZeroes: 3,
                                  })}{' '}
                                  {earningsDisplay.rewardCurrency.symbol}
                                </TokenValue>
                                <TokenUsdValue>
                                  ~{formatDollarAmount(earningsDisplay.farmRewardsUSD ?? 0)}
                                </TokenUsdValue>
                              </FlexGap>
                            </TokenRow>
                          )}
                    </FlexGap>
                  </FlexGap>
                )}
            </FlexGap>
          </Column>

          {/* APR Column */}
          <Column $minWidth="120px">
            <ColumnHeader>
              {hasFarm && '🌿 '}
              {totalApr > 0 ? displayApr(totalApr) : '0%'}
            </ColumnHeader>
            <FlexGap flexDirection="column" gap="4px">
              <Box>
                <AprLabel>{t('LP Fee APR')}</AprLabel>
                <AprValue>{lpApr > 0 ? displayApr(lpApr) : '0%'}</AprValue>
              </Box>
              {merklApr > 0 && (
                <Box>
                  <AprLabel>{t('Merkl APR')}</AprLabel>
                  <AprValue>{displayApr(merklApr)}</AprValue>
                </Box>
              )}
              {incentraApr > 0 && (
                <Box>
                  <AprLabel>{t('Incentra APR')}</AprLabel>
                  <AprValue>{displayApr(incentraApr)}</AprValue>
                </Box>
              )}
              {farmApr > 0 && (
                <Box>
                  <AprLabel>{t('Farm APR')}</AprLabel>
                  <AprValue>{displayApr(farmApr)}</AprValue>
                </Box>
              )}
            </FlexGap>
          </Column>
        </MainContent>

        {!isSolanaV3Position && (
          <PositionModal
            isOpen={isOpen}
            onDismiss={onDismiss}
            poolId={pool?.poolId ?? pool?.stableSwapAddress ?? pool?.lpAddress}
            protocol={pool?.protocol}
            chainId={pool?.chainId ?? chainId}
            position={position}
            presetTab={modalPresetTab}
          />
        )}

        {/* Action Buttons */}
        <ActionButtonsContainer>
          {poolDetailUrl && (
            <Button
              variant="primary60"
              scale="md"
              as={NextLinkFromReactRouter}
              to={poolDetailUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenNewIcon width="18px" color="primary60" />}
            >
              {t('Full Page')}
            </Button>
          )}
          {!isSolanaV3Position && protocolForActions && (
            <Button variant="primary60" scale="md" onClick={() => openModal('Remove')} width="48px" p="0">
              <MinusIcon width="24px" color="primary60" />
            </Button>
          )}
          {/* Hide plus button for V2 and STABLE positions and Solana V3 positions */}
          {!isSolanaV3Position && protocolForActions && (
            <Button variant="primary60" scale="md" onClick={() => openModal('Add')} width="48px" p="0">
              <AddIcon width="24px" color="primary60" />
            </Button>
          )}
          {/* Protocol-specific action buttons */}
          <PositionActionButtons
            position={position}
            pool={pool}
            chainId={chainId}
            isFarmLive={hasFarm}
            isStaked={'isStaked' in position ? position.isStaked : false}
            removed={removed}
            outOfRange={outOfRange}
            totalLiquidityUSD={totalLiquidityUSD}
            amount0={propAmount0}
            amount1={propAmount1}
            showCollectButton
            v3SdkPool={v3SdkPool}
          />
          {addLiquidityUrl && (
            <Button variant="primary60Outline" scale="md" as={NextLinkFromReactRouter} to={addLiquidityUrl}>
              {t('New position')}
            </Button>
          )}
        </ActionButtonsContainer>
      </Container>
    )
  },
)

function useExpandedData(position: UnifiedPositionDetail) {
  const chainId = getPositionChainId(position)
  // Only call useExtraInfinityPositionInfo for CL positions (not BIN)
  const infinityInfo = useExtraInfinityPositionInfo(
    position.protocol === Protocol.InfinityCLAMM ? (position as InfinityCLPositionDetail) : undefined,
  )
  const v3Info = useExtraV3PositionInfo(
    position.protocol === Protocol.V3 && !isSolana(chainId) ? (position as PositionDetail) : undefined,
  )

  const isEvmV3 = position.protocol === Protocol.V3 && !isSolana(chainId)
  const v3PositionDetail = isEvmV3 ? (position as PositionDetail) : undefined
  const [, v3PoolForRange] = usePoolByChainId(
    isEvmV3 ? v3Info.currency0 : undefined,
    isEvmV3 ? v3Info.currency1 : undefined,
    isEvmV3 ? v3PositionDetail?.fee : undefined,
  )

  const v3OutOfRangeFromPriceRange = useMemo(() => {
    if (!isEvmV3 || !v3PositionDetail) return false
    const poolForCalc = v3PoolForRange || v3Info.pool
    if (!poolForCalc) return false

    const { tickLower, tickUpper, fee } = v3PositionDetail
    if (tickLower === undefined || tickUpper === undefined) return false

    const tickSpacing = getTickSpacing(poolForCalc, fee)
    const ticksLimit = calculateTickLimits(tickSpacing)
    const isTickAtLimit = getTickAtLimitStatus(tickLower, tickUpper, ticksLimit)

    const c0 = v3Info.currency0
    const c1 = v3Info.currency1
    const isFlipped = Boolean(
      c0?.wrapped?.address &&
        poolForCalc.token1?.address &&
        c0.wrapped.address.toLowerCase() === poolForCalc.token1.address.toLowerCase(),
    )

    const rangeData = calculateTickBasedPriceRange(
      tickLower,
      tickUpper,
      c0?.wrapped,
      c1?.wrapped,
      poolForCalc,
      isTickAtLimit,
      isFlipped,
    )

    if (rangeData.showPercentages && rangeData.minPercentage && rangeData.maxPercentage) {
      const minIsNegative = rangeData.minPercentage.startsWith('-') && rangeData.minPercentage !== '-%'
      const minIsPositive = rangeData.minPercentage.startsWith('+')
      const maxIsNegative = rangeData.maxPercentage.startsWith('-') && rangeData.maxPercentage !== '-%'
      const maxIsPositive = rangeData.maxPercentage.startsWith('+')

      const inRange = (minIsNegative && maxIsPositive) || (minIsPositive && maxIsNegative)
      return !inRange && (minIsNegative || minIsPositive) && (maxIsNegative || maxIsPositive)
    }

    return false
  }, [isEvmV3, v3PositionDetail, v3PoolForRange, v3Info.pool, v3Info.currency0, v3Info.currency1])

  const poolId = useMemo((): `0x${string}` | undefined => {
    if (position.protocol === Protocol.InfinityCLAMM || position.protocol === Protocol.InfinityBIN) {
      const { poolKey } = position as InfinityCLPositionDetail | InfinityBinPositionDetail
      if (poolKey) {
        return getPoolId(poolKey)
      }
    }
    return undefined
  }, [position])

  const tokenId = useMemo(() => {
    if ('tokenId' in position) return position.tokenId
    return undefined
  }, [position])

  const tickLower = useMemo(() => {
    if (position.protocol === Protocol.InfinityCLAMM) {
      return (position as InfinityCLPositionDetail).tickLower
    }
    if (position.protocol === Protocol.V3) {
      return (position as PositionDetail).tickLower
    }
    return undefined
  }, [position])

  const tickUpper = useMemo(() => {
    if (position.protocol === Protocol.InfinityCLAMM) {
      return (position as InfinityCLPositionDetail).tickUpper
    }
    if (position.protocol === Protocol.V3) {
      return (position as PositionDetail).tickUpper
    }
    return undefined
  }, [position])

  const currency0 = infinityInfo.currency0 || v3Info.currency0
  const currency1 = infinityInfo.currency1 || v3Info.currency1

  const currentPrice = useMemo(() => {
    const info = infinityInfo.pool ? infinityInfo : v3Info
    if (!info.pool?.token0Price) return null
    return info.pool.token0Price.toSignificant(8)
  }, [infinityInfo, v3Info])

  const removed = infinityInfo.removed || v3Info.removed
  const outOfRange = infinityInfo.outOfRange || v3Info.outOfRange || v3OutOfRangeFromPriceRange

  // Extract priceLower/priceUpper as numbers for chart fallback (PAN-10696).
  // useExtraInfinityPositionInfo returns Price objects; convert to numeric here.
  const priceLower = useMemo(() => {
    const price = infinityInfo.priceLower || v3Info.priceLower
    if (!price) return undefined
    try {
      return parseFloat(price.toSignificant(8))
    } catch {
      return undefined
    }
  }, [infinityInfo.priceLower, v3Info.priceLower])

  const priceUpper = useMemo(() => {
    const price = infinityInfo.priceUpper || v3Info.priceUpper
    if (!price) return undefined
    try {
      return parseFloat(price.toSignificant(8))
    } catch {
      return undefined
    }
  }, [infinityInfo.priceUpper, v3Info.priceUpper])

  return {
    currency0,
    currency1,
    currentPrice,
    chainId,
    poolId,
    tokenId,
    tickLower,
    tickUpper,
    priceLower,
    priceUpper,
    v3Pool: v3Info.pool ?? undefined,
    removed,
    outOfRange,
  }
}
