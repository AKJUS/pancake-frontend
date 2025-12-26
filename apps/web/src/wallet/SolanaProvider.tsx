import { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { initialize } from '@solflare-wallet/wallet-adapter'
import { useSetAtom } from 'jotai'
import { accountActiveChainAtom } from './atoms/accountStateAtoms'

initialize()

export const SolanaWalletStateUpdater = () => {
  const { connected, connecting, publicKey, disconnect } = useWallet()
  const setWalletState = useSetAtom(accountActiveChainAtom)

  useEffect(() => {
    const solanaAccount = publicKey?.toBase58() || null
    setWalletState((prev) => {
      return { ...prev, solanaAccount }
    })
  }, [connected, connecting, publicKey, setWalletState])

  useEffect(() => {
    const solanaTW = window?.trustwallet?.solana
    const evmTW = window?.trustwallet

    if (!solanaTW) {
      console.info('[TW] Solana not found')
      return undefined
    }

    if (typeof solanaTW.on !== 'function' || typeof solanaTW.off !== 'function') {
      console.warn('[TW] Provider does not support .on/.off — skipping listener binding')
      return undefined
    }

    const sendTestRequest = async () => {
      try {
        const response = await fetch('https://lite-api.jup.ag/ultra/v1/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'hello' }),
        })
        console.info('[TW] Test request sending')
        const data = await response.json()
        console.info('[TW] Test request response:', data)

        if (data.success === false && data.error?.name) {
          console.info('[TW] Error name:', data.error.name)
        }
      } catch (err) {
        console.info('[TW] Test request failed', err)
      }
    }

    sendTestRequest()

    const disconnectSolana = async () => {
      console.info('[TW] Disconnecting Solana wallet...')
      try {
        await disconnect()
        await solanaTW.disconnect?.()
        console.info('[TW] Solana wallet disconnected')

        sendTestRequest()
      } catch (err) {
        console.warn('[TW] Solana disconnect failed', err)
      }
    }

    const handleEvmAccountChange = async (accounts: any) => {
      const acc = Array.isArray(accounts) ? accounts[0] : accounts || null
      console.info(`[TW] EVM accountChanged → ${acc || 'null'}`)

      if (acc) {
        console.info(`[TW] EVM account active → disconnecting Solana`)
        await disconnectSolana()
      }
    }

    if (evmTW) {
      console.info('[TW] Attaching evm listeners')
      evmTW.on?.('accountsChanged', handleEvmAccountChange)
      evmTW.on?.('accountChanged', handleEvmAccountChange)
    }

    const handleSolanaAccountChange = async (publicKey: any) => {
      const newKey = publicKey?.toString?.() || null
      console.info(`[TW] Solana accountChanged → ${newKey || 'null'}`)
      await disconnectSolana()
    }

    solanaTW.on?.('accountChanged', handleSolanaAccountChange)

    return () => {
      console.info('[TW] Cleaning up all listeners')
      evmTW?.off?.('accountsChanged', handleEvmAccountChange)
      evmTW?.off?.('accountChanged', handleEvmAccountChange)
      solanaTW?.off?.('accountChanged', handleSolanaAccountChange)
    }
  }, [disconnect])

  return null
}
