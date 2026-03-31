import { chainNames, getChainName } from '@pancakeswap/chains'
import { Protocol } from '@pancakeswap/farms'
import { INFINITY_SUPPORTED_CHAINS } from '@pancakeswap/infinity-sdk'
import { CAKE, USDC } from '@pancakeswap/tokens'
import { SelectIdRoute, zSelectId } from 'dynamicRoute'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useUnifiedNativeCurrency } from 'hooks/useNativeCurrency'
import { useRouteParams } from 'next-typesafe-url/pages'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo } from 'react'
import { getUnifiedNativeCurrency } from 'utils/getUnifiedNativeCurrency'
import { isSupportedProtocol } from 'utils/protocols'
import { LIQUIDITY_TYPES, LiquidityType } from 'utils/types'
import { useProtocolSupported } from 'views/CreateLiquidityPool/hooks/useProtocolSupported'
import { z } from 'zod'

export const useSelectIdRoute = () => {
  const router = useRouter()
  const { chainId: activeChainId } = useActiveChainId()
  const native = useUnifiedNativeCurrency(activeChainId)

  const { data: routeParams, error: routeError, isLoading } = useRouteParams(SelectIdRoute.routeParams)

  const protocolFromQuery = useMemo(() => router.query.selectId?.[1] || '', [router.query])

  const protocolName = useMemo(() => {
    const name =
      // if no protocol and infinity is supported, set to infinity
      (
        (!protocolFromQuery || protocolFromQuery === 'infinity') && INFINITY_SUPPORTED_CHAINS.includes(activeChainId)
          ? 'infinity'
          : protocolFromQuery === LiquidityType.StableSwap
          ? LiquidityType.StableSwap
          : // if other protocol value is supported (v2, v3, stable), set to that protocol
          isSupportedProtocol(protocolFromQuery as Protocol)
          ? protocolFromQuery
          : // if protocol is not supported, default to v3
            'v3'
      ) as LiquidityType

    return name
  }, [activeChainId, protocolFromQuery])

  const replaceWithDefaultRoute = useCallback(() => {
    if (!activeChainId || !router.isReady) return

    const chainName = getChainName(activeChainId)

    const currencyA = native.symbol
    const currencyB: string = CAKE[activeChainId]?.address ?? USDC[activeChainId]?.address ?? ''

    router.replace(
      {
        query: {
          ...router.query,
          selectId: [chainName, protocolName, currencyA, currencyB],
          chain: chainNames[activeChainId],
        }, // keep other query params
      },
      undefined,
      { shallow: true },
    )
  }, [activeChainId, native.symbol, router, protocolName])

  // If Infinity is not supported on the current chain, redirect to default route
  useEffect(
    () => {
      if (protocolName && protocolFromQuery && protocolName !== protocolFromQuery) {
        replaceWithDefaultRoute()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [protocolName, protocolFromQuery],
  )

  return {
    protocolName,
    replaceWithDefaultRoute,
    routeParams,
    routeError,
    isLoading,
  }
}

export const useSelectIdRouteParams = () => {
  const { routeParams } = useSelectIdRoute()
  const router = useRouter()

  const params = useMemo(() => {
    if (!routeParams || !routeParams.selectId) return null
    const [chainId, protocol, currencyIdA, currencyIdB] = routeParams.selectId

    return { chainId, protocol: protocol as LiquidityType | undefined, currencyIdA, currencyIdB }
  }, [routeParams])

  const { isV2Supported, isInfinitySupported, isStableSwapSupported, isV3Supported } = useProtocolSupported()

  const fallbackToSupportedProtocol = useCallback(
    (protocol?: LiquidityType, chainId?: number) => {
      if (!protocol || !chainId) return protocol

      const isSupported = (p: (typeof LIQUIDITY_TYPES)[number]): boolean => {
        switch (p) {
          case LiquidityType.Infinity:
            return isInfinitySupported(chainId)
          case LiquidityType.V3:
            return isV3Supported(chainId)
          case LiquidityType.V2:
            return isV2Supported(chainId)
          case LiquidityType.StableSwap:
            return isStableSwapSupported(chainId)
          default:
            return false
        }
      }

      if (protocol && isSupported(protocol)) return protocol

      const firstSupported = LIQUIDITY_TYPES.find(isSupported)

      return firstSupported ?? LiquidityType.V3
    },
    [isV2Supported, isInfinitySupported, isStableSwapSupported, isV3Supported],
  )

  const updateParams = useCallback(
    (p: Partial<z.infer<typeof zSelectId>>) => {
      if (!params || !Object.values(params).every((v) => v !== undefined)) return
      const hasOnlyChainId = Object.keys(p).length === 1 && 'chainId' in p && p.chainId !== params.chainId

      const query = {
        ...router.query,
        selectId: hasOnlyChainId
          ? [
              getChainName(p.chainId!),
              fallbackToSupportedProtocol(params.protocol, p.chainId),
              params.protocol !== LiquidityType.StableSwap
                ? getUnifiedNativeCurrency(p.chainId!).symbol
                : params.currencyIdA,
              params.protocol !== LiquidityType.StableSwap
                ? CAKE[p.chainId!]?.address ?? USDC[p.chainId!]?.address ?? params.currencyIdB
                : params.currencyIdB,
            ]
          : [
              getChainName(p.chainId ?? params.chainId),
              fallbackToSupportedProtocol(
                (p.protocol as LiquidityType | undefined) || params.protocol,
                p.chainId ?? params.chainId,
              ),
              p.currencyIdA ?? params.currencyIdA,
              p.currencyIdB ?? params.currencyIdB,
            ],
        chain: chainNames[p.chainId ?? params.chainId],
      } // keep other query params

      router.replace(
        {
          query,
        },
        undefined,
        { shallow: true },
      )
    },
    [fallbackToSupportedProtocol, params, router],
  )

  const switchCurrencies = useCallback(() => {
    updateParams({ currencyIdA: params?.currencyIdB, currencyIdB: params?.currencyIdA })
  }, [params, updateParams])

  return { ...params, updateParams, switchCurrencies }
}

export const useDefaultSelectIdRoute = () => {
  const { replaceWithDefaultRoute, routeParams, routeError, isLoading } = useSelectIdRoute()

  useEffect(() => {
    if (!isLoading && (!routeParams?.selectId || routeError)) {
      console.warn('replaceWithDefaultRoute', { routeParams, routeError })
      replaceWithDefaultRoute()
    }
  }, [isLoading, routeParams, replaceWithDefaultRoute, routeError])
}
