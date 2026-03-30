import { Protocol } from '@pancakeswap/farms'
import {
  ChevronDownIcon,
  Flex,
  FlexGap,
  Text,
  FeeTier,
  IconButton,
  ChevronUpIcon,
  Button,
  Tag,
} from '@pancakeswap/uikit'
import { TokenPairLogo } from 'components/TokenImage'
import { InfinityFeeTierBreakdown } from 'components/FeeTierBreakdown'
import { MerklTagV2 } from 'components/Merkl/MerklTag'
import { IncentraTagV2 } from 'components/Incentra/IncentraTag'
import { useTranslation } from '@pancakeswap/localization'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { Tooltips } from 'components/Tooltips'
import { PriceRangeDisplay } from 'views/PoolDetail/components/ProtocolPositionsTables/PriceRangeDisplay'
import { UnifiedPositionDetail, SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { InfinityPoolInfo, type UnifiedPoolInfo } from 'state/farmsV4/state/type'
import { isInfinityProtocol } from 'utils/protocols'
import { isSolana, NonEVMChainId } from '@pancakeswap/chains'
import styled from 'styled-components'
import { Currency, ERC20Token } from '@pancakeswap/sdk'
import { CurrencyAmount, UnifiedCurrency, UnifiedCurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { HookData } from '@pancakeswap/infinity-sdk'
import { BigNumber as BN } from 'bignumber.js'
import { useRouter } from 'next/router'
import { useMemo, memo, useState, useCallback } from 'react'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { RangeTag } from 'components/RangeTag'
import { useOpenHarvestModal } from 'components/HarvestPositionsModal'
import { useSelectedProtocols } from '../PoolsFilterPanel'
import { ExpandedRowContent } from './ExpandedRowContent'
import { PositionDebugView } from '../PositionItem/PositionDebugView'
import { getPositionKey } from '../../utils/getPositionKey'

// Styled components
const Row = styled.tr<{ $expanded?: boolean }>`
  border-bottom: 1px solid ${({ theme, $expanded }) => (!$expanded ? theme.colors.cardBorder : 'transparent')};
  transition: background 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.backgroundHover};
  }

  ${({ $expanded, theme }) =>
    $expanded &&
    `
    background: ${theme.colors.backgroundAlt};
  `}
`

const Cell = styled.td<{ align?: 'left' | 'center' | 'right' }>`
  padding: 8px;
  text-align: ${({ align }) => align || 'left'};
  vertical-align: middle;

  &:first-child {
    padding-left: 24px;
  }

  &:last-child {
    padding-right: 24px;
  }
`

const CellContentWrapper = styled.div`
  min-height: 70px;
  width: 100%;
  display: flex;
  align-items: center;
`

const ExpandedRow = styled.tr`
  background: ${({ theme }) => theme.colors.backgroundAlt};
`

const ExpandedCell = styled.td`
  padding: 0;
`

const PoolCell = styled(Flex)`
  align-items: center;
  gap: 12px;
`

const PoolLabelColumn = styled(Flex)`
  flex-wrap: wrap;
  gap: 4px;
`

type FarmRewardInfo = {
  amount: number
  amountUSD: number
  currency: Currency | UnifiedCurrency
}

// Data interface
export interface PositionDisplayData {
  currency0: Currency | UnifiedCurrency | undefined
  currency1: Currency | UnifiedCurrency | undefined
  removed: boolean
  outOfRange: boolean
  pool: UnifiedPoolInfo | null
  totalPriceUSD: number
  aprButton: React.ReactNode
  hookData: HookData | undefined
  chainId: number
  earnings: { display: string } | null
  earningsBreakdown?: {
    fee0Amount?: number
    fee1Amount?: number
    fee0USD?: number
    fee1USD?: number
    // Legacy single reward (for backward compatibility)
    farmRewardsAmount?: number
    farmRewardsUSD?: number
    rewardCurrency?: Currency | UnifiedCurrency
    // New: support multiple reward tokens
    farmRewards?: FarmRewardInfo[]
  }
  amount0: CurrencyAmount<ERC20Token | Currency> | UnifiedCurrencyAmount<UnifiedCurrency> | undefined
  amount1: CurrencyAmount<ERC20Token | Currency> | UnifiedCurrencyAmount<UnifiedCurrency> | undefined
  price0Usd: number | undefined
  price1Usd: number | undefined
  priceRangeDisplay: {
    minPriceFormatted: string
    maxPriceFormatted: string
    currentPrice?: string
    minPercentage: string
    maxPercentage: string
    rangePosition: number
    showPercentages: boolean
    // Raw numeric values for calculations (e.g., price inversion)
    minPrice?: number
    maxPrice?: number
    currentPriceValue?: number
  } | null
  lpApr?: number
  merklApr?: number
  incentraApr?: number
  farmApr?: number
  totalApr?: number
  hasFarm?: boolean
  /** For V2/Stable: fee value for FeeTier (e.g. 25 for 0.25%) */
  feeTier?: number
  /** For V2/Stable: denominator for FeeTier (e.g. 10000) */
  feeTierBase?: number
  /** Expanded row: navigate to pool detail */
  onViewDetails?: () => void
  /** Expanded row: add liquidity */
  onAddLiquidity?: () => void
  /** Expanded row: remove / decrease position */
  onRemoveLiquidity?: () => void
  /** Expanded row: harvest farm rewards (when hasFarm) */
  onHarvest?: () => void
  /** For Infinity positions: whether there are unclaimed rewards to harvest */
  hasUnclaimedRewards?: boolean
  /** For Infinity positions: whether merkle root is mismatched (claim would revert) */
  isMerkleRootMismatch?: boolean
  /** V3 SDK Pool for cross-chain fee fetching */
  v3SdkPool?: any
}

// Props interface
interface PositionRowDisplayProps {
  position: UnifiedPositionDetail
  data: PositionDisplayData
  expanded: boolean
  onToggleExpand: () => void
  hideEarningsColumn?: boolean
}

/** True when earningsBreakdown has at least one fee or farm reward to show in tooltip */
function hasEarningsBreakdownContent(
  breakdown: PositionDisplayData['earningsBreakdown'],
): breakdown is NonNullable<PositionDisplayData['earningsBreakdown']> {
  if (!breakdown) return false
  return (
    (breakdown.fee0Amount !== undefined && breakdown.fee0Amount > 0) ||
    (breakdown.fee1Amount !== undefined && breakdown.fee1Amount > 0) ||
    (breakdown.farmRewardsAmount !== undefined && breakdown.farmRewardsAmount > 0)
  )
}

// Pure display component
export const PositionRowDisplay: React.FC<PositionRowDisplayProps> = memo(
  ({ position, data, expanded, onToggleExpand, hideEarningsColumn = false }) => {
    const { t } = useTranslation()

    const {
      currency0,
      currency1,
      removed,
      outOfRange,
      pool,
      totalPriceUSD,
      aprButton,
      hookData,
      chainId,
      earnings,
      earningsBreakdown,
      amount0,
      amount1,
      price0Usd,
      price1Usd,
      priceRangeDisplay,
      lpApr,
      merklApr,
      incentraApr,
      farmApr,
      totalApr,
      hasFarm,
      feeTier: dataFeeTier,
      feeTierBase: dataFeeTierBase,
      onViewDetails,
      onAddLiquidity,
      onRemoveLiquidity,
      onHarvest,
      hasUnclaimedRewards,
      isMerkleRootMismatch,
      v3SdkPool,
    } = data

    const openHarvestModal = useOpenHarvestModal()
    const showExpandable = !removed
    const isInfinity = isInfinityProtocol(position.protocol)
    const showHarvestButton =
      removed && isInfinity && hasUnclaimedRewards && !isMerkleRootMismatch && Boolean(openHarvestModal)
    // const isSolanaPosition = isSolana(chainId)

    // V3 uses position.isStaked (individually staked NFT). Infinity: pool flags (hasFarm) can lag
    // campaign data; also treat non-zero Farm APR or position.isStaked as farming (same signals
    // as APR tooltips). Other protocols use hasFarm from pool config / isFarmLive.
    const isFarming = useMemo(() => {
      if (position.protocol === Protocol.V3 && chainId !== NonEVMChainId.SOLANA) {
        return Boolean('isStaked' in position ? position.isStaked : false)
      }
      if (isInfinityProtocol(position.protocol)) {
        const farmAprNum = typeof farmApr === 'number' ? farmApr : 0
        const staked = Boolean('isStaked' in position && position.isStaked)
        return Boolean(hasFarm) || farmAprNum > 0 || staked
      }
      return Boolean(hasFarm)
    }, [position, chainId, hasFarm, farmApr])

    // Inverted state for price display - lifted from ExpandedRowContent to share with price range
    const [inverted, setInverted] = useState(false)
    const handleToggleInverted = useCallback(() => setInverted((prev) => !prev), [])

    // Compute inverted price range display when inverted is true
    const displayPriceRange = useMemo(() => {
      if (!priceRangeDisplay) return null

      if (!inverted) return priceRangeDisplay

      try {
        // Use raw numeric values if available, otherwise fallback to parsing formatted strings
        const { minPrice } = priceRangeDisplay
        const { maxPrice } = priceRangeDisplay
        const { currentPriceValue } = priceRangeDisplay

        // Check if we have valid raw numeric values
        if (
          minPrice === undefined ||
          maxPrice === undefined ||
          !Number.isFinite(minPrice) ||
          !Number.isFinite(maxPrice) ||
          Number.isNaN(minPrice) ||
          Number.isNaN(maxPrice)
        ) {
          return priceRangeDisplay // Return original if raw values unavailable
        }

        // Use BigNumber for inversion to maintain precision
        const minPriceBN = new BN(minPrice)
        const maxPriceBN = new BN(maxPrice)
        const currentPriceBN =
          currentPriceValue && Number.isFinite(currentPriceValue) ? new BN(currentPriceValue) : null

        // Invert prices: new min = 1/max, new max = 1/min
        // Only invert if values are greater than 0
        const invertedMinPriceBN = maxPriceBN.gt(0) ? new BN(1).div(maxPriceBN) : new BN(0)
        const invertedMaxPriceBN = minPriceBN.gt(0) ? new BN(1).div(minPriceBN) : new BN(0)
        const invertedCurrentPriceBN = currentPriceBN && currentPriceBN.gt(0) ? new BN(1).div(currentPriceBN) : null

        // Check if inverted values are valid
        if (
          !invertedMinPriceBN.isFinite() ||
          !invertedMaxPriceBN.isFinite() ||
          invertedMinPriceBN.isNaN() ||
          invertedMaxPriceBN.isNaN()
        ) {
          return priceRangeDisplay // Return original if inversion failed
        }

        // Format the inverted prices
        const formatPrice = (priceBN: BN) => {
          if (!priceBN.isFinite() || priceBN.isNaN() || priceBN.lte(0)) return '0'
          const price = priceBN.toNumber()
          return formatNumber(price, { maxDecimalDisplayDigits: 6 })
        }

        // Swap and negate percentages
        const invertedMinPercentage = priceRangeDisplay.maxPercentage.startsWith('-')
          ? priceRangeDisplay.maxPercentage.replace('-', '+')
          : priceRangeDisplay.maxPercentage.startsWith('+')
          ? priceRangeDisplay.maxPercentage.replace('+', '-')
          : `-${priceRangeDisplay.maxPercentage}`
        const invertedMaxPercentage = priceRangeDisplay.minPercentage.startsWith('-')
          ? priceRangeDisplay.minPercentage.replace('-', '+')
          : priceRangeDisplay.minPercentage.startsWith('+')
          ? priceRangeDisplay.minPercentage.replace('+', '-')
          : `-${priceRangeDisplay.minPercentage}`

        // Flip range position (0 to 100 becomes 100 to 0)
        const invertedRangePosition = 100 - priceRangeDisplay.rangePosition

        const result = {
          minPriceFormatted: formatPrice(invertedMinPriceBN),
          maxPriceFormatted: formatPrice(invertedMaxPriceBN),
          currentPrice: invertedCurrentPriceBN ? formatPrice(invertedCurrentPriceBN) : undefined,
          minPercentage: invertedMinPercentage,
          maxPercentage: invertedMaxPercentage,
          rangePosition: invertedRangePosition,
          showPercentages: priceRangeDisplay.showPercentages,
          minPrice: invertedMinPriceBN.toNumber(),
          maxPrice: invertedMaxPriceBN.toNumber(),
          currentPriceValue: invertedCurrentPriceBN ? invertedCurrentPriceBN.toNumber() : undefined,
        }

        return result
      } catch (error) {
        // Return original price range if inversion fails
        return priceRangeDisplay
      }
    }, [priceRangeDisplay, inverted])

    const handleRowClick = useCallback(
      (e: React.MouseEvent<HTMLTableRowElement>) => {
        if (!showExpandable) {
          return
        }

        // Check if the click target is an interactive element or inside one
        const target = e.target as HTMLElement
        const isInteractive =
          target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.closest('button') !== null ||
          target.closest('a') !== null ||
          target.closest('[role="button"]') !== null ||
          target.closest('[data-interactive]') !== null

        if (!isInteractive) {
          onToggleExpand()
        }
      },
      [showExpandable, onToggleExpand],
    )

    const handleExpandClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        onToggleExpand()
      },
      [onToggleExpand],
    )

    return (
      <>
        <Row
          $expanded={expanded}
          onClick={showExpandable ? handleRowClick : undefined}
          style={{ cursor: showExpandable ? 'pointer' : 'default' }}
        >
          <Cell>
            <CellContentWrapper>
              <PoolCell>
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
                <PoolLabelColumn>
                  <FlexGap alignItems="center" gap="8px">
                    {currency0 && currency1 ? (
                      <>
                        <PositionDebugView json={data}>
                          <Text bold>
                            {currency0.symbol} / {currency1.symbol}
                          </Text>
                        </PositionDebugView>
                        {'tokenId' in position && position.tokenId && (
                          <Text color="textSubtle" fontSize="12px">
                            (#{position.tokenId.toString()})
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text color="textSubtle" fontSize="14px">
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
                        fee={dataFeeTier ?? ('fee' in position ? position.fee : 0)}
                        denominator={dataFeeTierBase ?? ('fee' in position ? 1_000_000 : undefined)}
                      />
                    )}
                    <MerklTagV2 poolAddress={pool?.lpAddress} />
                    <IncentraTagV2 poolAddress={pool?.lpAddress} />
                    {isFarming && !removed && !outOfRange && (
                      <Tag variant="primary60" scale="sm" px="6px">
                        {t('Farming')}
                      </Tag>
                    )}
                  </FlexGap>
                </PoolLabelColumn>
              </PoolCell>
            </CellContentWrapper>
          </Cell>
          <Cell align="left">
            {removed ? (
              <RangeTag lowContrast removed={removed} outOfRange={outOfRange} protocol={position.protocol} />
            ) : displayPriceRange ? (
              <PriceRangeDisplay
                minPrice={displayPriceRange.minPriceFormatted}
                maxPrice={displayPriceRange.maxPriceFormatted}
                currentPrice={displayPriceRange.currentPrice}
                minPercentage={displayPriceRange.minPercentage}
                maxPercentage={displayPriceRange.maxPercentage}
                rangePosition={displayPriceRange.rangePosition}
                outOfRange={outOfRange}
                removed={removed}
                showPercentages={displayPriceRange.showPercentages}
                maxWidth="180px"
                minPriceRaw={displayPriceRange.minPrice}
                maxPriceRaw={displayPriceRange.maxPrice}
                currentPriceRaw={displayPriceRange.currentPriceValue}
              />
            ) : [Protocol.V2, Protocol.STABLE, Protocol.InfinitySTABLE].includes(position.protocol) ? (
              <Text fontSize="12px" color="textSubtle" textTransform="uppercase" textAlign="center">
                {t('Full Range')}
              </Text>
            ) : (
              <Text fontSize="12px" color="textSubtle">
                -
              </Text>
            )}
          </Cell>
          <Cell align="right">
            <Flex flexDirection="column" alignItems="flex-end">
              <Tooltips
                content={
                  <FlexGap flexDirection="column" alignItems="flex-start" gap="8px">
                    <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
                      <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                        <FlexGap alignItems="center" gap="8px">
                          {currency0 && <CurrencyLogo currency={currency0} size="16px" />}
                          <Text fontSize="14px" bold>
                            {currency0?.symbol ?? '-'}
                          </Text>
                        </FlexGap>
                        <Text fontSize="14px" bold>
                          {amount0
                            ? formatNumber(BN(amount0.toExact()).toNumber(), {
                                maxDecimalDisplayDigits: 6,
                                maximumDecimalTrailingZeroes: 3,
                              })
                            : '-'}
                        </Text>
                      </FlexGap>
                      <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                        {amount0 && typeof price0Usd === 'number'
                          ? `~${formatDollarAmount(BN(amount0.toExact()).times(price0Usd).toNumber())}`
                          : '$0.00'}
                      </Text>
                    </FlexGap>
                    <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
                      <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                        <FlexGap alignItems="center" gap="8px">
                          {currency1 && <CurrencyLogo currency={currency1} size="16px" />}
                          <Text fontSize="14px" bold>
                            {currency1?.symbol ?? '-'}
                          </Text>
                        </FlexGap>
                        <Text fontSize="14px" bold>
                          {amount1
                            ? formatNumber(BN(amount1.toExact()).toNumber(), {
                                maxDecimalDisplayDigits: 6,
                                maximumDecimalTrailingZeroes: 3,
                              })
                            : '-'}
                        </Text>
                      </FlexGap>
                      <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                        {amount1 && typeof price1Usd === 'number'
                          ? `~${formatDollarAmount(BN(amount1.toExact()).times(price1Usd).toNumber())}`
                          : '$0.00'}
                      </Text>
                    </FlexGap>
                  </FlexGap>
                }
              >
                <Text bold fontSize="14px">
                  ${totalPriceUSD.toFixed(2)}
                </Text>
              </Tooltips>
            </Flex>
          </Cell>
          {!hideEarningsColumn && (
            <Cell align="right">
              {earnings && hasEarningsBreakdownContent(earningsBreakdown) ? (
                <Tooltips
                  content={
                    <FlexGap flexDirection="column" alignItems="flex-start" gap="8px">
                      {earningsBreakdown.fee0Amount !== undefined && earningsBreakdown.fee0Amount > 0 && currency0 && (
                        <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
                          <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                            <FlexGap alignItems="center" gap="8px">
                              <CurrencyLogo currency={currency0} size="16px" mb="-3px" />
                              <Text fontSize="14px" bold>
                                {currency0.symbol}
                              </Text>
                            </FlexGap>
                            <Text fontSize="14px" bold>
                              {formatNumber(earningsBreakdown.fee0Amount, {
                                maxDecimalDisplayDigits: 6,
                                maximumDecimalTrailingZeroes: 3,
                              })}
                            </Text>
                          </FlexGap>
                          {earningsBreakdown.fee0USD !== undefined && (
                            <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                              {formatDollarAmount(earningsBreakdown.fee0USD)}
                            </Text>
                          )}
                        </FlexGap>
                      )}
                      {earningsBreakdown.fee1Amount !== undefined && earningsBreakdown.fee1Amount > 0 && currency1 && (
                        <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
                          <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                            <FlexGap alignItems="center" gap="8px">
                              <CurrencyLogo currency={currency1} size="16px" mb="-3px" />
                              <Text fontSize="14px" bold>
                                {currency1.symbol}
                              </Text>
                            </FlexGap>
                            <Text fontSize="14px" bold>
                              {formatNumber(earningsBreakdown.fee1Amount, {
                                maxDecimalDisplayDigits: 6,
                                maximumDecimalTrailingZeroes: 3,
                              })}
                            </Text>
                          </FlexGap>
                          {earningsBreakdown.fee1USD !== undefined && (
                            <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                              {formatDollarAmount(earningsBreakdown.fee1USD)}
                            </Text>
                          )}
                        </FlexGap>
                      )}
                      {earningsBreakdown.farmRewards?.length
                        ? earningsBreakdown.farmRewards.map((reward, idx) => (
                            <FlexGap key={idx} flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
                              <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                                <FlexGap alignItems="center" gap="8px">
                                  <CurrencyLogo currency={reward.currency} size="16px" mb="-3px" />
                                  <Text fontSize="14px" bold>
                                    {reward.currency.symbol}
                                  </Text>
                                </FlexGap>
                                <Text fontSize="14px" bold>
                                  {formatNumber(reward.amount, {
                                    maxDecimalDisplayDigits: 6,
                                    maximumDecimalTrailingZeroes: 3,
                                  })}
                                </Text>
                              </FlexGap>
                              <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                                {formatDollarAmount(reward.amountUSD)}
                              </Text>
                            </FlexGap>
                          ))
                        : earningsBreakdown.farmRewardsAmount !== undefined &&
                          earningsBreakdown.farmRewardsAmount > 0 &&
                          earningsBreakdown.rewardCurrency && (
                            <FlexGap flexDirection="column" alignItems="flex-start" gap="2px" width="100%">
                              <FlexGap alignItems="center" justifyContent="space-between" width="100%" gap="16px">
                                <FlexGap alignItems="center" gap="8px">
                                  <CurrencyLogo currency={earningsBreakdown.rewardCurrency} size="16px" mb="-3px" />
                                  <Text fontSize="14px" bold>
                                    {earningsBreakdown.rewardCurrency.symbol}
                                  </Text>
                                </FlexGap>
                                <Text fontSize="14px" bold>
                                  {formatNumber(earningsBreakdown.farmRewardsAmount, {
                                    maxDecimalDisplayDigits: 6,
                                    maximumDecimalTrailingZeroes: 3,
                                  })}
                                </Text>
                              </FlexGap>
                              {earningsBreakdown.farmRewardsUSD !== undefined && (
                                <Text color="textSubtle" fontSize="12px" textAlign="right" width="100%">
                                  {formatDollarAmount(earningsBreakdown.farmRewardsUSD)}
                                </Text>
                              )}
                            </FlexGap>
                          )}
                    </FlexGap>
                  }
                >
                  <Text bold fontSize="14px">
                    {earnings.display}
                  </Text>
                </Tooltips>
              ) : earnings ? (
                <Text bold fontSize="14px">
                  {earnings.display}
                </Text>
              ) : (
                <Text bold fontSize="14px">
                  -
                </Text>
              )}
            </Cell>
          )}
          <Cell align="right">
            <Flex flexDirection="column" alignItems="flex-end" data-interactive>
              {aprButton}
              {/* <Text fontSize="12px" color="textSubtle">
              {t('LP + Farm APR')}
            </Text> */}
            </Flex>
          </Cell>
          <Cell align="right">
            {showHarvestButton ? (
              <div data-interactive>
                <Button scale="md" onClick={() => openHarvestModal?.('evm', chainId)}>
                  {t('Harvest')}
                </Button>
              </div>
            ) : showExpandable ? (
              <div data-interactive>
                <IconButton
                  variant="light"
                  onClick={handleExpandClick}
                  aria-label={expanded ? t('Collapse row') : t('Expand row')}
                >
                  {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </IconButton>
              </div>
            ) : null}
          </Cell>
        </Row>
        {expanded && showExpandable && (
          <ExpandedRow>
            <ExpandedCell colSpan={6}>
              <ExpandedRowContent
                position={position}
                pool={pool}
                currency0={currency0}
                currency1={currency1}
                amount0={amount0}
                amount1={amount1}
                earnings={earnings}
                earningsBreakdown={earningsBreakdown}
                totalLiquidityUSD={totalPriceUSD}
                lpApr={lpApr ?? 0}
                merklApr={merklApr ?? 0}
                incentraApr={incentraApr ?? 0}
                farmApr={farmApr ?? 0}
                totalApr={totalApr ?? 0}
                price0Usd={price0Usd}
                price1Usd={price1Usd}
                currentPrice={priceRangeDisplay?.currentPriceValue}
                onViewDetails={onViewDetails}
                onAddLiquidity={onAddLiquidity}
                onRemoveLiquidity={onRemoveLiquidity}
                v3SdkPool={v3SdkPool}
                onHarvest={onHarvest}
                inverted={inverted}
                onToggleInverted={handleToggleInverted}
                hasFarm={hasFarm}
              />
            </ExpandedCell>
          </ExpandedRow>
        )}
      </>
    )
  },
  // Custom comparison function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    // Compare position identity using position key
    const prevKey = getPositionKey(prevProps.position)
    const nextKey = getPositionKey(nextProps.position)
    if (prevKey !== nextKey) return false

    // Compare expanded state
    if (prevProps.expanded !== nextProps.expanded) return false

    // Compare hideEarningsColumn
    if (prevProps.hideEarningsColumn !== nextProps.hideEarningsColumn) return false

    // Compare data object properties (shallow comparison of key fields)
    const prevData = prevProps.data
    const nextData = nextProps.data

    // Compare critical data fields that affect rendering
    if (
      prevData.totalPriceUSD !== nextData.totalPriceUSD ||
      prevData.removed !== nextData.removed ||
      prevData.outOfRange !== nextData.outOfRange ||
      prevData.earnings?.display !== nextData.earnings?.display ||
      prevData.totalApr !== nextData.totalApr ||
      prevData.hasFarm !== nextData.hasFarm ||
      prevData.farmApr !== nextData.farmApr ||
      ('isStaked' in prevProps.position ? prevProps.position.isStaked : undefined) !==
        ('isStaked' in nextProps.position ? nextProps.position.isStaked : undefined) ||
      // Compare currency objects (these resolve asynchronously)
      prevData.currency0?.wrapped?.address !== nextData.currency0?.wrapped?.address ||
      prevData.currency1?.wrapped?.address !== nextData.currency1?.wrapped?.address ||
      // Compare price range display (may load asynchronously)
      prevData.priceRangeDisplay?.minPriceFormatted !== nextData.priceRangeDisplay?.minPriceFormatted ||
      prevData.priceRangeDisplay?.maxPriceFormatted !== nextData.priceRangeDisplay?.maxPriceFormatted ||
      prevData.priceRangeDisplay?.currentPrice !== nextData.priceRangeDisplay?.currentPrice ||
      // Compare amounts (may load asynchronously)
      prevData.amount0?.toExact() !== nextData.amount0?.toExact() ||
      prevData.amount1?.toExact() !== nextData.amount1?.toExact() ||
      // Compare USD prices (load asynchronously)
      prevData.price0Usd !== nextData.price0Usd ||
      prevData.price1Usd !== nextData.price1Usd ||
      // Compare pool object (may load asynchronously)
      prevData.pool?.lpAddress !== nextData.pool?.lpAddress
    ) {
      return false
    }

    // If all checks pass, props are equal - skip re-render
    return true
  },
)
