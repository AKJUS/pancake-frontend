import { Order } from '@gelatonetwork/limit-orders-lib'
import isEmpty from 'lodash/isEmpty'
import keyBy from 'lodash/keyBy'
import mapValues from 'lodash/mapValues'
import omitBy from 'lodash/omitBy'
import orderBy from 'lodash/orderBy'
import pickBy from 'lodash/pickBy'
import { useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { AppState, useAppDispatch } from 'state'
import { useAccount } from 'wagmi'
import { Hash } from 'viem'
import { Token } from '@pancakeswap/swap-sdk-core'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import { useTranslation } from '@pancakeswap/localization'

import { useActiveChainId } from 'hooks/useActiveChainId'

import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useSafeTxHashTransformer } from 'hooks/useSafeTxHashTransformer'
import { isSolana, NonEVMChainId } from '@pancakeswap/chains'
import {
  CrossChainFarmStepType,
  CrossChainFarmTransactionType,
  FarmTransactionStatus,
  SerializableTransactionReceipt,
  TransactionType,
  addTransaction,
} from './actions'
import { SwapTokenRecord, TransactionDetails } from './reducer'

// helper that can take a ethers library transaction response and add it to the list of transactions
export function useTransactionAdder(overrideChainId?: number): (
  response: { hash: Hash | string } | { transactionHash: Hash | string },
  customData?: {
    summary?: string
    translatableSummary?: { text: string; data?: Record<string, string | number | undefined> }
    approval?: { tokenAddress: string; spender: string; amount: string }
    claim?: { recipient: string }
    type?: TransactionType
    order?: Order
    crossChainFarm?: CrossChainFarmTransactionType
    // add/remove pool
    baseCurrencyId?: string
    quoteCurrencyId?: string
    expectedAmountBaseRaw?: string
    expectedAmountQuoteRaw?: string
    feeAmount?: FeeAmount
    createPool?: boolean
    // fee collect
    currencyId0?: string
    currencyId1?: string
    expectedCurrencyOwed0?: string
    expectedCurrencyOwed1?: string
    receipt?: SerializableTransactionReceipt
    swapTokens?: { input: SwapTokenRecord; output: SwapTokenRecord }
  },
) => void {
  const { solanaAccount, account: evmAccount, chainId: activeChainId } = useAccountActiveChain()
  const chainId = overrideChainId ?? activeChainId
  const from = isSolana(chainId) ? solanaAccount : evmAccount

  const dispatch = useAppDispatch()
  const safeTxHashTransformer = useSafeTxHashTransformer()

  return useCallback(
    async (
      response,
      {
        summary,
        translatableSummary,
        approval,
        claim,
        type,
        order,
        crossChainFarm,
        receipt,
        swapTokens,
      }: {
        summary?: string
        translatableSummary?: { text: string; data?: Record<string, string | number | undefined> }
        claim?: { recipient: string }
        approval?: { tokenAddress: string; spender: string }
        type?: TransactionType
        order?: Order
        crossChainFarm?: CrossChainFarmTransactionType
        receipt?: SerializableTransactionReceipt
        swapTokens?: { input: SwapTokenRecord; output: SwapTokenRecord }
      } = {},
    ) => {
      if (!from) return
      if (!chainId) return

      let hash: Hash | string | undefined

      if ('hash' in response) {
        // eslint-disable-next-line prefer-destructuring
        hash = response.hash
      } else if ('transactionHash' in response) {
        hash = response.transactionHash
      }

      if (!hash) {
        throw Error('No transaction hash found.')
      }

      try {
        hash = await safeTxHashTransformer(hash as Hash)
      } catch (e) {
        console.error('Failed to get transaction hash from Safe', e)
      }

      dispatch(
        addTransaction({
          hash,
          from,
          chainId,
          approval,
          summary,
          translatableSummary,
          claim,
          type,
          order,
          crossChainFarm,
          receipt,
          swapTokens,
        }),
      )
    },
    [from, chainId, safeTxHashTransformer, dispatch],
  )
}

// returns all the transactions
export function useAllTransactions(): { [chainId: number]: { [txHash: string]: TransactionDetails } } {
  const { unifiedAccount } = useAccountActiveChain()

  const state: {
    [chainId: number]: {
      [txHash: string]: TransactionDetails
    }
  } = useSelector<AppState, AppState['transactions']>((s) => s.transactions)

  return useMemo(() => {
    return mapValues(state, (transactions) =>
      pickBy(
        transactions,
        (transactionDetails) => transactionDetails.from.toLowerCase() === unifiedAccount?.toLowerCase(),
      ),
    )
  }, [unifiedAccount, state])
}

// returns all transactions excluding bridge transactions (for AMM transaction list)
export function useAMMTransactions(): { [chainId: number]: { [txHash: string]: TransactionDetails } } {
  const allTransactions = useAllTransactions()

  return useMemo(() => {
    const filtered: { [chainId: number]: { [txHash: string]: TransactionDetails } } = {}

    Object.entries(allTransactions).forEach(([chainId, transactions]) => {
      filtered[Number(chainId)] = Object.fromEntries(
        Object.entries(transactions).filter(([, tx]) => tx.type !== 'bridge'),
      )
    })

    return filtered
  }, [allTransactions])
}

export function useAllSortedRecentTransactions(): { [chainId: number]: { [txHash: string]: TransactionDetails } } {
  const allTransactions = useAllTransactions()
  return useMemo(() => {
    return omitBy(
      mapValues(allTransactions, (transactions) =>
        keyBy(
          orderBy(
            pickBy(transactions, (trxDetails) => isTransactionRecent(trxDetails)),
            ['addedTime'],
            'desc',
          ),
          'hash',
        ),
      ),
      isEmpty,
    )
  }, [allTransactions])
}

// returns all sorted recent transactions excluding bridge transactions (for AMM transaction list)
export function useAMMSortedRecentTransactions(): { [chainId: number]: { [txHash: string]: TransactionDetails } } {
  const ammTransactions = useAMMTransactions()
  return useMemo(() => {
    return omitBy(
      mapValues(ammTransactions, (transactions) =>
        keyBy(
          orderBy(
            pickBy(transactions, (trxDetails) => isTransactionRecent(trxDetails)),
            ['addedTime'],
            'desc',
          ),
          'hash',
        ),
      ),
      isEmpty,
    )
  }, [ammTransactions])
}

// returns all the transactions for the current chain
export function useAllActiveChainTransactions(overrideChainId?: number): { [txHash: string]: TransactionDetails } {
  const { chainId: activeChainId } = useActiveChainId()
  const chainId = overrideChainId ?? activeChainId

  return useAllChainTransactions(chainId)
}

export function useAllChainTransactions(chainId?: number): { [txHash: string]: TransactionDetails } {
  const { address: account } = useAccount()

  const state = useSelector<AppState, AppState['transactions']>((s) => s.transactions)

  return useMemo(() => {
    if (chainId && state[chainId]) {
      return pickBy(
        state[chainId],
        (transactionDetails) => transactionDetails.from.toLowerCase() === account?.toLowerCase(),
      )
    }
    return {}
  }, [account, chainId, state])
}

export function useSolanaTransactions(): { [txId: string]: TransactionDetails } {
  const { solanaAccount } = useAccountActiveChain()

  const state = useSelector<AppState, AppState['transactions']>((s) => s.transactions)

  return useMemo(() => {
    if (solanaAccount) {
      return pickBy(
        state[NonEVMChainId.SOLANA],
        (transactionDetails) => transactionDetails.from.toLowerCase() === solanaAccount?.toLowerCase(),
      )
    }
    return {}
  }, [solanaAccount, state])
}

export function useIsTransactionPending(transactionHash?: string): boolean {
  const transactions = useAllActiveChainTransactions()

  if (!transactionHash || !transactions[transactionHash]) return false

  return !transactions[transactionHash].receipt
}

/**
 * Returns whether a transaction happened in the last day (86400 seconds * 1000 milliseconds / second)
 * @param tx to check for recency
 */
export function isTransactionRecent(tx: TransactionDetails): boolean {
  return Date.now() - tx.addedTime < 86_400_000
}

// returns whether a token has a pending approval transaction
export function useHasPendingApproval(
  tokenAddress: string | undefined,
  spender: string | undefined,
  overrideChainId?: number,
): boolean {
  const allTransactions = useAllActiveChainTransactions(overrideChainId)
  return useMemo(
    () =>
      typeof tokenAddress === 'string' &&
      typeof spender === 'string' &&
      Object.keys(allTransactions).some((hash) => {
        const tx = allTransactions[hash]
        if (!tx) return false
        if (tx.receipt) {
          return false
        }
        const { approval } = tx
        if (!approval) return false
        return approval.spender === spender && approval.tokenAddress === tokenAddress && isTransactionRecent(tx)
      }),
    [allTransactions, spender, tokenAddress],
  )
}

export function useHasPendingRevocation(token?: Token, spender?: string) {
  const allTransactions = useAllActiveChainTransactions()
  const pendingApprovals = useMemo(() => {
    if (typeof token?.address !== 'string' || typeof spender !== 'string') {
      return undefined
    }
    // eslint-disable-next-line guard-for-in
    for (const txHash in allTransactions) {
      const tx = allTransactions[txHash]
      if (!tx || tx.receipt || tx.type === 'approve' || !tx.approval) continue
      if (tx.approval.spender === spender && tx.approval.tokenAddress === token.address && isTransactionRecent(tx)) {
        return BigInt(tx.approval.amount ?? 0)
      }
    }
    return undefined
  }, [allTransactions, spender, token?.address])
  return typeof pendingApprovals === 'bigint' && pendingApprovals === 0n
}

// we want the latest one to come first, so return negative if a is after b
function newTransactionsFirst(a: TransactionDetails, b: TransactionDetails) {
  return b.addedTime - a.addedTime
}

// calculate pending transactions
interface CrossChainPendingData {
  txid?: string
  lpAddress?: string
  type?: CrossChainFarmStepType
}
export function usePendingTransactions(): {
  hasPendingTransactions: boolean
  pendingNumber: number
  crossChainFarmPendingList: CrossChainPendingData[]
} {
  const allTransactions = useAllTransactions()
  const sortedRecentTransactions = useMemo(() => {
    const txs = Object.values(allTransactions).flatMap((trxObjects) => Object.values(trxObjects))
    return txs.filter(isTransactionRecent).sort(newTransactionsFirst)
  }, [allTransactions])

  const pending = sortedRecentTransactions
    .filter((tx) => !tx.receipt || tx?.crossChainFarm?.status === FarmTransactionStatus.PENDING)
    .map((tx) => tx.hash)
  const hasPendingTransactions = !!pending.length

  const crossChainFarmPendingList = sortedRecentTransactions
    .filter((tx) => pending.includes(tx.hash) && !!tx.crossChainFarm)
    .map((tx) => ({ txid: tx?.hash, lpAddress: tx?.crossChainFarm?.lpAddress, type: tx?.crossChainFarm?.type }))

  return {
    hasPendingTransactions,
    crossChainFarmPendingList,
    pendingNumber: pending.length,
  }
}

export function useCrossChainFarmPendingTransaction(lpAddress?: string): CrossChainPendingData[] {
  const { crossChainFarmPendingList } = usePendingTransactions()
  return useMemo(() => {
    if (!lpAddress) return []
    return crossChainFarmPendingList.filter((tx) => tx?.lpAddress?.toLowerCase() === lpAddress.toLowerCase())
  }, [lpAddress, crossChainFarmPendingList])
}

export const getReadableTransactionType = (t, type?: TransactionType) => {
  if (type === undefined) {
    return t('PancakeSwap AMM')
  }
  switch (type) {
    case 'approve':
      return t('Token Approval')
    case 'swap':
      return t('PancakeSwap AMM')
    case 'wrap':
      return t('Wrap Native Token')
    case 'add-liquidity':
    case 'increase-liquidity-v3':
    case 'add-liquidity-v3':
    case 'zap-liquidity-v3':
      return t('Add Liquidity')
    case 'remove-liquidity':
    case 'remove-liquidity-v3':
      return t('Remove Liquidity')
    case 'collect-fee':
      return t('Collect Fee')
    case 'limit-order-approval':
    case 'limit-order-submission':
    case 'limit-order-cancellation':
    case 'place-limit-order':
      return t('Limit Order')
    case 'cross-chain-farm':
      return t('Farming')
    case 'migrate-v3':
      return t('Migration')
    case 'bridge-icake':
      return t('IFO')
    case 'claim-liquid-staking':
      return t('Liquid Staking')
    case 'add-liquidity-infinity-cl':
      return t('Add Liquidity Infinity CLAMM')
    case 'remove-liquidity-infinity-cl':
      return t('Remove Liquidity Infinity CLAMM')
    case 'add-liquidity-infinity-bin':
      return t('Add Liquidity Infinity LBAMM')
    case 'remove-liquidity-infinity-bin':
      return t('Remove Liquidity Infinity LBAMM')

    default:
      return type
  }
}

export function useReadableTransactionType(type?: TransactionType) {
  const { t } = useTranslation()
  return useMemo(() => {
    return getReadableTransactionType(t, type)
  }, [type, t])
}

export function useRecentlySwappedTokens(): SwapTokenRecord[] {
  // Read Redux state directly with both EVM and Solana accounts to avoid the
  // unifiedAccount filter in useAllTransactions(), which drops EVM transactions
  // when the active chain is Solana (unifiedAccount flips to the Solana address).
  const { account: evmAccount } = useAccountActiveChain()
  const state = useSelector<AppState, AppState['transactions']>((s) => s.transactions)
  const solTxs = useSolanaTransactions()

  return useMemo(() => {
    const seen = new Set<string>()
    const result: SwapTokenRecord[] = []

    // Collect EVM transactions across all chains, filtered by EVM account
    const evmTxs: TransactionDetails[] = []
    if (evmAccount) {
      const chainEntries = Object.values(state) as { [txHash: string]: TransactionDetails }[]
      for (const chainTxs of chainEntries) {
        for (const tx of Object.values(chainTxs)) {
          if (tx.from.toLowerCase() === evmAccount.toLowerCase() && isTransactionRecent(tx)) {
            evmTxs.push(tx)
          }
        }
      }
    }

    const solSwaps = Object.values(solTxs)
    const allSwaps = [...evmTxs, ...solSwaps]
      .filter((tx) => (tx.type === 'swap' || tx.type === 'bridge') && tx.swapTokens)
      .sort((a, b) => b.addedTime - a.addedTime)

    for (const tx of allSwaps) {
      if (result.length >= 5) break
      for (const record of [tx.swapTokens!.input, tx.swapTokens!.output]) {
        if (result.length >= 5) break
        const key = record.isNative ? `${record.chainId}-native` : `${record.chainId}-${record.address!.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          result.push(record)
        }
      }
    }
    return result
  }, [evmAccount, state, solTxs])
}
