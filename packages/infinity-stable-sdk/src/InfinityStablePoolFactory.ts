import { Currency } from '@pancakeswap/sdk'
import { ChainId } from '@pancakeswap/chains'
import { Address, Hex, encodeFunctionData, toHex } from 'viem'
import invariant from 'tiny-invariant'

import { infinityStablePoolFactoryABI } from './abis/infinityStablePoolFactoryABI'
import { CL_STABLE_SWAP_POOL_FACTORY_ADDRESS, INFINITY_STABLE_POOL_FEE_DENOMINATOR, NULL_METHOD_ID } from './constants'
import {
  AdvancedPoolFormParams,
  CreateInfinityStablePoolOptions,
  CreatePoolAndAddLiquidityOptions,
  MethodParameters,
  PoolPreset,
  PRESET_CONFIGS,
  ADDRESS_ZERO,
} from './types'

/**
 * Validates that two currencies are different
 */
function validateCurrencies(tokenA: Currency, tokenB: Currency): void {
  invariant(!tokenA.equals(tokenB), 'IDENTICAL_CURRENCIES')
  invariant(tokenA.wrapped.address !== tokenB.wrapped.address, 'IDENTICAL_ADDRESSES')
}

/**
 * Sorts two currencies and returns them in deterministic order
 */
function sortCurrencies(tokenA: Currency, tokenB: Currency): [Currency, Currency] {
  return tokenA.wrapped.sortsBefore(tokenB.wrapped) ? [tokenA, tokenB] : [tokenB, tokenA]
}

/**
 * StableSwapNG Pool Factory for creating and managing stable swap pools
 */
export abstract class InfinityStablePoolFactory {
  public static ABI = infinityStablePoolFactoryABI

  /**
   * Get the factory address for a specific chain
   */
  public static getFactoryAddress(chainId: ChainId.BSC | ChainId.BSC_TESTNET): Address {
    const address = CL_STABLE_SWAP_POOL_FACTORY_ADDRESS[chainId]
    invariant(address, `Unsupported chainId: ${chainId}`)
    return address
  }

  /**
   * Cannot be constructed.
   */
  // eslint-disable-next-line
  private constructor() {}

  /**
   * Encodes the createPool function call
   */
  private static encodeCreatePool(options: CreateInfinityStablePoolOptions): Hex {
    const [tokenA, tokenB] = sortCurrencies(options.tokenA, options.tokenB)

    // Generate pool name and symbol
    const name = `${tokenA.symbol}-${tokenB.symbol}`
    const symbol = `${tokenA.symbol}-${tokenB.symbol}`

    // Prepare token addresses
    const coins = [tokenA.wrapped.address as Address, tokenB.wrapped.address as Address]

    // Validate all required parameters are provided
    invariant(options.A !== undefined, 'A parameter is required')
    invariant(options.fee !== undefined, 'fee parameter is required')
    invariant(options.offpegFeeMultiplier !== undefined, 'offpegFeeMultiplier parameter is required')
    invariant(options.maExpTime !== undefined, 'maExpTime parameter is required')
    invariant(options.assetTypes !== undefined, 'assetTypes parameter is required')

    const { A } = options
    const { fee } = options
    const { offpegFeeMultiplier } = options
    const { maExpTime } = options
    const implementationIdx = 0n
    const { assetTypes } = options
    const methodIds = [options.methodIds?.[0] ?? NULL_METHOD_ID, options.methodIds?.[1] ?? NULL_METHOD_ID]
    const oracles = [options.oracles?.[0] ?? ADDRESS_ZERO, options.oracles?.[1] ?? ADDRESS_ZERO]

    console.info('[debug] InfinityStablePoolFactory.encodeCreatePool call parameters', {
      name,
      symbol,
      coins,
      A,
      fee,
      offpegFeeMultiplier,
      maExpTime,
      implementationIdx,
      assetTypes,
      methodIds,
      oracles,
    })

    return encodeFunctionData({
      abi: InfinityStablePoolFactory.ABI,
      functionName: 'createPool',
      args: [
        {
          name,
          symbol,
          coins,
          A,
          fee,
          offpegFeeMultiplier,
          maExpTime,
          implementationIdx,
          assetTypes,
          methodIds,
          oracles,
        },
      ],
    })
  }

  /**
   * Creates call parameters for pool creation
   */
  public static createPoolCallParameters(options: CreateInfinityStablePoolOptions): MethodParameters {
    validateCurrencies(options.tokenA, options.tokenB)

    return {
      calldata: this.encodeCreatePool(options),
      value: toHex(0),
    }
  }

  /**
   * Creates call parameters using a preset configuration
   */
  public static createPoolWithPresetCallParameters(
    tokenA: Currency,
    tokenB: Currency,
    preset: PoolPreset,
  ): MethodParameters {
    const presetConfig = PRESET_CONFIGS[preset]
    invariant(presetConfig, `Unknown preset: ${preset}`)

    return this.createPoolCallParameters({
      tokenA,
      tokenB,
      ...presetConfig,
    })
  }

  /**
   * Get preset configuration
   */
  public static getPresetConfig(preset: PoolPreset): Omit<CreateInfinityStablePoolOptions, 'tokenA' | 'tokenB'> {
    const presetConfig = PRESET_CONFIGS[preset]
    invariant(presetConfig, `Unknown preset: ${preset}`)
    return presetConfig
  }

  /**
   * Encodes the createPoolAndAddLiquidity function call
   */
  private static encodeCreatePoolAndAddLiquidity(options: CreatePoolAndAddLiquidityOptions): Hex {
    const [tokenA, tokenB] = sortCurrencies(options.tokenA, options.tokenB)

    // Generate pool name and symbol
    const name = `${tokenA.symbol}-${tokenB.symbol}`
    const symbol = `${tokenA.symbol}-${tokenB.symbol}`

    // Prepare token addresses
    const coins = [tokenA.wrapped.address as Address, tokenB.wrapped.address as Address]

    // Validate all required parameters are provided
    invariant(options.A !== undefined, 'A parameter is required')
    invariant(options.fee !== undefined, 'fee parameter is required')
    invariant(options.offpegFeeMultiplier !== undefined, 'offpegFeeMultiplier parameter is required')
    invariant(options.maExpTime !== undefined, 'maExpTime parameter is required')
    invariant(options.assetTypes !== undefined, 'assetTypes parameter is required')
    invariant(options.amount0 !== undefined, 'amount0 is required')
    invariant(options.amount1 !== undefined, 'amount1 is required')
    invariant(options.minMintAmount !== undefined, 'minMintAmount is required')
    invariant(options.receiver !== undefined, 'receiver is required')

    const { A } = options
    const { fee } = options
    const { offpegFeeMultiplier } = options
    const { maExpTime } = options
    const implementationIdx = 0n
    const { assetTypes } = options
    const methodIds = [options.methodIds?.[0] ?? NULL_METHOD_ID, options.methodIds?.[1] ?? NULL_METHOD_ID]
    const oracles = [options.oracles?.[0] ?? ADDRESS_ZERO, options.oracles?.[1] ?? ADDRESS_ZERO]

    // Determine which amounts to use based on token order
    const isSorted = options.tokenA.wrapped.sortsBefore(options.tokenB.wrapped)
    const amount0 = isSorted ? options.amount0 : options.amount1
    const amount1 = isSorted ? options.amount1 : options.amount0

    console.info('[debug] InfinityStablePoolFactory.encodeCreatePoolAndAddLiquidity call parameters', {
      name,
      symbol,
      coins,
      A,
      fee,
      offpegFeeMultiplier,
      maExpTime,
      implementationIdx,
      assetTypes,
      methodIds,
      oracles,
      amount0,
      amount1,
      minMintAmount: options.minMintAmount,
      receiver: options.receiver,
    })

    return encodeFunctionData({
      abi: InfinityStablePoolFactory.ABI,
      functionName: 'createPoolAndAddLiquidity',
      args: [
        {
          name,
          symbol,
          coins,
          A,
          fee,
          offpegFeeMultiplier,
          maExpTime,
          implementationIdx,
          assetTypes,
          methodIds,
          oracles,
        },
        {
          amount0,
          amount1,
          minMintAmount: options.minMintAmount,
          receiver: options.receiver,
        },
      ],
    })
  }

  /**
   * Converts raw string form params (as entered by the user) into SDK-compatible bigint pool options.
   * Handles swap fee percentage, amplification parameter, off-peg fee multiplier, and moving average time.
   */
  public static parsePoolFormParams(
    params: AdvancedPoolFormParams,
  ): Pick<CreateInfinityStablePoolOptions, 'fee' | 'A' | 'offpegFeeMultiplier' | 'maExpTime'> {
    const result: Pick<CreateInfinityStablePoolOptions, 'fee' | 'A' | 'offpegFeeMultiplier' | 'maExpTime'> = {}

    if (params.swapFee) {
      const swapFeeValue = parseFloat(params.swapFee)
      const clampedSwapFee = Math.max(0, Math.min(1, swapFeeValue))
      // 0.01% = 1000000
      result.fee = BigInt(Math.floor((clampedSwapFee / 100) * INFINITY_STABLE_POOL_FEE_DENOMINATOR))
    }

    if (params.isAdvancedEnabled) {
      if (params.amplificationParam) {
        result.A = BigInt(params.amplificationParam.replace(/,/g, ''))
      }
      if (params.offpegFeeMultiplier) {
        // Off-peg multiplier uses 1e10 precision (10 => 100000000000n)
        result.offpegFeeMultiplier = BigInt(Math.floor(parseFloat(params.offpegFeeMultiplier) * 1e10))
      }
      if (params.movingAverageTime) {
        result.maExpTime = BigInt(Math.floor(parseInt(params.movingAverageTime, 10) / Math.log(2)))
      }
    }

    return result
  }

  /**
   * Creates call parameters for pool creation with initial liquidity
   */
  public static createPoolAndAddLiquidityCallParameters(options: CreatePoolAndAddLiquidityOptions): MethodParameters {
    validateCurrencies(options.tokenA, options.tokenB)

    return {
      calldata: this.encodeCreatePoolAndAddLiquidity(options),
      value: toHex(0),
    }
  }
}
