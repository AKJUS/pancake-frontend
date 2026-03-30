import { INFI_FARMING_DISTRIBUTOR_ADDRESSES, encodeClaimCalldata } from '@pancakeswap/infinity-sdk'
import { MasterChefV3 } from '@pancakeswap/v3-sdk'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Address, Hex, createWalletClient, custom, encodeFunctionData, hexToBigInt } from 'viem'
import { eip5792Actions } from 'viem/experimental'
import { useAccount, useSendTransaction, useWalletClient } from 'wagmi'
import { useAtomValue, useSetAtom } from 'jotai'
import { ChainId as EvmChainId } from '@pancakeswap/chains'

import { useEIP5792Status } from 'hooks/useIsEIP5792Supported'
import { useMasterchefV3ByChain } from 'hooks/useContract'
import { useUserAllFarmRewardsByChainIdFromAPI } from 'hooks/infinity/useFarmReward'
import { useMerkleTreeRootFromDistributor } from 'hooks/infinity/useDistributor'
import useCatchTxError from 'hooks/useCatchTxError'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { RetryableError, retry } from 'state/multicall/retry'
import { calculateGasMargin } from 'utils'
import { publicClient as getPublicClient } from 'utils/viem'

import {
  HarvestTxStatus,
  setHarvestStatusAtom,
  evmHarvestingAtom,
  evmTxMapAtom,
  resetEvmHarvestStatusAtom,
} from '../state/atoms'
import { invalidateHarvestRewardQueries } from '../utils/invalidateHarvestRewardQueries'

interface BatchCall {
  to: Address
  value: bigint
  data: Hex
}

export interface V2HarvestTarget {
  key: string
  lpAddress: Address
  bCakeWrapperAddress: Address
}

interface UseEvmHarvestAllParams {
  v3StakedTokenIds: string[]
  v2Targets: V2HarvestTarget[]
  /** Must match useHarvestModalData `effectiveEvmChainId` (focused / data chain, not necessarily wallet chain while previewing). */
  harvestModalChainId: number
}

export function useEvmHarvestAll({ v3StakedTokenIds, v2Targets, harvestModalChainId }: UseEvmHarvestAllParams) {
  const queryClient = useQueryClient()
  const chainId = harvestModalChainId
  const { address: account, connector } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId })
  const { sendTransactionAsync } = useSendTransaction()
  const eip5792Status = useEIP5792Status()
  const masterChefV3Address = useMasterchefV3ByChain(chainId as EvmChainId)?.address as Address | undefined
  const [, setLatestTxReceipt] = useLatestTxReceipt()
  const { fetchWithCatchTxError } = useCatchTxError()

  const setStatus = useSetAtom(setHarvestStatusAtom)
  const setHarvesting = useSetAtom(evmHarvestingAtom)
  const resetStatus = useSetAtom(resetEvmHarvestStatusAtom)

  const [infinityTimestamp, setInfinityTimestamp] = useState<number | undefined>()

  const { allRewards, totalUnclaimedRewards } = useUserAllFarmRewardsByChainIdFromAPI({
    chainId,
    user: account,
    timestamp: infinityTimestamp,
  })

  // When the API's merkle root doesn't match the on-chain root, the current snapshot is stale
  // (a new epoch was published but the API hasn't indexed it yet, or vice versa). Adjust the
  // timestamp to the last known-good epoch so the claim calldata will match what's on-chain.
  const merkleTreeRootFromDistributor = useMerkleTreeRootFromDistributor(chainId ?? undefined)
  const merkleRootMismatch = useMemo(
    () =>
      merkleTreeRootFromDistributor
        ? allRewards?.find((r) => r.merkleRoot !== merkleTreeRootFromDistributor)
        : undefined,
    [allRewards, merkleTreeRootFromDistributor],
  )
  useEffect(() => {
    if (infinityTimestamp || !merkleTreeRootFromDistributor || !merkleRootMismatch) return
    setInfinityTimestamp(Number(merkleRootMismatch.epochEndTimestamp) - 1)
  }, [merkleTreeRootFromDistributor, infinityTimestamp, merkleRootMismatch])

  const hasInfinityRewards = useMemo(
    () => totalUnclaimedRewards?.some((r) => Number(r.totalReward) > 0),
    [totalUnclaimedRewards],
  )
  // Mirror the panel's `infinityClaimable` gate: skip infinity harvest when the merkle proof is stale
  const infinityClaimable = hasInfinityRewards && !merkleRootMismatch
  const hasV3Rewards = v3StakedTokenIds.length > 0
  const hasV2Rewards = v2Targets.length > 0

  const isEip5792Ready = useMemo(
    () => eip5792Status === 'ready' && chainId !== EvmChainId.BASE,
    [eip5792Status, chainId],
  )

  const txCount = useMemo(() => {
    if (!chainId) return 0
    if (isEip5792Ready) return 1

    let count = 0
    if (infinityClaimable) count += 1
    if (hasV3Rewards) count += 1
    count += v2Targets.length
    return count
  }, [chainId, isEip5792Ready, infinityClaimable, hasV3Rewards, v2Targets.length])

  const buildInfinityCalldata = useCallback((): BatchCall | null => {
    if (!account || !allRewards || !chainId || !hasInfinityRewards) return null

    const claimParams = allRewards.map(({ totalRewardAmount, rewardTokenAddress, proofs }) => ({
      proof: proofs,
      amount: BigInt(totalRewardAmount),
      token: rewardTokenAddress,
    }))
    const calldata = encodeClaimCalldata(claimParams)

    return {
      to: INFI_FARMING_DISTRIBUTOR_ADDRESSES[chainId] as Address,
      data: calldata,
      value: 0n,
    }
  }, [account, allRewards, chainId, hasInfinityRewards])

  const buildV3Calldata = useCallback((): BatchCall | null => {
    if (!account || !masterChefV3Address || !hasV3Rewards) return null

    const { calldata, value } = MasterChefV3.batchHarvestCallParameters(
      v3StakedTokenIds.map((tokenId) => ({ tokenId, to: account })),
    )

    return {
      to: masterChefV3Address,
      data: calldata as Hex,
      value: hexToBigInt(value),
    }
  }, [account, masterChefV3Address, hasV3Rewards, v3StakedTokenIds])

  const onHarvestSuccess = useCallback(async () => {
    await invalidateHarvestRewardQueries(queryClient)
  }, [queryClient])

  const buildV2Calldatas = useCallback((): BatchCall[] => {
    return v2Targets.map((target) => ({
      to: target.bCakeWrapperAddress,
      data: encodeFunctionData({
        abi: [
          {
            name: 'deposit',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: '_amount', type: 'uint256' },
              { name: '_lock', type: 'bool' },
            ],
            outputs: [],
          },
        ],
        functionName: 'deposit',
        args: [0n, false],
      }),
      value: 0n,
    }))
  }, [v2Targets])

  const harvestBatched = useCallback(async () => {
    if (!walletClient || !connector || !chainId || !account) return

    const calls: BatchCall[] = []
    const keys: string[] = []

    if (infinityClaimable) {
      const infinityCall = buildInfinityCalldata()
      if (infinityCall) {
        calls.push(infinityCall)
        keys.push(`infinity-${chainId}`)
      }
    }

    const v3Call = buildV3Calldata()
    if (v3Call) {
      calls.push(v3Call)
      keys.push(`v3-${chainId}`)
    }

    const v2Calls = buildV2Calldatas()
    v2Calls.forEach((call, idx) => {
      calls.push(call)
      keys.push(v2Targets[idx].key)
    })

    if (calls.length === 0) return

    keys.forEach((key) => setStatus({ key, status: HarvestTxStatus.Pending }))

    try {
      const provider = await connector.getProvider()
      const client = createWalletClient({
        transport: custom(provider as any),
        account: walletClient.account,
        chain: walletClient.chain,
      }).extend(eip5792Actions())

      const result = await client.sendCalls({ calls, forceAtomic: true })

      if (!result.id) {
        keys.forEach((key) => setStatus({ key, status: HarvestTxStatus.Failed, error: 'No transaction ID returned' }))
        return
      }

      const { promise: statusPromise } = retry(
        async () => {
          const status = await client.getCallsStatus({ id: result.id })
          if (status.status === 'failure') throw new Error('Transaction failed')
          if (status.status !== 'success') throw new RetryableError()
          return status
        },
        { n: 20, minWait: 2000, maxWait: 4000 },
      )

      const status = await statusPromise
      const hash = status.receipts?.[0]?.transactionHash

      if (status.status === 'success') {
        keys.forEach((key) => setStatus({ key, status: HarvestTxStatus.Success, hash }))
        if (hash) {
          setLatestTxReceipt({ blockHash: hash, status: 'success' })
        }
        await onHarvestSuccess()
      }
    } catch (error) {
      keys.forEach((key) =>
        setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message ?? 'Unknown error' }),
      )
    }
  }, [
    walletClient,
    connector,
    chainId,
    account,
    infinityClaimable,
    buildInfinityCalldata,
    buildV3Calldata,
    buildV2Calldatas,
    v2Targets,
    setStatus,
    setLatestTxReceipt,
    onHarvestSuccess,
  ])

  const sendTx = useCallback(
    async (call: BatchCall) => {
      if (!account || !chainId) return null
      const client = getPublicClient({ chainId })
      return fetchWithCatchTxError(() =>
        client.estimateGas({ account, ...call }).then((estimate) =>
          sendTransactionAsync({
            ...call,
            account,
            chainId,
            gas: calculateGasMargin(estimate),
          }),
        ),
      )
    },
    [account, chainId, fetchWithCatchTxError, sendTransactionAsync],
  )

  const harvestSequential = useCallback(async () => {
    if (!account || !chainId) return

    let anySuccess = false

    if (infinityClaimable) {
      const key = `infinity-${chainId}`
      setStatus({ key, status: HarvestTxStatus.Pending })
      try {
        const call = buildInfinityCalldata()
        if (call) {
          const receipt = await sendTx(call)
          if (receipt?.status) {
            setStatus({ key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
            setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
            anySuccess = true
          } else {
            setStatus({ key, status: HarvestTxStatus.Failed })
          }
        }
      } catch (error) {
        setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
      }
    }

    if (hasV3Rewards && masterChefV3Address) {
      const key = `v3-${chainId}`
      setStatus({ key, status: HarvestTxStatus.Pending })
      try {
        const call = buildV3Calldata()
        if (call) {
          const receipt = await sendTx(call)
          if (receipt?.status) {
            setStatus({ key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
            setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
            anySuccess = true
          } else {
            setStatus({ key, status: HarvestTxStatus.Failed })
          }
        }
      } catch (error) {
        setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
      }
    }

    const v2Calls = buildV2Calldatas()
    for (let i = 0; i < v2Targets.length; i++) {
      const target = v2Targets[i]
      const call = v2Calls[i]
      setStatus({ key: target.key, status: HarvestTxStatus.Pending })
      try {
        // eslint-disable-next-line no-await-in-loop
        const receipt = await sendTx(call)
        if (receipt?.status) {
          setStatus({ key: target.key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
          setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
          anySuccess = true
        } else {
          setStatus({ key: target.key, status: HarvestTxStatus.Failed })
        }
      } catch (error) {
        setStatus({ key: target.key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
      }
    }

    if (anySuccess) {
      await onHarvestSuccess()
    }
  }, [
    account,
    chainId,
    infinityClaimable,
    hasV3Rewards,
    masterChefV3Address,
    v2Targets,
    buildInfinityCalldata,
    buildV3Calldata,
    buildV2Calldatas,
    sendTx,
    setStatus,
    setLatestTxReceipt,
    onHarvestSuccess,
  ])

  const harvestAll = useCallback(async () => {
    if (!chainId) return
    resetStatus()
    setHarvesting(true)
    try {
      if (isEip5792Ready) {
        await harvestBatched()
      } else {
        await harvestSequential()
      }
    } finally {
      setHarvesting(false)
    }
  }, [chainId, isEip5792Ready, harvestBatched, harvestSequential, setHarvesting, resetStatus])

  const currentTxMap = useAtomValue(evmTxMapAtom)

  const retryFailed = useCallback(async () => {
    if (!chainId || !account) return
    setHarvesting(true)

    try {
      let anySuccess = false

      if (infinityClaimable) {
        const key = `infinity-${chainId}`
        // Only retry if this entry actually failed; skip if already succeeded or never attempted
        if (currentTxMap[key]?.status === HarvestTxStatus.Failed) {
          setStatus({ key, status: HarvestTxStatus.Pending })
          try {
            const call = buildInfinityCalldata()
            if (call) {
              const receipt = await sendTx(call)
              if (receipt?.status) {
                setStatus({ key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
                setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
                anySuccess = true
              } else {
                setStatus({ key, status: HarvestTxStatus.Failed })
              }
            }
          } catch (error) {
            setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
          }
        }
      }

      if (hasV3Rewards && masterChefV3Address) {
        const key = `v3-${chainId}`
        if (currentTxMap[key]?.status === HarvestTxStatus.Failed) {
          setStatus({ key, status: HarvestTxStatus.Pending })
          try {
            const call = buildV3Calldata()
            if (call) {
              const receipt = await sendTx(call)
              if (receipt?.status) {
                setStatus({ key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
                setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
                anySuccess = true
              } else {
                setStatus({ key, status: HarvestTxStatus.Failed })
              }
            }
          } catch (error) {
            setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
          }
        }
      }

      const v2Calls = buildV2Calldatas()
      for (let i = 0; i < v2Targets.length; i++) {
        const target = v2Targets[i]
        const call = v2Calls[i]
        if (currentTxMap[target.key]?.status !== HarvestTxStatus.Failed) continue
        setStatus({ key: target.key, status: HarvestTxStatus.Pending })
        try {
          // eslint-disable-next-line no-await-in-loop
          const receipt = await sendTx(call)
          if (receipt?.status) {
            setStatus({ key: target.key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
            setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
            anySuccess = true
          } else {
            setStatus({ key: target.key, status: HarvestTxStatus.Failed })
          }
        } catch (error) {
          setStatus({ key: target.key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
        }
      }

      if (anySuccess) {
        await onHarvestSuccess()
      }
    } finally {
      setHarvesting(false)
    }
  }, [
    chainId,
    account,
    currentTxMap,
    infinityClaimable,
    hasV3Rewards,
    masterChefV3Address,
    v2Targets,
    buildInfinityCalldata,
    buildV3Calldata,
    buildV2Calldatas,
    sendTx,
    setStatus,
    setHarvesting,
    setLatestTxReceipt,
    onHarvestSuccess,
  ])

  // Mirrors useFarmInfinityActions flags so the modal can apply the same gating as InfinityPositionActions.
  const infinityHasRewards = Boolean(allRewards?.length)
  const infinityMerkleRootMismatch = Boolean(merkleRootMismatch)

  return {
    harvestAll,
    retryFailed,
    txCount,
    hasInfinityRewards,
    infinityHasRewards,
    infinityMerkleRootMismatch,
    hasV3Rewards,
    hasV2Rewards,
    isEip5792Ready,
    totalUnclaimedRewards,
  }
}
