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
    label: 'Classic',
    value: STABLE_POOL_TYPE.classic,
  },
]

export const useStablePoolTypeQuery = () => {
  const router = useRouter()
  const { protocol } = useSelectIdRouteParams()
  const [stablePoolTypeQuery_, setStablePoolTypeQuery] = useDynamicRouteParam('stablePoolType')

  const stablePoolTypeQuery = useMemo(() => {
    const values = (Array.isArray(stablePoolTypeQuery_) ? stablePoolTypeQuery_ : [stablePoolTypeQuery_]).filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    )
    const validValues = values.filter((v): v is STABLE_POOL_TYPE => v === STABLE_POOL_TYPE.classic)

    const uniqueValues = Array.from(new Set(validValues))

    return uniqueValues.length ? uniqueValues : [STABLE_POOL_TYPE.classic]
  }, [stablePoolTypeQuery_])

  const setStablePoolType = useCallback(
    (values: string[]) => {
      const validValues = Array.from(
        new Set(values.filter((v): v is STABLE_POOL_TYPE => v === STABLE_POOL_TYPE.classic)),
      )

      setStablePoolTypeQuery(validValues)
    },
    [setStablePoolTypeQuery],
  )

  // Remove stablePoolType param if protocol is not StableSwap
  useEffect(() => {
    if (protocol && protocol !== LiquidityType.StableSwap && stablePoolTypeQuery_) {
      const { stablePoolType: _stablePoolType, ...restQuery } = router.query
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
