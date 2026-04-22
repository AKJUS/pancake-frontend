import { ChainId, AVERAGE_CHAIN_BLOCK_TIMES } from '@pancakeswap/chains'
import { useCallback } from 'react'
import { RetryableError, retry } from 'state/multicall/retry'
import { SafeTransactionService } from 'state/transactions/safeTransactionService'
import { Hash } from 'viem'
import { useAccount } from 'wagmi'

enum TransactionStatus {
  AWAITING_CONFIRMATIONS = 'AWAITING_CONFIRMATIONS',
  AWAITING_EXECUTION = 'AWAITING_EXECUTION',
}

type SafeTxDetails = {
  txStatus: TransactionStatus
  txHash?: string
}

export const useSafeTxHashTransformer = () => {
  const { connector, chainId } = useAccount()
  const confirmationSeconds = chainId ? AVERAGE_CHAIN_BLOCK_TIMES[chainId] : AVERAGE_CHAIN_BLOCK_TIMES[ChainId.BSC]

  return useCallback(
    async (hash: Hash): Promise<Hash> => {
      if (!hash || !connector) return hash

      // Path 1: Safe App browser — provider.sdk is available.
      try {
        const provider: any = await connector.getProvider()
        if (provider?.sdk?.txs) {
          const initialResp: SafeTxDetails = await provider.sdk.txs.getBySafeTxHash(hash)

          if (
            initialResp.txHash &&
            initialResp.txStatus !== TransactionStatus.AWAITING_CONFIRMATIONS &&
            initialResp.txStatus !== TransactionStatus.AWAITING_EXECUTION
          ) {
            return initialResp.txHash as Hash
          }

          const pollViaSdk = async (): Promise<Hash> => {
            const p: any = await connector.getProvider()
            const resp: SafeTxDetails = await p.sdk.txs.getBySafeTxHash(hash)
            if (
              resp.txStatus === TransactionStatus.AWAITING_CONFIRMATIONS ||
              resp.txStatus === TransactionStatus.AWAITING_EXECUTION
            ) {
              throw new RetryableError('Safe tx not yet executed')
            }
            return (resp.txHash as Hash) ?? hash
          }

          return retry(pollViaSdk, {
            n: 10,
            minWait: 5000,
            maxWait: 10000,
            delay: confirmationSeconds * 1000 + 1000,
          }).promise as Promise<Hash>
        }
      } catch (e) {
        // SDK path not available (e.g. WalletConnect Safe), fall through to REST API
      }

      // Path 2: WalletConnect Safe — use Safe Transaction Service REST API.
      const service = chainId ? SafeTransactionService.forChain(chainId) : null
      if (!service) return hash

      const isSafe = await service.isSafeTxHash(hash)
      if (!isSafe) return hash

      const pollViaApi = async (): Promise<Hash> => {
        const data = await service.getTransaction(hash)
        if (!data?.isExecuted || !data.transactionHash) throw new RetryableError('Safe tx not yet executed')
        return data.transactionHash as Hash
      }

      return retry(pollViaApi, {
        n: 10,
        minWait: 5000,
        maxWait: 10000,
        delay: confirmationSeconds * 1000 + 1000,
      }).promise as Promise<Hash>
    },
    [chainId, confirmationSeconds, connector],
  )
}
