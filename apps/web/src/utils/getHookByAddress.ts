import { ChainId } from '@pancakeswap/chains'
import { HookData, hooksList, whitelistLabeledHooksList } from '@pancakeswap/infinity-sdk'
import { Address } from 'viem'
import keyBy from 'lodash/keyBy'
import memoize from 'lodash/memoize'
import { isAddressEqual } from 'utils'
import { ZERO_ADDRESS } from '@pancakeswap/sdk'

export const getHooksMap = memoize((chainId: number) => {
  const list = hooksList[chainId] ?? []
  return keyBy(list, (item) => item.address.toLowerCase())
})

export const getHookByAddress = (chainId?: ChainId, address?: HookData['address']): HookData | undefined => {
  return chainId && address ? getHooksMap(chainId)[address.toLowerCase()] : undefined
}

export const isHookWhitelisted = memoize(
  (chainId?: ChainId, address?: Address): boolean => {
    if (!chainId || !address) return false
    return Boolean(
      isAddressEqual(address, ZERO_ADDRESS) ||
        whitelistLabeledHooksList[chainId]?.some((addr) => isAddressEqual(addr, address)) ||
        getHookByAddress(chainId, address),
    )
  },
  (chainId, address) => `${chainId}#${address}`,
)
