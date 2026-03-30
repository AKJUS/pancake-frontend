import { PositionDetails, Protocol } from '@pancakeswap/farms'
import { masterChefV3ABI } from '@pancakeswap/v3-sdk'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useMasterchefV3, useV3NFTPositionManagerContract } from 'hooks/useContract'
import { useReadContracts, useReadContract } from '@pancakeswap/wagmi'
import isUndefinedOrNull from '@pancakeswap/utils/isUndefinedOrNull'
import { useEffect, useMemo } from 'react'
import { Address } from 'viem'

interface UseV3PositionsResults {
  loading: boolean
  positions: PositionDetails[] | undefined
}

interface UseV3PositionResults {
  loading: boolean
  position: PositionDetails | undefined
}

export function useV3PositionsFromTokenIds(tokenIds: bigint | bigint[] | undefined): UseV3PositionsResults {
  const positionManager = useV3NFTPositionManagerContract()
  const { chainId } = useActiveChainId()

  const normalizedTokenIds = useMemo(() => {
    if (tokenIds === undefined) return []
    return Array.isArray(tokenIds) ? tokenIds : [tokenIds]
  }, [tokenIds])

  const inputs = useMemo(
    () =>
      normalizedTokenIds.length > 0 && positionManager
        ? normalizedTokenIds.map(
            (tokenId) =>
              ({
                abi: positionManager.abi,
                address: positionManager.address,
                functionName: 'positions',
                args: [tokenId],
                chainId,
              } as const),
          )
        : [],
    [chainId, positionManager, normalizedTokenIds],
  )

  const { isLoading, data: positions } = useReadContracts({
    contracts: inputs,
    allowFailure: true,
    query: {
      enabled: !!inputs.length,
    },
    watch: true,
  })

  return {
    loading: isLoading,
    positions: useMemo(() => {
      if (!positions || !inputs) return []

      return inputs
        .map((input, i) => {
          const p = positions[i]
          if (!p || p.status !== 'success' || !p.result) return undefined

          const r = p.result

          return {
            nonce: r[0],
            operator: r[1],
            token0: r[2],
            token1: r[3],
            fee: r[4],
            tickLower: r[5],
            tickUpper: r[6],
            liquidity: r[7],
            feeGrowthInside0LastX128: r[8],
            feeGrowthInside1LastX128: r[9],
            tokensOwed0: r[10],
            tokensOwed1: r[11],
            tokenId: input.args[0],
          } as PositionDetails
        })
        .filter((p): p is PositionDetails => !!p && !Object.values(p).some(isUndefinedOrNull))
    }, [inputs, positions]),
  }
}

export function useV3PositionFromTokenId(tokenId: bigint | undefined): UseV3PositionResults {
  const position = useV3PositionsFromTokenIds(tokenId)

  return useMemo(
    () => ({
      loading: position.loading,
      position: position.positions?.[0],
    }),
    [position.loading, position.positions],
  )
}

export function useV3TokenIdsByAccount(
  contractAddress?: Address,
  account?: Address | null | undefined,
  overrideChainId?: number,
): { tokenIds: bigint[]; loading: boolean } {
  const { chainId: activeChainId } = useActiveChainId()
  const chainId = overrideChainId ?? activeChainId

  const {
    isLoading: balanceLoading,
    data: accountBalance,
    refetch: refetchBalance,
  } = useReadContract({
    abi: masterChefV3ABI,
    address: contractAddress as `0x${string}`,
    query: {
      enabled: !!account && !!contractAddress,
    },
    args: [account!],
    functionName: 'balanceOf',
    chainId,
    watch: true,
  })

  const tokenIdsArgs = useMemo(() => {
    if (accountBalance && account) {
      const tokenRequests: {
        abi: typeof masterChefV3ABI
        address: Address
        functionName: 'tokenOfOwnerByIndex'
        args: [Address, number]
        chainId?: number
      }[] = []
      for (let i = 0; i < accountBalance; i++) {
        tokenRequests.push({
          abi: masterChefV3ABI,
          address: contractAddress as `0x${string}`,
          functionName: 'tokenOfOwnerByIndex',
          args: [account, i],
          chainId,
        })
      }
      return tokenRequests
    }
    return []
  }, [account, accountBalance, chainId, contractAddress])

  const {
    isLoading: someTokenIdsLoading,
    data: tokenIds,
    refetch: refetchTokenIds,
  } = useReadContracts({
    contracts: tokenIdsArgs,
    allowFailure: true,
    query: {
      enabled: !!tokenIdsArgs.length,
    },
  })

  // refetch when account changes, It seems like the useReadContracts doesn't refetch when the account changes on production
  // check if we can remove this effect when we upgrade to the latest version of wagmi
  useEffect(() => {
    if (account) {
      refetchBalance({ cancelRefetch: false })
      refetchTokenIds({ cancelRefetch: false })
    }
  }, [account, refetchBalance, refetchTokenIds])

  return {
    tokenIds: useMemo(
      () => (tokenIds?.map((r) => (r.status === 'success' ? r.result : null)).filter(Boolean) as bigint[]) ?? [],
      [tokenIds],
    ),
    loading: someTokenIdsLoading || balanceLoading,
  }
}

export function useV3Positions(account: Address | null | undefined): UseV3PositionsResults {
  const positionManager = useV3NFTPositionManagerContract()
  const masterchefV3 = useMasterchefV3()
  const isMasterChefV3Available = Boolean(masterchefV3?.address && masterchefV3?.address !== '0x')

  const { tokenIds, loading: tokenIdsLoading } = useV3TokenIdsByAccount(positionManager?.address, account)

  const { tokenIds: stakedTokenIds } = useV3TokenIdsByAccount(
    isMasterChefV3Available ? masterchefV3?.address : undefined,
    account,
  )

  const totalTokenIds = useMemo(() => [...stakedTokenIds, ...tokenIds], [stakedTokenIds, tokenIds])

  const { positions, loading: positionsLoading } = useV3PositionsFromTokenIds(totalTokenIds)

  return useMemo(
    () => ({
      loading: tokenIdsLoading || positionsLoading,
      positions: positions?.map((position) => ({
        ...position,
        isStaked: Boolean(stakedTokenIds?.find((s) => s === position.tokenId)),
        protocol: Protocol.V3,
      })),
    }),
    [positions, positionsLoading, stakedTokenIds, tokenIdsLoading],
  )
}
