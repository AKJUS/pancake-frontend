import { Text } from '@pancakeswap/uikit'
import { NextPage } from 'next'
import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useWalletRuntime } from 'wallet/hook/useWalletEnv'

const WalletDebugPage: NextPage = () => {
  const runtime = useWalletRuntime()
  const { connector, address, chainId, status } = useAccount()

  const debugPayload = useMemo(
    () => ({
      env: runtime.env,
      wallet: runtime.wallet,
      hostDetection: runtime.hostDetection,
      connectorId: runtime.connectorId,
      selectedWalletId: runtime.selectedWalletId,
      wagmi: {
        connectorId: connector?.id ?? null,
        connectorName: connector?.name ?? null,
        address: address ?? null,
        chainId: chainId ?? null,
        status,
      },
      providerSignals:
        typeof window === 'undefined'
          ? null
          : {
              isBinance: Boolean((window as any)?.ethereum?.isBinance || (window as any)?.binancew3w),
              isMetaMask: Boolean((window as any)?.ethereum?.isMetaMask),
              isTrust: Boolean((window as any)?.ethereum?.isTrust || (window as any)?.ethereum?.isTrustWallet),
              isCoinbaseWallet: Boolean((window as any)?.ethereum?.isCoinbaseWallet),
              isPhantom: Boolean((window as any)?.phantom?.ethereum || (window as any)?.ethereum?.isPhantom),
              isBitgetWallet: Boolean((window as any)?.bitkeep?.ethereum || (window as any)?.ethereum?.isBitgetWallet),
              hasOkxWallet: Boolean((window as any)?.okxwallet),
              userAgent: navigator.userAgent,
            },
    }),
    [address, chainId, connector?.id, connector?.name, runtime, status],
  )

  return (
    <div style={{ padding: 24 }}>
      <Text as="h1" bold fontSize="32px" mb="24px">
        Wallet Runtime Debug
      </Text>
      <pre
        style={{
          padding: 16,
          borderRadius: 12,
          overflowX: 'auto',
          background: '#111',
          color: '#f5f5f5',
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {JSON.stringify(debugPayload, null, 2)}
      </pre>
    </div>
  )
}

export default WalletDebugPage
