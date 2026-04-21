import {
  AllowanceTransfer,
  Permit,
  Permit2ABI,
  generatePermitTypedData,
  getPermit2Address,
} from '@pancakeswap/permit2-sdk'
import { Token } from '@pancakeswap/swap-sdk-core'
import { Permit2Signature } from '@pancakeswap/universal-router-sdk'
import { useCallback } from 'react'
import { publicClient } from 'utils/viem'
import { Address, Hex, isHex, parseSignature, serializeSignature } from 'viem'
import { useSignTypedData, useWalletClient } from 'wagmi'
import { useAccountActiveChain } from './useAccountActiveChain'
import { useIsSmartContract } from './useIsSmartContract'

const normalizeSignatureV = (signature: Hex): Hex => {
  try {
    // Canonicalize signature v/yParity to legacy 27/28 encoding.
    return serializeSignature(parseSignature(signature))
  } catch {
    return signature
  }
}

const useAllowanceTransferPermit = (overrideChainId?: number) => {
  const { account, chainId: activeChainId } = useAccountActiveChain()
  const chainId = overrideChainId ?? activeChainId

  const { data: walletClient } = useWalletClient()

  return useCallback(
    async (permit: Permit) => {
      if (!chainId) throw new Error('PERMIT: missing chainId')
      if (!account) throw new Error('PERMIT: missing account')
      const permit2Address = getPermit2Address(chainId)
      if (!permit2Address) throw new Error('PERMIT: missing permit2Address')

      const { amount, token, expiration } = permit.details

      const client = publicClient({ chainId })

      const { request } = await client.simulateContract({
        address: permit2Address,
        abi: Permit2ABI,
        functionName: 'approve',
        args: [token as Address, permit.spender as Address, BigInt(amount), Number(expiration)],
      })
      return walletClient?.writeContract(request)
    },
    [account, chainId, walletClient],
  )
}

export const useWritePermit = (token?: Token, spender?: Address, nonce?: number, overrideChainId?: number) => {
  const { account, chainId: activeChainId } = useAccountActiveChain()
  const chainId = overrideChainId ?? activeChainId

  const { signTypedDataAsync } = useSignTypedData()
  const scWritePermit = useAllowanceTransferPermit(chainId)
  const isSC = useIsSmartContract(account, chainId)

  return useCallback(async (): Promise<Permit2Signature> => {
    if (!chainId) throw new Error('PERMIT: missing chainId')
    if (!token) throw new Error('PERMIT: missing token')
    if (!spender) throw new Error('PERMIT: missing spender')
    if (!account) throw new Error('PERMIT: missing owner')
    if (nonce === undefined) throw new Error('PERMIT: missing nonce')

    const permit: Permit = generatePermitTypedData(token, nonce, spender)

    if (isSC) {
      const tx = await scWritePermit(permit)
      return {
        ...permit,
        tx,
        signature: '0x',
      }
    }

    const {
      domain,
      types,
      values: message,
    } = AllowanceTransfer.getPermitData(permit, getPermit2Address(chainId), chainId)

    let signature = await signTypedDataAsync({
      account,
      domain,
      primaryType: 'PermitSingle',
      types,
      message,
    })

    // @hack: trust extension wallet doesn't prefix the signature with 0x
    signature = isHex(signature) ? signature : `0x${signature}`
    signature = normalizeSignatureV(signature)

    return {
      ...permit,
      signature,
    }
  }, [account, chainId, isSC, nonce, scWritePermit, signTypedDataAsync, spender, token])
}
