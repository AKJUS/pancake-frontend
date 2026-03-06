import { useDynamicRouteParam } from 'hooks/useDynamicRouteParam'
import { useCallback, useEffect, useMemo } from 'react'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { LiquidityType } from 'utils/types'
import { useRouter } from 'next/router'
import { isInfinityStableSupported } from '@pancakeswap/infinity-stable-sdk'

export enum STABLE_POOL_TYPE {
  classic = 'classic',
  infinity = 'infinity',
}

export const STABLE_POOL_OPTIONS = [
  {
    label: 'Classic',
    value: STABLE_POOL_TYPE.classic,
  },
  {
    label: 'Infinity',
    value: STABLE_POOL_TYPE.infinity,
  },
]

export const useStablePoolTypeQuery = () => {
  const router = useRouter()
  const { protocol, chainId } = useSelectIdRouteParams()
  const [stablePoolTypeQuery_, setStablePoolTypeQuery] = useDynamicRouteParam('stablePoolType')

  const defaultStablePoolTypes = useMemo(() => {
    return chainId && isInfinityStableSupported(chainId)
      ? [STABLE_POOL_TYPE.infinity, STABLE_POOL_TYPE.classic]
      : [STABLE_POOL_TYPE.classic]
  }, [chainId])

  const stablePoolTypeQuery = useMemo(() => {
    const values = (Array.isArray(stablePoolTypeQuery_) ? stablePoolTypeQuery_ : [stablePoolTypeQuery_]).filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    )
    const validValues = values.filter((v): v is STABLE_POOL_TYPE =>
      [STABLE_POOL_TYPE.classic, STABLE_POOL_TYPE.infinity].includes(v as STABLE_POOL_TYPE),
    )

    const uniqueValues = Array.from(new Set(validValues))

    if (!chainId || !isInfinityStableSupported(chainId)) {
      const classicOnly = uniqueValues.filter((v) => v !== STABLE_POOL_TYPE.infinity)
      return classicOnly.length ? classicOnly : [STABLE_POOL_TYPE.classic]
    }

    return uniqueValues.length ? uniqueValues : defaultStablePoolTypes
  }, [chainId, defaultStablePoolTypes, stablePoolTypeQuery_])

  const setStablePoolType = useCallback(
    (values: string[]) => {
      const validValues = Array.from(
        new Set(
          values.filter((v): v is STABLE_POOL_TYPE =>
            [STABLE_POOL_TYPE.classic, STABLE_POOL_TYPE.infinity].includes(v as STABLE_POOL_TYPE),
          ),
        ),
      )

      if (!chainId || !isInfinityStableSupported(chainId)) {
        setStablePoolTypeQuery(validValues.filter((v) => v !== STABLE_POOL_TYPE.infinity))
        return
      }

      setStablePoolTypeQuery(validValues)
    },
    [chainId, setStablePoolTypeQuery],
  )

  // Remove stablePoolType param if protocol is not StableSwap
  useEffect(() => {
    if (protocol && protocol !== LiquidityType.StableSwap && stablePoolTypeQuery_) {
      const { stablePoolType, ...restQuery } = router.query
      router.replace(
        {
          query: restQuery,
        },
        undefined,
        { shallow: true },
      )
    }
  }, [protocol, stablePoolTypeQuery_, router])

  return useMemo(
    () => ({
      stablePoolTypeQuery,
      setStablePoolType,
    }),
    [stablePoolTypeQuery, setStablePoolType],
  )
}
