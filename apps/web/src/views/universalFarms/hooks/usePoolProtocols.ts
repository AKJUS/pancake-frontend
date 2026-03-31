import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { useMatchBreakpoints } from '@pancakeswap/uikit'
import { INFINITY_PROTOCOLS } from 'config/constants/protocols'
import { useMemo } from 'react'

export const usePoolProtocols = () => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  return useMemo(
    () => [
      {
        label: t('All'),
        value: null,
      },
      {
        label: 'Infinity',
        value: INFINITY_PROTOCOLS,
      },
      {
        label: 'V3',
        value: Protocol.V3,
      },
      {
        label: 'V2',
        value: Protocol.V2,
      },
      {
        label: isMobile ? t('SS') : t('StableSwap'),
        value: [Protocol.STABLE],
      },
    ],
    [isMobile, t],
  )
}
