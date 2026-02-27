import Decimal from 'decimal.js'
import { Protocol } from '@pancakeswap/farms'
import { HookData } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { Percent, UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import {
  AutoColumn,
  Box,
  BscScanIcon,
  Card,
  CopyButton,
  Flex,
  FlexGap,
  Link,
  MiscellaneousIcon,
  OpenNewIcon,
  Skeleton,
  SwapHorizIcon,
  Tag,
  Text,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { CurrencyLogo, DoubleCurrencyLogo, FeeTierTooltip, Liquidity } from '@pancakeswap/widgets-internal'
import { InfinityFeeTierBreakdown } from 'components/FeeTierBreakdown'
import { LinkType, MiniUniversalFarmsOverlay } from 'components/MiniUniversalFarms/MiniUniversalFarmsOverlay'
import { getFarmAprInfo } from 'state/farmsV4/search/farm.util'
import { PoolInfo, UnifiedPoolInfo } from 'state/farmsV4/state/type'
import { getBlockExploreLink } from 'utils'
import { isInfinityProtocol } from 'utils/protocols'
import { Tooltips } from 'components/Tooltips'
import { PoolFeaturesModal } from 'views/PoolDetail/components/PoolFeaturesModal'
import { PoolGlobalAprButtonV3 } from 'views/universalFarms/components/PoolAprButtonV3'
import { GreyBadge } from 'components/Liquidity/Badges'

interface PoolInfoHeaderProps {
  poolId?: string
  poolInfo: UnifiedPoolInfo | null | undefined
  currency0?: UnifiedCurrency
  currency1?: UnifiedCurrency
  chainId?: number
  isInverted?: boolean
  hookData?: HookData
  overrideAprDisplay?: {
    aprDisplay?: React.ReactNode
    roiCalculator?: React.ReactNode
  }
  linkType?: LinkType
  onInvertPrices?: () => void

  /** Optional override for currency0.symbol */
  symbol0?: string
  /** Optional override for currency1.symbol */
  symbol1?: string
  price?: Decimal
  isStableInfinity?: boolean
}
export const PoolInfoHeader = ({
  isStableInfinity,
  poolInfo,
  currency0,
  currency1,
  symbol0,
  symbol1,
  chainId,
  poolId,
  hookData,
  isInverted,
  onInvertPrices,
  overrideAprDisplay,
  linkType,
  price,
}: PoolInfoHeaderProps) => {
  const { t } = useTranslation()

  const { isMobile, isTablet } = useMatchBreakpoints()
  const isSmallScreen = isMobile || isTablet

  const protocol = poolInfo?.protocol

  // Determine loading state based on essential data availability
  const isLoading = !poolInfo || !currency0 || !currency1

  return (
    <>
      <Card innerCardProps={{ p: ['16px', '16px', '16px', '16px', '16px', '8px 24px'] }}>
        {isLoading ? (
          <FlexGap
            justifyContent="space-between"
            alignItems={isSmallScreen ? 'flex-start' : 'center'}
            flexDirection={isSmallScreen ? 'column' : 'row'}
            gap="16px"
          >
            <FlexGap
              gap="16px"
              justifyContent={isSmallScreen ? 'space-between' : 'flex-start'}
              flexDirection={isSmallScreen ? 'row-reverse' : 'row'}
              width="100%"
            >
              <Box>
                <Skeleton width="40px" height="40px" />
              </Box>
              <FlexGap flexDirection={['column', 'column', 'column', 'row']} flexWrap="wrap" gap="16px">
                <FlexGap
                  gap="12px"
                  alignItems={isSmallScreen ? 'flex-start' : 'center'}
                  flexDirection={isSmallScreen ? 'column' : 'row'}
                >
                  <Skeleton width="36px" height="36px" variant="circle" />
                  <FlexGap gap="4px" alignItems="center">
                    <Skeleton width="80px" height="24px" />
                    <Skeleton width="20px" height="24px" />
                    <Skeleton width="80px" height="24px" />
                  </FlexGap>
                </FlexGap>
                <FlexGap gap="16px" flexWrap="wrap" alignItems="center" alignContent="center">
                  <Skeleton width="60px" height="24px" />
                  <Skeleton width="80px" height="24px" />
                </FlexGap>
              </FlexGap>
            </FlexGap>
            <FlexGap
              gap={isMobile ? '20px' : '16px'}
              flexDirection={isMobile ? 'row-reverse' : 'row'}
              alignItems="center"
            >
              <Box py="8px" width="100%">
                <Skeleton width="100px" height="12px" mb="4px" />
                <Skeleton width={isMobile ? '120px' : '150px'} height={isMobile ? '20px' : '24px'} />
              </Box>
              {!isStableInfinity && (
                <Box py="8px">
                  <Skeleton width="80px" height="12px" mb="4px" />
                  <Skeleton width={isMobile ? '100px' : '120px'} height={isMobile ? '20px' : '24px'} />
                </Box>
              )}
            </FlexGap>
          </FlexGap>
        ) : (
          <FlexGap
            justifyContent="space-between"
            alignItems={isSmallScreen ? 'flex-start' : 'center'}
            flexDirection={isSmallScreen ? 'column' : 'row'}
            gap="16px"
          >
            <FlexGap
              gap="16px"
              justifyContent={isSmallScreen ? 'space-between' : 'flex-start'}
              flexDirection={isSmallScreen ? 'row-reverse' : 'row'}
              width="100%"
            >
              <Box>
                <MiniUniversalFarmsOverlay linkType={linkType} />
              </Box>
              <FlexGap flexDirection={['column', 'column', 'column', 'row']} flexWrap="wrap" gap="16px">
                <FlexGap
                  gap="12px"
                  alignItems={isSmallScreen ? 'flex-start' : 'center'}
                  flexDirection={isSmallScreen ? 'column' : 'row'}
                >
                  <Flex alignItems="center" justifyContent="center" position="relative">
                    <DoubleCurrencyLogo
                      currency0={currency0}
                      currency1={currency1}
                      size={36}
                      innerMargin="2px"
                      showChainLogoCurrency1
                    />
                  </Flex>

                  <FlexGap gap="4px" alignItems="center">
                    <Text bold fontSize={24} style={{ lineHeight: '1' }}>
                      {symbol0 ?? currency0?.symbol}
                    </Text>
                    <Text color="textSubtle" bold fontSize={24} style={{ lineHeight: '1' }}>
                      /
                    </Text>
                    <Text bold fontSize={24} style={{ lineHeight: '1' }}>
                      {symbol1 ?? currency1?.symbol}
                    </Text>
                    <Tooltips
                      content={
                        <FlexGap gap="4px" flexDirection="column" minWidth="150px">
                          {protocol && ![Protocol.InfinityCLAMM, Protocol.InfinityBIN].includes(protocol) && (
                            <FlexGap gap="16px" justifyContent="space-between" alignItems="center">
                              <FlexGap gap="4px">
                                <DoubleCurrencyLogo
                                  currency0={currency0}
                                  currency1={currency1}
                                  size={24}
                                  innerMargin="2px"
                                />
                                <Text>
                                  {currency0?.symbol} / {currency1?.symbol}
                                </Text>
                              </FlexGap>

                              <FlexGap gap="4px">
                                <Link
                                  target="_blank"
                                  href={getBlockExploreLink(
                                    protocol === Protocol.STABLE ? poolInfo.stableSwapAddress : poolInfo.lpAddress,
                                    'address',
                                    chainId,
                                  )}
                                >
                                  <OpenNewIcon width={16} height={16} color="primary60" />
                                </Link>
                                <CopyButton
                                  text={
                                    protocol === Protocol.STABLE
                                      ? poolInfo.stableSwapAddress ?? ''
                                      : poolInfo.lpAddress ?? ''
                                  }
                                  tooltipMessage={t('Token address copied')}
                                  width="16px"
                                  height="16px"
                                />
                              </FlexGap>
                            </FlexGap>
                          )}

                          <FlexGap gap="16px" justifyContent="space-between" alignItems="center">
                            <FlexGap gap="8px">
                              <CurrencyLogo currency={currency0} size="24px" />
                              <Text>{currency0?.symbol}</Text>
                            </FlexGap>
                            {currency0?.isToken && currency0?.wrapped?.address && (
                              <FlexGap gap="4px">
                                <Link
                                  target="_blank"
                                  href={getBlockExploreLink(currency0?.wrapped?.address, 'address', chainId)}
                                >
                                  <OpenNewIcon width={16} height={16} color="primary60" />
                                </Link>
                                <CopyButton
                                  text={currency0?.wrapped?.address ?? ''}
                                  tooltipMessage={t('Token address copied')}
                                  width="16px"
                                  height="16px"
                                />
                              </FlexGap>
                            )}
                          </FlexGap>
                          <FlexGap gap="16px" justifyContent="space-between" alignItems="center">
                            <FlexGap gap="8px">
                              <CurrencyLogo currency={currency1} size="24px" />
                              <Text>{currency1?.symbol}</Text>
                            </FlexGap>
                            {currency1?.isToken && currency1?.wrapped?.address && (
                              <FlexGap gap="4px">
                                <Link
                                  target="_blank"
                                  href={getBlockExploreLink(currency1?.wrapped?.address, 'address', chainId)}
                                >
                                  <OpenNewIcon width={16} height={16} color="primary60" />
                                </Link>
                                <CopyButton
                                  text={currency1?.wrapped?.address ?? ''}
                                  tooltipMessage={t('Token address copied')}
                                  width="16px"
                                  height="16px"
                                />
                              </FlexGap>
                            )}
                          </FlexGap>
                        </FlexGap>
                      }
                    >
                      <BscScanIcon width={24} height={24} color="textSubtle" style={{ cursor: 'pointer' }} />
                    </Tooltips>
                  </FlexGap>
                </FlexGap>
                {poolInfo && (
                  <FlexGap gap="16px" flexWrap="wrap" alignItems="center" alignContent="center">
                    {poolInfo?.protocol ? (
                      <AutoColumn rowGap="4px">
                        <Box>
                          {isInfinityProtocol(poolInfo.protocol) &&
                          typeof poolId === 'string' &&
                          poolId.startsWith('0x') ? (
                            <InfinityFeeTierBreakdown
                              poolId={poolId as `0x${string}`}
                              chainId={chainId}
                              hookData={hookData}
                              infoIconVisible={false}
                              showType={false}
                            />
                          ) : (
                            <FeeTierTooltip
                              type={poolInfo.protocol}
                              percent={new Percent(poolInfo?.feeTier ?? 0n, poolInfo?.feeTierBase)}
                              dynamic={poolInfo?.isDynamicFee}
                              showType={false}
                            />
                          )}
                        </Box>
                      </AutoColumn>
                    ) : null}

                    {isStableInfinity ? (
                      <GreyBadge $withBorder>
                        <Text color="textSubtle" small>
                          {t('Infinity | SS')}
                        </Text>
                      </GreyBadge>
                    ) : (
                      <Liquidity.PoolFeaturesBadge
                        showPoolType
                        showPoolFeature={false}
                        showPoolTypeInfo={false}
                        showPoolFeatureInfo={false}
                        poolType={poolInfo.protocol}
                        hookData={hookData}
                        showLabel={false}
                      />
                    )}

                    {hookData && (
                      <PoolFeaturesModal hookData={hookData} chainId={chainId}>
                        <Tag
                          variant="tertiary"
                          startIcon={<MiscellaneousIcon width={16} height={16} color="textSubtle" />}
                          endIcon={<>&nbsp;»</>}
                        >
                          {t('Pool Features')}
                        </Tag>
                      </PoolFeaturesModal>
                    )}
                  </FlexGap>
                )}
              </FlexGap>
            </FlexGap>
            {poolInfo && (
              <FlexGap
                gap={isMobile ? '20px' : '16px'}
                flexDirection={isMobile ? 'row-reverse' : 'row'}
                alignItems="center"
              >
                <Box py="8px" width="100%">
                  <FlexGap gap="2px" alignItems="center">
                    <Text
                      fontSize={12}
                      color="textSubtle"
                      textTransform="uppercase"
                      minWidth="max-content"
                      style={{ userSelect: 'none' }}
                      bold
                    >
                      {t('Current Price')}
                    </Text>
                    <SwapHorizIcon color="primary60" onClick={onInvertPrices} style={{ cursor: 'pointer' }} />
                  </FlexGap>
                  <FlexGap gap="8px" alignItems="center" width="100%">
                    {price ? (
                      <Text fontSize={isMobile ? 20 : 24} bold width="max-content">
                        {formatNumber((isInverted ? new Decimal(1).div(price) : price).toNumber(), {
                          maximumSignificantDigits: 8,
                          maxDecimalDisplayDigits: 6,
                        })}
                      </Text>
                    ) : poolInfo && poolInfo.token0Price && poolInfo.token1Price ? (
                      <Text fontSize={isMobile ? 20 : 24} bold width="max-content">
                        {formatNumber(Number(isInverted ? poolInfo.token0Price : poolInfo.token1Price), {
                          maximumSignificantDigits: 8,
                          maxDecimalDisplayDigits: 6,
                        })}
                      </Text>
                    ) : (
                      <Text fontSize={isMobile ? 20 : 24} bold width="max-content">
                        -
                      </Text>
                    )}

                    <Text fontSize={10} color="textSubtle" textTransform="uppercase" width="max-content">
                      {t(
                        '%assetA% = 1 %assetB%',
                        isInverted
                          ? {
                              assetA: currency0?.symbol,
                              assetB: currency1?.symbol,
                            }
                          : {
                              assetA: currency1?.symbol,
                              assetB: currency0?.symbol,
                            },
                      )}
                    </Text>
                  </FlexGap>
                </Box>

                {!isStableInfinity && (
                  <Box py="8px">
                    <AutoColumn rowGap="2px">
                      <FlexGap>
                        <Text fontSize={12} bold color="textSubtle" textTransform="uppercase" width="max-content">
                          {t('Est. APR')}
                        </Text>
                        {overrideAprDisplay?.roiCalculator || (
                          <PoolGlobalAprButtonV3
                            pool={poolInfo as unknown as PoolInfo}
                            showApyText={false}
                            color="text"
                            {...getFarmAprInfo(poolInfo.farm)}
                            fontSize={isMobile ? '20px' : '24px'}
                          />
                        )}
                      </FlexGap>
                      {overrideAprDisplay?.aprDisplay || (
                        <PoolGlobalAprButtonV3
                          pool={poolInfo as unknown as PoolInfo}
                          showApyButton={false}
                          color="text"
                          {...getFarmAprInfo(poolInfo.farm)}
                          fontSize={isMobile ? '20px' : '24px'}
                        />
                      )}
                    </AutoColumn>
                  </Box>
                )}
              </FlexGap>
            )}
          </FlexGap>
        )}
      </Card>
    </>
  )
}
