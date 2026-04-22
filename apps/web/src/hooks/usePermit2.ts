import { generatePermitTypedData, getPermit2Address, Permit2ABI } from '@pancakeswap/permit2-sdk'
import { Currency, CurrencyAmount, MaxUint256, Token } from '@pancakeswap/swap-sdk-core'
import { Permit2Signature } from '@pancakeswap/universal-router-sdk'
import { QueryObserverResult } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { Address, encodeFunctionData, Hash, erc20Abi, Hex } from 'viem'
import { useHasPendingApproval } from 'state/transactions/hooks'
import { useAccountActiveChain } from './useAccountActiveChain'
import { useApproveCallback } from './useApproveCallback'
import { Permit2Details, usePermit2Details } from './usePermit2Details'
import { usePermit2Requires } from './usePermit2Requires'
import { useWritePermit } from './useWritePermit'

type Permit2HookState = {
  permit2Allowance: CurrencyAmount<Currency> | undefined
  permit2Details: Permit2Details | undefined

  isPermitting: boolean
  isApproving: boolean
  isRevoking: boolean

  requirePermit: boolean
  requireApprove: boolean
  requireRevoke: boolean
}

export interface Calldata {
  address: Address
  calldata: Hex
  value?: Hex
}

type Permit2HookCallback = {
  permit: () => Promise<Permit2Signature & { tx?: Hash }>
  approve: () => Promise<{ hash: Address } | undefined>
  revoke: () => Promise<{ hash: Address } | undefined>

  refetch: () => Promise<QueryObserverResult<bigint>>

  getPermitCalldata: () => Calldata | null
  getApproveCalldata: () => Calldata | null
}

type UsePermit2ReturnType = Permit2HookState & Permit2HookCallback

export function useSubmitPermit2({
  currency,
  spender,
  permit2Details,
}: {
  currency: Token | undefined
  spender: Address | undefined
  permit2Details: Permit2Details | undefined
}) {
  const [isPermitting, setIsPermitting] = useState(false)
  const writePermit = useWritePermit(currency, spender, permit2Details?.nonce, currency?.chainId)

  const permit = useCallback(async () => {
    setIsPermitting(true)

    const signature = await writePermit()

    setIsPermitting(false)

    return signature
  }, [writePermit])

  return useMemo(
    () => ({
      permit,
      isPermitting,
    }),
    [permit, isPermitting],
  )
}

export const usePermit2 = (
  amount: CurrencyAmount<Token> | undefined,
  spender: Address | undefined,
  {
    enablePaymaster = false,
    overrideChainId,
  }: {
    enablePaymaster?: boolean
    overrideChainId?: number
  } = {},
): UsePermit2ReturnType => {
  const { account, chainId: activeChainId } = useAccountActiveChain()
  const chainId = overrideChainId ?? activeChainId

  const approveTarget = useMemo(() => getPermit2Address(chainId), [chainId])

  const { data: permit2Details } = usePermit2Details(account, amount?.currency, spender, chainId)
  const {
    requireApprove,
    requirePermit,
    requireRevoke,
    refetch,
    allowance: permit2Allowance,
  } = usePermit2Requires(amount, spender, chainId)

  const [isPermitting, setIsPermitting] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [isApprovingLocal, setIsApprovingLocal] = useState(false)

  const pendingApproval = useHasPendingApproval(amount?.currency?.address, approveTarget, chainId)
  // Stay in approving state while the tx is pending in Redux (covers Safe Wallet queue window).
  const isApproving = isApprovingLocal || pendingApproval

  const writePermit = useWritePermit(amount?.currency, spender, permit2Details?.nonce, chainId)
  const { approveNoCheck, revokeNoCheck } = useApproveCallback(amount, approveTarget, {
    enablePaymaster,
    overrideChainId: chainId,
  })

  const permit = useCallback(async () => {
    setIsPermitting(true)

    const signature = await writePermit()

    setIsPermitting(false)

    return signature
  }, [writePermit])

  const approve = useCallback(async () => {
    setIsApprovingLocal(true)
    try {
      const result = await approveNoCheck()
      console.log('[usePermit2] approve result:', result)
      return result
    } finally {
      setIsApprovingLocal(false)
    }
  }, [approveNoCheck])

  const revoke = useCallback(async () => {
    setIsRevoking(true)
    try {
      const result = await revokeNoCheck()
      return result
    } finally {
      setIsRevoking(false)
    }
  }, [revokeNoCheck])

  const getPermitCalldata = useCallback(() => {
    if (!amount?.currency || !permit2Details || !spender) return null

    const permit2Address = getPermit2Address(chainId)
    if (!permit2Address) return null

    const permit = generatePermitTypedData(amount.currency, permit2Details.nonce, spender)
    const { amount: permitAmount, token, expiration } = permit.details

    return {
      address: permit2Address,
      calldata: encodeFunctionData({
        abi: Permit2ABI,
        functionName: 'approve',
        args: [token as Address, permit.spender as Address, BigInt(permitAmount), Number(expiration)],
      }),
    }
  }, [chainId, permit2Details, amount?.currency, spender])

  const getApproveCalldata = useCallback(() => {
    const permit2Address = getPermit2Address(chainId)
    if (!permit2Address || !amount?.currency.address) {
      return null
    }

    return {
      address: amount?.currency.address,
      calldata: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [permit2Address, MaxUint256],
      }),
    }
  }, [amount?.currency.address, chainId])

  return {
    permit2Allowance,
    permit2Details,

    isPermitting,
    isApproving,
    isRevoking,

    requireApprove,
    requirePermit,
    requireRevoke,

    refetch,

    approve,
    revoke,
    permit,

    getPermitCalldata,
    getApproveCalldata,
  }
}
