import { isEvm, NonEVMChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { WNATIVE } from '@pancakeswap/sdk'
import { ZERO_ADDRESS } from '@pancakeswap/swap-sdk-core'
import {
  ArrowBackIcon,
  Box,
  Button,
  ButtonMenu,
  ButtonMenuItem,
  Flex,
  FlexGap,
  Spinner,
  Text,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import { CurrencyLogo, LightGreyShadowCard } from '@pancakeswap/widgets-internal'
import { useQueries, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { useCallback, useMemo, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { erc20Abi, formatUnits, type Address } from 'viem'
import { chainIdToExplorerInfoChainName, explorerApiClient } from 'state/info/api/client'
import { publicClient } from 'utils/wagmi'
import styled, { keyframes, useTheme } from 'styled-components'
import { formatAmount } from 'utils/formatInfoNumbers'
import { safeGetUnifiedAddress } from 'utils/safeGetAddress'

import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { BalanceData } from 'hooks/useAddressBalance'
import { PnLTag } from './PnLTag'
import { useEnhancedTokenLogo } from './hooks/useEnhancedTokenLogo'

const PERIOD_OPTIONS = ['1D', '1W', '1M', '1Y'] as const
const PERIOD_LABELS = ['D', 'W', 'M', 'Y'] as const

// The Explorer API indexes tokens by ERC20 contract address; it has no entry for
// the zero-address placeholder that wallet-api returns for native balances.
// Map natives to their wrapped equivalent for stats/chart queries only — the UI
// still displays the native symbol, name, and balance from the wallet-api payload.
const WSOL_ADDRESS = 'So11111111111111111111111111111111111111112'

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
`

const Backdrop = styled(Box)`
  position: absolute;
  inset: 0;
  background: ${({ theme }) => theme.colors.backgroundOverlay ?? 'rgba(40, 13, 95, 0.6)'};
  z-index: 20;
  animation: ${fadeIn} 200ms ease-out;
  border-radius: 24px;
`

const PanelSheet = styled(Box)`
  position: absolute;
  left: 0;
  right: 0;
  top: auto;
  bottom: 0;
  max-height: calc(100% - 32px);
  z-index: 21;
  background: ${({ theme }) => theme.colors.backgroundAlt};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  animation: ${slideUp} 300ms cubic-bezier(0.61, 1, 0.88, 1);
`

const PageContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.backgroundAlt};
`

const ScrollArea = styled(Box)`
  overflow-y: auto;
  padding: 0 16px 16px;
`

const HeaderRow = styled(Flex)`
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.cardBorder};
`

const StatsRow = styled(Flex)`
  justify-content: space-between;
  gap: 8px;
  padding: 12px 0 4px;
`

const StatCell = styled(Flex)`
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-align: center;
`

const BalanceCard = styled(LightGreyShadowCard)`
  border-radius: 24px;
  margin-top: 16px;
`

const ChartBox = styled(Box)`
  width: 100%;
  height: 148px;
  padding-top: 8px;
`

const ChartTooltip = styled(Box)`
  background: ${({ theme }) => theme.colors.cardSecondary};
  color: ${({ theme }) => theme.colors.textSubtle};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  padding: 6px 10px;
  border-radius: 16px;
  font-size: 12px;
  line-height: 1.5;
  font-family: Kanit, sans-serif;
  pointer-events: none;
`

const IconButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
`

interface TokenDetailsPanelProps {
  asset: BalanceData
  onClose: () => void
  onDismissModal: () => void
}

const formatStat = (value?: string | null) => {
  if (value == null) return '—'
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `$${formatAmount(num)}`
}

const formatUsd = (value?: string | number | null) => {
  if (value == null) return '$0.00'
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '$0.00'
  if (num > 0 && num < 0.01) return '<$0.01'
  return `$${formatAmount(num)}`
}

// Stablecoins move in tiny sub-cent increments — force 4 decimals below $1 so
// the chart tooltip shows meaningful differences between data points.
const formatUsdPrecise = (value: number) => {
  if (!Number.isFinite(value)) return '$0.00'
  if (value > 0 && value < 0.0001) return '<$0.0001'
  if (value < 1) return `$${value.toFixed(4)}`
  return `$${formatAmount(value)}`
}

export const TokenDetailsPanel: React.FC<TokenDetailsPanelProps> = ({ asset, onClose, onDismissModal }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const theme = useTheme()
  const { isMobile } = useMatchBreakpoints()
  const { getEnhancedLogoURI } = useEnhancedTokenLogo()
  const [periodIndex, setPeriodIndex] = useState(0)

  const chainName = chainIdToExplorerInfoChainName[asset.chainId as keyof typeof chainIdToExplorerInfoChainName]
  const period = PERIOD_OPTIONS[periodIndex]

  const chartAddress = useMemo(() => {
    const raw = asset.token.address
    if (asset.chainId === NonEVMChainId.SOLANA && (!raw || raw === ZERO_ADDRESS)) {
      return WSOL_ADDRESS
    }
    if (raw === ZERO_ADDRESS) {
      return WNATIVE[asset.chainId as keyof typeof WNATIVE]?.address ?? raw
    }
    return raw
  }, [asset.chainId, asset.token.address])

  const tokenDataQuery = useQuery({
    queryKey: ['walletTokenDetailV2', asset.chainId, chartAddress],
    queryFn: async ({ signal }) => {
      const res = await explorerApiClient.GET('/cached/tokens/v2/{chainName}/{address}', {
        signal,
        params: { path: { chainName: chainName!, address: chartAddress } },
      })
      return res.data ?? null
    },
    enabled: Boolean(chainName) && Boolean(chartAddress),
    staleTime: 60 * 1000,
    retry: 1,
  })

  const chartQueries = useQueries({
    queries: PERIOD_OPTIONS.map((p) => ({
      queryKey: ['walletTokenDetailChart', asset.chainId, chartAddress, p],
      queryFn: async ({ signal }: { signal?: AbortSignal }) => {
        const res = await explorerApiClient.GET('/cached/tokens/chart/{chainName}/{address}/price', {
          signal,
          params: { path: { chainName: chainName!, address: chartAddress }, query: { period: p } },
        })
        return res.data ?? []
      },
      enabled: Boolean(chainName) && Boolean(chartAddress),
      staleTime: 60 * 1000,
      retry: 1,
    })),
  })
  const chartQuery = chartQueries[periodIndex]

  // Total supply: only fetch for non-native ERC20 tokens. Natives (ETH, BNB) have
  // no fixed on-chain supply and their wrapped-contract supply ≠ native supply.
  // Solana tokens would need RPC, not worth the extra surface area — leave as —.
  const isEvmChain = isEvm(asset.chainId)
  const isNativeAsset = asset.token.address === ZERO_ADDRESS
  const totalSupplyQuery = useQuery({
    queryKey: ['erc20TotalSupply', asset.chainId, chartAddress],
    queryFn: async () => {
      const client = publicClient({ chainId: asset.chainId })
      if (!client) return null
      return client.readContract({
        address: chartAddress as Address,
        abi: erc20Abi,
        functionName: 'totalSupply',
      })
    },
    enabled: isEvmChain && !isNativeAsset && Boolean(chartAddress),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const totalSupplyNum = useMemo(() => {
    const raw = totalSupplyQuery.data
    if (raw == null) return undefined
    const formatted = formatUnits(raw, asset.token.decimals)
    const num = Number(formatted)
    return Number.isFinite(num) ? num : undefined
  }, [totalSupplyQuery.data, asset.token.decimals])

  const fdv = useMemo(() => {
    const price = Number(tokenDataQuery.data?.priceUSD ?? asset.price?.usd ?? NaN)
    if (!Number.isFinite(price) || totalSupplyNum == null) return undefined
    return totalSupplyNum * price
  }, [totalSupplyNum, tokenDataQuery.data?.priceUSD, asset.price?.usd])

  const priceChangePercent = useMemo(() => {
    const { data } = tokenDataQuery
    if (!data) return undefined
    const current = Number(data.priceUSD)
    const past = Number(data.priceUSD24h)
    if (!Number.isFinite(current) || !Number.isFinite(past) || past === 0) return undefined
    return ((current - past) / past) * 100
  }, [tokenDataQuery.data])

  const chartPoints = useMemo(() => {
    return (chartQuery.data ?? [])
      .map((d) => ({
        time: typeof d.bucket === 'string' ? dayjs(d.bucket).valueOf() : 0,
        value: d.close != null ? Number(d.close) : 0,
      }))
      .filter((p) => p.time > 0 && Number.isFinite(p.value))
  }, [chartQuery.data])

  const tokenInfo = useMemo(() => {
    const isNative = asset.token.address === ZERO_ADDRESS
    const address = isNative ? undefined : safeGetUnifiedAddress(asset.chainId, asset.token.address)
    return {
      chainId: asset.chainId,
      address,
      isNative,
      isToken: !isNative,
      decimals: asset.token.decimals,
      symbol: asset.token.symbol,
      name: asset.token.name,
      logoURI: getEnhancedLogoURI(asset.token.address, asset.chainId, asset.token.logoURI),
    }
  }, [
    asset.chainId,
    asset.token.address,
    asset.token.decimals,
    asset.token.symbol,
    asset.token.name,
    asset.token.logoURI,
    getEnhancedLogoURI,
  ])

  const quantityDisplay = useMemo(() => {
    const quantityNum = parseFloat(asset.quantity)
    if (quantityNum < 0.000001) return '<0.000001'
    return quantityNum.toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 2 })
  }, [asset.quantity])

  const handleSwap = useCallback(() => {
    onDismissModal()
    const chainQueryName = CHAIN_QUERY_NAME[asset.chainId as keyof typeof CHAIN_QUERY_NAME]
    router.push({
      pathname: '/swap',
      query: {
        inputCurrency: asset.token.address,
        ...(chainQueryName ? { chain: chainQueryName, [PERSIST_CHAIN_KEY]: '1' } : {}),
      },
    })
  }, [asset.chainId, asset.token.address, onDismissModal, router])

  const chartColor = theme.colors.primary60 ?? '#02919D'

  const Container = isMobile ? PageContainer : PanelSheet

  return (
    <>
      {!isMobile && <Backdrop onClick={onClose} />}
      <Container>
        <HeaderRow>
          <FlexGap alignItems="center" gap="4px" minWidth={0}>
            <IconButton type="button" onClick={onClose} aria-label={t('Back')}>
              <ArrowBackIcon width="24px" color="text" />
            </IconButton>
            <CurrencyLogo showChainLogo currency={tokenInfo} size="40px" />
            <Box minWidth={0} ml="8px">
              <Text bold fontSize="16px">
                {asset.token.symbol}
              </Text>
              <Text color="textSubtle" fontSize="14px">
                {asset.token.name}
              </Text>
            </Box>
          </FlexGap>
          <FlexGap flexDirection="column" alignItems="flex-end" gap="2px" flexShrink={0}>
            <Text bold fontSize="16px">
              {formatUsd(tokenDataQuery.data?.priceUSD ?? asset.price?.usd)}
            </Text>
            {priceChangePercent !== undefined && <PnLTag priceChangePercent={priceChangePercent} size="sm" />}
          </FlexGap>
        </HeaderRow>

        <ScrollArea>
          <ChartBox>
            {chartQuery.isFetching && chartPoints.length === 0 && !chartQuery.isError ? (
              <Flex alignItems="center" justifyContent="center" height="100%">
                <Spinner size={60} />
              </Flex>
            ) : chartPoints.length === 0 ? (
              <Flex alignItems="center" justifyContent="center" height="100%">
                <Text color="textSubtle" fontSize="14px">
                  {t('Chart data unavailable')}
                </Text>
              </Flex>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartPoints} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tokenDetailChartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip
                    cursor={{ stroke: theme.colors.textSubtle, strokeDasharray: '2 2' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const point = payload[0].payload as { time: number; value: number }
                      return (
                        <ChartTooltip>
                          <div>{dayjs(point.time).format('MMM D, HH:mm')}</div>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{formatUsdPrecise(point.value)}</div>
                        </ChartTooltip>
                      )
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    fill="url(#tokenDetailChartFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartBox>

          <StatsRow>
            <StatCell>
              <Text color="textSubtle" fontSize="12px">
                {t('24h Volume')}
              </Text>
              <Text bold fontSize="12px">
                {formatStat(tokenDataQuery.data?.volumeUSD24h)}
              </Text>
            </StatCell>
            <StatCell>
              <Text color="textSubtle" fontSize="12px">
                {t('FDV')}
              </Text>
              <Text bold fontSize="12px">
                {fdv != null ? `$${formatAmount(fdv)}` : '—'}
              </Text>
            </StatCell>
            <StatCell>
              <Text color="textSubtle" fontSize="12px">
                {t('Total Supply')}
              </Text>
              <Text bold fontSize="12px">
                {totalSupplyNum != null ? formatAmount(totalSupplyNum) : '—'}
              </Text>
            </StatCell>
          </StatsRow>

          <Flex justifyContent="center" mt="12px">
            <ButtonMenu scale="sm" variant="subtle" activeIndex={periodIndex} onItemClick={setPeriodIndex}>
              {PERIOD_LABELS.map((label) => (
                <ButtonMenuItem key={label}>{label}</ButtonMenuItem>
              ))}
            </ButtonMenu>
          </Flex>

          <BalanceCard>
            <Text color="textSubtle" fontSize="14px" mb="4px">
              {t('My Balance')}
            </Text>
            <Flex alignItems="center" justifyContent="space-between">
              <FlexGap alignItems="center" gap="8px">
                <CurrencyLogo currency={tokenInfo} size="20px" />
                <Text bold fontSize="20px">
                  {quantityDisplay} {asset.token.symbol}
                </Text>
              </FlexGap>
              <Text bold fontSize="20px">
                {formatUsd(asset.price?.totalUsd)}
              </Text>
            </Flex>
          </BalanceCard>

          <Button
            variant="secondary"
            width="100%"
            mt="16px"
            onClick={handleSwap}
            style={{ color: theme.colors.primary60 }}
          >
            {t('Swap')}
          </Button>
        </ScrollArea>
      </Container>
    </>
  )
}

export default TokenDetailsPanel
