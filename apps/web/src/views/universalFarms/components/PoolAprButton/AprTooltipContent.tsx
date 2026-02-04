import { useTranslation } from '@pancakeswap/localization'
import { LinkExternal, Text } from '@pancakeswap/uikit'
import { displayApr } from '@pancakeswap/utils/displayApr'
import { PropsWithChildren } from 'react'
import { StyledLi } from '../shared/styled'

type AprValue = {
  value: number | `${number}`
}

type AprTooltipContentProps = {
  combinedApr: number
  cakeApr?: AprValue
  lpFeeApr: number
  showDesc?: boolean
  expired?: boolean
  merklApr?: number
  merklLink?: string
  incentraApr?: number
  incentraLink?: string
}

export const AprTooltipContent: React.FC<PropsWithChildren<AprTooltipContentProps>> = ({
  combinedApr,
  cakeApr,
  lpFeeApr,
  showDesc = true,
  merklApr,
  merklLink,
  incentraApr,
  incentraLink,
  children,
}) => {
  const { t } = useTranslation()
  const cakeAprValue = Number(cakeApr?.value ?? 0)
  return (
    <>
      <Text>
        {t('Combined APR')}: <b>{displayApr(combinedApr)}</b>
      </Text>
      <ul>
        {cakeApr && cakeAprValue ? (
          <li>
            {t('Farm APR')}: &nbsp;&nbsp;
            <b>{displayApr(cakeAprValue)}</b>
          </li>
        ) : null}
        <li>
          {t('LP Fee APR')}:&nbsp;&nbsp;<b>{displayApr(lpFeeApr)}</b>
        </li>
        {merklApr ? (
          <StyledLi>
            <Text lineHeight={1.5}>
              {t('Merkl APR')}:&nbsp;&nbsp;<b>{displayApr(merklApr)}</b>
            </Text>
            <LinkExternal ml={2} href={merklLink}>
              {t('Check')}
            </LinkExternal>
          </StyledLi>
        ) : null}
        {incentraApr ? (
          <StyledLi>
            <Text lineHeight={1.5}>
              {`Incentra ${t('APR')}`}:&nbsp;&nbsp;<b>{displayApr(incentraApr)}</b>
            </Text>
            <LinkExternal ml={2} href={incentraLink}>
              {t('Check')}
            </LinkExternal>
          </StyledLi>
        ) : null}
      </ul>

      {showDesc && (
        <>
          <Text mt="10px">
            {t(
              'APRs are calculated using the total liquidity in the pool versus the total reward amount, actual APRs may be higher as some liquidity is not staked or in-range.',
            )}
          </Text>
          <Text mt="10px">{t('APRs for individual positions may vary depending on the price range set.')}</Text>
        </>
      )}

      {children}
    </>
  )
}

export const BCakeWrapperFarmAprTipContent = () => {
  const { t } = useTranslation()
  return (
    <Text mt="15px">
      {t('bCAKE only boosts Farm APR. Actual boost multiplier is subject to farm and pool conditions.')}
    </Text>
  )
}
