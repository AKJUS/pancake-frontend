import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { Percent, getUnifiedCurrencyAddress } from '@pancakeswap/swap-sdk-core'
import {
  AutoColumn,
  Box,
  BscScanIcon,
  Card,
  CardBody,
  CopyButton,
  Flex,
  FlexGap,
  Grid,
  Link,
  MiscellaneousIcon,
  OpenNewIcon,
  Spinner,
  SwapHorizIcon,
  Tab,
  TabMenu,
  Tag,
  Text,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'

import { formatNumber } from '@pancakeswap/utils/formatNumber'
import {
  CurrencyLogo,
  DoubleCurrencyLogo,
  FeeTierTooltip,
  LightGreyCard,
  Liquidity,
} from '@pancakeswap/widgets-internal'
import { InfinityFeeTierBreakdown } from 'components/FeeTierBreakdown'
import { MiniUniversalFarmsOverlay } from 'components/MiniUniversalFarms/MiniUniversalFarmsOverlay'
import { useHookByPoolId } from 'hooks/infinity/useHooksList'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { NextSeo } from 'next-seo'
import { useMemo, useState } from 'react'
import { InfinityPoolInfo, PoolInfo as PoolInfoType, SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { useChainIdByQuery } from 'state/info/hooks'
import { getBlockExploreLink } from 'utils'
import { getTokenSymbolAlias } from 'utils/getTokenAlias'
import { isInfinityProtocol } from 'utils/protocols'
import { Tooltips } from 'components/Tooltips'
import { getRewardProvider, getRewardMultiplier } from 'views/universalFarms/components/FarmStatusDisplay/hooks'
import { PoolGlobalAprButtonV3 } from 'views/universalFarms/components/PoolAprButtonV3'
import { RewardInfoCard } from 'views/universalFarms/components/RewardInfoCard'
import LiquiditySunsetWarning from 'components/Liquidity/LiquiditySunsetWarning'
import { isSolana } from '@pancakeswap/chains'
import { AprInfo } from 'state/farmsV4/hooks'
import { usePoolInfoByQuery } from '../hooks/usePoolInfo'
import { usePoolSymbol } from '../hooks/usePoolSymbol'
import { useFlipCurrentPrice } from '../state/flipCurrentPrice'
import { MyPositions } from './MyPositions'
import { PoolCharts } from './PoolCharts'
import { PoolFeaturesModal } from './PoolFeaturesModal'
import { PoolStatus } from './PoolStatus'
import { PoolTvlWarning } from './PoolTvlWarning'
import { Transactions } from './Transactions'

enum PoolDetailTab {
  MyPositions = 0,
  Transactions = 1,
}

const RewardInfoCardContainer = ({ poolInfo }: { poolInfo: PoolInfoType }) => {
  const provider = getRewardProvider(poolInfo.chainId, poolInfo.lpAddress)
  const multiplier = getRewardMultiplier(poolInfo.chainId, poolInfo.lpAddress)
  const hasPoolReward = !!provider

  if (!hasPoolReward) return null

  return <RewardInfoCard provider={provider} multiplier={multiplier} />
}

export const PoolInfo = () => {
  const { t } = useTranslation()
  const { isMobile, isMd } = useMatchBreakpoints()
  const { poolSymbol } = usePoolSymbol()

  const poolInfo = usePoolInfoByQuery()

  const protocol = poolInfo?.protocol

  const chainId = useChainIdByQuery()
  const isSolanaChain = isSolana(chainId)

  const isSmallScreen = isMobile || isMd

  const [flipCurrentPrice, setFlipCurrentPrice] = useFlipCurrentPrice()
  const [tab, setTab] = useState(PoolDetailTab.MyPositions)

  const currency0 =
    useUnifiedCurrency(poolInfo?.token0 ? getUnifiedCurrencyAddress(poolInfo.token0) : undefined, chainId) ??
    poolInfo?.token0 ??
    undefined
  const currency1 =
    useUnifiedCurrency(poolInfo?.token1 ? getUnifiedCurrencyAddress(poolInfo.token1) : undefined, chainId) ??
    poolInfo?.token1 ??
    undefined

  const fee = useMemo(() => {
    return new Percent(poolInfo?.feeTier ?? 0n, poolInfo?.feeTierBase)
  }, [poolInfo?.feeTier, poolInfo?.feeTierBase])

  const poolId = (poolInfo as InfinityPoolInfo)?.poolId
  const hookData = useHookByPoolId(chainId, poolId)

  const aprInfo = useMemo(() => {
    if (isSolanaChain && poolInfo) {
      const { feeApr, rewardApr } = (poolInfo as SolanaV3PoolInfo).rawPool.day
      return {
        lpApr: `${feeApr / 100}`,
        cakeApr: { value: `${rewardApr.reduce((acc: number, i: number) => acc + i / 100, 0)}` },
        merklApr: '0',
        incentraApr: '0',
      } satisfies AprInfo
    }
    return undefined
  }, [poolInfo, isSolanaChain])

  if (!poolInfo)
    return (
      <Flex mt="80px" justifyContent="center">
        <Spinner />
      </Flex>
    )

  return (
    <AutoColumn gap={['16px', null, null, '48px']}>
      <LiquiditySunsetWarning overrideChainId={poolInfo?.chainId} />

      <NextSeo title={poolSymbol} />
      <Card>
        <CardBody>
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
                <MiniUniversalFarmsOverlay linkType="poolDetail" />
              </Box>
              <FlexGap flexDirection="column" gap="16px">
                <FlexGap
                  gap="12px"
                  alignItems={isSmallScreen ? 'flex-start' : 'center'}
                  flexDirection={isSmallScreen ? 'column' : 'row'}
                >
                  <Box>
                    <Flex alignItems="center" justifyContent="center" position="relative">
                      <DoubleCurrencyLogo
                        currency0={currency0}
                        currency1={currency1}
                        size={48}
                        innerMargin="2px"
                        showChainLogoCurrency1
                      />
                    </Flex>
                  </Box>
                  <FlexGap gap="4px" alignItems="center">
                    <Text bold fontSize={32} style={{ lineHeight: '1' }}>
                      {currency0?.isNative
                        ? currency0?.symbol
                        : getTokenSymbolAlias(currency0?.wrapped?.address, currency0?.chainId, currency0?.symbol)}
                    </Text>
                    <Text color="textSubtle" bold fontSize={32} style={{ lineHeight: '1' }}>
                      /
                    </Text>
                    <Text bold fontSize={32} style={{ lineHeight: '1' }}>
                      {getTokenSymbolAlias(currency1?.wrapped?.address, currency1?.chainId, currency1?.symbol)}
                    </Text>
                  </FlexGap>
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
                              <Text>{poolSymbol}</Text>
                            </FlexGap>

                            <FlexGap gap="4px" alignItems="center">
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
                                tooltipMessage={t('Pair address copied')}
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
                <FlexGap gap="16px" flexWrap="wrap" alignItems="center" alignContent="center">
                  {poolInfo?.protocol ? (
                    <AutoColumn rowGap="4px">
                      <Box>
                        {isInfinityProtocol(poolInfo.protocol) ? (
                          <InfinityFeeTierBreakdown
                            poolId={poolId}
                            chainId={chainId}
                            hookData={hookData}
                            infoIconVisible={false}
                            showType={false}
                          />
                        ) : (
                          <FeeTierTooltip
                            type={poolInfo.protocol}
                            percent={fee}
                            dynamic={poolInfo?.isDynamicFee}
                            showType={false}
                          />
                        )}
                      </Box>
                    </AutoColumn>
                  ) : null}

                  <Liquidity.PoolFeaturesBadge
                    showPoolType
                    showPoolFeature={false}
                    showPoolTypeInfo={false}
                    showPoolFeatureInfo={false}
                    poolType={poolInfo.protocol}
                    hookData={hookData}
                    showLabel={false}
                  />

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
              </FlexGap>
            </FlexGap>

            <FlexGap gap="16px" flexDirection={['column', null, 'row']}>
              <Box p="8px 16px" width="100%">
                <FlexGap gap="8px" alignItems="center">
                  <Text fontSize={12} bold color="textSubtle" textTransform="uppercase" style={{ userSelect: 'none' }}>
                    {t('Current Price')}
                  </Text>
                  <SwapHorizIcon
                    color="primary60"
                    onClick={() => setFlipCurrentPrice(!flipCurrentPrice)}
                    style={{ cursor: 'pointer' }}
                  />
                </FlexGap>
                <FlexGap mt="2px" gap="8px" alignItems="center" width="100%">
                  <Text fontSize={28} bold width="max-content">
                    {formatNumber(Number(flipCurrentPrice ? poolInfo.token0Price : poolInfo.token1Price), {
                      maximumSignificantDigits: 6,
                      maxDecimalDisplayDigits: 6,
                    })}
                  </Text>

                  <Text fontSize={12} color="textSubtle" textTransform="uppercase" width="max-content">
                    {t(
                      '%assetA% = 1 %assetB%',
                      flipCurrentPrice
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
              <LightGreyCard padding="8px 16px">
                <AutoColumn rowGap="2px">
                  <FlexGap>
                    <Text fontSize={12} bold color="textSubtle" textTransform="uppercase" minWidth="max-content">
                      {t('Est. APR')}
                    </Text>
                    {isSolanaChain ? null : <PoolGlobalAprButtonV3 pool={poolInfo} showApyText={false} />}
                  </FlexGap>
                  {poolInfo ? (
                    <PoolGlobalAprButtonV3
                      clickable={!isSolanaChain}
                      aprInfo={aprInfo}
                      pool={poolInfo}
                      showApyButton={false}
                    />
                  ) : null}
                </AutoColumn>
              </LightGreyCard>
            </FlexGap>
          </FlexGap>
        </CardBody>
      </Card>

      <AutoColumn gap="lg">
        <PoolTvlWarning poolInfo={poolInfo} />
        <Grid gridGap="24px" gridTemplateColumns={['1fr', '1fr', '1fr', '2fr 1fr']}>
          <PoolCharts poolInfo={poolInfo} />
          <PoolStatus poolInfo={poolInfo} style={{ order: isSmallScreen ? -1 : undefined }} />
        </Grid>
      </AutoColumn>

      <Box>
        <Box style={{ margin: isSmallScreen ? '0 30px -3px' : '0 24px -3px' }}>
          <TabMenu activeIndex={tab} onItemClick={setTab}>
            <Tab
              isActive={tab === PoolDetailTab.MyPositions}
              onClick={() => setTab(PoolDetailTab.MyPositions)}
              key="my-positions"
            >
              <span style={{ fontSize: isSmallScreen ? '12px' : '16px' }}>{t('My Positions')}</span>
            </Tab>
            <Tab
              isActive={tab === PoolDetailTab.Transactions}
              onClick={() => setTab(PoolDetailTab.Transactions)}
              key="transactions"
            >
              <span style={{ fontSize: isSmallScreen ? '12px' : '16px' }}>{t('Transactions')}</span>
            </Tab>
          </TabMenu>
        </Box>

        {tab === PoolDetailTab.MyPositions ? <MyPositions poolInfo={poolInfo} /> : null}
        {tab === PoolDetailTab.Transactions ? <Transactions protocol={poolInfo.protocol} /> : null}

        {poolInfo && (
          <Box>
            <RewardInfoCardContainer poolInfo={poolInfo} />
          </Box>
        )}
      </Box>
    </AutoColumn>
  )
}
