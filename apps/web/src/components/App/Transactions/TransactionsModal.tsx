import { useTranslation } from '@pancakeswap/localization'
import { Box, Button, FlexGap, InjectedModalProps, Modal, ModalBody, SwapLoading, Text } from '@pancakeswap/uikit'
import { TransactionList } from '@pancakeswap/widgets-internal'
import isEmpty from 'lodash/isEmpty'
import { useCallback, useMemo } from 'react'
import { useAppDispatch } from 'state'
import { useAMMSortedRecentTransactions } from 'state/transactions/hooks'
import { useRecentXOrders } from 'views/Swap/x/useRecentXOders'

import { clearAllTransactions } from 'state/transactions/actions'
import { useRecentBridgeOrders } from 'views/Swap/Bridge/hooks/useRecentBridgeOrders'
import { Address } from 'viem'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { isEvm, isSolana } from '@pancakeswap/chains'

import { isSol } from '@pancakeswap/sdk'
import ConnectWalletButton from '../../ConnectWalletButton'
import { AutoRow } from '../../Layout/Row'
import { CrossChainTransaction } from './CrossChainTransaction'
import Transaction from './Transaction'
import { XTransaction } from './XTransaction'
import { AmmTransactionItem, CrossChainTransactionItem, TransactionItem, XTransactionItem } from './types'

function getTransactionTimestamp(item: TransactionItem): number {
  switch (item.type) {
    case 'tx':
      return item.item.addedTime
    case 'xOrder':
      return new Date(item.item.createdAt).getTime()
    case 'crossChainOrder':
      return new Date(item.order.timestamp).getTime()
    default:
      return 0
  }
}

function sortByTransactionTime(a: TransactionItem, b: TransactionItem) {
  const timeA = getTransactionTimestamp(a)
  const timeB = getTransactionTimestamp(b)
  return timeB - timeA
}

export function RecentTransactions() {
  const { chainId, account: evmAccount, solanaAccount } = useAccountActiveChain()
  const isEvmChain = isEvm(chainId)

  const dispatch = useAppDispatch()

  const { data: recentXOrders } = useRecentXOrders({
    chainId: isEvmChain ? chainId : undefined,
    address: isEvmChain ? (evmAccount as Address) : undefined,
    refetchInterval: 10_000,
    enabled: isEvmChain && Boolean(evmAccount),
  })

  // Cross-Chain Orders
  const {
    data: crossChainOrdersResponse,
    isFetching: isRecentBridgeOrdersLoading,
    fetchNextPage,
  } = useRecentBridgeOrders({
    address: (isSolana(chainId) ? solanaAccount : isEvm(chainId) ? (evmAccount as Address) : undefined) || undefined,
  })

  const hasMoreCrossChainOrders = Boolean(
    crossChainOrdersResponse?.pages[crossChainOrdersResponse.pages.length - 1].hasNextPage,
  )

  const recentCrossChainOrders: CrossChainTransactionItem[] = useMemo(
    () =>
      crossChainOrdersResponse?.pages.flatMap(
        (page) =>
          page?.rows?.map(
            (order): CrossChainTransactionItem => ({
              type: 'crossChainOrder',
              order,
            }),
          ) ?? [],
      ) ?? [],
    [crossChainOrdersResponse?.pages],
  )

  const sortedRecentTransactions = useAMMSortedRecentTransactions()
  const ammTransactions: AmmTransactionItem[] = useMemo(
    () =>
      Object.entries(sortedRecentTransactions).flatMap(([chainId, transactions]) => {
        return Object.values(transactions).map((transaction) => ({
          type: 'tx',
          item: transaction,
          chainId: Number(chainId),
        }))
      }),
    [sortedRecentTransactions],
  )

  const xOrders: XTransactionItem[] = useMemo(
    () => recentXOrders?.orders.reverse().map((order) => ({ type: 'xOrder', item: order })) ?? [],
    [recentXOrders],
  )

  const { t } = useTranslation()

  const hasTransactions = !isEmpty(sortedRecentTransactions)

  const clearAllTransactionsCallback = useCallback(() => {
    dispatch(clearAllTransactions())
  }, [dispatch])

  const recentTransactionsHeading = useMemo(() => {
    return (
      <FlexGap alignItems="center" gap="8px">
        <Text color="secondary" fontSize="12px" textTransform="uppercase" bold>
          {t('Recent Transactions')}
        </Text>
        {isRecentBridgeOrdersLoading && <SwapLoading />}
      </FlexGap>
    )
  }, [t, isRecentBridgeOrdersLoading])

  return (
    <Box onClick={(e) => e.stopPropagation()}>
      {evmAccount || solanaAccount ? (
        xOrders.length > 0 || hasTransactions || recentCrossChainOrders.length > 0 ? (
          <>
            <AutoRow mb="1rem" style={{ justifyContent: 'space-between' }}>
              {recentTransactionsHeading}
              {hasTransactions && (
                <Button variant="tertiary" scale="xs" onClick={clearAllTransactionsCallback}>
                  {t('clear')}
                </Button>
              )}
            </AutoRow>

            <UnifiedTransactionList
              transactions={ammTransactions}
              xOrders={xOrders}
              crossChainOrders={recentCrossChainOrders}
            />

            {hasMoreCrossChainOrders && (
              <Button
                variant="text"
                scale="sm"
                mt="16px"
                disabled={isRecentBridgeOrdersLoading}
                onClick={() => fetchNextPage()}
              >
                {isRecentBridgeOrdersLoading ? t('Loading...') : t('Load More')}
              </Button>
            )}
          </>
        ) : (
          <>
            {recentTransactionsHeading}
            <Text mt="8px">{t('No recent transactions')}</Text>
          </>
        )
      ) : (
        <ConnectWalletButton />
      )}
    </Box>
  )
}

const TransactionsModal: React.FC<React.PropsWithChildren<InjectedModalProps>> = ({ onDismiss }) => {
  const { t } = useTranslation()

  return (
    <Modal title={t('Recent Transactions')} headerBackground="gradientCardHeader" onDismiss={onDismiss}>
      <ModalBody>
        <RecentTransactions />
      </ModalBody>
    </Modal>
  )
}

function UnifiedTransactionList({
  transactions,
  xOrders = [],
  crossChainOrders = [],
}: {
  transactions?: TransactionItem[]
  xOrders?: TransactionItem[]
  crossChainOrders?: TransactionItem[]
}) {
  const allTransactionItems = useMemo(
    () => [...(transactions || []), ...crossChainOrders, ...xOrders].sort(sortByTransactionTime),
    [transactions, xOrders, crossChainOrders],
  )

  return (
    <TransactionList>
      {allTransactionItems.map((tx) => {
        if (tx.type === 'tx') {
          return <Transaction key={tx.item.hash + tx.item.addedTime} tx={tx.item} chainId={tx.chainId} />
        }
        if (tx.type === 'crossChainOrder') {
          return <CrossChainTransaction key={tx.order.orderId} order={tx.order} />
        }
        return <XTransaction key={tx.item.hash} order={tx.item} />
      })}
    </TransactionList>
  )
}

export default TransactionsModal
