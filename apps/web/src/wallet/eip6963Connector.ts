import { chains } from 'utils/wagmi'
import { createConnector } from 'wagmi'
import { UserRejectedRequestError, withRetry } from 'viem'
import { EIP6963Detail } from './WalletProvider'
import { normalizeAccounts } from './util/normalizeAccounts'
import { normalizeChainId } from './util/normalizeChainId'

const cache = new Map<string, any>()

type CreateConnectorConfig = Parameters<typeof createConnector>[0] extends (arg: infer C) => any ? C : never

const waitForChainIdToSync = async (provider: any, chainId: number): Promise<number> => {
  return withRetry(
    async () => {
      const value = normalizeChainId(await provider.request({ method: 'eth_chainId' }))
      if (value !== chainId) {
        throw new Error(`ChainId mismatch after network switch. Expected: ${chainId}, got: ${value}`)
      }
      return value
    },
    {
      delay: 50,
      retryCount: 20,
    },
  )
}

const sendAndWaitForChangeEvent = async (config: CreateConnectorConfig, chainId: number): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>

    const listener = ((data) => {
      if (data && typeof data === 'object' && 'chainId' in data && data.chainId === chainId) {
        clearTimeout(timer)
        config.emitter.off('change', listener)
        resolve()
      }
    }) satisfies Parameters<typeof config.emitter.on>[1]

    timer = setTimeout(() => {
      config.emitter.off('change', listener)
      reject(new Error(`Timeout waiting for chainId ${chainId} change event`))
    }, 5000)

    config.emitter.on('change', listener)
    config.emitter.emit('change', { chainId })
  })
}

export const createEip6963Connector = (detail: EIP6963Detail) => {
  if (cache.has(detail.info.uuid)) {
    return cache.get(detail.info.uuid)
  }

  const { provider, info } = detail

  const connector = createConnector((config) => ({
    id: 'injected',
    name: info.name,
    type: 'injected',
    icon: info.icon,

    async connect({ chainId, withCapabilities } = {}) {
      const [accounts, currentChainIdRaw] = await Promise.all([
        provider.request({ method: 'eth_requestAccounts' }),
        this.getChainId(),
      ])

      let currentChainId = currentChainIdRaw

      if (chainId && currentChainId !== chainId) {
        const chain = await this.switchChain!({ chainId }).catch((error) => {
          if (error.code === UserRejectedRequestError.code) throw error
          return { id: currentChainId }
        })
        currentChainId = chain?.id ?? currentChainId
      }

      return {
        accounts: normalizeAccounts(accounts).map((account) => {
          return withCapabilities ? { address: account, capabilities: {} } : account
        }) as never,
        chainId: currentChainId,
      }
    },

    async disconnect() {},

    async getProvider() {
      return provider
    },

    async isAuthorized() {
      if (!provider) return false
      const accounts = await provider.request({ method: 'eth_accounts' })
      return normalizeAccounts(accounts).length > 0
    },

    async getAccounts() {
      if (!provider) return []
      const accounts = await provider.request({ method: 'eth_accounts' })
      return normalizeAccounts(accounts) as readonly `0x${string}`[]
    },

    async getChainId() {
      if (!provider) throw new Error('MetaMask not found')
      const chainId = await provider.request({ method: 'eth_chainId' })
      return normalizeChainId(chainId)
    },

    onAccountsChanged(accounts) {},

    onChainChanged() {},

    onDisconnect(callback) {
      // @ts-ignore
      const handler = (err?: unknown) => callback(err)
      provider?.on?.('disconnect', handler)
    },

    async switchChain({ chainId }) {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })

      await waitForChainIdToSync(provider, chainId)
      await sendAndWaitForChangeEvent(config, chainId)

      const chain = chains.find((x) => x.id === chainId)!
      return chain
    },
  }))
  cache.set(info.uuid, connector)
  return connector
}
