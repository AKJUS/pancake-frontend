import {
  AccountAuthenticator,
  Aptos,
  AptosConfig,
  generateRawTransaction,
  generateTransactionPayload,
  InputEntryFunctionDataWithRemoteABI,
  InputGenerateTransactionOptions,
  InputGenerateTransactionPayloadData,
  Network,
  RawTransaction,
} from '@aptos-labs/ts-sdk'

import { getWallets, Wallet } from '@wallet-standard/core'
import { Chain } from '../chain'
import { ConnectorNotFoundError } from '../errors'
import { Connector } from './base'
import { Account, SignMessagePayload, SignMessageResponse } from './types'
import { convertTransactionPayloadForWalletStandard } from '../transactions/payloadTransformer'

type WalletStandardConnectorOptions = {
  /** Id of connector */
  id: string
  /** Name of connector */
  name: string
}

type AptosWallet = Wallet & {
  features: {
    'aptos:connect': {
      connect(): Promise<{
        args: {
          address: { data: Uint8Array }
          publicKey: { key: { data: Uint8Array } }
        }
        status: string
      }>
    }
    'aptos:disconnect'?: {
      disconnect(): Promise<void>
    }
    'aptos:account'?: {
      account(): Promise<Account>
    }
    'aptos:network': {
      network(): Promise<{ name: string }>
    }
    'aptos:signTransaction': {
      signTransaction(tx: any): Promise<any>
    }
    'aptos:signAndSubmitTransaction': {
      signAndSubmitTransaction(input: { payload: any; gasUnitPrice?: number; maxGasAmount?: number }): Promise<{
        args: { hash: string }
        status: 'Approved' | 'Rejected'
      }>

      signAndSubmitTransaction(
        input: { rawTransaction: RawTransaction },
        options?: InputGenerateTransactionOptions,
      ): Promise<{
        args: { hash: string }
        status: 'Approved' | 'Rejected'
      }>
    }
    'aptos:signMessage': {
      signMessage(msg: SignMessagePayload): Promise<SignMessageResponse>
    }
    'standard:events'?: {
      on(
        event: 'change',
        cb: (args: {
          accounts?: Array<{
            args: {
              address: { data: Uint8Array }
              publicKey: { key: { data: Uint8Array } }
            }
          }>
          chain?: string
        }) => void,
      ): void
    }
  }
}

export class WalletStandardConnector extends Connector<AptosWallet, WalletStandardConnectorOptions> {
  readonly id: string

  readonly name: string

  provider?: AptosWallet

  constructor(config: { chains?: Chain[]; options?: WalletStandardConnectorOptions } = {}) {
    super(config)

    if (!config.options?.id || !config.options?.name) {
      throw new Error('WalletStandardConnector requires options.id and options.name')
    }

    this.id = config.options.id
    this.name = config.options.name
  }

  get ready(): boolean {
    if (typeof window === 'undefined') return false
    return getWallets()
      .get()
      .some((w) => {
        const matchesNameOrId =
          w.name.toLowerCase() === this.name.toLowerCase() || w.name.toLowerCase() === this.id.toLowerCase()

        const hasAptosConnect = Boolean(w.features?.['aptos:connect'])

        return matchesNameOrId && hasAptosConnect
      })
  }

  async getProvider(_config?: { networkName?: string }): Promise<AptosWallet> {
    if (this.provider) return this.provider

    const wallets = getWallets().get()

    const wallet = wallets.find((w) => {
      const matchesNameOrId =
        w.name.toLowerCase() === this.name.toLowerCase() || w.name.toLowerCase() === this.id.toLowerCase()

      const hasAptosConnect = Boolean(w.features?.['aptos:connect'])

      return matchesNameOrId && hasAptosConnect
    })

    if (!wallet) throw new ConnectorNotFoundError()

    this.provider = wallet as unknown as AptosWallet
    return this.provider
  }

  async connect(_config?: { networkName?: string }) {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()

    this.emit('message', { type: 'connecting' })

    const result = await provider.features['aptos:connect'].connect()

    const account: Account = {
      address: this.normalizeAddress(result.args.address),
      publicKey: this.normalizePublicKey(result.args.publicKey),
    }

    const networkResult = await provider.features['aptos:network'].network()
    const network = typeof networkResult === 'string' ? networkResult : networkResult.name

    provider.features['standard:events']?.on(
      'change',
      ({
        accounts: rawAccounts,
        chain,
      }: {
        accounts?: Array<{
          args: {
            address: any
            publicKey: any
          }
        }>
        chain?: string
      }) => {
        if (!rawAccounts || rawAccounts.length === 0) {
          this.emit('disconnect')
        } else {
          const raw = rawAccounts[0]

          const acc: Account = {
            address: this.normalizeAddress(raw.args.address),
            publicKey: this.normalizePublicKey(raw.args.publicKey),
          }

          this.emit('change', { account: acc })
        }

        if (chain) {
          this.emit('change', { network: chain })
        }
      },
    )

    return {
      account,
      network,
      provider,
    }
  }

  async disconnect() {
    const provider = await this.getProvider()
    return provider?.features['aptos:disconnect']?.disconnect()
  }

  async account(): Promise<Account> {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()

    const feature = provider.features['aptos:account']
    if (!feature) throw new ConnectorNotFoundError()

    const raw = await feature.account()

    let addressValue: any

    if (typeof raw === 'string') {
      addressValue = raw
    } else if (raw?.address) {
      addressValue = raw.address
    } else {
      throw new Error('Invalid account format returned by wallet')
    }

    const account: Account = {
      address: this.normalizeAddress(addressValue),
    }

    if (raw && typeof raw === 'object' && raw.publicKey) {
      if (Array.isArray(raw.publicKey)) {
        account.publicKey = raw.publicKey.map((pk) => this.normalizePublicKey(pk))
      } else {
        account.publicKey = this.normalizePublicKey(raw.publicKey)
      }
    }

    return account
  }

  async network(): Promise<string> {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()

    const result = await provider.features['aptos:network'].network()

    return typeof result === 'string' ? result : result.name
  }

  async isConnected() {
    try {
      const provider = await this.getProvider()
      if (!provider) return false

      const result = provider.features['aptos:account'] && (await provider.features['aptos:account'].account())

      return !!result?.address
    } catch {
      return false
    }
  }

  async signTransaction(_tx: InputGenerateTransactionPayloadData): Promise<AccountAuthenticator> {
    throw new Error('signTransaction is not supported by Petra Wallet Standard')
  }

  async signAndSubmitTransaction(
    tx: InputGenerateTransactionPayloadData,
    options?: Partial<InputGenerateTransactionOptions>,
  ) {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()

    const feature = provider.features['aptos:signAndSubmitTransaction']
    if (!feature) throw new ConnectorNotFoundError()

    const normalizedOptions = this.normalizeTransactionOptions(options)

    let result

    try {
      result = await feature.signAndSubmitTransaction({
        payload: convertTransactionPayloadForWalletStandard(tx),
        gasUnitPrice: normalizedOptions?.gasUnitPrice,
        maxGasAmount: normalizedOptions?.maxGasAmount,
      })
    } catch (err) {
      result = await feature.signAndSubmitTransaction(
        { rawTransaction: await this.generateRawTransaction(tx, normalizedOptions) },
        normalizedOptions,
      )
    }

    if (result?.status !== 'Approved') {
      throw new Error('Transaction was not approved')
    }

    return {
      hash: result.args.hash,
    }
  }

  async signMessage(message: SignMessagePayload): Promise<SignMessageResponse> {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()

    return provider.features['aptos:signMessage'].signMessage(message)
  }

  private normalizeAddress(address: any): `0x${string}` {
    if (typeof address === 'string') {
      return address.startsWith('0x') ? (address as `0x${string}`) : (`0x${address}` as `0x${string}`)
    }

    if (address?.data instanceof Uint8Array) {
      return `0x${Buffer.from(address.data).toString('hex')}` as `0x${string}`
    }

    throw new Error('Invalid address format')
  }

  private normalizePublicKey(publicKey: any): string {
    if (typeof publicKey === 'string') {
      return publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey
    }

    if (publicKey?.key?.data instanceof Uint8Array) {
      return Buffer.from(publicKey.key.data).toString('hex')
    }

    throw new Error('Invalid publicKey format')
  }

  private async getAptosClient(provider: any): Promise<Aptos> {
    const networkResult = await provider.features['aptos:network']?.network()

    if (!networkResult) {
      throw new Error('Wallet does not expose aptos:network')
    }

    const networkName = typeof networkResult === 'string' ? networkResult : networkResult.name

    let network: Network

    switch (networkName) {
      case 'mainnet':
        network = Network.MAINNET
        break
      case 'testnet':
        network = Network.TESTNET
        break
      case 'devnet':
      default:
        network = Network.DEVNET
        break
    }

    const config = new AptosConfig({ network })
    return new Aptos(config)
  }

  private async generateRawTransaction(
    tx: InputGenerateTransactionPayloadData,
    options?: Partial<InputGenerateTransactionOptions>,
  ): Promise<RawTransaction> {
    const provider = await this.getProvider()
    if (!provider) throw new ConnectorNotFoundError()

    const { address } = await this.account()

    const { config: aptosConfig } = await this.getAptosClient(provider)

    const payloadInstance = await generateTransactionPayload({
      ...tx,
      aptosConfig,
    } as InputEntryFunctionDataWithRemoteABI)

    const rawTxn = await generateRawTransaction({
      aptosConfig,
      sender: address,
      payload: payloadInstance,
      options: {
        gasUnitPrice: options?.gasUnitPrice,
        maxGasAmount: options?.maxGasAmount,
        expireTimestamp: options?.expireTimestamp,
      },
    })

    return rawTxn
  }

  private normalizeTransactionOptions(opts?: Record<string, any>): InputGenerateTransactionOptions {
    if (!opts) return {}

    return {
      maxGasAmount: opts.max_gas_amount ?? opts.maxGasAmount,
      gasUnitPrice: opts.gas_unit_price ? Number(opts.gas_unit_price) : opts.gasUnitPrice,
      expireTimestamp: opts.expiration_timestamp_secs ? Number(opts.expiration_timestamp_secs) : opts.expireTimestamp,
    }
  }
}
