import { usePrivy } from '@privy-io/react-auth'
import { useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'

import { getQueryChainId } from 'wallet/util/getQueryChainId'
import { accountActiveChainAtom, currentConnectorAtom } from 'wallet/atoms/accountStateAtoms'
import { useAccount } from 'wagmi'
import { usePrivyWalletAddress } from 'wallet/Privy/hooks'
import { useSwitchNetworkV2 } from './useSwitchNetworkV2'

export function useSyncWagmiState() {
  const { chainId: wagmiChainId, address: evmAccount, connector } = useAccount()
  const updAccountState = useSetAtom(accountActiveChainAtom)
  const setCurrentConnector = useSetAtom(currentConnectorAtom)
  const { switchNetwork } = useSwitchNetworkV2()
  const { ready, authenticated } = usePrivy()
  const { address: privyAddress, isLoading: isPrivyAddressLoading } = usePrivyWalletAddress()

  const oldWagmiChainId = useRef(wagmiChainId)

  useEffect(() => {
    const verifyWalletChainId = async () => {
      if (!oldWagmiChainId.current && wagmiChainId) {
        const urlChain = getQueryChainId()
        switchNetwork(urlChain || wagmiChainId, {
          from: 'connect',
          replaceUrl: true,
        }).then(() => {
          oldWagmiChainId.current = wagmiChainId
        })
      }
      if (wagmiChainId && oldWagmiChainId.current && oldWagmiChainId.current !== wagmiChainId) {
        switchNetwork(wagmiChainId, {
          replaceUrl: true,
          from: 'wagmi',
        }).then(() => {
          oldWagmiChainId.current = wagmiChainId
        })
      }
    }
    verifyWalletChainId()
  }, [wagmiChainId, switchNetwork])

  useEffect(() => {
    setCurrentConnector(connector ?? null)
  }, [connector, setCurrentConnector])

  useEffect(() => {
    if (!ready) {
      return
    }

    if (authenticated) {
      if (isPrivyAddressLoading) {
        return
      }

      updAccountState((prev) => ({
        ...prev,
        account: privyAddress,
      }))

      return
    }

    updAccountState((prev) => ({
      ...prev,
      account: evmAccount,
    }))
  }, [ready, authenticated, privyAddress, isPrivyAddressLoading, evmAccount, connector, updAccountState])
}
