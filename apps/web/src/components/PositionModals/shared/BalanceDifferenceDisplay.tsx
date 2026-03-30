import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount } from '@pancakeswap/sdk'
import { ArrowForwardIcon, FlexGap, PreTitle, RowBetween, Text } from '@pancakeswap/uikit'
import { CurrencyLogo, LightGreyCard } from '@pancakeswap/widgets-internal'
import FormattedCurrencyAmount from 'components/FormattedCurrencyAmount/FormattedCurrencyAmount'

const MIN_COL_WIDTH = '80px'

interface BalanceDifferenceDisplayProps {
  currency0: Currency
  currency1: Currency
  currency0Amount: string
  currency0NewAmount: string
  currency1Amount: string
  currency1NewAmount: string
  totalPositionUsd: string
  totalPositionNewUsd: string
  removedAmountUsd: string
  /** V3 remove: uncollected fees collected with liquidity removal (optional) */
  feeValue0?: CurrencyAmount<Currency>
  feeValue1?: CurrencyAmount<Currency>
  /** Sum of fees in USD; only passed when there are fees to show */
  feesEarnedUsd?: string
}

export function BalanceDifferenceDisplay({
  currency0,
  currency1,
  currency0Amount,
  currency0NewAmount,
  currency1Amount,
  currency1NewAmount,
  totalPositionUsd,
  totalPositionNewUsd,
  removedAmountUsd,
  feeValue0,
  feeValue1,
  feesEarnedUsd,
}: BalanceDifferenceDisplayProps) {
  const { t } = useTranslation()

  const showFeesEarned = Boolean(feeValue0?.greaterThan(0) || feeValue1?.greaterThan(0))

  return (
    <LightGreyCard mt="16px" padding="16px" borderRadius="24px" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <RowBetween>
        <PreTitle>{t('Position')}</PreTitle>
        <FlexGap gap="8px" alignItems="center">
          <Text color="textSubtle" small>
            {t('Current')}
          </Text>
          <ArrowForwardIcon color="textSubtle" width="16px" mt="2px" />
          <Text color="textSubtle" minWidth={MIN_COL_WIDTH} small>
            {t('New Balance')}
          </Text>
        </FlexGap>
      </RowBetween>

      <RowBetween mt="8px">
        <FlexGap gap="8px">
          <CurrencyLogo currency={currency0} size="24px" />
          <Text mt="2px" color="textSubtle" small>
            {currency0.symbol ?? 'UNKNOWN'}
          </Text>
        </FlexGap>

        <FlexGap gap="8px" alignItems="center">
          <Text small>{currency0Amount}</Text>
          <ArrowForwardIcon color="textSubtle" width="16px" mt="2px" />
          <Text minWidth={MIN_COL_WIDTH} textAlign="right" small>
            {Number(currency0NewAmount) === 0 ? '0' : currency0NewAmount}
          </Text>
        </FlexGap>
      </RowBetween>

      <RowBetween mt="8px">
        <FlexGap gap="8px">
          <CurrencyLogo currency={currency1} size="24px" />
          <Text mt="2px" color="textSubtle" small>
            {currency1.symbol ?? 'UNKNOWN'}
          </Text>
        </FlexGap>

        <FlexGap gap="8px" alignItems="center">
          <Text small>{currency1Amount}</Text>
          <ArrowForwardIcon color="textSubtle" width="16px" mt="2px" />
          <Text minWidth={MIN_COL_WIDTH} textAlign="right" small>
            {Number(currency1NewAmount) === 0 ? '0' : currency1NewAmount}
          </Text>
        </FlexGap>
      </RowBetween>

      <RowBetween mt="8px" gap="8px">
        <PreTitle>{t('Total Position Value (USD)')}</PreTitle>
        <FlexGap gap="8px" alignItems="center">
          <Text small>{totalPositionUsd}</Text>
          <ArrowForwardIcon color="textSubtle" width="16px" mt="2px" />
          <Text minWidth={MIN_COL_WIDTH} textAlign="right" small>
            {totalPositionNewUsd}
          </Text>
        </FlexGap>
      </RowBetween>

      <RowBetween mt="8px">
        <Text color="textSubtle" small>
          {t('Total removed value (USD)')}
        </Text>

        <Text minWidth={MIN_COL_WIDTH} textAlign="right" small>
          {removedAmountUsd}
        </Text>
      </RowBetween>

      {showFeesEarned ? (
        <>
          <PreTitle mt="8px">{t('Fees Earned')}</PreTitle>

          {feeValue0?.greaterThan(0) ? (
            <RowBetween mt="8px">
              <FlexGap gap="8px">
                <CurrencyLogo currency={feeValue0.currency} size="24px" />
                <Text mt="2px" color="textSubtle" small>
                  {feeValue0.currency.symbol ?? 'UNKNOWN'}
                </Text>
              </FlexGap>
              <Text minWidth={MIN_COL_WIDTH} textAlign="right" small>
                <FormattedCurrencyAmount currencyAmount={feeValue0} />
              </Text>
            </RowBetween>
          ) : null}

          {feeValue1?.greaterThan(0) ? (
            <RowBetween mt="8px">
              <FlexGap gap="8px">
                <CurrencyLogo currency={feeValue1.currency} size="24px" />
                <Text mt="2px" color="textSubtle" small>
                  {feeValue1.currency.symbol ?? 'UNKNOWN'}
                </Text>
              </FlexGap>
              <Text minWidth={MIN_COL_WIDTH} textAlign="right" small>
                <FormattedCurrencyAmount currencyAmount={feeValue1} />
              </Text>
            </RowBetween>
          ) : null}

          <RowBetween mt="8px">
            <Text color="textSubtle" small>
              {t('Total fees earned value (USD)')}
            </Text>
            <Text minWidth={MIN_COL_WIDTH} textAlign="right" small>
              {feesEarnedUsd ?? '$0.00'}
            </Text>
          </RowBetween>
        </>
      ) : null}
    </LightGreyCard>
  )
}
