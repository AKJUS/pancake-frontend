import { useTranslation } from '@pancakeswap/localization'
import { Tag } from '@pancakeswap/uikit'
import { TagV2 } from 'components/Liquidity/Badges'
import { useMerklInfo } from 'hooks/useMerkl'

export function MerklTag({ poolAddress }: { poolAddress?: string }) {
  const { t } = useTranslation()
  const { hasMerkl } = useMerklInfo(poolAddress)

  if (!hasMerkl) return null

  return (
    <Tag ml="8px" outline variant="warning">
      {t('Merkl')}
    </Tag>
  )
}

export function MerklTagV2({ poolAddress }: { poolAddress?: string }) {
  const { t } = useTranslation()
  const { hasMerkl } = useMerklInfo(poolAddress)

  if (!hasMerkl) return null

  return (
    <TagV2 ml="8px" variant="warning">
      {t('Merkl')}
    </TagV2>
  )
}

export function MerklRewardsTag({ poolAddress }: { poolAddress?: string }) {
  const { t } = useTranslation()
  const { hasMerkl } = useMerklInfo(poolAddress)

  if (!hasMerkl) return null

  return (
    <Tag variant="warning" mr="8px" outline>
      {t('Merkl Rewards')}
    </Tag>
  )
}
