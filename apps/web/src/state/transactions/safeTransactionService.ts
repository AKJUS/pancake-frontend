import { ChainId } from '@pancakeswap/chains'
import { Hash } from 'viem'

type SafeServiceTxDetails = {
  isExecuted: boolean
  transactionHash?: string
}

const SAFE_TX_SERVICE_URLS: Partial<Record<number, string>> = {
  [ChainId.ETHEREUM]: 'https://safe-transaction-mainnet.safe.global',
  [ChainId.BSC]: 'https://safe-transaction-bsc.safe.global',
  [ChainId.ARBITRUM_ONE]: 'https://safe-transaction-arbitrum.safe.global',
  [ChainId.BASE]: 'https://safe-transaction-base.safe.global',
  [ChainId.LINEA]: 'https://safe-transaction-linea.safe.global',
  [ChainId.ZKSYNC]: 'https://safe-transaction-zksync.safe.global',
  [ChainId.OPBNB]: 'https://safe-transaction-opbnb-mainnet.bnbchain.org',
}

export class SafeTransactionService {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async isSafeTxHash(hash: Hash): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/multisig-transactions/${hash}/`)
      return res.ok
    } catch {
      return false
    }
  }

  async getTransaction(hash: Hash): Promise<SafeServiceTxDetails | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/multisig-transactions/${hash}/`)
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }

  static forChain(chainId: number): SafeTransactionService | null {
    const url = SAFE_TX_SERVICE_URLS[chainId]
    return url ? new SafeTransactionService(url) : null
  }
}
