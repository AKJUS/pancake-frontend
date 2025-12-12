import { BridgeTransactionData, PriceOrder, SVMOrder } from '@pancakeswap/price-api-sdk'
import { Currency, CurrencyAmount, UnifiedCurrency, UnifiedCurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { Address } from 'viem/accounts'
import { CrossChainAPIErrorCode } from '../CrossChainConfirmSwapModal/hooks/useBridgeErrorMessages'

export enum BridgeType {
  NON_EVM = 'NON-EVM',
  EVM = 'EVM',
}

export type BridgeCallData = {
  router: Address
  calldata: `0x${string}`
}

export type GetBridgeCalldataResponse = {
  transactionData: BridgeCallData
  gasFee: string
}

export enum Command {
  BRIDGE = 'BRIDGE',
  SWAP = 'SWAP',
}

export interface BridgeDataSchema {
  command: Command.BRIDGE
  data: {
    inputToken: Address
    outputToken: Address
    inputAmount: string
    minOutputAmount?: string
    originChainId: number
    destinationChainId: number
    originChainRecipient: Address
    destinationChainRecipient?: Address
    bridgeTransactionData?: BridgeTransactionData
  }
}

export interface SwapDataSchema {
  command: Command.SWAP
  data: {
    originChainId: number
    trade: any
    slippageTolerance: number
    deadlineOrPreviousBlockhash?: string
    recipient?: Address
  }
}

export interface Permit2Schema {
  details?: {
    token: string
    amount: string
    expiration: number
    nonce: number
  }
  spender?: string
  sigDeadline?: string
  signature?: string
}

export interface CalldataRequestSchema {
  requestId?: string
  inputToken: string
  outputToken: string
  inputAmount: string
  originChainId: number
  destinationChainId: number
  recipientOnDestChain: string
  commands?: (BridgeDataSchema | SwapDataSchema)[]
  permit2?: Permit2Schema
  type: BridgeType
  user?: string
  slippageTolerance?: number
}

export enum BridgeStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  PENDING = 'PENDING', // when a transaction is not yet indexed
  BRIDGE_PENDING = 'BRIDGE_PENDING', // when bridging is pending
  FAILED = 'FAILED',
  MULTISIG_SUBMITTED = 'MULTISIG_SUBMITTED',
}

export interface BridgeStatusResponse {
  status: BridgeStatus
  data?: BridgeResponseStatusData[]
  inputToken?: string
  outputToken?: string
  inputAmount?: string
  outputAmount?: string
  originChainId?: number
  destinationChainId?: number
  minOutputAmount?: string
  orderId?: string
  transactionId?: string
}

export type BridgeResponseStatusData =
  | {
      command: Command.BRIDGE
      status: {
        code: BridgeStatus
        errorCode?: CrossChainAPIErrorCode
      }
      metadata?: StatusMetadataBridge
    }
  | {
      command: Command.SWAP
      status: {
        code: BridgeStatus
        errorCode?: CrossChainAPIErrorCode
      }
      metadata?: StatusMetadataSwap
    }

export enum RelayStatus {
  REFUND = 'refund',
  DELAYED = 'delayed',
  WAITING = 'waiting',
  FAILURE = 'failure',
  PENDING = 'pending',
  SUCCESS = 'success',
}

interface StatusMetadataBridge {
  originChainId: number
  destinationChainId: number
  depositId: number
  bridgeStatus: RelayStatus | string
  fillTx: string
  depositTxHash: string
  depositRefundTxHash: string
  inputAmount: string
  outputAmount: string
  fee: string
  inputToken: string
  outputToken: string
}

export interface StatusMetadataSwap {
  chainId: number
  inputToken: string
  outputToken: string
  inputAmount: string
  outputAmount: string
  tx: string
  fee: string
}

export interface BridgeStatusData extends BridgeStatusResponse {
  inputCurrencyAmount?: UnifiedCurrencyAmount<UnifiedCurrency> | null
  outputCurrencyAmount?: UnifiedCurrencyAmount<UnifiedCurrency> | null
  feesBreakdown?: {
    totalFeesUSD: number
    // in case of having swap in the bridge order, swapFeesUSD is null if swap fee is not loaded yet or returned as 0
    swapFeesUSD: number | null
    bridgeFeesUSD: number
  }
  bridgeStatus?: RelayStatus | string
}

export interface ActiveBridgeOrderMetadata {
  originChainId: number
  txHash: string
  destinationChainId: number
  isMultisig: boolean

  order: Exclude<PriceOrder, SVMOrder> | null | undefined

  // Optional metadata to show in modals quickly
  metadata?: {
    status: BridgeStatus
    inputToken: string
    outputToken: string
    inputAmount: string
    outputAmount: string
    minOutputAmount: string
    originChainId: number
    destinationChainId: number
    recipientOnDestinationChain: string
  }
}

export interface UserBridgeOrdersResponse {
  startCursor: string
  endCursor: string
  hasNextPage: boolean
  rows: UserBridgeOrder[]
}

export interface UserBridgeOrder {
  status: BridgeStatus
  inputToken: string
  outputToken: string
  inputAmount: string
  outputAmount: string
  minOutputAmount: string
  originChainId: number
  destinationChainId: number
  orderId: string
  transactionHash: string
  fillTransactionHash: string
  command: string
  timestamp: string
  recipientOnDestinationChain: string
}

export type BridgeMetadataParams = {
  inputAmount: CurrencyAmount<Currency>
  outputCurrency: Currency
  nonce?: number
  commands?: (BridgeDataSchema | SwapDataSchema)[]
  recipientOnDestChain?: string
}

export enum RELAY_STEP_ID {
  DEPOSIT = 'deposit',
  APPROVE = 'approve',
}
