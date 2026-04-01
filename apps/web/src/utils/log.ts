import { TradeType, UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import { WalletIds } from '@pancakeswap/ui-wallets'

import { logger } from './datadog'

export const logTx = ({ account, hash, chainId }: { account: string; hash: string; chainId: number }) => {
  fetch(`/api/_log/${account}/${chainId}/${hash}`)
}

export type LogTradeType =
  | 'V2Swap'
  | 'SmartSwap'
  | 'StableSwap'
  | 'MarketMakerSwap'
  | 'V3SmartSwap'
  | 'UniversalRouter'
  | 'X'
  | 'X-Filled'
  | 'SolanaSwap'

export const logSwap = ({
  input,
  output,
  inputAmount,
  outputAmount,
  quotedInputAmountRaw,
  maximumAmountInRaw,
  quotedOutputAmountRaw,
  minimumAmountOutRaw,
  chainId,
  account,
  hash,
  type,
  tradeType,
  isMultisig = false,
  env,
  wallet,
}: {
  tradeType?: TradeType
  input: UnifiedCurrency
  output: UnifiedCurrency
  inputAmount?: string
  outputAmount?: string
  quotedInputAmountRaw?: string
  maximumAmountInRaw?: string
  quotedOutputAmountRaw?: string
  minimumAmountOutRaw?: string
  chainId: number
  account: string
  hash: `0x${string}`
  type: LogTradeType
  isMultisig?: boolean
  env?: string
  wallet?: WalletIds
}) => {
  try {
    logger.info(type, {
      tradeType,
      inputAddress: input.isToken ? input.address.toLowerCase() : input.symbol,
      outputAddress: output.isToken ? output.address.toLowerCase() : output.symbol,
      inputAmount,
      outputAmount,
      quotedInputAmountRaw,
      maximumAmountInRaw,
      quotedOutputAmountRaw,
      minimumAmountOutRaw,
      account,
      hash,
      chainId,
      isMultisig,
      env,
      wallet,
    })
  } catch (error) {
    //
  }
}
