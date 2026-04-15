import { ChainId } from '@pancakeswap/chains'
import { Trans, useTranslation } from '@pancakeswap/localization'
import { Currency } from '@pancakeswap/swap-sdk-core'
import {
  AtomBox,
  AutoColumn,
  AutoRow,
  Box,
  ExpandableLabel,
  Flex,
  PreTitle,
  ScanLink,
  Text,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import { useQuery } from '@tanstack/react-query'
import { CurrencyLogo } from 'components/Logo'
import dayjs from 'dayjs'
import { gql } from 'graphql-request'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { memo, ReactNode, useMemo, useState } from 'react'
import { ChainLinkSupportChains } from 'state/info/constant'
import { getBlockExploreLink } from 'utils'
import { v3Clients } from 'utils/graphql'

type PositionTX = {
  id: string
  amount0: string
  amount1: string
  timestamp: string
  logIndex: string
}

type PositionHistoryResult = {
  positionSnapshots: {
    id: string
    transaction: {
      mints: PositionTX[]
      burns: PositionTX[]
      collects: PositionTX[]
    }
  }[]
}

type PositionHistoryType = 'mint' | 'burn' | 'collect'

const positionHistoryTypeText = {
  mint: <Trans>Add Liquidity</Trans>,
  burn: <Trans>Remove Liquidity</Trans>,
  collect: <Trans>Collect fee</Trans>,
} satisfies Record<PositionHistoryType, ReactNode>

const PositionHistoryRow = ({
  chainId,
  positionTx,
  type,
  currency0,
  currency1,
}: {
  chainId?: ChainId
  positionTx: PositionTX
  type: PositionHistoryType
  currency0: Currency
  currency1: Currency
}) => {
  const { isMobile } = useMatchBreakpoints()

  const isPlus = type !== 'burn'

  const date = useMemo(() => dayjs.unix(+positionTx.timestamp), [positionTx.timestamp])
  const mobileDate = useMemo(() => isMobile && date.format('YYYY/MM/DD'), [isMobile, date])
  const mobileTime = useMemo(() => isMobile && date.format('HH:mm:ss'), [isMobile, date])
  const desktopDate = useMemo(() => !isMobile && date.toDate().toLocaleString(), [isMobile, date])

  const position0AmountString = useMemo(() => {
    const amount0Number = +positionTx.amount0
    if (amount0Number > 0) {
      return amount0Number.toLocaleString(undefined, {
        maximumFractionDigits: 6,
        maximumSignificantDigits: 6,
      })
    }
    return null
  }, [positionTx.amount0])

  const position1AmountString = useMemo(() => {
    const amount1Number = +positionTx.amount1
    if (amount1Number > 0) {
      return amount1Number.toLocaleString(undefined, {
        maximumFractionDigits: 6,
        maximumSignificantDigits: 6,
      })
    }
    return null
  }, [positionTx.amount1])

  if (isMobile) {
    return (
      <Box>
        <AutoRow>
          <ScanLink
            useBscCoinFallback={chainId ? ChainLinkSupportChains.includes(chainId) : false}
            href={getBlockExploreLink(positionTx.id, 'transaction', chainId)}
          >
            <Flex flexDirection="column" alignItems="center">
              <Text ellipsis>{mobileDate}</Text>
              <Text fontSize="12px">{mobileTime}</Text>
            </Flex>
          </ScanLink>
        </AutoRow>
        <Text>{positionHistoryTypeText[type]}</Text>
        <AutoColumn gap="4px">
          {+positionTx.amount0 > 0 && (
            <AutoRow flexWrap="nowrap" gap="12px" justifyContent="space-between">
              <AutoRow width="auto" flexWrap="nowrap" gap="4px">
                <AtomBox minWidth="24px">
                  <CurrencyLogo currency={currency0} />
                </AtomBox>
                <Text display={['none', 'none', 'block']}>{currency0.symbol}</Text>
              </AutoRow>
              <Text bold ellipsis title={positionTx.amount0}>
                {isPlus ? '+' : '-'} {position0AmountString}
              </Text>
            </AutoRow>
          )}
          {+positionTx.amount1 > 0 && (
            <AutoRow flexWrap="nowrap" gap="12px" justifyContent="space-between">
              <AutoRow width="auto" flexWrap="nowrap" gap="4px">
                <AtomBox minWidth="24px">
                  <CurrencyLogo currency={currency1} />
                </AtomBox>
                <Text display={['none', 'none', 'block']}>{currency1.symbol}</Text>
              </AutoRow>
              <Text bold ellipsis title={positionTx.amount1}>
                {isPlus ? '+' : '-'} {position1AmountString}
              </Text>
            </AutoRow>
          )}
        </AutoColumn>
      </Box>
    )
  }

  return (
    <AtomBox
      display="grid"
      style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
      gap="16px"
      alignItems="center"
      borderTop="1"
      p="16px"
    >
      <AutoRow justifyContent="center">
        <ScanLink
          useBscCoinFallback={chainId ? ChainLinkSupportChains.includes(chainId) : false}
          href={getBlockExploreLink(positionTx.id, 'transaction', chainId)}
        >
          <Text ellipsis>{desktopDate}</Text>
        </ScanLink>
      </AutoRow>
      <Text>{positionHistoryTypeText[type]}</Text>
      <AutoColumn gap="4px">
        {+positionTx.amount0 > 0 && (
          <AutoRow flexWrap="nowrap" justifyContent="flex-end" gap="12px">
            <Text bold ellipsis title={positionTx.amount0}>
              {isPlus ? '+' : '-'} {position0AmountString}
            </Text>
            <AutoRow width="auto" flexWrap="nowrap" gap="4px">
              <AtomBox minWidth="24px">
                <CurrencyLogo currency={currency0} />
              </AtomBox>
              <Text display={['none', 'none', 'block']}>{currency0.symbol}</Text>
            </AutoRow>
          </AutoRow>
        )}
        {+positionTx.amount1 > 0 && (
          <AutoRow flexWrap="nowrap" justifyContent="flex-end" gap="12px">
            <Text bold ellipsis title={positionTx.amount1}>
              {isPlus ? '+' : '-'} {position1AmountString}
            </Text>
            <AutoRow width="auto" flexWrap="nowrap" gap="4px">
              <AtomBox minWidth="24px">
                <CurrencyLogo currency={currency1} />
              </AtomBox>
              <Text display={['none', 'none', 'block']}>{currency1.symbol}</Text>
            </AutoRow>
          </AutoRow>
        )}
      </AutoColumn>
    </AtomBox>
  )
}

const PositionHistoryComponent = ({
  tokenId,
  currency0,
  currency1,
}: {
  tokenId: string
  currency0: Currency
  currency1: Currency
}) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const { chainId } = useActiveChainId()
  const client = v3Clients[chainId as keyof typeof v3Clients]
  const { data, isPending } = useQuery({
    queryKey: ['positionHistory', chainId, tokenId],

    queryFn: async () => {
      // @TODO: Implement the query with infinity
      if (!client) return []
      const result: PositionHistoryResult = await client.request<PositionHistoryResult>(
        gql`
          query positionHistory($tokenId: String!) {
            positionSnapshots(where: { position: $tokenId }, orderBy: timestamp, orderDirection: desc, first: 30) {
              id
              transaction {
                mints(where: { or: [{ amount0_gt: "0" }, { amount1_gt: "0" }] }) {
                  id
                  timestamp
                  amount1
                  amount0
                  logIndex
                }
                burns(where: { or: [{ amount0_gt: "0" }, { amount1_gt: "0" }] }) {
                  id
                  timestamp
                  amount1
                  amount0
                  logIndex
                }
                collects(where: { or: [{ amount0_gt: "0" }, { amount1_gt: "0" }] }) {
                  id
                  timestamp
                  amount0
                  amount1
                  logIndex
                }
              }
            }
          }
        `,
        {
          tokenId,
        },
      )

      return result.positionSnapshots.filter((snapshot) => {
        const { transaction } = snapshot
        return transaction.mints.length > 0 || transaction.burns.length > 0 || transaction.collects.length > 0
      })
    },

    enabled: Boolean(client && tokenId),
    refetchInterval: 30_000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })

  if (isPending || !data?.length) {
    return null
  }

  return (
    <AtomBox textAlign="center" pt="16px">
      <ExpandableLabel
        expanded={isExpanded}
        onClick={() => {
          setIsExpanded(!isExpanded)
        }}
      >
        {isExpanded ? t('Hide') : t('History')}
      </ExpandableLabel>
      {isExpanded && (
        <AtomBox display="grid" gap="16px">
          <AtomBox display="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }} alignItems="center">
            <PreTitle>{t('Timestamp')}</PreTitle>
            <PreTitle>{t('Action')}</PreTitle>
            <PreTitle>{t('Token Transferred')}</PreTitle>
          </AtomBox>

          {data.map((d) => {
            return (
              <AutoColumn key={d.id} gap="16px">
                {d.transaction.mints.map((positionTx) => (
                  <PositionHistoryRow
                    chainId={chainId}
                    positionTx={positionTx}
                    key={positionTx.id}
                    type="mint"
                    currency0={currency0}
                    currency1={currency1}
                  />
                ))}
                {d.transaction.collects
                  .map((collectTx) => {
                    const foundSameTxBurn = d.transaction.burns.find(
                      (burnTx) =>
                        +collectTx.amount0 >= +burnTx.amount0 &&
                        +collectTx.amount1 >= +burnTx.amount1 &&
                        +burnTx.logIndex < +collectTx.logIndex,
                    )
                    if (foundSameTxBurn) {
                      if (
                        foundSameTxBurn.amount0 === collectTx.amount0 &&
                        foundSameTxBurn.amount1 === collectTx.amount1
                      ) {
                        return null
                      }
                      return {
                        ...collectTx,
                        amount0: String(+collectTx.amount0 - +foundSameTxBurn.amount0),
                        amount1: String(+collectTx.amount1 - +foundSameTxBurn.amount1),
                      }
                    }
                    return collectTx
                  })
                  .filter((tx): tx is PositionTX => Boolean(tx))
                  .map((positionTx) => (
                    <PositionHistoryRow
                      chainId={chainId}
                      positionTx={positionTx}
                      key={positionTx.id}
                      type="collect"
                      currency0={currency0}
                      currency1={currency1}
                    />
                  ))}
                {d.transaction.burns.map((positionTx) => (
                  <PositionHistoryRow
                    chainId={chainId}
                    positionTx={positionTx}
                    key={positionTx.id}
                    type="burn"
                    currency0={currency0}
                    currency1={currency1}
                  />
                ))}
              </AutoColumn>
            )
          })}
        </AtomBox>
      )}
    </AtomBox>
  )
}

export const PositionHistory = memo(PositionHistoryComponent)
