import { Protocol } from '@pancakeswap/farms'
import { HOOK_CATEGORY } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { useMemo } from 'react'

export enum POOL_TYPE_FEATURE {
  all = 'All Pools',
  poolType = 'Pool Type',
  poolFeature = 'Pool Feature',
}

export const usePoolTypes = () => {
  const { t } = useTranslation()
  return useMemo(
    () => [
      {
        key: '0',
        label: t('All Pools'),
        data: POOL_TYPE_FEATURE.all,
        children: [
          {
            key: '0-0',
            label: t('Pool Type'),
            data: POOL_TYPE_FEATURE.poolType,
            children: [
              {
                key: '0-0-0',
                label: t('CLAMM'),
                data: Protocol.InfinityCLAMM,
              },
              {
                key: '0-0-1',
                label: t('LBAMM'),
                data: Protocol.InfinityBIN,
              },
            ],
          },
          {
            key: '0-1',
            label: t('Pool Feature'),
            data: POOL_TYPE_FEATURE.poolFeature,
            children: Object.entries(HOOK_CATEGORY).map(([_key, value], idx) => ({
              key: `0-1-${idx}`,
              label: value,
              data: value,
            })),
          },
        ],
      },
    ],
    [t],
  )
}
