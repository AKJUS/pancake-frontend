import { ChainId, NonEVMChainId } from '@pancakeswap/chains'
import {
  encodeHooksRegistration,
  HookData,
  hooksList,
  INFI_BIN_POOL_MANAGER_ADDRESSES,
  INFI_CL_POOL_MANAGER_ADDRESSES,
} from '@pancakeswap/infinity-sdk'

import { Currency, CurrencyAmount, Percent, SPLToken } from '@pancakeswap/swap-sdk-core'
import { checksumAddress } from 'viem'
import { Address } from 'viem/accounts'
import {
  BaseInfinityPool,
  InfinityBinPool,
  InfinityClPool,
  InfinityStablePool,
  PoolType,
  StablePool,
  SVMPool,
  V2Pool,
  V3Pool,
  WithTvl,
} from '../../v3-router/types'
import {
  parseBinPoolBinReserves,
  parseCurrency,
  parseTick,
  serializeBinPoolBinReserves,
  serializeTick,
} from '../../v3-router/utils/transformer'
import {
  RemotePool,
  RemotePoolBase,
  RemotePoolBIN,
  RemotePoolCL,
  RemotePoolInfinityStable,
  RemotePoolStable,
  RemotePoolV2,
  RemotePoolV3,
  RemoteToken,
} from './remotePool.type'

type WithChainId = {
  chainId: ChainId
}

function getValidToken(chainId: ChainId, token: RemoteToken): Currency {
  try {
    const raw = {
      address: checksumAddress(token.id),
      decimals: token.decimals,
      symbol: token.symbol,
    }
    return parseCurrency(chainId, raw)
  } catch (ex) {
    console.warn('invalid token', token, ex)
    throw ex
  }
}

function normalizeTvlUSD(tvlUSD: string) {
  const val = Number(tvlUSD)
  return Number.isFinite(val) ? Math.ceil(val).toString() : '0'
}

export function parseRemotePool(remote: RemotePool) {
  if (remote.protocol === 'infinityCl') {
    return toLocalInfinityPool(remote as RemotePoolCL, remote.chainId as keyof typeof hooksList)
  }
  if (remote.protocol === 'infinityBin') {
    return toLocalInfinityPool(remote as RemotePoolBIN, remote.chainId as keyof typeof hooksList)
  }
  if (remote.protocol === 'infinityStable') {
    return parseRemoteInfinityStablePool(remote as RemotePoolInfinityStable)
  }
  if (remote.protocol === 'v2') {
    return parseRemoteV2Pool(remote as RemotePoolV2)
  }
  if (remote.protocol === 'v3') {
    if (remote.chainId === NonEVMChainId.SOLANA) return parseRemoteV3Pool(remote as RemotePoolV3)
    return parseRemoteV3Pool(remote as RemotePoolV3)
  }
  if (remote.protocol === 'stable') {
    return parseRemoteStablePool(remote as RemotePoolStable)
  }
  throw new Error(`Unsupported pool protocol`)
}

export function parseRemoteStablePool(remote: RemotePoolStable) {
  const chainId = remote.chainId as ChainId
  const currency0 = getValidToken(chainId, remote.token0)
  const currency1 = getValidToken(chainId, remote.token1)
  return {
    type: PoolType.STABLE,
    address: checksumAddress(remote.id),
    balances: [CurrencyAmount.fromRawAmount(currency0, 0), CurrencyAmount.fromRawAmount(currency1, 0)],
    amplifier: 0n,
    fee: new Percent(remote.feeTier || 0, 1_000),
  } as StablePool
}

export function parseRemoteInfinityStablePool(remote: RemotePoolInfinityStable) {
  const chainId = remote.chainId as ChainId
  const currency0 = getValidToken(chainId, remote.token0)
  const currency1 = getValidToken(chainId, remote.token1)
  const tvlUSD = BigInt(normalizeTvlUSD(remote.tvlUSD))
  const poolManagerAddress = INFI_CL_POOL_MANAGER_ADDRESSES[chainId as keyof typeof hooksList]

  return {
    type: PoolType.InfinityStable,
    id: checksumAddress(remote.id),
    chainId,
    currency0,
    currency1,
    fee: remote.feeTier,
    tickSpacing: 1,
    // NOTE: amplifier and stableFee are not available in the remote pool yet
    amplifier: 0,
    stableFee: 0,
    hooks: remote.hookAddress ? checksumAddress(remote.hookAddress) : undefined,
    poolManager: poolManagerAddress,
    tvlUSD,
  } as InfinityStablePool & WithTvl
}

export function parseRemoteV2Pool(remote: RemotePoolV2) {
  const chainId = remote.chainId as ChainId
  const currency0 = getValidToken(chainId, remote.token0)
  const currency1 = getValidToken(chainId, remote.token1)
  return {
    type: PoolType.V2,
    address: checksumAddress(remote.id),
    reserve0: CurrencyAmount.fromRawAmount(currency0, 0),
    reserve1: CurrencyAmount.fromRawAmount(currency1, 0),
  } as V2Pool
}

export function parseRemoteV3Pool(remote: RemotePoolV3) {
  const { chainId } = remote
  const isSol = chainId === NonEVMChainId.SOLANA
  return {
    type: PoolType.V3,
    token0: isSol ? parseSolanaToken(chainId, remote.token0) : getValidToken(chainId, remote.token0),
    token1: isSol ? parseSolanaToken(chainId, remote.token1) : getValidToken(chainId, remote.token1),
    fee: remote.feeTier,
    liquidity: remote.liquidity ? BigInt(remote.liquidity) : 0n,
    sqrtRatioX96: 0n,
    token0ProtocolFee: new Percent(0, 1_000_000),
    token1ProtocolFee: new Percent(0, 1_000_000),
  } as V3Pool
}

const DEFAULT_SOLANA_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

function parseSolanaToken(chainId: NonEVMChainId, token: RemoteToken): SPLToken {
  const programId = DEFAULT_SOLANA_PROGRAM_ID

  return new SPLToken({
    chainId,
    address: token.id,
    decimals: token.decimals,
    symbol: token.symbol,
    logoURI: '',
    programId,
  })
}

export function toLocalInfinityPool(
  remote: RemotePoolCL | RemotePoolBIN,
  chainId: keyof typeof hooksList,
  hooksMap?: Record<string, HookData>,
) {
  const { id, feeTier, protocol, protocolFee, hookAddress, tvlUSD } = remote

  const type = protocol === 'infinityCl' ? PoolType.InfinityCL : PoolType.InfinityBIN

  let relatedHook = hooksList[chainId]?.find((hook) => hook.address.toLowerCase() === hookAddress?.toLowerCase())
  if (hooksMap && !relatedHook && hookAddress) {
    relatedHook = hooksMap?.[hookAddress.toLowerCase()]
  }

  const currency0 = getValidToken(chainId, remote.token0)
  const currency1 = getValidToken(chainId, remote.token1)
  const bnTvlUsd = BigInt(normalizeTvlUSD(tvlUSD))

  const pool: BaseInfinityPool & WithTvl & WithChainId = {
    id: checksumAddress(id),
    chainId,
    type,
    fee: feeTier,
    protocolFee,
    hooks: hookAddress ? checksumAddress(hookAddress) : undefined,
    hooksRegistrationBitmap: relatedHook ? encodeHooksRegistration(relatedHook.hooksRegistration) : undefined,
    poolManager:
      type === PoolType.InfinityBIN
        ? INFI_BIN_POOL_MANAGER_ADDRESSES[chainId]
        : INFI_CL_POOL_MANAGER_ADDRESSES[chainId],
    currency0,
    currency1,
    tvlUSD: bnTvlUsd,
  }

  if (pool.type === PoolType.InfinityCL) {
    const remoteClPool = remote as RemotePoolCL

    return {
      ...pool,
      type: PoolType.InfinityCL,
      sqrtRatioX96: remoteClPool.sqrtPrice ? BigInt(remoteClPool.sqrtPrice) : 0n,
      tick: remoteClPool.tick,
      ticks: remoteClPool.ticks ? remoteClPool.ticks.map((x) => parseTick(x)) : [],
      tickSpacing: Number(remoteClPool.tickSpacing),
      liquidity: remoteClPool.liquidity ? BigInt(remoteClPool.liquidity) : 0n,
    } as InfinityClPool
  }
  if (pool.type === PoolType.InfinityBIN) {
    const removeBinPool = remote as RemotePoolBIN
    const binPool: InfinityBinPool = {
      ...pool,
      type: PoolType.InfinityBIN,
      binStep: removeBinPool.binStep,
      activeId: removeBinPool.activeId,
      reserveOfBin: parseBinPoolBinReserves(removeBinPool.reserveOfBin),
    }
    return binPool
  }
  throw new Error(`Unknown pool type: ${type}`)
}

export function toRemoteInfinityPool(
  pool: (InfinityClPool & WithTvl) | (InfinityBinPool & WithTvl),
): RemotePoolCL | RemotePoolBIN {
  const base: RemotePoolBase = {
    id: pool.id,
    chainId: pool.currency0.chainId,
    token0: {
      id: pool.currency0.wrapped.address as Address,
      decimals: pool.currency0.decimals,
      symbol: pool.currency0.symbol || '',
    },
    token1: {
      id: pool.currency1.wrapped.address as Address,
      decimals: pool.currency1.decimals,
      symbol: pool.currency1.symbol || '',
    },
    tvlUSD: pool.tvlUSD.toString(),
    apr24h: '0',
    volumeUSD24h: '0',
    hookAddress: pool.hooks as Address | undefined,
    isDynamicFee: false, // Assuming default; adjust based on your logic
    protocol: pool.type === PoolType.InfinityCL ? 'infinityCl' : 'infinityBin',
    feeTier: pool.fee,
  }

  if (pool.type === PoolType.InfinityCL) {
    const ticks = pool.ticks ? pool.ticks.map((x) => serializeTick(x)) : []
    return {
      ...base,
      sqrtPrice: pool.sqrtRatioX96.toString(),
      tick: pool.tick,
      ticks,
      tickSpacing: pool.tickSpacing,
      protocolFee: pool.protocolFee || 0,
      feeTier: pool.fee,
    } as RemotePoolCL
  }

  if (pool.type === PoolType.InfinityBIN) {
    const bins = serializeBinPoolBinReserves(pool.reserveOfBin)
    return {
      ...base,
      binStep: pool.binStep,
      activeId: pool.activeId,
      reserveOfBin: bins,
      protocolFee: pool.protocolFee || 0,
      feeTier: pool.fee,
    } as RemotePoolBIN
  }

  throw new Error(`Unsupported pool type: ${pool}`)
}
