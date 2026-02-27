import { useDynamicRouteParam } from 'hooks/useDynamicRouteParam'
import { useCallback, useEffect, useMemo } from 'react'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { LiquidityType } from 'utils/types'
import { useRouter } from 'next/router'

export enum STABLE_POOL_TYPE {
  classic = 'classic',
  infinity = 'infinity',
}

export const STABLE_POOL_OPTIONS = [
  {
    label: 'Classic StableSwap',
    value: STABLE_POOL_TYPE.classic,
  },
  {
    label: 'Infinity StableSwap',
    value: STABLE_POOL_TYPE.infinity,
  },
]

export const useStablePoolTypeQuery = () => {
  const router = useRouter()
  const { protocol } = useSelectIdRouteParams()
  const [stablePoolTypeQuery_, setStablePoolTypeQuery] = useDynamicRouteParam('stablePoolType')

  const stablePoolTypeQuery = useMemo(() => {
    // If there's an explicit query param, use it
    if (stablePoolTypeQuery_) {
      return stablePoolTypeQuery_
    }

    // Default to classic
    return STABLE_POOL_TYPE.classic
  }, [stablePoolTypeQuery_])

  const setStablePoolType = useCallback(
    (value: string) => {
      if (![STABLE_POOL_TYPE.classic, STABLE_POOL_TYPE.infinity].includes(value as STABLE_POOL_TYPE)) {
        throw new Error('setStablePoolType: Invalid stable pool type')
      }

      setStablePoolTypeQuery(value)
    },
    [setStablePoolTypeQuery],
  )

  // Remove stablePoolType param if protocol is not StableSwap
  useEffect(() => {
    if (protocol !== LiquidityType.StableSwap && stablePoolTypeQuery_) {
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
