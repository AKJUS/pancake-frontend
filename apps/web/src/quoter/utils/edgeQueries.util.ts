import { ChainId, NonEVMChainId, UnifiedChainId } from '@pancakeswap/chains'
import { INFINITY_SUPPORTED_CHAINS } from '@pancakeswap/infinity-sdk'
import { OnChainProvider } from '@pancakeswap/smart-router'
import { NextResponse } from 'next/server'
import qs from 'qs'
import { checksumAddress } from 'utils/checksumAddress'
import { getViemClients } from 'utils/viem.server'
import { type Address } from 'viem'

export type Protocol = 'v2' | 'stable' | 'v3' | 'infinityCl' | 'infinityBin' | 'infinityStable'

export const ALLOWED_PROTOCOLS = ['v2', 'stable', 'v3', 'infinityCl', 'infinityBin', 'infinityStable']

export const getProvider = () => {
  return getViemClients as OnChainProvider
}

const MAX_CACHE_SECONDS = 10
export const responseJson = (val: any, extra?: any) => {
  return NextResponse.json(
    {
      data: val,
      lastUpdated: Number(Date.now()),
      ...extra,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': `max-age=${MAX_CACHE_SECONDS}, s-maxage=${MAX_CACHE_SECONDS}`,
        'Content-Type': 'application/json',
      },
    },
  )
}

export function parseCandidatesQuery(raw: string) {
  if (!raw) {
    throw new Error('Invalid query')
  }
  const queryParsed = qs.parse(raw)
  const addressA = checksumAddress(queryParsed.addressA as Address)
  const addressB = checksumAddress(queryParsed.addressB as Address)
  const protocols = ((queryParsed.protocol as string) || '').split(',') as Protocol[]
  const chainId = Number.parseInt(queryParsed.chainId as string)
  const typeParam = (queryParsed.type as string) || 'full'
  const type = typeParam === 'light' ? 'light' : 'full'
  const includeInfinity = protocols.includes('infinityBin') || protocols.includes('infinityCl')
  if (!INFINITY_SUPPORTED_CHAINS.includes(chainId) && includeInfinity) {
    throw new Error('Invalid chainId')
  }
  for (const protocol of protocols) {
    if (ALLOWED_PROTOCOLS.indexOf(protocol) === -1) {
      throw new Error('Invalid protocol')
    }
  }
  return {
    addressA,
    addressB,
    protocols,
    chainId,
    type,
  }
}

export function parseTvQuery(raw: string) {
  if (!raw) {
    throw new Error('Invalid query')
  }

  const queryParsed = qs.parse(raw)
  const protocols = ((queryParsed.protocol as string) || '').split(',') as Protocol[]
  const chainId = Number.parseInt(queryParsed.chainId as string)

  const allowedProtocols = ['infinityBin', 'infinityCl']

  if (!INFINITY_SUPPORTED_CHAINS.includes(chainId)) {
    throw new Error('Invalid chainId')
  }

  for (const protocol of protocols) {
    if (!allowedProtocols.includes(protocol)) {
      throw new Error('Invalid protocol')
    }
  }

  return {
    protocols,
    chainId,
  }
}

export function getEdgeChainName(chainId: UnifiedChainId): APIChain {
  switch (chainId) {
    case ChainId.BSC:
      return 'bsc'
    case ChainId.BSC_TESTNET:
      return 'bsc-testnet'
    case ChainId.ETHEREUM:
      return 'ethereum'
    case ChainId.BASE:
      return 'base'
    case ChainId.OPBNB:
      return 'opbnb'
    case ChainId.ZKSYNC:
      return 'zksync'
    case ChainId.LINEA:
      return 'linea'
    case ChainId.ARBITRUM_ONE:
      return 'arbitrum'
    case NonEVMChainId.SOLANA:
      return 'sol'
    case ChainId.MONAD_MAINNET:
      return 'monad'
    default:
      throw new Error('Invalid chain id')
  }
}

export type APIChain =
  | 'bsc'
  | 'bsc-testnet'
  | 'ethereum'
  | 'base'
  | 'opbnb'
  | 'zksync'
  | 'linea'
  | 'arbitrum'
  | 'sol'
  | 'monad'

export const safeGetAddress = (address: Address) => {
  try {
    return checksumAddress(address)
  } catch (error) {
    return undefined
  }
}
