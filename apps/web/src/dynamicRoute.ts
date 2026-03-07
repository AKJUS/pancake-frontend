import { ChainId, chainNames } from '@pancakeswap/chains'
import { Protocol } from '@pancakeswap/farms'
import { getChainId } from 'config/chains'
import { DynamicRoute } from 'next-typesafe-url'
import { Address, Hex } from 'viem'
import { z } from 'zod'

export const zChainId = z
  .number()
  .int()
  .positive()
  .refine(
    (num): num is ChainId => {
      return Object.values(ChainId).includes(num)
    },
    {
      message: 'Invalid chain id',
    },
  )
export const zChainName = z.enum(Object.values(chainNames) as [string, ...string[]])

export const zNetwork = zChainId.or(zChainName).transform((val) => {
  if (typeof val === 'number') return val
  const chainId = getChainId(val)

  // @notice: as zChainId is validated, this should never undefined
  return chainId!
})

export const zProtocolInfinity = z.literal('infinity')
export const zProtocolV3 = z.literal('v3')
export const zProtocolSolanaV3 = z.literal('v3')
export const zProtocolV2 = z.literal('v2')
export const zProtocolStable = z.literal('stableSwap')
export const zProtocol = zProtocolInfinity
  .or(zProtocolV3)
  .or(zProtocolSolanaV3)
  .or(zProtocolV2)
  .or(zProtocolStable)
  .optional()

export const zCurrencyId = z.string()
export const zAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .transform((val) => {
    return val as Address
  })
export const zInfinityPoolId = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid infinity pool id')
  .transform((val) => {
    return val as Hex
  })

export const zSelectId = z.object({
  chainId: zNetwork,
  protocol: zProtocol,
  currencyIdA: zCurrencyId,
  currencyIdB: zCurrencyId,
})
export const SelectIdRoute = {
  routeParams: z.object({
    selectId: z.tuple([zNetwork, zProtocol, zCurrencyId, zCurrencyId]).optional(),
  }),
} satisfies DynamicRoute

export const zInfinityPoolIdTuple = z.tuple([zNetwork, zProtocolInfinity, zInfinityPoolId])
export const zInfinityPoolIdObject = z.object({
  chainId: zNetwork,
  protocol: zProtocolInfinity,
  poolId: zInfinityPoolId,
})
export const zV3PoolIdTuple = z.tuple([zNetwork, zProtocolV3, zAddress, zAddress, z.number()])
export const zPoolAddressTuple = z.tuple([zNetwork, zProtocolV2.or(zProtocolStable).or(zProtocolV3), zAddress])

export const PoolIdRoute = {
  routeParams: z.object({
    poolId: zInfinityPoolIdTuple.or(zV3PoolIdTuple).or(zPoolAddressTuple),
  }),
} satisfies DynamicRoute

export const zTokenId = z.number().int().positive()
export const zMintId = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
export const zPositionProtocol = z.enum([Protocol.InfinityCLAMM, Protocol.InfinityBIN])
export const zPositionAction = z.enum(['increase', 'decrease'])
export const zProtocolInfinityBin = z
  .string()
  .regex(
    new RegExp(`^${Protocol.InfinityBIN}$`, 'i'),
    `Invalid protocol: expected ${Protocol.InfinityBIN} (case-insensitive)`,
  )
  .transform(() => Protocol.InfinityBIN)
export const zProtocolInfinityClamm = z
  .string()
  .regex(
    new RegExp(`^${Protocol.InfinityCLAMM}$`, 'i'),
    `Invalid protocol: expected ${Protocol.InfinityCLAMM} (case-insensitive)`,
  )
  .transform(() => Protocol.InfinityCLAMM)
export const zInfinityBinPositionIdTuple = z
  .tuple([zProtocolInfinityBin, zInfinityPoolId])
  .or(z.tuple([zProtocolInfinityBin, zInfinityPoolId, zPositionAction]))
export const zInfinityBinPositionIdObject = z.object({
  protocol: zProtocolInfinityBin,
  poolId: zInfinityPoolId,
  action: zPositionAction.optional(),
})
export const zInfinityClammPositionIdTuple = z
  .tuple([zProtocolInfinityClamm, zTokenId])
  .or(z.tuple([zProtocolInfinityClamm, zTokenId, zPositionAction]))
export const zInfinityClammPositionIdObject = z.object({
  protocol: zProtocolInfinityClamm,
  tokenId: zTokenId,
  action: zPositionAction.optional(),
})
export const zSolanaV3PositionIdTuple = z.tuple([z.literal(Protocol.V3), z.literal('solana'), zMintId, zMintId])
export const zSolanaV3PositionIdObject = z.object({
  protocol: z.literal(Protocol.V3),
  type: z.literal('solana'),
  poolId: zMintId,
  mintId: zMintId,
})
export const PositionIdRoute = {
  routeParams: z.object({
    positionId: zInfinityBinPositionIdTuple.or(zInfinityClammPositionIdTuple).or(zSolanaV3PositionIdTuple), // only Infinity bin, Infi clamm, Solana v3 support now, can add v2/v3/stable later
  }),
} satisfies DynamicRoute
