import { useEffect, useCallback } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { previouslyUsedWalletsAtom, selectedWalletAtom, walletFilterAtom } from './atom'

export const useSelectedWallet = () => {
  return useAtomValue(selectedWalletAtom)
}

export const usePreviouslyUsedWallets = () => {
  return useAtomValue(previouslyUsedWalletsAtom)
}

export const useWalletFilter = () => {
  const [filter, setFilter] = useAtom(walletFilterAtom)

  const setFilterValue = useCallback(
    (value: boolean) => {
      setFilter({ type: filter.type, value })
    },
    [filter.type, setFilter],
  )

  const setFilterType = useCallback(
    (type: 'solanaOnly' | 'evmOnly') => {
      setFilter({ type, value: false })
    },
    [setFilter],
  )

  return {
    type: filter.type,
    value: filter.value,
    setFilterValue,
    setFilterType,
    setFilter,
  }
}

export enum WalletFilterValue {
  All = 'all',
  SolanaOnly = 'solanaOnly',
  EVMOnly = 'evmOnly',
}

export const useWalletFilterValue = () => {
  const { value: walletFilterChecked, type: walletFilterType } = useWalletFilter()

  if (walletFilterType === 'solanaOnly' && walletFilterChecked) {
    return WalletFilterValue.SolanaOnly
  }

  if (walletFilterType === 'evmOnly' && walletFilterChecked) {
    return WalletFilterValue.EVMOnly
  }

  return WalletFilterValue.All
}

export const useWalletFilterEffect = ({
  evmAddress,
  solanaAddress,
}: {
  evmAddress?: string
  solanaAddress?: string
}) => {
  const { setFilterValue, setFilterType, setFilter } = useWalletFilter()

  useEffect(() => {
    if (evmAddress && solanaAddress) {
      setFilterValue(false)
    } else if (evmAddress) {
      setFilter({ type: 'solanaOnly', value: true })
    } else if (solanaAddress) {
      setFilter({ type: 'evmOnly', value: true })
    } else {
      setFilter({ type: 'solanaOnly', value: false })
    }
  }, [evmAddress, solanaAddress, setFilter, setFilterValue, setFilterType])
}
