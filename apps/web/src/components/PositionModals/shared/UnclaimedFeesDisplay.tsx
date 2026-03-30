import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { Button, FlexGap, PreTitle, RowBetween, Text } from '@pancakeswap/uikit'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { CurrencyLogo, LightGreyCard } from '@pancakeswap/widgets-internal'

interface UnclaimedFeesDisplayProps {
  currency0: Currency
  currency1: Currency
  feeAmount0: CurrencyAmount<Currency> | undefined
  feeAmount1: CurrencyAmount<Currency> | undefined
  feeUsd0: number | undefined
  feeUsd1: number | undefined
  totalFeesUsd: number | undefined
  onCollect: () => void
  collecting: boolean
  disabled: boolean
  hideButton?: boolean
}

export function UnclaimedFeesDisplay({
  currency0,
  currency1,
  feeAmount0,
  feeAmount1,
  feeUsd0,
  feeUsd1,
  totalFeesUsd,
  onCollect,
  collecting,
  disabled,
  hideButton,
}: UnclaimedFeesDisplayProps) {
  const { t } = useTranslation()

  return (
    <>
      <LightGreyCard padding="16px" borderRadius="24px" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <PreTitle color="secondary" mb="8px">
          {t('Unclaimed Fees')}
        </PreTitle>
        <Text fontSize="32px" bold lineHeight={1.2} letterSpacing="-0.32px">
          {formatFiatNumber(totalFeesUsd ?? 0)}
        </Text>

        <RowBetween mt="8px">
          <FlexGap gap="8px" alignItems="center">
            <CurrencyLogo currency={currency0} size="24px" />
            <Text small>{formatNumber(feeAmount0?.toSignificant(6) ?? '0')}</Text>
            <Text small color="textSubtle">
              {currency0.symbol}
            </Text>
          </FlexGap>
          <Text small>{formatFiatNumber(feeUsd0 ?? 0)}</Text>
        </RowBetween>

        <RowBetween mt="8px">
          <FlexGap gap="8px" alignItems="center">
            <CurrencyLogo currency={currency1} size="24px" />
            <Text small>{formatNumber(feeAmount1?.toSignificant(6) ?? '0')}</Text>
            <Text small color="textSubtle">
              {currency1.symbol}
            </Text>
          </FlexGap>
          <Text small>{formatFiatNumber(feeUsd1 ?? 0)}</Text>
        </RowBetween>
      </LightGreyCard>

      {hideButton ? null : (
        <Button mt="16px" width="100%" disabled={disabled} onClick={onCollect}>
          {collecting ? t('Collecting...') : t('Collect')}
        </Button>
      )}
    </>
  )
}
