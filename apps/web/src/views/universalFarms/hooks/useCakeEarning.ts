import { Protocol } from '@pancakeswap/farms'
import { formatBigInt } from '@pancakeswap/utils/formatBalance'
import BigNumber from 'bignumber.js'
import { useCakePrice } from 'hooks/useCakePrice'
import { useMemo } from 'react'
import { useStakedPositionsByUser } from 'state/farmsV3/hooks'
import { useAccountPositionDetailByPool } from 'state/farmsV4/hooks'
import { useAccountV2PendingCakeReward } from 'state/farmsV4/state/accountPositions/hooks/useAccountV2PendingCakeReward'
import { PoolInfo, StablePoolInfo, V2PoolInfo } from 'state/farmsV4/state/type'
import { useChainIdByQuery } from 'state/info/hooks'
import { useAccount } from 'wagmi'

export const useV2CakeEarning = (pool: PoolInfo | null | undefined) => {
  const { address: account } = useAccount()
  const cakePrice = useCakePrice()
  const { chainId, lpAddress } = pool || {}
  const { data: pendingCake, isLoading } = useAccountV2PendingCakeReward(account, {
    chainId,
    lpAddress,
    bCakeWrapperAddress: (pool as V2PoolInfo | StablePoolInfo)?.bCakeWrapperAddress,
  })
  const pendingCakeBigInt = useMemo(() => BigInt(pendingCake ?? 0), [pendingCake])
  const earningsAmount = useMemo(() => +formatBigInt(pendingCakeBigInt, 5), [pendingCakeBigInt])
  const earningsBusd = useMemo(() => {
    return new BigNumber(earningsAmount ?? 0).times(cakePrice.toString()).toNumber()
  }, [cakePrice, earningsAmount])

  return {
    earningsAmount,
    earningsBusd,
    hasEarnings: pendingCakeBigInt > 0n,
    isLoading,
  }
}

export const useV3CakeEarning = (tokenIds: bigint[] = [], chainId: number) => {
  const cakePrice = useCakePrice()
  const { tokenIdResults: results, isLoading } = useStakedPositionsByUser(tokenIds, chainId)
  const earningsAmount = useMemo(() => {
    return results.reduce((acc, pendingCake = 0n) => acc + pendingCake, 0n)
  }, [results])
  const earningsBusd = useMemo(() => {
    return new BigNumber(earningsAmount.toString()).times(cakePrice.toString()).div(1e18).toNumber()
  }, [cakePrice, earningsAmount])

  return useMemo(
    () => ({
      earningsAmount: +formatBigInt(earningsAmount, 5),
      earningsBusd,
      hasEarnings: earningsAmount > 0n,
      isLoading,
    }),
    [earningsAmount, earningsBusd, isLoading],
  )
}

export const useV3CakeEarningsByPool = (pool: PoolInfo | null | undefined) => {
  const chainId = useChainIdByQuery()
  const { address: account } = useAccount()
  const { data, isLoading } = useAccountPositionDetailByPool<Protocol.V3>(
    pool?.chainId ?? chainId,
    account,
    pool ?? undefined,
  )
  const tokenIds = useMemo(() => {
    if (!data?.length) return []
    return data
      .filter((item) => item.isStaked)
      .map((item) => item.tokenId)
      .filter(Boolean)
  }, [data])
  const { earningsBusd, earningsAmount, hasEarnings } = useV3CakeEarning(tokenIds, pool?.chainId ?? chainId)
  return {
    earningsBusd,
    earningsAmount,
    hasEarnings,
    isLoading,
  }
}
