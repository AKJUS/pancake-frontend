import { Trans, useTranslation } from '@pancakeswap/localization'
import { FlexGap, InfoIcon, Link, Text, useTooltip } from '@pancakeswap/uikit'
import { ReactNode } from 'react'
import { styled } from 'styled-components'
import { NumberDisplay } from '@pancakeswap/widgets-internal'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import type { IFOStatus } from '../../hooks/ifo/useIFOStatus'
import useIfo from '../../hooks/useIfo'
import { useIfoDisplay } from '../../hooks/useIfoDisplay'

const StyledText = styled(Text)`
  font-size: 14px;
  font-family: Kanit;
  line-height: 150%;
`

type InfoRowData = { left: ReactNode; right: ReactNode; display: boolean }

const InfoRow: React.FC<InfoRowData & { mt?: string }> = ({ left, right, display, mt }) =>
  display ? (
    <FlexGap justifyContent="space-between" mt={mt}>
      {left}
      {right}
    </FlexGap>
  ) : null

interface IfoPoolInfoDisplayProps {
  pid: number
  ifoStatus?: IFOStatus
  variant: 'live' | 'finished' | 'presale' | 'history'
}

const splitValueAndSuffix = (value?: string) => {
  if (!value) return { numeric: undefined, suffix: undefined }

  const [numeric, ...rest] = value.trim().split(/\s+/)
  if (!numeric) return { numeric: undefined, suffix: undefined }

  return {
    numeric,
    suffix: rest.length ? ` ${rest.join(' ')}` : undefined,
  }
}

const IfoPoolInfoDisplay: React.FC<IfoPoolInfoDisplayProps> = ({ pid, ifoStatus, variant }) => {
  const { t } = useTranslation()
  const { pools, users } = useIfo()
  const poolInfo = pools?.[pid]
  const userStatus = users[pid]
  const stakeCurrency = poolInfo?.stakeCurrency
  const { pools: displayPools } = useIfoDisplay()
  const raiseAmountText = displayPools?.[pid]?.raiseAmountText
  const pricePerToken = poolInfo?.price
  const userHasStaked = userStatus?.stakedAmount?.greaterThan(0)
  const showExtraInfo = variant === 'live' && userHasStaked
  const feeTier = poolInfo?.feeTier !== undefined ? `${(poolInfo.feeTier * 100).toFixed(2)}%` : undefined
  const taxValue = poolInfo?.isCakePool && userStatus?.tax ? userStatus.tax.toFixed(6) : undefined
  const taxSymbol = userStatus?.tax?.currency?.symbol
  const taxSuffix = poolInfo?.isCakePool && userStatus?.tax && taxSymbol ? ` ${taxSymbol}` : undefined
  const cakeToBurnValue =
    poolInfo?.isCakePool && poolInfo?.estimatedCakeToBurn ? formatAmount(poolInfo.estimatedCakeToBurn, 6) : undefined
  const cakeToBurnSymbol = poolInfo?.estimatedCakeToBurn?.currency?.symbol
  const cakeToBurnSuffix =
    poolInfo?.isCakePool && poolInfo?.estimatedCakeToBurn && cakeToBurnSymbol ? ` ${cakeToBurnSymbol}` : undefined
  const { numeric: raiseAmountValue, suffix: raiseAmountSuffix } = splitValueAndSuffix(raiseAmountText)
  const commonNumberDisplayProps = {
    color: 'text' as const,
    fontSize: '14px',
    fontFamily: 'Kanit',
    lineHeight: '150%',
  }

  const {
    targetRef: statusTargetRef,
    tooltip: statusTooltip,
    tooltipVisible: statusTooltipVisible,
  } = useTooltip(t('This sale has been oversubscribed. You will get partial refund of the deposit.'), {
    placement: 'top',
  })

  const feeTierTooltipContent = (
    <Text as="div" fontSize="12px">
      <Trans>Tiered Tax based on subscription % : Fees decrease as oversubscription increases.</Trans>
      <ul style={{ whiteSpace: 'pre' }}>
        <li>{'>=0x    1.00%'}</li>
        <li>{'>=50x   0.80%'}</li>
        <li>{'>=100x  0.60%'}</li>
        <li>{'>=150x  0.50%'}</li>
        <li>{'>=200x  0.40%'}</li>
        <li>{'>=250x  0.30%'}</li>
        <li>{'>=300x  0.25%'}</li>
        <li>{'>=400x  0.20%'}</li>
        <li>{'>=500x  0.15%'}</li>
        <li>{'>=650x  0.12%'}</li>
        <li>{'>=800x  0.10%'}</li>
        <li>{'>=1000x 0.080%'}</li>
        <li>{'>=1250x 0.065%'}</li>
        <li>{'>=1500x 0.055%'}</li>
        <li>{'>=1800x 0.045%'}</li>
        <li>{'>=2200x 0.037%'}</li>
        <li>{'>=2700x 0.030%'}</li>
        <li>{'>=3300x 0.025%'}</li>
        <li>{'>=4000x 0.020%'}</li>
        <li>{'>=5000x 0.017%'}</li>
      </ul>
      (<Trans>All CAKE.PAD fees collected will be used in CAKE burn</Trans>)
    </Text>
  )

  const {
    targetRef: feeTierTargetRef,
    tooltip: feeTierTooltip,
    tooltipVisible: feeTierTooltipVisible,
  } = useTooltip(feeTierTooltipContent, {
    placement: 'top-start',
  })

  const taxTooltipContent = (
    <Text as="div" fontSize="12px">
      {t(
        'Taxes apply only if the CAKE.PAD event is oversubscribed. Tax is deducted solely from your excess committed funds (based on fee tier).',
      )}
      <br />
      <Link
        href="https://docs.pancakeswap.finance/earn/cakepad/how-cake.pad-taxes-work-in-overflow-sales-with-example"
        target="_blank"
      >
        {t('Learn More')}
      </Link>
    </Text>
  )

  const {
    targetRef: taxTargetRef,
    tooltip: taxTooltip,
    tooltipVisible: taxTooltipVisible,
  } = useTooltip(taxTooltipContent, {
    placement: 'top-start',
  })

  const feeTierRight = (
    <FlexGap ref={feeTierTargetRef} alignItems="center">
      <StyledText color="text">{feeTier}</StyledText>
      <InfoIcon width="14px" color="textSubtle" />
      {feeTierTooltipVisible && feeTierTooltip}
    </FlexGap>
  )

  const statusRight = (
    <FlexGap flexDirection="column" alignItems="flex-end">
      <FlexGap gap="3px" alignItems="center">
        <NumberDisplay
          {...commonNumberDisplayProps}
          value={ifoStatus?.progress ? ifoStatus.progress.toFixed(2) : '0.00'}
          suffix=" %"
        />
        {ifoStatus?.progress?.greaterThan(1) && (
          <StyledText as="span" color="text">
            🎉
          </StyledText>
        )}
        {ifoStatus?.progress?.greaterThan(1) && variant === 'finished' && (
          <FlexGap ref={statusTargetRef}>
            <InfoIcon width="14px" color="textSubtle" />
            {statusTooltipVisible && statusTooltip}
          </FlexGap>
        )}
      </FlexGap>
      {ifoStatus?.progress?.greaterThan(1) && variant !== 'finished' && (
        <FlexGap gap="3px">
          <StyledText color="text">{t('Oversubscribed')}</StyledText>
          <FlexGap ref={statusTargetRef}>
            <InfoIcon width="14px" color="textSubtle" />
            {statusTooltipVisible && statusTooltip}
          </FlexGap>
        </FlexGap>
      )}
    </FlexGap>
  )

  const list: InfoRowData[] = [
    {
      left: <StyledText color="textSubtle">{t('Sale Price per token')}</StyledText>,
      right: pricePerToken ? (
        <NumberDisplay
          {...commonNumberDisplayProps}
          value={pricePerToken.toFixed(6)}
          suffix={stakeCurrency?.symbol ? ` ${stakeCurrency.symbol}` : undefined}
        />
      ) : (
        <StyledText color="text">-</StyledText>
      ),
      display: true,
    },
    {
      left: <StyledText color="textSubtle">{t('Raise Goal')}</StyledText>,
      right: raiseAmountValue ? (
        <StyledText>
          {formatNumber(raiseAmountValue, { maxDecimalDisplayDigits: 6 })} {raiseAmountSuffix}
        </StyledText>
      ) : (
        <StyledText color="text">{raiseAmountText ?? '-'}</StyledText>
      ),
      display: true,
    },
    {
      left: <StyledText color="textSubtle">{t('Total committed')}</StyledText>,
      right: (
        <NumberDisplay
          {...commonNumberDisplayProps}
          value={ifoStatus?.currentStakedAmount?.toFixed(2) ?? '0'}
          suffix={stakeCurrency?.symbol ? ` ${stakeCurrency.symbol}` : undefined}
        />
      ),
      display: variant !== 'presale',
    },
    {
      left: <StyledText color="textSubtle">{t('Deposit Amount')}</StyledText>,
      right: (
        <NumberDisplay
          {...commonNumberDisplayProps}
          value={userStatus?.stakedAmount?.toExact() ?? '0'}
          suffix={stakeCurrency?.symbol ? ` ${stakeCurrency.symbol}` : undefined}
        />
      ),
      display: Boolean(variant !== 'presale' && showExtraInfo),
    },
    {
      left: <StyledText color="textSubtle">{t('Fee Tier')}</StyledText>,
      right: feeTierRight,
      display: variant !== 'presale' && variant !== 'finished' && !showExtraInfo && !!feeTier,
    },
    {
      left: <StyledText color="textSubtle">{t('Status')}</StyledText>,
      right: statusRight,
      display: variant !== 'presale' && variant !== 'history',
    },
    {
      left: <StyledText color="textSubtle">{t('Fee Tier')}</StyledText>,
      right: feeTierRight,
      display: Boolean(variant !== 'presale' && showExtraInfo && !!feeTier),
    },
    {
      left: <StyledText color="textSubtle">{t('Your Tax')}</StyledText>,
      right: (
        <FlexGap ref={taxTargetRef} alignItems="center">
          {taxValue ? (
            <NumberDisplay {...commonNumberDisplayProps} value={taxValue} suffix={taxSuffix} />
          ) : (
            <StyledText color="text">-</StyledText>
          )}
          <InfoIcon width="14px" color="textSubtle" />
          {taxTooltipVisible && taxTooltip}
        </FlexGap>
      ),
      display: Boolean(variant !== 'presale' && showExtraInfo && !!taxValue),
    },
    {
      left: <StyledText color="textSubtle">{t('Total CAKE to burn')}</StyledText>,
      right: cakeToBurnValue ? (
        <NumberDisplay
          {...commonNumberDisplayProps}
          value={cakeToBurnValue}
          suffix={cakeToBurnSuffix}
          maximumSignificantDigits={6}
        />
      ) : (
        <StyledText color="text">-</StyledText>
      ),
      display: Boolean(variant !== 'presale' && !!cakeToBurnValue),
    },
  ]

  return (
    <>
      {list.map((row, idx) => (
        <InfoRow key={idx} {...row} mt={idx === 0 ? '8px' : undefined} />
      ))}
    </>
  )
}

export default IfoPoolInfoDisplay
