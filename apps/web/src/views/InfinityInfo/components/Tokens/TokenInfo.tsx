import { useTranslation } from '@pancakeswap/localization'
import {
  AutoColumn,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CopyButton,
  Flex,
  Heading,
  Image,
  Message,
  MessageText,
  ScanLink,
  Spinner,
  Text,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'

import Page from 'components/Layout/Page'
import { TabToggle, TabToggleGroup } from 'components/TabToggle'
import { CHAIN_QUERY_NAME } from 'config/chains'
import dayjs from 'dayjs'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useTheme from 'hooks/useTheme'
import dynamic from 'next/dynamic'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { getBlockExploreLink, safeGetAddress, isAddressEqual } from 'utils'
import { formatAmount } from 'utils/formatInfoNumbers'

import { CAKE, USDT } from '@pancakeswap/tokens'
import isUndefinedOrNull from '@pancakeswap/utils/isUndefinedOrNull'
import truncateHash from '@pancakeswap/utils/truncateHash'
import { getSelectInfinityLiquidityURL } from 'config/constants/liquidity'
import { ChainLinkSupportChains, multiChainId, multiChainScan } from 'state/info/constant'
import {
  useChainNameByQuery,
  useMultiChainPath,
  useStableSwapPath,
  useTokenDataQuery,
  useTokenTransactionsQuery,
} from 'state/info/hooks'
import { styled } from 'styled-components'
import { getTokenNameAlias, getTokenSymbolAlias } from 'utils/getTokenAlias'
import { isAddress, zeroAddress } from 'viem'
import { CurrencyLogo } from 'views/Info/components/CurrencyLogo'
import useCMCLink from 'views/Info/hooks/useCMCLink'
// import BarChart from '../components/BarChart/alt'
import { PoolDataForView, Transaction } from 'state/info/types'
import BarChart from 'views/V3Info/components/BarChart/alt'
import { LocalLoader } from 'views/V3Info/components/Loader'
import Percent from 'views/V3Info/components/Percent'
import PoolTable from 'views/V3Info/components/PoolTable'
import TransactionTable from 'views/V3Info/components/TransactionsTable'
import { MonoSpace, StyledCMCLink } from 'views/V3Info/components/shared'
import { unixToDate } from 'views/V3Info/utils/date'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { infinityInfoPath } from '../../constants'
import { usePoolsDataForToken } from './hooks/usePoolsDataForToken'
import { useTokenChartData } from './hooks/useTokenChartData'

const LineChart = dynamic(() => import('views/V3Info/components/LineChart/alt'), {
  ssr: false,
})

const ContentLayout = styled.div`
  margin-top: 16px;
  display: grid;
  grid-template-columns: 260px 1fr;
  grid-gap: 1em;
  @media screen and (max-width: 800px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
`

enum ChartView {
  TVL = 0,
  VOL = 1,
  PRICE_INFI_CL = 2,
  PRICE_INFI_BIN = 3,
}

const TokenInfo: React.FC<{ address: string }> = ({ address }) => {
  const { isXs, isSm } = useMatchBreakpoints()
  // const chainId = useChainIdByQuery()
  // eslint-disable-next-line no-param-reassign
  address = address.toLowerCase()
  const cmcLink = useCMCLink(address)
  const { isDark } = useTheme()

  // scroll on page view
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const { t } = useTranslation()
  const tokenData = useTokenDataQuery(address)
  const poolDatas = usePoolsDataForToken(address)
  const transactions = useTokenTransactionsQuery(address)
  const chartData = useTokenChartData(address)
  const formatPoolData: PoolDataForView[] = useMemo(() => {
    if (!poolDatas) return []
    return poolDatas.filter((pool): pool is PoolDataForView => !isUndefinedOrNull(pool)) ?? []
  }, [poolDatas])

  const formattedTvlData = useMemo(() => {
    if (chartData) {
      return chartData.map((day) => {
        return {
          time: unixToDate(day.date),
          value: day.totalValueLockedUSD,
        }
      })
    }
    return []
  }, [chartData])

  const formattedVolumeData = useMemo(() => {
    if (chartData) {
      return chartData.map((day) => {
        return {
          time: unixToDate(day.date),
          value: day.volumeUSD,
        }
      })
    }
    return []
  }, [chartData])

  // chart labels
  const [view, setView] = useState(ChartView.TVL)
  const [latestValue, setLatestValue] = useState<number | undefined>()
  const [valueLabel, setValueLabel] = useState<string | undefined>()

  // pricing data
  // const infinityClPriceData = useTokenPriceData(address, 'week', 'infinityCl')
  // const infinityBinPriceData = useTokenPriceData(address, 'week', 'infinityBin')
  // const getAdjustedToCurrent = useCallback(
  //   (priceData) => {
  //     if (priceData && tokenData && priceData.length > 0) {
  //       const adjusted = [...priceData]
  //       adjusted.push({
  //         time: currentTimestamp() / 1000,
  //         open: priceData[priceData.length - 1].close,
  //         close: tokenData?.priceUSD,
  //         high: tokenData?.priceUSD,
  //         low: priceData[priceData.length - 1].close,
  //       })
  //       return adjusted
  //     }
  //     return undefined
  //   },
  //   [tokenData],
  // )
  // const [infinityClAdjustedToCurrent, infinityBinAdjustedToCurrent] = useMemo(() => {
  //   return [getAdjustedToCurrent(infinityClPriceData), getAdjustedToCurrent(infinityBinPriceData)]
  // }, [getAdjustedToCurrent, infinityClPriceData, infinityBinPriceData])
  const chainPath = useMultiChainPath()
  const infoTypeParam = useStableSwapPath()
  const chainName = useChainNameByQuery()
  const { chainId } = useActiveChainId()

  const tokenSymbol = getTokenSymbolAlias(address, chainId, tokenData?.symbol)
  const tokenName = getTokenNameAlias(address, chainId, tokenData?.name)
  const swapOutputCurrency =
    isAddress(address) && isAddressEqual(address, zeroAddress) ? CAKE[multiChainId[chainName]].address : address
  const addLiquidityUrl = useMemo(() => {
    const addr = safeGetAddress(address)
    return getSelectInfinityLiquidityURL({
      chainId,
      protocol: 'infinity',
      currency0: addr,
      currency1: addr
        ? isAddressEqual(addr, zeroAddress)
          ? CAKE[chainId].address ?? USDT[chainId].address
          : zeroAddress
        : undefined,
    })
  }, [chainId, address])

  return (
    <Page>
      {tokenData ? (
        !tokenData.exists ? (
          <Card>
            <Box p="16px">
              <Text>
                {t('No pair has been created with this token yet. Create one')}
                <NextLinkFromReactRouter style={{ display: 'inline', marginLeft: '6px' }} to={`/add/${address}`}>
                  {t('here.')}
                </NextLinkFromReactRouter>
              </Text>
            </Box>
          </Card>
        ) : (
          <AutoColumn gap="32px">
            <AutoColumn gap="32px">
              <Flex justifyContent="space-between" mb="24px" flexDirection={['column', 'column', 'row']}>
                <Breadcrumbs mb="32px">
                  <NextLinkFromReactRouter to={`/${infinityInfoPath}${chainPath}${infoTypeParam}`}>
                    <Text color="primary">{t('Info.detail')}</Text>
                  </NextLinkFromReactRouter>
                  <NextLinkFromReactRouter to={`/${infinityInfoPath}${chainPath}/tokens${infoTypeParam}`}>
                    <Text color="primary">{t('Tokens')}</Text>
                  </NextLinkFromReactRouter>
                  <Flex>
                    <Text mr="8px">{tokenSymbol}</Text>
                    <Text>{`(${truncateHash(address)})`}</Text>
                  </Flex>
                </Breadcrumbs>
                <Flex justifyContent={[null, null, 'flex-end']} mt={['8px', '8px', 0]} alignItems="center">
                  <ScanLink
                    mr="8px"
                    color="primary"
                    useBscCoinFallback={ChainLinkSupportChains.includes(multiChainId[chainName])}
                    href={getBlockExploreLink(address, 'address', multiChainId[chainName])}
                  >
                    {t('View on %site%', { site: multiChainScan[chainName] })}
                  </ScanLink>
                  {cmcLink && (
                    <StyledCMCLink
                      href={cmcLink}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      title="CoinMarketCap"
                    >
                      <Image src="/images/CMC-logo.svg" height={22} width={22} alt={t('View token on CoinMarketCap')} />
                    </StyledCMCLink>
                  )}
                  <CopyButton text={address} tooltipMessage={t('Token address copied')} />
                </Flex>
              </Flex>
              <Flex justifyContent="space-between" flexDirection={['column', 'column', 'column', 'row']}>
                <Flex flexDirection="column" mb={['8px', null]}>
                  <Flex alignItems="center">
                    <CurrencyLogo size="32px" address={address} chainName={chainName} />
                    <Text
                      ml="12px"
                      bold
                      lineHeight="0.7"
                      fontSize={isXs || isSm ? '24px' : '40px'}
                      id="info-token-name-title"
                    >
                      {tokenName}
                    </Text>
                    <Text ml="12px" lineHeight="1" color="textSubtle" fontSize={isXs || isSm ? '14px' : '20px'}>
                      ({tokenSymbol})
                    </Text>
                  </Flex>
                  <Flex mt="8px" ml="46px" alignItems="center">
                    <Text mr="16px" bold fontSize="24px">
                      ${formatAmount(tokenData.priceUSD, { notation: 'standard' })}
                    </Text>
                    <Percent value={tokenData.priceUSDChange} fontWeight={600} />
                  </Flex>
                </Flex>
                <Flex>
                  {chainId ? (
                    <NextLinkFromReactRouter to={addLiquidityUrl}>
                      <Button mr="8px" variant="secondary">
                        {t('Add Liquidity')}
                      </Button>
                    </NextLinkFromReactRouter>
                  ) : null}
                  <NextLinkFromReactRouter
                    to={`/swap?outputCurrency=${swapOutputCurrency}&chain=${
                      CHAIN_QUERY_NAME[multiChainId[chainName]]
                    }&${PERSIST_CHAIN_KEY}=1`}
                  >
                    <Button>{t('Trade')}</Button>
                  </NextLinkFromReactRouter>
                </Flex>
              </Flex>
            </AutoColumn>
            {tokenData.tvlUSD <= 0 && (
              <Message variant="warning">
                <MessageText fontSize="16px">
                  {t('TVL is currently too low to represent the data correctly')}
                </MessageText>
              </Message>
            )}
            <ContentLayout>
              <Card>
                <Box p="24px">
                  <Text bold small color="secondary" fontSize="12px" textTransform="uppercase">
                    {t('TVL')}
                  </Text>
                  <Text bold fontSize="24px">
                    ${formatAmount(tokenData.tvlUSD)}
                  </Text>
                  <Percent value={tokenData.tvlUSDChange} />

                  <Text mt="24px" bold color="secondary" fontSize="12px" textTransform="uppercase">
                    {t('Volume 24H')}
                  </Text>
                  <Text bold fontSize="24px" textTransform="uppercase">
                    ${formatAmount(tokenData.volumeUSD)}
                  </Text>
                  <Percent value={tokenData.volumeUSDChange} />

                  <Text mt="24px" bold color="secondary" fontSize="12px" textTransform="uppercase">
                    {t('Volume 7D')}
                  </Text>
                  <Text bold fontSize="24px">
                    ${formatAmount(tokenData.volumeUSDWeek)}
                  </Text>

                  <Text mt="24px" bold color="secondary" fontSize="12px" textTransform="uppercase">
                    {t('Transactions 24H')}
                  </Text>
                  <Text bold fontSize="24px">
                    {formatAmount(tokenData.txCount, { isInteger: true })}
                  </Text>
                </Box>
              </Card>
              <Card>
                <TabToggleGroup>
                  <TabToggle isActive={view === ChartView.VOL} onClick={() => setView(ChartView.VOL)}>
                    <Text>{t('Volume')}</Text>
                  </TabToggle>
                  <TabToggle isActive={view === ChartView.TVL} onClick={() => setView(ChartView.TVL)}>
                    <Text>{t('Liquidity')}</Text>
                  </TabToggle>
                  {/* <TabToggle
                    isActive={view === ChartView.PRICE_INFI_CL}
                    onClick={() => setView(ChartView.PRICE_INFI_CL)}
                  >
                    <Text>
                      {t('CLAMM')} {t('Price')}
                    </Text>
                  </TabToggle>
                  <TabToggle
                    isActive={view === ChartView.PRICE_INFI_BIN}
                    onClick={() => setView(ChartView.PRICE_INFI_BIN)}
                  >
                    <Text>
                      {t('LBAMM')} {t('Price')}
                    </Text>
                  </TabToggle> */}
                </TabToggleGroup>
                <Flex flexDirection="column" px="24px" pt="24px">
                  {latestValue
                    ? formatDollarAmount(latestValue, 2)
                    : view === ChartView.VOL
                    ? formatDollarAmount(formattedVolumeData[formattedVolumeData.length - 1]?.value)
                    : view === ChartView.TVL
                    ? formatDollarAmount(formattedTvlData[formattedTvlData.length - 1]?.value)
                    : formatDollarAmount(tokenData.priceUSD, 2)}
                  <Text small color="secondary">
                    {valueLabel ? (
                      <MonoSpace>{valueLabel}</MonoSpace>
                    ) : (
                      <MonoSpace>{dayjs.utc().format('MMM D, YYYY')}</MonoSpace>
                    )}
                  </Text>
                </Flex>
                <Box height="320px">
                  {view === ChartView.TVL ? (
                    <LineChart
                      data={formattedTvlData}
                      color={isDark ? '#9A6AFF' : '#7A6EAA'}
                      minHeight={340}
                      value={latestValue}
                      label={valueLabel}
                      setValue={setLatestValue}
                      setLabel={setValueLabel}
                    />
                  ) : view === ChartView.VOL ? (
                    <BarChart
                      data={formattedVolumeData}
                      color="#1FC7D4"
                      minHeight={340}
                      value={latestValue}
                      label={valueLabel}
                      setValue={setLatestValue}
                      setLabel={setValueLabel}
                    />
                  ) : // : view === ChartView.PRICE_INFI_CL ? (
                  //   <CandleChart
                  //     data={infinityClAdjustedToCurrent}
                  //     setValue={setLatestValue}
                  //     setLabel={setValueLabel}
                  //   />
                  // ) : view === ChartView.PRICE_INFI_BIN ? (
                  //   <CandleChart
                  //     data={infinityBinAdjustedToCurrent}
                  //     setValue={setLatestValue}
                  //     setLabel={setValueLabel}
                  //   />
                  // )
                  null}
                </Box>
              </Card>
            </ContentLayout>
            <Heading>{t('Pairs')}</Heading>
            <PoolTable poolDatas={formatPoolData} />
            <Heading>{t('Transactions')}</Heading>
            {transactions ? (
              <TransactionTable transactions={transactions as Transaction[]} />
            ) : (
              <LocalLoader fill={false} />
            )}
          </AutoColumn>
        )
      ) : (
        <Flex mt="80px" justifyContent="center">
          <Spinner />
        </Flex>
      )}
    </Page>
  )
}

export default TokenInfo
