import { EventEmitter } from 'events'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getAddress, hexToBigInt } from 'viem'
import { useChainId, useConfig, useConnectors, useReconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'

/**
 * Registers a smart account connector in wagmi for the Privy embedded smart wallet.
 *
 * @experimental
 * Currently, this hook only supports:
 * - using only the smart account connector if the smart wallets client has loaded. All other connectors
 *   (e.g. external wallets) will be removed while the user is using the embedded wallet.
 *
 */
export const useEmbeddedSmartAccountConnectorV2 = () => {
  const connectors = useConnectors()
  const config = useConfig()
  const id = useChainId()
  const { client: isReady, getClientForChain } = useSmartWallets()
  const { reconnect } = useReconnect()
  const router = useRouter()

  // Add state management to track smart wallet ready status
  const [isSmartWalletReady, setIsSmartWalletReady] = useState(false)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [hasSetupFailed, setHasSetupFailed] = useState(false)
  const [setupStartTime, setSetupStartTime] = useState<number | null>(null)

  // Check URL parameter to disable AA wallet
  const shouldUseAAWallet = router.query.aawallet !== 'false'

  useEffect(() => {
    const setupSmartAccountConnector = async () => {
      // Track setup start time for first attempt
      if (retryCount === 0 && !setupStartTime) {
        setSetupStartTime(Date.now())
      }

      // Check if total time exceeded 10 seconds
      if (setupStartTime) {
        const totalDuration = (Date.now() - setupStartTime) / 1000
        if (totalDuration > 10) {
          console.error(
            `[PrivySmartAccount] ❌ Total setup time exceeded 10 seconds (${totalDuration.toFixed(2)}s), giving up`,
          )
          setIsSmartWalletReady(true)
          setIsSettingUp(false)
          setHasSetupFailed(true)
          setSetupStartTime(null)
          return
        }
      }

      // If AA wallet is disabled via URL param, skip setup
      if (!shouldUseAAWallet) {
        setIsSmartWalletReady(true)
        setIsSettingUp(false)
        setHasSetupFailed(false)
        setSetupStartTime(null)
        return
      }

      // Prevent infinite retry loop - max 3 attempts
      if (retryCount >= 3) {
        const totalDuration = setupStartTime ? ((Date.now() - setupStartTime) / 1000).toFixed(2) : '0'
        console.error('[PrivySmartAccount] ❌ Setup failed after 3 attempts', {
          retryCount,
          totalDuration: `${totalDuration}s`,
          timestamp: new Date().toISOString(),
        })
        setIsSmartWalletReady(true) // Mark as ready to prevent further retries
        setIsSettingUp(false)
        setHasSetupFailed(true) // Mark as failed
        setSetupStartTime(null)
        return
      }

      const existingSmartAccountConnector = connectors.find((connector) => connector.id === 'io.privy.smart_wallet')

      // If smart account connector already exists, mark as ready
      if (existingSmartAccountConnector) {
        setIsSmartWalletReady(true)
        setIsSettingUp(false)
        setHasSetupFailed(false) // Clear failed state if successful
        setSetupStartTime(null)
        return
      }

      // If no smart wallet client, mark as ready (use embedded wallet)
      if (!isReady) {
        setIsSmartWalletReady(true)
        setIsSettingUp(false)
        setHasSetupFailed(false)
        setSetupStartTime(null)
        return
      }

      // Start setting up smart account connector
      setIsSettingUp(true)

      // Add timeout to prevent infinite loading (3 seconds per attempt)
      const setupTimeout = setTimeout(() => {
        console.error(`[PrivySmartAccount] ⏱️ Setup timeout after 3 seconds (attempt ${retryCount + 1}/3)`)
        setRetryCount((prev) => prev + 1)
        setIsSmartWalletReady(false)
      }, 3000) // 3 seconds timeout per attempt

      try {
        // @ts-ignore
        const client = await getClientForChain({ id })

        if (!client || !getClientForChain) {
          console.warn('[PrivySmartAccount] ⚠️ Unable to get smart wallet client, falling back to embedded wallet')
          clearTimeout(setupTimeout)
          // If unable to get client, fallback to embedded wallet
          setIsSmartWalletReady(true)
          setIsSettingUp(false)
          return
        }

        const smartAccountProvider = new SmartWalletEIP1193Provider(client, getClientForChain)

        const smartAccountConnectorConstructor = injected({
          target: {
            provider: smartAccountProvider as any,
            id: 'io.privy.smart_wallet',
            name: 'io.privy.smart_wallet',
            icon: '',
          },
        })

        // If a user uses an embedded wallet with a smart account, we will currently set it up as the only connector
        // for wagmi for the smoothest integration experience.
        // @ts-ignore
        const smartAccountConnector = config._internal.connectors.setup(smartAccountConnectorConstructor)
        // @ts-ignore
        config._internal.connectors.setState([smartAccountConnector])
        // @ts-ignore
        await config.storage?.setItem('recentConnectorId', smartAccountConnector.id)

        // After setup is complete, mark as ready and reconnect
        clearTimeout(setupTimeout)
        setIsSmartWalletReady(true)
        setIsSettingUp(false)
        setHasSetupFailed(false) // Clear failed state on success
        setRetryCount(0) // Reset retry count on success
        setSetupStartTime(null) // Reset setup start time
        // @ts-ignore
        reconnect()
      } catch (error) {
        clearTimeout(setupTimeout)
        console.error('[PrivySmartAccount] ❌ Setup error:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          attempt: retryCount + 1,
          timestamp: new Date().toISOString(),
        })
        // Increment retry count and try again
        setRetryCount((prev) => prev + 1)
        setIsSmartWalletReady(false)
      }
    }

    setupSmartAccountConnector()
  }, [
    config,
    connectors,
    getClientForChain,
    id,
    isReady,
    reconnect,
    router.query,
    shouldUseAAWallet,
    retryCount,
    setupStartTime,
  ])

  // Return state for other components to use
  return {
    isSmartWalletReady,
    isSettingUp,
    shouldUseAAWallet,
    hasSetupFailed,
  }
}

class SmartWalletEIP1193Provider extends EventEmitter {
  private smartWalletClient: any

  private readonly getClientForChain: (params: { id: number }) => Promise<any>

  constructor(client: any, getClientForChain: (params: { id: number }) => Promise<any>) {
    super()
    this.smartWalletClient = client
    this.getClientForChain = getClientForChain
  }

  async request(args: any): Promise<any> {
    const { method, params = [] } = args
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return this.handleEthRequestAccounts()
      case 'eth_sendTransaction':
        return this.handleEthSendTransaction(params)
      case 'personal_sign':
        return this.handlePersonalSign(params as any)
      case 'eth_signTypedData':
      case 'eth_signTypedData_v4':
        return this.handleEthSignTypedDataV4(params as any)
      case 'eth_signTransaction':
        throw new Error('eth_signTransaction is not supported. Use eth_sendTransaction instead.')
      case 'wallet_switchEthereumChain': {
        const [{ chainId }] = params as [{ chainId: string }]
        if (!this.smartWalletClient?.account) {
          throw new Error('account not connected!')
        }
        const newClient = await this.getClientForChain({
          id: parseInt(chainId, 16),
        })
        if (!newClient) {
          throw new Error(`No smart wallet client found for chain ID ${chainId}`)
        }
        this.smartWalletClient = newClient
        this.emit('chainChanged', chainId)
        return null
      }
      default:
        return this.smartWalletClient?.transport.request({ method, params } as any)
    }
  }

  private async handleEthRequestAccounts(): Promise<string[]> {
    if (!this.smartWalletClient?.account) {
      return []
    }
    return [this.smartWalletClient.account.address]
  }

  private async handleEthSendTransaction(params: any): Promise<string> {
    const [tx] = params
    if (!this.smartWalletClient?.account) {
      throw new Error('account not connected!')
    }
    return this.smartWalletClient.sendTransaction({
      ...tx,
      value: tx.value ? hexToBigInt(tx.value) : undefined,
    })
  }

  private async handlePersonalSign(params: [string, string]): Promise<string> {
    if (!this.smartWalletClient?.account) {
      throw new Error('account not connected!')
    }

    const [message, address] = params
    if (getAddress(address) !== getAddress(this.smartWalletClient.account.address)) {
      throw new Error('cannot sign for address that is not the current account')
    }

    return this.smartWalletClient.signMessage({
      message,
    })
  }

  private async handleEthSignTypedDataV4(params: [string, any]): Promise<string> {
    if (!this.smartWalletClient?.account) {
      throw new Error('account not connected!')
    }

    const address = params[0]
    if (getAddress(address) !== getAddress(this.smartWalletClient.account.address)) {
      throw new Error('cannot sign for address that is not the current account')
    }

    const typedData = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1]

    return this.smartWalletClient.signTypedData(typedData as any)
  }
}
