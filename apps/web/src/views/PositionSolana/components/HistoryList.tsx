import { useTranslation } from '@pancakeswap/localization'
import {
  AutoColumn,
  Button,
  Card,
  CardBody,
  CheckmarkCircleFillIcon,
  Flex,
  FlexGap,
  Link,
  Spinner,
  Text,
} from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import dayjs from 'dayjs'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import { useMemo, useState } from 'react'
import { getBlockExploreLink } from 'utils'
import { Transaction, TransactionType } from 'views/PoolDetail/components/Transactions/type'
import { usePoolHistory } from '../hooks/usePoolHistory'

dayjs.extend(advancedFormat)

const ITEMS_PER_PAGE = 3

interface HistoryListProps {
  poolId?: string
  chainId?: number
}

export const HistoryList: React.FC<HistoryListProps> = ({ poolId, chainId }) => {
  const { t } = useTranslation()
  const { data: transactions, isLoading } = usePoolHistory(poolId, chainId)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  const visibleTxs = useMemo(() => transactions?.slice(0, visibleCount) ?? [], [transactions, visibleCount])
  const hasMore = (transactions?.length ?? 0) > visibleCount

  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <Flex justifyContent="center" py="24px">
            <Spinner />
          </Flex>
        </CardBody>
      </Card>
    )
  }

  if (!transactions?.length) return null

  return (
    <Card>
      <CardBody padding="16px">
        <AutoColumn gap="8px">
          <Text
            fontSize="12px"
            fontWeight={600}
            color="textSubtle"
            textTransform="uppercase"
            style={{ letterSpacing: '0.24px' }}
          >
            {t('History')}
          </Text>

          {visibleTxs.map((tx) => (
            <HistoryItem key={tx.id} tx={tx} chainId={chainId} />
          ))}

          {hasMore && (
            <Button
              variant="textPrimary60"
              onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
              width="100%"
            >
              {t('Show More')}
            </Button>
          )}
        </AutoColumn>
      </CardBody>
    </Card>
  )
}

function HistoryItem({ tx, chainId }: { tx: Transaction; chainId?: number }) {
  const timestamp = dayjs.unix(tx.timestamp).format('MMMM Do YYYY, HH:mm')
  const absAmount0 = Math.abs(tx.amount0)
  const absAmount1 = Math.abs(tx.amount1)
  const actionText = getActionText(tx.type)

  const explorerLink = chainId ? getBlockExploreLink(tx.transactionHash, 'transaction', chainId) : undefined

  return (
    <AutoColumn gap="0px">
      <Text fontSize="14px" color="textSubtle">
        {timestamp}
      </Text>
      <Link href={explorerLink} external style={{ textDecoration: 'none' }}>
        <FlexGap gap="4px" alignItems="center">
          <CheckmarkCircleFillIcon width="16px" color="positive60" />
          <Text fontSize="16px" color="text">
            <Text as="span" bold fontSize="16px">
              {formatNumber(absAmount0, { maximumSignificantDigits: 6 })} {tx.token0.symbol}
            </Text>
            {' and '}
            <Text as="span" bold fontSize="16px">
              {formatNumber(absAmount1, { maximumSignificantDigits: 6 })} {tx.token1.symbol}
            </Text>
            {` ${actionText}`}
          </Text>
        </FlexGap>
      </Link>
    </AutoColumn>
  )
}

function getActionText(type: TransactionType): string {
  switch (type) {
    case TransactionType.Add:
      return 'added to the pool'
    case TransactionType.Remove:
      return 'removed from the pool'
    case TransactionType.Swap:
      return 'swapped in the pool'
    default:
      return ''
  }
}
