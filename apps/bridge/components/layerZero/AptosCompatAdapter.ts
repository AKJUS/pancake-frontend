/* eslint-disable class-methods-use-this */
import { getWallets, Wallet } from '@wallet-standard/core'

interface MinimalSignMessagePayload {
  message: string
  nonce?: string
}
interface LegacySignMessageResponse {
  signature: string
  fullMessage: string
}

type AptosWallet = Wallet & {
  features: {
    'aptos:connect': {
      connect(): Promise<{
        args: {
          address: { data: Uint8Array } | string
          publicKey: { key: { data: Uint8Array } } | string
        }
        status: string
      }>
    }
    'aptos:disconnect'?: {
      disconnect(): Promise<void>
    }
    'aptos:account'?: {
      account(): Promise<{
        address: { data: Uint8Array } | string
        publicKey: { key: { data: Uint8Array } } | string
      }>
    }
    'aptos:network': {
      network(): Promise<{ name: string } | string>
    }
    'aptos:signTransaction': {
      signTransaction(tx: any): Promise<any>
    }
    'aptos:signAndSubmitTransaction': {
      signAndSubmitTransaction(input: any): Promise<{
        args: { hash: string }
        status: 'Approved' | 'Rejected'
      }>
    }
    'aptos:signMessage': {
      signMessage(msg: MinimalSignMessagePayload): Promise<any>
    }
    'standard:events'?: {
      on(
        event: 'change',
        cb: (args: {
          accounts?: Array<{
            args: {
              address: { data: Uint8Array } | string
              publicKey: { key: { data: Uint8Array } } | string
            }
          }>
          chain?: string
        }) => void,
      ): void
      off(
        event: 'change',
        cb: (args: {
          accounts?: Array<{
            args: {
              address: { data: Uint8Array } | string
              publicKey: { key: { data: Uint8Array } } | string
            }
          }>
          chain?: string
        }) => void,
      ): void
    }
  }
}

interface ConnectedAccount {
  address: string
  publicKey: string
}

interface LegacyPetraApi {
  connect(walletName?: string): Promise<{ address: string; publicKey: string }>
  account(): Promise<{ address: string; publicKey: string }>
  signTransaction(txnObject: any): Promise<Uint8Array>
  signAndSubmitTransaction(txnObject: any): Promise<{ hash: string }>
  signMessage(messageObj: any): Promise<LegacySignMessageResponse>
  disconnect(): Promise<void>
  network(): Promise<string>
  isConnected(): Promise<boolean>
}

class AptosCompatAdapter implements LegacyPetraApi {
  private activeProvider: AptosWallet | null = null

  private connectedAccount: ConnectedAccount | null = null

  private connectedNetwork: string | null = null

  private readonly walletName: string

  private pendingAccountChangeCallbacks: Array<(account: { address: string; publicKey: string } | null) => void> = []

  constructor(targetWalletName: string = 'Petra') {
    this.walletName = targetWalletName
  }

  private findProviderByName(name: string): AptosWallet | undefined {
    const lower = name.toLowerCase()
    return (getWallets().get() as AptosWallet[]).find((w) => w.name.toLowerCase() === lower)
  }

  private ensureActiveProvider(): void {
    if (!this.activeProvider) {
      throw new Error('Aptos adapter: No wallet connected. Call connect() first.')
    }
  }

  async connect(): Promise<{ address: string; publicKey: string }> {
    const provider = this.findProviderByName(this.walletName)

    if (!provider) {
      throw new Error(`Aptos adapter: Wallet '${this.walletName}' not found or not available.`)
    }

    if (!provider.features['aptos:connect']) {
      throw new Error(`Aptos adapter: Selected wallet '${provider.name}' does not support 'aptos:connect'.`)
    }

    this.activeProvider = provider

    try {
      const result = await this.activeProvider.features['aptos:connect'].connect()

      this.connectedAccount = {
        address: AptosCompatAdapter.normalizeAddress(result.args.address),
        publicKey: AptosCompatAdapter.normalizePublicKey(result.args.publicKey),
      }

      if (this.activeProvider.features['aptos:network']) {
        const networkResult = await this.activeProvider.features['aptos:network'].network()
        this.connectedNetwork = typeof networkResult === 'string' ? networkResult : networkResult.name
      } else {
        this.connectedNetwork = null
      }

      if (this.activeProvider.features['standard:events']) {
        this.activeProvider.features['standard:events'].on('change', (args) => {
          if (args.accounts && args.accounts.length > 0) {
            const newAccountInfo = args.accounts[0]
            this.connectedAccount = {
              address: AptosCompatAdapter.normalizeAddress(newAccountInfo.args.address),
              publicKey: AptosCompatAdapter.normalizePublicKey(newAccountInfo.args.publicKey),
            }
          } else {
            this.connectedAccount = null
            this.connectedNetwork = null
            this.activeProvider = null
          }

          if (args.chain) {
            this.connectedNetwork = args.chain
          }

          this.pendingAccountChangeCallbacks.forEach((cb) => cb(this.connectedAccount))
          this.pendingAccountChangeCallbacks = []
        })
      }

      if (!this.connectedAccount) {
        throw new Error('Aptos adapter: Connection succeeded but account state is invalid.')
      }

      return this.connectedAccount
    } catch (error) {
      this.activeProvider = null
      this.connectedAccount = null
      this.connectedNetwork = null
      throw error
    }
  }

  async account(): Promise<{ address: string; publicKey: string }> {
    this.ensureActiveProvider()
    if (!this.connectedAccount) {
      if (this.activeProvider?.features['aptos:account']) {
        const rawAccount = await this.activeProvider.features['aptos:account'].account()
        this.connectedAccount = {
          address: AptosCompatAdapter.normalizeAddress(rawAccount.address),
          publicKey: AptosCompatAdapter.normalizePublicKey(rawAccount.publicKey),
        }
      } else {
        throw new Error("Aptos adapter: Wallet does not support 'aptos:account' feature and state is unavailable.")
      }
    }
    if (!this.connectedAccount) {
      throw new Error('Aptos adapter: Account state is invalid.')
    }
    return this.connectedAccount
  }

  onAccountChange(callback: (account: { address: string; publicKey: string } | null) => void): () => void {
    if (!this.activeProvider) {
      this.pendingAccountChangeCallbacks.push(callback)
      return () => {
        this.pendingAccountChangeCallbacks = this.pendingAccountChangeCallbacks.filter((cb) => cb !== callback)
      }
    }

    return this._registerAccountChangeListener(callback)
  }

  private _registerAccountChangeListener(
    callback: (account: { address: string; publicKey: string } | null) => void,
  ): () => void {
    if (!this.activeProvider!.features['standard:events']) {
      throw new Error("Active wallet does not support 'standard:events'.")
    }

    const listener = (args: any) => {
      if (args.accounts && args.accounts.length > 0) {
        const acc = args.accounts[0]
        callback({
          address: AptosCompatAdapter.normalizeAddress(acc.args.address),
          publicKey: AptosCompatAdapter.normalizePublicKey(acc.args.publicKey),
        })
      } else {
        callback(null)
      }
    }

    this.activeProvider!.features['standard:events'].on('change', listener)

    if (this.connectedAccount) {
      callback(this.connectedAccount)
    }

    return () => {
      this.activeProvider!.features['standard:events']?.off('change', listener)
    }
  }

  async signTransaction(txnObject: any): Promise<Uint8Array> {
    throw new Error("Aptos adapter does not support 'aptos:signTransaction'.")
  }

  async signAndSubmitTransaction(txnObject: any): Promise<{ hash: string }> {
    this.ensureActiveProvider()

    if (!this.activeProvider!.features['aptos:signAndSubmitTransaction']) {
      throw new Error("Aptos adapter: Active wallet does not support 'aptos:signAndSubmitTransaction'.")
    }

    console.warn(
      'Aptos adapter: signAndSubmitTransaction called. Input format mapping might be required. Passing object directly to Wallet Standard.',
    )

    const result = await this.activeProvider!.features['aptos:signAndSubmitTransaction'].signAndSubmitTransaction({
      payload: {
        type: 'entry_function_payload',
        functionArguments: txnObject.arguments,
        function: txnObject.function,
        typeArguments: txnObject.type_arguments || [],
      },
    })

    if (result.status === 'Approved') {
      return { hash: result.args.hash }
    }
    throw new Error(`Transaction rejected by wallet: ${result.status}`)
  }

  async signMessage(messageObj: any): Promise<LegacySignMessageResponse> {
    throw new Error("Aptos adapter does not support 'aptos:signMessage'.")
  }

  async disconnect(): Promise<void> {
    if (this.activeProvider && this.activeProvider.features['aptos:disconnect']) {
      try {
        await this.activeProvider.features['aptos:disconnect'].disconnect()
      } catch (error) {
        console.warn("Aptos adapter: Error calling wallet's disconnect feature:", error)
      }
    }

    this.connectedAccount = null
    this.connectedNetwork = null
    this.activeProvider = null
  }

  getNetwork(): { name: string } | null {
    if (this.connectedNetwork) {
      return { name: this.connectedNetwork }
    }
    return null
  }

  async network(): Promise<string> {
    this.ensureActiveProvider()
    if (this.connectedNetwork) {
      return this.connectedNetwork
    }
    if (this.activeProvider!.features['aptos:network']) {
      const result = await this.activeProvider!.features['aptos:network'].network()
      const networkName = typeof result === 'string' ? result : result.name
      if (!networkName) {
        throw new Error('Aptos adapter: Wallet returned an invalid network name.')
      }
      return networkName
    }
    throw new Error("Aptos adapter: Wallet does not provide 'aptos:network' feature and network is unknown.")
  }

  async isConnected(): Promise<boolean> {
    return this.activeProvider !== null && this.connectedAccount !== null
  }

  private static normalizeAddress(address: { data: Uint8Array } | string): string {
    if (typeof address === 'string') {
      return address.startsWith('0x') ? address : `0x${address}`
    }
    if (address?.data instanceof Uint8Array) {
      return `0x${Buffer.from(address.data).toString('hex')}`
    }
    throw new Error('Invalid address format')
  }

  private static normalizePublicKey(publicKey: { key: { data: Uint8Array } } | string): string {
    if (typeof publicKey === 'string') {
      return publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey
    }
    if (publicKey?.key?.data instanceof Uint8Array) {
      return Buffer.from(publicKey.key.data).toString('hex')
    }
    throw new Error('Invalid publicKey format')
  }
}

export function initializeAptosCompatAdapter(targetWalletName: string = 'Petra', windowKey: string = 'petra') {
  const adapter = new AptosCompatAdapter(targetWalletName)

  Object.defineProperty(window, windowKey, {
    configurable: true,
    enumerable: true,
    get() {
      return adapter
    },
    set(_) {
      console.warn(`window.${windowKey} overwrite attempt ignored`)
    },
  })

  console.info(
    `Aptos compatibility adapter installed on window.${windowKey}. Will connect to wallet named: "${targetWalletName}"`,
  )
}
/* eslint-enable class-methods-use-this */
