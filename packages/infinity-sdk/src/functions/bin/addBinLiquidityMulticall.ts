import { Address, Hex, stringify } from 'viem'
import { BinLiquidityShape, PoolKey, Permit2Signature } from '../../types'
import { encodeMulticall } from '../../utils/encodeMulticall'
import { encodePermit2 } from '../../utils/encodePermit2'
import {
  BinAddLiquidityParams,
  encodeBinPositionManagerAddLiquidityCalldata,
  encodeBinPositionManagerInitializePoolCalldata,
} from './calldatas'
import { getLiquidityShape } from './getLiquidityShape'

export type AddBinLiquidityMulticallParams = {
  isInitialized: boolean
  activeIdDesired: bigint | number
  idSlippage: bigint | number
  poolKey: PoolKey<'Bin'>
  lowerBinId: number
  upperBinId: number
  liquidityShape: BinLiquidityShape
  owner: Address
  amount0: bigint
  amount1: bigint
  amount0Max: bigint
  amount1Max: bigint
  token0Permit2Signature: Permit2Signature | undefined
  token1Permit2Signature: Permit2Signature | undefined
  modifyPositionHookData?: Hex
  deadline: bigint
}

export const addBinLiquidityMulticall = ({
  isInitialized,
  activeIdDesired,
  idSlippage,
  liquidityShape,
  lowerBinId,
  upperBinId,
  poolKey,
  amount0,
  amount1,
  amount0Max,
  amount1Max,
  owner,
  token1Permit2Signature,
  token0Permit2Signature,
  deadline,
  modifyPositionHookData = '0x',
}: AddBinLiquidityMulticallParams) => {
  const calls: Hex[] = []

  if (!isInitialized) {
    calls.push(encodeBinPositionManagerInitializePoolCalldata(poolKey, activeIdDesired))
  }

  if (token0Permit2Signature) {
    calls.push(encodePermit2(owner, token0Permit2Signature))
  }

  if (token1Permit2Signature) {
    calls.push(encodePermit2(owner, token1Permit2Signature))
  }

  const shape = getLiquidityShape({
    shape: liquidityShape,
    lowerBinId,
    upperBinId,
    activeIdDesired: Number(activeIdDesired),
    amount0,
    amount1,
  })

  console.debug('debug shape', stringify(shape, null, 2))

  const addLiquidityParams: BinAddLiquidityParams = {
    poolKey,
    amount0,
    amount1,
    amount0Max,
    amount1Max,
    activeIdDesired: BigInt(activeIdDesired),
    idSlippage: BigInt(idSlippage),
    hookData: modifyPositionHookData,
    to: owner,
    ...shape,
  }

  calls.push(encodeBinPositionManagerAddLiquidityCalldata(addLiquidityParams, deadline))

  return encodeMulticall(calls)
}
