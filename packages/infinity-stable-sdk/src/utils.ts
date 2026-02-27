import { ChainId, Currency } from '@pancakeswap/sdk'
import { Address, getAddress } from 'viem'
import invariant from 'tiny-invariant'

/**
 * Validates that a currency is a valid token
 */
export function validateCurrency(currency: Currency): void {
  invariant(currency, 'INVALID_CURRENCY')
  invariant(currency.wrapped, 'CURRENCY_NOT_WRAPPED')
}

/**
 * Validates that two currencies are different and valid
 */
export function validateCurrencyPair(tokenA: Currency, tokenB: Currency): void {
  validateCurrency(tokenA)
  validateCurrency(tokenB)
  invariant(!tokenA.equals(tokenB), 'IDENTICAL_CURRENCIES')
  invariant(tokenA.wrapped.address !== tokenB.wrapped.address, 'IDENTICAL_ADDRESSES')
}

/**
 * Sorts two currencies and returns them in deterministic order
 * This ensures consistent pool creation regardless of input order
 */
export function sortCurrencies(tokenA: Currency, tokenB: Currency): [Currency, Currency] {
  validateCurrencyPair(tokenA, tokenB)
  return tokenA.wrapped.sortsBefore(tokenB.wrapped) ? [tokenA, tokenB] : [tokenB, tokenA]
}

/**
 * Gets the sorted token addresses from two currencies
 */
export function getSortedTokenAddresses(tokenA: Currency, tokenB: Currency): [Address, Address] {
  const [token0, token1] = sortCurrencies(tokenA, tokenB)
  return [token0.wrapped.address as Address, token1.wrapped.address as Address]
}

/**
 * Generates a pool name from two currencies
 */
export function generatePoolName(tokenA: Currency, tokenB: Currency): string {
  const [token0, token1] = sortCurrencies(tokenA, tokenB)
  return `${token0.symbol}-${token1.symbol}`
}

/**
 * Generates a pool symbol from two currencies
 */
export function generatePoolSymbol(tokenA: Currency, tokenB: Currency): string {
  return generatePoolName(tokenA, tokenB) // Same as name for now
}

/**
 * Validates that a fee is within acceptable bounds
 */
export function validateFee(fee: bigint): void {
  invariant(fee >= 0n, 'NEGATIVE_FEE')
  invariant(fee <= 10000000n, 'FEE_TOO_HIGH') // Max 1%
}

/**
 * Validates that an amplification parameter is within acceptable bounds
 */
export function validateAmplification(A: bigint): void {
  invariant(A >= 1n, 'AMPLIFICATION_TOO_LOW')
  invariant(A <= 10000n, 'AMPLIFICATION_TOO_HIGH')
}

// Fee precision: 10^8 (100,000,000)
// This means the minimum fee unit is 1e-8 (0.00000001 as decimal rate)
// Example: 0.00000001 * 100000000 = 1n
const FEE_PRECISION = 100000000

/**
 * Converts a decimal percentage (0-1 range) to fee format
 * Example: 0.00000001 -> 1n (minimum unit)
 * Uses Math.round for better precision with small values
 */
export function percentageToFee(percentage: number): bigint {
  invariant(percentage >= 0 && percentage <= 1, 'INVALID_PERCENTAGE')
  return BigInt(Math.round(percentage * FEE_PRECISION))
}

/**
 * Converts fee format to decimal percentage (0-1 range)
 * Example: 1n -> 0.00000001
 */
export function feeToPercentage(fee: bigint): number {
  return Number(fee) / FEE_PRECISION
}

export function getPoolIdFromReceipt(receipt?: {
  logs: {
    topics: string[]
  }[]
}): string | undefined {
  if (receipt && Array.isArray(receipt.logs) && receipt.logs.length > 2 && receipt.logs[2]?.topics?.length > 1) {
    return receipt.logs[2]?.topics[1]
  }

  return undefined
}

export function getHookAddressFromReceipt(receipt?: {
  logs: {
    data?: string
  }[]
}): Address | undefined {
  const calldata = receipt?.logs?.[2]?.data
  if (typeof calldata !== 'string' || !calldata.startsWith('0x')) {
    return undefined
  }

  const dataNoPrefix = calldata.slice(2)
  if (dataNoPrefix.length < 64) {
    return undefined
  }

  const firstWord = dataNoPrefix.slice(0, 64)
  const addressHex = firstWord.slice(24) // last 20 bytes (40 hex chars)
  if (addressHex.length !== 40) {
    return undefined
  }

  try {
    return getAddress(`0x${addressHex}` as Address)
  } catch {
    return undefined
  }
}

const INFINITY_STABLE_SUPPORTED_CHAINS = [ChainId.BSC, ChainId.BSC_TESTNET] as const

export function isInfinityStableSupported(chainId: ChainId): boolean {
  return INFINITY_STABLE_SUPPORTED_CHAINS.includes(chainId as (typeof INFINITY_STABLE_SUPPORTED_CHAINS)[number])
}
