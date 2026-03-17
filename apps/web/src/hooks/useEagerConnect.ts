import { isInBinance } from '@binance/w3w-utils'
import { isCyberWallet } from '@cyberlab/cyber-app-sdk'
import { isTokenPocketApp } from '@pancakeswap/ui-wallets'
import { useEffect } from 'react'
import { useConfig, useConnect } from 'wagmi'
import { eip6963Providers } from 'wallet/WalletProvider'
import { createEip6963Connector } from 'wallet/eip6963Connector'
import { binanceWeb3WalletConnector, cyberWalletConnector, injectedConnector } from 'utils/wagmi'

const useEagerConnect = () => {
  const config = useConfig()
  const { connectAsync, connectors } = useConnect()

  useEffect(() => {
    if (!(typeof window === 'undefined') && window?.parent !== window && isCyberWallet() && cyberWalletConnector) {
      connectAsync({ connector: cyberWalletConnector as any })
    } else if (isInBinance()) {
      connectAsync({ connector: binanceWeb3WalletConnector() })
    } else if (isTokenPocketApp()) {
      let hadPreviousConnection = false
      try {
        if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage) {
          hadPreviousConnection = !!window.localStorage.getItem('wagmi.recentConnectorId')
        }
      } catch {
        hadPreviousConnection = false
      }
      if (hadPreviousConnection) {
        // Use EIP-6963 connector if TP announced one — it carries the wallet icon
        // and mirrors what useAuth.login() does on manual connect.
        // Fall back to injectedConnector if EIP-6963 is not available.
        const tpEip6963 = eip6963Providers.find((p) => p.provider?.isTokenPocket)
        const connector = tpEip6963 ? createEip6963Connector(tpEip6963) : injectedConnector
        connectAsync({ connector }).catch(() => {})
      }
    }
  }, [config, connectAsync, connectors])
}

export default useEagerConnect
