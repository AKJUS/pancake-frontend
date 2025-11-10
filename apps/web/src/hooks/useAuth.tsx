import { useTranslation } from '@pancakeswap/localization'
import {
  EvmConnectorNames,
  WalletAdaptedNetwork,
  WalletConfigV3,
  WalletConnectorNotFoundError,
  WalletSwitchChainError,
} from '@pancakeswap/ui-wallets'
import { ConnectData } from '@pancakeswap/ui-wallets/src/types'
import { usePrivy } from '@privy-io/react-auth'
import { useCallback } from 'react'
import { useAppDispatch } from 'state'
import { CONNECTOR_MAP } from 'utils/wagmi'
import { ConnectorNotFoundError, SwitchChainNotSupportedError, useAccount, useConnect, useDisconnect } from 'wagmi'
import { eip6963Providers } from 'wallet/WalletProvider'
import { createEip6963Connector } from 'wallet/eip6963Connector'
import { useFirebaseAuth } from '../wallet/Privy/firebase'
import { clearUserStates } from '../utils/clearUserStates'
import { useActiveChainId } from './useActiveChainId'

const useAuth = () => {
  const dispatch = useAppDispatch()
  const { connectAsync } = useConnect()
  const { chain } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { chainId } = useActiveChainId()
  const { t } = useTranslation()
  const { logout: privyLogout, ready, authenticated } = usePrivy()
  const { signOutAndClearUserStates } = useFirebaseAuth()

  const login = useCallback(
    async (wallet: WalletConfigV3<EvmConnectorNames>): Promise<ConnectData | undefined> => {
      const { connectorId, title, networks } = wallet

      if (!networks.includes(WalletAdaptedNetwork.EVM)) return

      let eipConnector: any

      if (connectorId === EvmConnectorNames.Injected) {
        const eip6963detail = eip6963Providers.find((p) => p.info.name.toLowerCase() === title.toLowerCase())
        if (eip6963detail) {
          if (!eip6963detail.info.icon) {
            eip6963detail.info.icon = wallet.icon as string
          }
          eipConnector = createEip6963Connector(eip6963detail)
          console.log(`[wallet]`, 'createEip6963Connector', eip6963detail, eipConnector)
        }
      }
      const connector = eipConnector || CONNECTOR_MAP[connectorId]

      try {
        if (!connector) return
        // eslint-disable-next-line consistent-return
        return connectAsync({
          connector,
          chainId: connectorId === EvmConnectorNames.WalletConnect ? undefined : chainId,
        })
      } catch (error) {
        if (error instanceof ConnectorNotFoundError) {
          throw new WalletConnectorNotFoundError()
        }
        if (
          error instanceof SwitchChainNotSupportedError
          // TODO: wagmi
          // || error instanceof SwitchChainError
        ) {
          throw new WalletSwitchChainError(t('Unable to switch network. Please try it on your wallet'))
        }
      }
    },
    [connectAsync, chainId, t],
  )

  const logout = useCallback(async () => {
    console.log(`[wallet]`, 'logout', { chainId, authenticated, ready })
    try {
      if (authenticated && ready) {
        await signOutAndClearUserStates()
        await privyLogout()
      } else await disconnectAsync()
    } catch (error) {
      console.error(error)
    } finally {
      clearUserStates(dispatch, { chainId: chain?.id })
      // Clear wagmi storage to prevent auto-reconnect for wallets like Trust Wallet
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('wagmi.recentConnectorId')
        window.localStorage.removeItem('wagmi.store')
      }
    }
  }, [disconnectAsync, dispatch, chain?.id, chainId, authenticated, ready, signOutAndClearUserStates, privyLogout])

  return { login, logout }
}

export default useAuth
