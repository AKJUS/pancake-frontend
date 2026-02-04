import { ALL_PROTOCOLS, type Protocol } from '@pancakeswap/farms'
import { TreeSelectChangeEvent } from '@pancakeswap/uikit'
import { SELECTED_ALL, SELECTED_NONE, fromSelectedNodes, toSelectedNodes } from '@pancakeswap/widgets-internal'
import { useDynamicRouteParam } from 'hooks/useDynamicRouteParam'
import { useCallback, useMemo } from 'react'
import { POOL_TYPE_FEATURE, usePoolTypes } from 'views/universalFarms/hooks'

export const usePoolTypeQuery = () => {
  const poolTypesTree = usePoolTypes()
  const [poolTypeQuery_, setPoolTypeQuery] = useDynamicRouteParam('poolType')

  const poolTypeQuery = useMemo(() => {
    if (poolTypeQuery_ === SELECTED_ALL) {
      return toSelectedNodes(poolTypesTree, fromSelectedNodes(poolTypesTree, [SELECTED_ALL])).map((n) => n.data)
    }
    if (poolTypeQuery_ === SELECTED_NONE) {
      return []
    }
    return Array.isArray(poolTypeQuery_) ? poolTypeQuery_ : poolTypeQuery_ ? [poolTypeQuery_] : []
  }, [poolTypesTree, poolTypeQuery_])

  const poolType = useMemo(() => {
    const defaultPoolType =
      typeof poolTypeQuery_ === 'undefined' &&
      poolTypeQuery &&
      Array.isArray(poolTypeQuery) &&
      poolTypeQuery.length === 0
        ? [SELECTED_ALL]
        : poolTypeQuery
    return fromSelectedNodes(poolTypesTree, defaultPoolType)
  }, [poolTypesTree, poolTypeQuery_, poolTypeQuery])

  const setPoolType = useCallback(
    (value: TreeSelectChangeEvent['value']) => {
      const root = value?.['0']
      if (!value || Object.keys(value).length === 0) {
        setPoolTypeQuery(SELECTED_NONE)
      } else if (root && root.checked && root.partialChecked === false) {
        // select all
        setPoolTypeQuery(SELECTED_ALL)
      } else {
        setPoolTypeQuery(toSelectedNodes(poolTypesTree, value).map((n) => n.data))
      }
    },
    [setPoolTypeQuery, poolTypesTree],
  )

  return { poolType, setPoolType, poolTypeQuery }
}

export const usePoolFeatureAndType = () => {
  const { poolTypeQuery } = usePoolTypeQuery()
  return useMemo(
    () =>
      poolTypeQuery.length
        ? poolTypeQuery.reduce<{
            features: string[]
            protocols: string[]
            isSelectAllProtocols: boolean
            isSelectAllFeatures: boolean
          }>(
            (v, q) => {
              const isProtocol = ALL_PROTOCOLS.includes(q as Protocol)
              if (isProtocol) {
                v.protocols.push(q)
              } else if (
                ![POOL_TYPE_FEATURE.all, POOL_TYPE_FEATURE.poolType, POOL_TYPE_FEATURE.poolFeature].includes(q)
              ) {
                v.features.push(q)
              }
              if (q === POOL_TYPE_FEATURE.poolType) {
                // eslint-disable-next-line no-param-reassign
                v.isSelectAllProtocols = true
              }
              if (q === POOL_TYPE_FEATURE.poolFeature) {
                // eslint-disable-next-line no-param-reassign
                v.isSelectAllFeatures = true
              }
              return v
            },
            {
              features: [],
              protocols: [],
              isSelectAllProtocols: false,
              isSelectAllFeatures: false,
            },
          )
        : {
            features: [],
            protocols: [],
            isSelectAllProtocols: true,
            isSelectAllFeatures: true,
          },
    [poolTypeQuery],
  )
}
