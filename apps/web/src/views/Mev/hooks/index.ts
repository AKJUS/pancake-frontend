import { ChainId } from '@pancakeswap/chains'
import { useQuery } from '@tanstack/react-query'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { BSCMevGuardChain } from 'utils/mevGuardChains'
import { MethodNotFoundRpcError, WalletClient } from 'viem'
import { addChain } from 'viem/actions'
import { WalletType } from 'views/Mev/types'
import { Connector, useAccount, useWalletClient } from 'wagmi'
import {
  walletConnectSupportDefaultMevOnBSC,
  walletPretendToBinanceWallet,
  walletPretendToMetamask,
  walletSupportCustomRPCNative,
  walletSupportDefaultMevOnBSC,
  walletSupportManualRPCConfig,
} from '../constant'

const WalletProviders = [
  'isApexWallet',
  'isAvalanche',
  'isBackpack',
  'isBifrost',
  'isBitKeep',
  'isBitski',
  'isBlockWallet',
  'isBraveWallet',
  'isCoinbaseWallet',
  'isDawn',
  'isEnkrypt',
  'isExodus',
  'isFrame',
  'isFrontier',
  'isGamestop',
  'isHyperPay',
  'isImToken',
  'isKuCoinWallet',
  'isMathWallet',
  // 'isMetaMask',
  'isOkxWallet',
  'isOKExWallet',
  'isOneInchAndroidWallet',
  'isOneInchIOSWallet',
  'isOneKey',
  'isOpera',
  'isPhantom',
  'isPortal',
  'isRabby',
  'isRainbow',
  'isStatus',
  'isTally',
  'isTokenPocket',
  'isTokenary',
  'isTrust',
  'isTrustWallet',
  'isUniswapWallet',
  'isXDEFI',
  'isZerion',
  'isBinance',
]

async function checkWalletSupportAddEthereumChain(connector: Connector) {
  try {
    if (typeof connector.getProvider !== 'function') return false

    const provider = (await connector.getProvider()) as any

    return provider && provider.isMetaMask && !WalletProviders.some((p: string) => p in provider)
  } catch (error) {
    console.error(error, 'wallet_addEthereumChain is not supported')
    return false
  }
}

async function fetchMEVStatus(walletClient: WalletClient): Promise<{ mevEnabled: boolean }> {
  if (!walletClient || !walletClient?.request) {
    console.error('Ethereum provider not found')
    return { mevEnabled: false }
  }

  try {
    const result = await walletClient.request({
      // @ts-ignore
      method: 'eth_call',
      params: [
        {
          from: walletClient.account?.address ?? '0x',
          to: '0x0000000000000000000000000000000000000048',
          value: '0x30',
          data: '0x',
        },
        'latest',
      ],
    })

    return { mevEnabled: result === '0x30' }
  } catch (error) {
    console.error('Error checking MEV status:', error)
    return { mevEnabled: false }
  }
}

export function useWalletSupportsAddEthereumChain() {
  const { connector } = useAccount()
  const { data, isLoading } = useQuery({
    queryKey: ['walletSupportsAddEthereumChain', connector?.uid],
    queryFn: () => checkWalletSupportAddEthereumChain(connector!),
    enabled: Boolean(connector),
    retry: false,
  })
  return { walletSupportsAddEthereumChain: data ?? false, isLoading }
}

export function useIsMEVEnabled() {
  const { data: walletClient } = useWalletClient()
  const { account, chainId } = useAccountActiveChain()
  const { walletType } = useWalletType()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['isMEVEnabled', walletClient, account, chainId, walletType],
    queryFn: () => fetchMEVStatus(walletClient!),
    enabled: Boolean(account) && walletClient && chainId === ChainId.BSC,
    staleTime: 60000,
  })

  // console.log('isMEVEnabled', data?.mevEnabled, walletType, chainId, walletClient)
  return {
    isMEVEnabled:
      (walletType !== WalletType.mevNotSupported &&
        (data?.mevEnabled || (walletType === WalletType.mevDefaultOnBSC && chainId === ChainId.BSC))) ??
      false,
    isLoading,
    refetch,
    isMEVProtectAvailable: chainId === ChainId.BSC,
  }
}

export const useShouldShowMEVToggle = () => {
  const { isLoading: isWalletSupportLoading } = useWalletSupportsAddEthereumChain()
  const { account } = useAccountActiveChain()
  const { isMEVEnabled, isLoading, isMEVProtectAvailable } = useIsMEVEnabled()
  const { walletType, isLoading: isWalletTypeLoading } = useWalletType()
  return (
    !isLoading &&
    !isWalletTypeLoading &&
    !isMEVEnabled &&
    !isWalletSupportLoading &&
    Boolean(account) &&
    walletType > WalletType.mevNotSupported &&
    isMEVProtectAvailable
  )
}

export const useAddMevRpc = (onSuccess?: () => void, onBeforeStart?: () => void, onFinish?: () => void) => {
  const { data: walletClient } = useWalletClient()
  const { connector } = useAccount()
  const addMevRpc = useCallback(async () => {
    onBeforeStart?.()
    try {
      const provider = (await connector?.getProvider()) as any
      // Check if the Ethereum provider is available
      if (walletClient) {
        // Prompt the wallet to add the custom network
        const result = await addChain(walletClient, { chain: BSCMevGuardChain })

        if (provider?.isMetaMask && !walletPretendToMetamask.some((d) => d in provider)) {
          console.info('MetaMask chain dapp detected. Adding RPC network again. on metamask dapp need to run twice')
          await addChain(walletClient, { chain: BSCMevGuardChain })
        }
        console.info('RPC network added successfully!', result)
        onSuccess?.()
      } else {
        console.warn('Ethereum provider not found. Please check your wallet')
      }
    } catch (error) {
      if ((error as any).code === MethodNotFoundRpcError.code) console.error('wallet_addEthereumChain is not supported')
      else console.error('Error adding RPC network:', error)
    } finally {
      onFinish?.()
    }
  }, [onBeforeStart, connector, walletClient, onSuccess, onFinish])
  return { addMevRpc }
}

export async function getWalletType(connector?: Connector, mevParam?: string | null): Promise<WalletType> {
  if (!connector || typeof connector.getProvider !== 'function') return WalletType.mevNotSupported
  const provider = (await connector.getProvider()) as any

  // check WalletConnect + supported wallets
  if (provider.isWalletConnect) {
    try {
      // check session metadata
      const walletName = provider.session?.peer?.metadata?.name
      if (walletConnectSupportDefaultMevOnBSC.includes(walletName)) {
        return WalletType.mevDefaultOnBSC
      }
    } catch (error) {
      console.error('Error detecting Wallet via WalletConnect:', error)
    }
  }
  if (walletSupportManualRPCConfig.some((d) => d in provider)) return WalletType.mevOnlyManualConfig
  if (
    walletSupportDefaultMevOnBSC.some((d) => d in provider) &&
    !walletPretendToBinanceWallet.some((d) => d in provider)
  )
    return WalletType.mevDefaultOnBSC
  if (
    mevParam === 'isOkxWallet' ||
    mevParam === 'isCoinbaseWallet' || // for testing in on production, because coinbase/okx wallet will block our preview domain
    (walletSupportCustomRPCNative.some((d) => d in provider) && !walletPretendToMetamask.some((d) => d in provider))
  )
    return WalletType.nativeSupportCustomRPC
  return WalletType.mevNotSupported
}

export function useWalletType() {
  const searchParams = useSearchParams()
  const mevParam = searchParams.get('mev')

  const { connector } = useAccount()
  const { data, isLoading } = useQuery({
    queryKey: ['useWalletType', connector?.uid, mevParam],
    queryFn: async () => {
      if (!connector) {
        return WalletType.mevNotSupported
      }
      return getWalletType(connector, mevParam)
    },
  })
  return { walletType: data ?? WalletType.mevNotSupported, isLoading }
}
