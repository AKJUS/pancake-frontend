import { chainFullNames, getChainName, isEvm } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { useToast } from '@pancakeswap/uikit'
import { EvmConnectorNames, isPhantomEvmChainSupported } from '@pancakeswap/ui-wallets'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { useActiveChainIdRef } from 'hooks/useAccountActiveChain'
import useAuth from 'hooks/useAuth'
import { useAtomValue, useSetAtom } from 'jotai'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { safeGetAddress } from 'utils'
import { Connector, useAccount, useSwitchChain } from 'wagmi'
import { accountActiveChainAtom } from 'wallet/atoms/accountStateAtoms'
import { SwitchChainRequest, switchChainUpdatingAtom } from 'wallet/atoms/switchChainRequestAtom'
import { normalizeChainId } from 'wallet/util/normalizeChainId'
import { PrivySwitchChainError } from 'wallet/util/PrivySwitchChainError'

type SwitchFrom = 'wagmi' | 'url' | 'switch' | 'connect'
export interface SwitchChainOption {
  replaceUrl?: boolean
  from: SwitchFrom
  force?: boolean
}

type ReplaceGuardState = {
  cancelled: boolean
  requestId: number
}
export const useSwitchNetworkV2 = () => {
  const { switchChainAsync } = useSwitchChain()
  const switching = useAtomValue(switchChainUpdatingAtom)
  const { isConnected, address: evmAddress, connector: wagmiConnector } = useAccount()
  const processSwitching = useProcessSwitchChainRequest()
  const router = useRouter()

  const switchChain = useCallback(
    (
      chainId: number,
      option: SwitchChainOption = {
        replaceUrl: true,
        from: 'switch',
        force: false,
      },
    ) => {
      const { replaceUrl, from, force } = option
      const { query } = router

      const request: SwitchChainRequest = {
        chainId,
        replaceUrl: Boolean(replaceUrl),
        evmAddress,
        wagmiConnector,
        path: window.location.pathname,
        pathname: router.pathname,
        from,
        persistChain: Boolean(query.persistChain),
        force,
      }

      return processSwitching(request)
    },
    [router, evmAddress, wagmiConnector, processSwitching],
  )

  const canSwitch = useMemo(
    () =>
      isConnected
        ? !!switchChainAsync &&
          !(
            typeof window !== 'undefined' &&
            // @ts-ignore // TODO: add type later
            window.ethereum?.isMathWallet
          )
        : true,
    [switchChainAsync, isConnected],
  )

  const canSwitchToChain = useCallback(
    (chainId: number) => {
      if (!isEvm(chainId)) {
        return true
      }
      if (wagmiConnector?.id === EvmConnectorNames.Phantom && !isPhantomEvmChainSupported(chainId)) {
        return false
      }
      return isConnected
        ? !!switchChainAsync &&
            !(
              typeof window !== 'undefined' &&
              // @ts-ignore // TODO: add type later
              window.ethereum?.isMathWallet
            )
        : true
    },
    [switchChainAsync, isConnected, wagmiConnector?.id],
  )

  return { switchNetwork: switchChain, canSwitch, isLoading: switching, canSwitchToChain }
}

export const requireLogout = async (connector: Connector, chainId: number, address: `0x${string}` | undefined) => {
  try {
    if (typeof connector.getProvider !== 'function') return false

    const provider = (await connector.getProvider()) as any

    const checksummedAddress = safeGetAddress(address)

    return Boolean(
      !checksummedAddress ||
        (provider &&
          Array.isArray(provider.session?.namespaces?.eip155?.accounts) &&
          !provider.session.namespaces.eip155.accounts.some(
            (account: string) =>
              account?.includes(`${chainId}:${checksummedAddress}`) ||
              account?.includes(`${chainId}:${checksummedAddress.toLowerCase()}`),
          )),
    )
  } catch (error) {
    console.error(error, 'Error detecting provider')
    return false
  }
}

const useProcessSwitchChainRequest = () => {
  const { switchChainAsync: switchNetworkWagmiAsync } = useSwitchChain()
  const { connector } = useAccount()
  const { logout } = useAuth()
  const updateAccountState = useSetAtom(accountActiveChainAtom)
  const setSwitching = useSetAtom(switchChainUpdatingAtom)
  const lock = useRef(false)
  const router = useRouter()
  const replaceGuardRef = useRef<ReplaceGuardState>({ cancelled: false, requestId: 0 })
  const { toastError } = useToast()
  const { t } = useTranslation()

  useEffect(() => {
    const handleRouteChangeStart = () => {
      replaceGuardRef.current.cancelled = true
    }

    router.events.on('routeChangeStart', handleRouteChangeStart)

    return () => {
      replaceGuardRef.current.cancelled = true
      router.events.off('routeChangeStart', handleRouteChangeStart)
    }
  }, [router])

  const activeChainIdRef = useActiveChainIdRef()
  const processSwitching = useCallback(
    async (request: SwitchChainRequest) => {
      const {
        from,
        wagmiConnector,
        evmAddress,
        replaceUrl,
        chainId: requestChainId,
        path,
        pathname,
        persistChain,
      } = request
      if (lock.current) {
        return false
      }
      const currentRequestId = replaceGuardRef.current.requestId + 1
      replaceGuardRef.current = { cancelled: false, requestId: currentRequestId }
      console.log(`[wallet] process switch`, request)
      // Need to switch
      lock.current = true
      try {
        setSwitching(true)
        if (isEvm(requestChainId)) {
          if (connector?.id === EvmConnectorNames.Phantom && !isPhantomEvmChainSupported(requestChainId)) {
            toastError(
              t('Unsupported network'),
              t('Phantom EVM currently supports Ethereum, Base, and Monad only, current chainId is %chainId%', {
                chainId: requestChainId,
              }),
            )
            return false
          }
          // from = wagmi -> no need call switch again
          if (from !== 'wagmi') {
            let shouldSwitch = true

            if (connector && typeof connector.getChainId === 'function') {
              try {
                const connectorChainId = normalizeChainId(await connector.getChainId())
                // Only switch if chain IDs differ
                shouldSwitch = connectorChainId !== requestChainId
              } catch (error) {
                console.warn('Error getting connector chain ID, switching anyway:', error)
                shouldSwitch = true
              }
            }

            if (shouldSwitch) {
              await switchNetworkWagmiAsync({ chainId: requestChainId })
            } else {
              console.info('Chain IDs match — no switch needed.')
            }
          }
          const isWrongNetwork = Boolean(
            !requestChainId ||
              !CHAIN_QUERY_NAME[requestChainId] ||
              (persistChain && CHAIN_QUERY_NAME[requestChainId] !== router.query.chain),
          )
          updateAccountState((prev) => ({
            ...prev,
            chainId: isWrongNetwork ? prev.chainId : requestChainId,
            isWrongNetwork,
            isNotMatched: isWrongNetwork,
          }))
          if (replaceUrl && !persistChain) {
            const guardState = replaceGuardRef.current
            const isLatestRequest = guardState.requestId === currentRequestId
            const hasBeenCancelled = guardState.cancelled || !isLatestRequest
            const matchesCurrentPathname = router.pathname === pathname
            const matchesCurrentPath =
              typeof window !== 'undefined' ? window.location.pathname === path : matchesCurrentPathname

            if (!hasBeenCancelled && matchesCurrentPathname && matchesCurrentPath) {
              const chain = getChainName(requestChainId)
              router.replace({ pathname: path, query: { ...router.query, chain } }, undefined, {
                shallow: true,
              })
            }
          }

          if (wagmiConnector && (await requireLogout(wagmiConnector, requestChainId, evmAddress))) {
            await logout()
          }
          return true
        }

        // Solana
        updateAccountState((prev) => ({
          ...prev,
          chainId: requestChainId,
        }))
        router.replace({ query: { ...router.query, chain: 'sol' } }, undefined, { shallow: true })
        return true
      } catch (error) {
        console.log(`[chain]`, 'switch error', error)
        if (error instanceof PrivySwitchChainError) {
          const chainName = error.chainId ? chainFullNames[error.chainId] ?? '' : ''

          toastError(t('Error'), t('Social login with %chainName% is not supported.', { chainName }))
        } else {
          toastError(t('Error'), t('An unexpected error occurred while switching chains. Please try again.'))
        }
        return false
      } finally {
        setSwitching(false)
        setTimeout(() => {
          lock.current = false
        }, 60)
      }
    },
    [connector, logout, router, setSwitching, switchNetworkWagmiAsync, t, toastError, updateAccountState],
  )

  const handleRequestChainIdChange = useCallback(
    async (request: SwitchChainRequest) => {
      const { from, chainId: requestChainId, force } = request
      const activeChainId = activeChainIdRef.current

      if (requestChainId === activeChainId && !['url', 'connect'].includes(from) && !force) {
        return false
      }

      return processSwitching(request)
    },
    [activeChainIdRef, processSwitching],
  )

  return handleRequestChainIdChange
}
