import { BinPositionManagerAbi, CLPositionManagerAbi } from '@pancakeswap/infinity-sdk'
import { getInfinityPositionManagerAddress } from 'utils/addressHelpers'
import { publicClient } from 'utils/viem'
import { Address } from 'viem'
import { isAddressEqual } from 'utils'

/**
 * Get all token ids of a given account
 * including farming and non-farming token ids
 *
 * @param chainId target chain id
 * @param account target account address
 * @returns
 */
export const getAccountInfinityCLTokenIds = async (chainId: number, account: Address) => {
  const positionManagerAddress = getInfinityPositionManagerAddress('CL', chainId)
  const abi = CLPositionManagerAbi
  return getAccountInfinityCLTokenIdsFromContract(chainId, account, positionManagerAddress, abi)
}

export const getAccountInfinityCLTokenIdsFromContract = async (
  chainId: number,
  account: Address,
  contractAddress: Address | undefined | null,
  abi: typeof CLPositionManagerAbi | typeof BinPositionManagerAbi,
) => {
  const client = publicClient({ chainId })

  if (!contractAddress || !account || !client) {
    return []
  }

  const nextTokenId = await client.readContract({
    abi,
    address: contractAddress,
    functionName: 'nextTokenId',
  })

  const ownerOfCalls = Array.from({ length: Number(nextTokenId) }, (_, i) => {
    return {
      abi,
      address: contractAddress,
      functionName: 'ownerOf',
      args: [i + 1] as const,
    } as const
  })

  const ownerOfResults = await client.multicall({
    contracts: ownerOfCalls,
    allowFailure: true,
  })

  const tokenIds = ownerOfResults
    .map((resp, idx) => (resp.result && isAddressEqual(resp.result, account) ? idx + 1 : null))
    .filter((item) => item !== null) as number[]

  return tokenIds
}

export const getAccountInfinityCLTokenIdsRecently = async (chainId: number, account: Address) => {
  const client = publicClient({ chainId })
  const psm = getInfinityPositionManagerAddress('CL', chainId)

  if (!psm || !account || !client) {
    return []
  }

  const nextTokenId = await client.readContract({
    abi: CLPositionManagerAbi,
    address: psm,
    functionName: 'nextTokenId',
  })

  const ownerOfCalls = new Array(Number(50)).fill(0).map((_, i) => {
    return {
      abi: CLPositionManagerAbi,
      address: psm,
      functionName: 'ownerOf',
      args: [Number(nextTokenId) + 5 - i] as const,
    } as const
  })

  const ownerOfResults = await client.multicall({
    contracts: ownerOfCalls,
    allowFailure: true,
  })

  const tokenIds = ownerOfResults
    .map((resp, idx) => (resp.result && isAddressEqual(resp.result, account) ? Number(nextTokenId) + 5 - idx : null))
    .filter((item) => item !== null) as number[]

  return tokenIds
}
