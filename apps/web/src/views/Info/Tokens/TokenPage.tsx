/* eslint-disable no-nested-ternary */
import { useTranslation } from '@pancakeswap/localization'
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CopyButton,
  Flex,
  Heading,
  Image,
  ScanLink,
  Text,
  Link as UIKitLink,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'

import TextWithSkeleton from 'components/TextWithSkeleton'
import { NextSeo } from 'next-seo'

import truncateHash from '@pancakeswap/utils/truncateHash'
import Page from 'components/Layout/Page'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { ONE_HOUR_SECONDS } from 'config/constants/info'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { tokenInfoV2PageDataAtom } from 'edge/tokenInfoPageDataAtom'
import { useAtomValue } from 'jotai'
import { ChainLinkSupportChains, checkIsStableSwap, multiChainId, multiChainScan } from 'state/info/constant'
import {
  useChainIdByQuery,
  useChainNameByQuery,
  useMultiChainPath,
  useStableSwapPath,
  useTokenPriceDataQuery,
} from 'state/info/hooks'
import { useRouter } from 'next/router'
import { styled } from 'styled-components'
import { getBlockExploreLink } from 'utils'
import { formatAmount } from 'utils/formatInfoNumbers'
import { getTokenNameAlias, getTokenSymbolAlias } from 'utils/getTokenAlias'
import { CurrencyLogo } from 'views/Info/components/CurrencyLogo'
import ChartCard from 'views/Info/components/InfoCharts/ChartCard'
import PoolTable from 'views/Info/components/InfoTables/PoolsTable'
import TransactionTable from 'views/Info/components/InfoTables/TransactionsTable'
import Percent from 'views/Info/components/Percent'
import useCMCLink from 'views/Info/hooks/useCMCLink'
import { DISABLED_ADD_LIQUIDITY_CHAINS } from 'config/constants/liquidity'
import { PERSIST_CHAIN_KEY } from 'config/constants'

dayjs.extend(duration)

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

const StyledCMCLink = styled(UIKitLink)`
  width: 24px;
  height: 24px;
  margin-right: 8px;

  &:hover {
    opacity: 0.8;
  }
`
const DEFAULT_TIME_WINDOW = dayjs.duration(1, 'weeks')

const TokenPage: React.FC<React.PropsWithChildren<{ routeAddress: string }>> = ({ routeAddress }) => {
  const router = useRouter()
  const { isXs, isSm } = useMatchBreakpoints()
  const { t } = useTranslation()
  const chainId = useChainIdByQuery()
  // In case somebody pastes checksummed address into url (since GraphQL expects lowercase address)
  const address = routeAddress.toLowerCase()

  const cmcLink = useCMCLink(address)
  const type = checkIsStableSwap() ? 'stableSwap' : 'swap'

  const {
    token: tokenData,
    pool: poolDatas,
    transactions,
    chartVolume: volumeChartData,
    chartTvl: tvlChartData,
    loading,
  } = useAtomValue(tokenInfoV2PageDataAtom({ address, chain: CHAIN_QUERY_NAME[chainId], type }))

  // pricing data
  const priceData = useTokenPriceDataQuery(address, ONE_HOUR_SECONDS, DEFAULT_TIME_WINDOW)

  const chainPath = useMultiChainPath()
  const chainName = useChainNameByQuery()
  const infoTypeParam = useStableSwapPath()
  const tokenSymbol = tokenData ? getTokenSymbolAlias(tokenData.address, chainId, tokenData.symbol) : ''
  const tokenName = tokenData ? getTokenNameAlias(tokenData.address, chainId, tokenData.name) : ''

  return (
    <Page>
      <NextSeo title={tokenData?.symbol} />
      <>
        {/* Stuff on top */}
        <Flex justifyContent="space-between" mb="24px" flexDirection={['column', 'column', 'row']}>
          <Breadcrumbs mb="32px">
            <NextLinkFromReactRouter to={`/info${chainPath}${infoTypeParam}`}>
              <Text color="primary">{t('Info.section_title')}</Text>
            </NextLinkFromReactRouter>
            <NextLinkFromReactRouter to={`/info${chainPath}/tokens${infoTypeParam}`}>
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
              <StyledCMCLink href={cmcLink} rel="noopener noreferrer nofollow" target="_blank" title="CoinMarketCap">
                <Image src="/images/CMC-logo.svg" height={22} width={22} alt={t('View token on CoinMarketCap')} />
              </StyledCMCLink>
            )}
            {/* <SaveIcon
                  fill={savedTokens.includes(address)}
                  onClick={() => (savedTokens.includes(address) ? removeToken(address) : addToken(address))}
                /> */}
            <CopyButton ml="4px" text={address} tooltipMessage={t('Token address copied')} />
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
              <TextWithSkeleton mr="16px" bold fontSize="24px" loading={loading} width={80}>
                {tokenData ? `$${formatAmount(tokenData.priceUSD, { notation: 'standard' })}` : ''}
              </TextWithSkeleton>
              {!loading ? <Percent value={tokenData?.priceUSDChange} fontWeight={600} /> : null}
            </Flex>
          </Flex>
          <Flex>
            <Button
              mr="8px"
              variant="secondary"
              disabled={!!DISABLED_ADD_LIQUIDITY_CHAINS[chainId]}
              onClick={() => router.push(`/liquidity/pools?chain=${CHAIN_QUERY_NAME[chainId!]}&search=${tokenSymbol}`)}
            >
              {t('Add Liquidity')}
            </Button>
            <NextLinkFromReactRouter
              to={`/swap?outputCurrency=${address}&chainId=${multiChainId[chainName]}&${PERSIST_CHAIN_KEY}=1`}
            >
              <Button>{t('Trade')}</Button>
            </NextLinkFromReactRouter>
          </Flex>
        </Flex>

        {/* data on the right side of chart */}
        <ContentLayout>
          <Card>
            <Box p="24px">
              <Text bold small color="secondary" fontSize="12px" textTransform="uppercase">
                {t('Liquidity')}
              </Text>
              <TextWithSkeleton bold fontSize="24px" width={80} loading={loading}>
                {tokenData ? `$${formatAmount(tokenData.liquidityUSD)}` : ''}
              </TextWithSkeleton>
              {!loading ? <Percent value={tokenData?.liquidityUSDChange} /> : null}

              <Text mt="24px" bold color="secondary" fontSize="12px" textTransform="uppercase">
                {t('Volume 24H')}
              </Text>
              <TextWithSkeleton bold fontSize="24px" textTransform="uppercase" width={80} loading={loading}>
                {!loading ? `$${formatAmount(tokenData?.volumeUSD)}` : ''}
              </TextWithSkeleton>
              {!loading ? <Percent value={tokenData?.volumeUSDChange} /> : null}

              <Text mt="24px" bold color="secondary" fontSize="12px" textTransform="uppercase">
                {t('Volume 7D')}
              </Text>
              <TextWithSkeleton bold fontSize="24px" width={80} loading={loading}>
                {tokenData ? `$${formatAmount(tokenData.volumeUSDWeek)}` : ''}
              </TextWithSkeleton>

              <Text mt="24px" bold color="secondary" fontSize="12px" textTransform="uppercase">
                {t('Transactions 24H')}
              </Text>
              <TextWithSkeleton bold fontSize="24px" width={80} loading={loading}>
                {tokenData ? formatAmount(tokenData.txCount, { isInteger: true }) : ''}
              </TextWithSkeleton>
            </Box>
          </Card>
          {/* charts card */}
          <ChartCard
            variant="token"
            volumeChartData={volumeChartData}
            tvlChartData={tvlChartData}
            tokenData={tokenData}
            tokenPriceData={priceData}
          />
        </ContentLayout>

        {/* pools and transaction tables */}
        <Heading scale="lg" mb="16px" mt="40px">
          {t('Pairs')}
        </Heading>

        <PoolTable poolDatas={poolDatas} />

        <Heading scale="lg" mb="16px" mt="40px">
          {t('Transactions')}
        </Heading>

        <TransactionTable transactions={transactions} />
      </>
    </Page>
  )
}

export default TokenPage
