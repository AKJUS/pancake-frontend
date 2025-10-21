import { getChainName, isEvm } from '@pancakeswap/chains'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { useActiveChainIdRef } from 'hooks/useAccountActiveChain'
import useAuth from 'hooks/useAuth'
import { useAtomValue, useSetAtom } from 'jotai'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Connector, useAccount, useSwitchChain } from 'wagmi'
import { accountActiveChainAtom } from 'wallet/atoms/accountStateAtoms'
import { SwitchChainRequest, switchChainUpdatingAtom } from 'wallet/atoms/switchChainRequestAtom'
import { SOLANA_SUPPORTED_PATH } from 'wallet/network.switch.config'

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
  const { isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const switching = useAtomValue(switchChainUpdatingAtom)
  const { address: evmAddress, connector: wagmiConnector } = useAccount()
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
      return isConnected
        ? !!switchChainAsync &&
            !(
              typeof window !== 'undefined' &&
              // @ts-ignore // TODO: add type later
              window.ethereum?.isMathWallet
            )
        : true
    },
    [switchChainAsync, isConnected],
  )

  return { switchNetwork: switchChain, canSwitch, isLoading: switching, canSwitchToChain }
}

const requireLogout = async (connector: Connector, chainId: number, address: `0x${string}` | undefined) => {
  try {
    if (typeof connector.getProvider !== 'function') return false

    const provider = (await connector.getProvider()) as any

    return Boolean(
      provider &&
        Array.isArray(provider.session?.namespaces?.eip155?.accounts) &&
        !provider.session.namespaces.eip155.accounts.some((account: string) =>
          account?.includes(`${chainId}:${address}`),
        ),
    )
  } catch (error) {
    console.error(error, 'Error detecting provider')
    return false
  }
}

const useProcessSwitchChainRequest = () => {
  const { switchChainAsync: switchNetworkWagmiAsync } = useSwitchChain()
  const { logout } = useAuth()
  const updateAccountState = useSetAtom(accountActiveChainAtom)
  const setSwitching = useSetAtom(switchChainUpdatingAtom)
  const lock = useRef(false)
  const router = useRouter()
  const replaceGuardRef = useRef<ReplaceGuardState>({ cancelled: false, requestId: 0 })

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
          if (from !== 'wagmi') {
            // from = wagmi -> no need call switch again
            await switchNetworkWagmiAsync({ chainId: requestChainId })
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
        if (!SOLANA_SUPPORTED_PATH.some((p) => path.startsWith(p))) {
          window.open('https://solana.pancakeswap.finance', '_self')
          return true
        }
        updateAccountState((prev) => ({
          ...prev,
          chainId: requestChainId,
        }))
        router.replace({ query: { ...router.query, chain: 'sol' } }, undefined, { shallow: true })
        return true
      } catch (error) {
        console.log(`[chain]`, 'switch error', error)
        return false
      } finally {
        setSwitching(false)
        setTimeout(() => {
          lock.current = false
        }, 60)
      }
    },
    [router, switchNetworkWagmiAsync, setSwitching, updateAccountState, logout],
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
