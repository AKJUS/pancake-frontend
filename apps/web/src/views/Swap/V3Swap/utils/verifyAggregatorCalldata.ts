import type { AggregatorCalldataData, AggregatorQuoteData } from '@pancakeswap/aggregator-sdk'
import { Address, getAddress, Hex } from 'viem'
import { isAllowedAggregatorRouter } from 'config/constants/aggregatorRouters'
import { isAddressEqual } from 'utils'
import { logger } from 'utils/datadog'
import { extractAggregatorRecipient } from './decodeAggregatorCall'

export interface VerifyAggregatorCalldataArgs {
  chainId: number
  quoteData: AggregatorQuoteData
  recipient: string
  calldataResult: AggregatorCalldataData
}

// Three pre-send assertions — see doc/aggregation-implementation/plan-19-04.md.
// Throws (with a structured log) on any failure. Does not touch the wallet.
export function verifyAggregatorCalldata({
  chainId,
  quoteData,
  recipient,
  calldataResult,
}: VerifyAggregatorCalldataArgs): { txTo: Address; txData: Hex } {
  const txTo = calldataResult.to as Address
  const txData = calldataResult.calldata as Hex

  if (!isAllowedAggregatorRouter(chainId, txTo)) {
    logger.warn('aggregator.calldata.rejected', { reason: 'not-allowlisted', chainId, txTo })
    throw new Error(`Aggregator router ${txTo} is not allowlisted for chain ${chainId}`)
  }

  const approvedSpender = quoteData.aggregatorAddress
  if (!approvedSpender || !isAddressEqual(getAddress(approvedSpender), txTo)) {
    logger.warn('aggregator.calldata.rejected', {
      reason: 'spender-target-mismatch',
      chainId,
      txTo,
      approvedSpender,
    })
    throw new Error(`Aggregator calldata target ${txTo} does not match approved spender ${approvedSpender}`)
  }

  const onchainRecipient = extractAggregatorRecipient(txData)
  if (!isAddressEqual(onchainRecipient, getAddress(recipient))) {
    logger.warn('aggregator.calldata.rejected', {
      reason: 'recipient-mismatch',
      chainId,
      onchainRecipient,
      feRecipient: recipient,
    })
    throw new Error(`Aggregator calldata recipient ${onchainRecipient} does not match frontend recipient ${recipient}`)
  }

  return { txTo, txData }
}
