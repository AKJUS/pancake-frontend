import { useTranslation } from '@pancakeswap/localization'
import { Card, CardBody, FlexGap, Text } from '@pancakeswap/uikit'
import { CurrencyLogo, DoubleCurrencyLogo, NumberDisplay } from '@pancakeswap/widgets-internal'
import type { Currency } from '@pancakeswap/swap-sdk-core'
import useTheme from 'hooks/useTheme'
import { StyledLogo } from '../Icons'
import useIfo from '../../hooks/useIfo'
import { useIfoDisplay } from '../../hooks/useIfoDisplay'

interface SubscribeInfoProps {
  stakeCurrency0?: Currency
  stakeCurrency1?: Currency
}

const SubscribeInfo: React.FC<SubscribeInfoProps> = ({ stakeCurrency0, stakeCurrency1 }) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  if (!stakeCurrency0 && !stakeCurrency1) {
    return null
  }
  return (
    <FlexGap
      alignItems="center"
      gap="8px"
      mt="16px"
      p="12px"
      borderRadius="16px"
      border={`1px solid ${theme.colors.cardBorder}`}
      background={theme.colors.cardSecondary}
    >
      {stakeCurrency0 && stakeCurrency1 ? (
        <DoubleCurrencyLogo size={40} currency0={stakeCurrency0} currency1={stakeCurrency1} />
      ) : stakeCurrency0 || stakeCurrency1 ? (
        <CurrencyLogo size="40px" currency={stakeCurrency0 ?? stakeCurrency1} />
      ) : null}
      <Text>
        {stakeCurrency0 && stakeCurrency1 ? (
          <>
            {t('Subscribe to the sale by depositing')}{' '}
            <Text as="span" bold>
              {stakeCurrency0.symbol} & {stakeCurrency1.symbol}
            </Text>{' '}
            {t('in a 1:1 ratio.')}
          </>
        ) : stakeCurrency0 || stakeCurrency1 ? (
          <>
            {t('Subscribe to the sale by depositing')}{' '}
            <Text as="span" bold>
              {stakeCurrency0?.symbol ?? stakeCurrency1?.symbol}
            </Text>
            .
          </>
        ) : null}
      </Text>
    </FlexGap>
  )
}

export const IfoSaleInfoDisplay: React.FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { config, info, pools } = useIfo()
  const { preSaleDurationText } = useIfoDisplay()

  const stakeCurrency0 = pools?.[0]?.stakeCurrency
  const stakeCurrency1 = pools?.[1]?.stakeCurrency
  const { icon } = config ?? {}

  const { offeringCurrency, totalSalesAmount, status } = info
  const offeringSymbolSuffix = offeringCurrency?.symbol ? ` ${offeringCurrency.symbol.toUpperCase()}` : undefined

  if (status === 'finished') {
    return (
      <FlexGap gap="8px" alignItems="center" background={theme.colors.backgroundAlt}>
        {icon && <StyledLogo size="40px" srcs={[icon]} />}
        <FlexGap flexDirection="column">
          <Text fontSize="12px" bold color="secondary" lineHeight="18px" textTransform="uppercase">
            {t('Total Sale')}
          </Text>
          <NumberDisplay
            bold
            fontSize="20px"
            lineHeight="30px"
            value={totalSalesAmount?.toSignificant(6)}
            suffix={offeringSymbolSuffix}
          />
        </FlexGap>
      </FlexGap>
    )
  }

  return (
    <>
      <Text fontSize="12px" bold color="secondary" lineHeight="18px" textTransform="uppercase">
        {t('Total Sale')}
      </Text>
      <FlexGap mt="8px" gap="8px" alignItems="center" background={theme.colors.backgroundAlt}>
        {icon && <StyledLogo size="40px" srcs={[icon]} />}
        <FlexGap flexDirection="column">
          <NumberDisplay
            bold
            fontSize="20px"
            lineHeight="30px"
            value={totalSalesAmount?.toSignificant(6)}
            suffix={offeringSymbolSuffix}
          />
          <Text color="textSubtle">{`${preSaleDurationText} ${t('Event Duration')}`}</Text>
        </FlexGap>
      </FlexGap>
      <SubscribeInfo stakeCurrency0={stakeCurrency0} stakeCurrency1={stakeCurrency1} />
    </>
  )
}

export const IfoSaleInfoCard: React.FC = () => {
  const { theme } = useTheme()
  return (
    <Card background={theme.colors.card}>
      <CardBody p="16px">
        <IfoSaleInfoDisplay />
      </CardBody>
    </Card>
  )
}
