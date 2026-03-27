import { useMemo } from 'react'

import { useAtomValue } from 'jotai'
import { tokensMapAtom } from 'views/universalFarms/atom/tokensMapAtom'

import { useTranslation } from '@pancakeswap/localization'
import { Box, Text, TooltipText, useTooltip, WarningIcon } from '@pancakeswap/uikit'

import { PoolSearchResult, SOL_CHAIN_ID } from './utils'

export const PoolCautionTag: React.FC<{ item: PoolSearchResult }> = ({ item }) => {
  const { t } = useTranslation()
  const { tokensMap } = useAtomValue(tokensMapAtom)

  const unwhitelistedSymbol = useMemo(() => {
    if (item.chainId === SOL_CHAIN_ID) return undefined
    const key0 = `${item.chainId}:${item.token0Address}`.toLowerCase()
    const key1 = `${item.chainId}:${item.token1Address}`.toLowerCase()
    const [symbol0, symbol1] = item.pairSymbol.split(' / ')
    if (!tokensMap[key0]) return symbol0 ?? undefined
    if (!tokensMap[key1]) return symbol1 ?? undefined
    return undefined
  }, [item, tokensMap])

  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    <Text fontSize="14px">
      {t(
        'Caution: %token% is currently unverified. Always confirm the address and do your own research before trading or interacting with this pool.',
        { token: unwhitelistedSymbol },
      )}
    </Text>,
    { placement: 'top' },
  )

  if (!unwhitelistedSymbol) return null

  return (
    <Box ml="4px" display="inline-flex">
      <TooltipText ref={targetRef}>
        <WarningIcon width="18px" color="warning" />
      </TooltipText>
      {tooltipVisible && tooltip}
    </Box>
  )
}
