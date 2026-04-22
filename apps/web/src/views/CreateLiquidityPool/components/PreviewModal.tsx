import { useTranslation } from '@pancakeswap/localization'
import { UnifiedCurrency, UnifiedCurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { AutoRow, Box, Button, Checkbox, FlexGap, Modal, ModalV2, ModalV2Props, Text } from '@pancakeswap/uikit'
import truncateHash from '@pancakeswap/utils/truncateHash'
import { CurrencyLogo, DoubleCurrencyLogo, LightGreyCard } from '@pancakeswap/widgets-internal'
import Divider from 'components/Divider'
import { useUnifiedUSDPriceAmount } from 'hooks/useStablecoinPrice'
import React, { useState } from 'react'
import { CurrencyField as Field } from 'utils/types'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'

interface PreviewModalProps extends ModalV2Props {
  currencies: { [field in Field]?: UnifiedCurrency }
  parsedAmounts: { [field in Field]?: UnifiedCurrencyAmount<UnifiedCurrency> }
  attemptingTxn?: boolean
  // V3 and V2 main fee tier display
  feeTier?: React.ReactNode

  details?: {
    // Infinity
    poolType?: React.ReactNode
    feeTierSetting?: React.ReactNode
    hookAddress?: string

    // Infinity & V3
    priceRange?: React.ReactNode

    // Infinity, V3 & V2
    startPrice?: React.ReactNode
  }
  onConfirm?: () => void
}

export const PreviewModal = ({
  currencies,
  parsedAmounts,
  onConfirm,
  isOpen,
  onDismiss,
  feeTier,
  details,
  attemptingTxn = false,
}: PreviewModalProps) => {
  const { t } = useTranslation()

  const { [Field.CURRENCY_A]: currencyA, [Field.CURRENCY_B]: currencyB } = currencies

  const currencyAUsdValue = useUnifiedUSDPriceAmount(
    currencyA,
    parsedAmounts[Field.CURRENCY_A] ? Number(parsedAmounts[Field.CURRENCY_A]!.toExact()) : undefined,
  )
  const currencyBUsdValue = useUnifiedUSDPriceAmount(
    currencyB,
    parsedAmounts[Field.CURRENCY_B] ? Number(parsedAmounts[Field.CURRENCY_B]!.toExact()) : undefined,
  )

  const [ackAccepted, setAckAccepted] = useState(false)

  return (
    <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
      <Modal title="" headerBorderColor="transparent" bodyPadding="0 24px 24px" maxWidth={[null, null, null, '400px']}>
        <AutoRow justifyContent="center">
          <FlexGap flexDirection="column" gap="8px" alignItems="center">
            <DoubleCurrencyLogo
              currency0={currencyA}
              currency1={currencyB}
              size={48}
              innerMargin="-8px"
              showChainLogoCurrency1
            />
            <Text fontSize="20px" bold>
              {currencyA?.symbol} / {currencyB?.symbol}
            </Text>
            {feeTier && (
              <LightGreyCard mx="auto" mt="8px" padding="8px 32px">
                <Text textAlign="center" bold>
                  {feeTier}
                </Text>
              </LightGreyCard>
            )}
          </FlexGap>
        </AutoRow>

        <LightGreyCard mt="24px" padding="0">
          <FlexGap justifyContent="space-between" alignItems="center" p="12px 16px 8px">
            <FlexGap gap="8px" alignItems="center">
              <CurrencyLogo currency={currencyA} size="28px" showChainLogo />
              <Text bold>{currencyA?.symbol}</Text>
            </FlexGap>
            <Box>
              <Text bold textAlign="right">
                {parsedAmounts[Field.CURRENCY_A]?.toSignificant(6) || '-'}
              </Text>
              <Text fontSize="12px" color="textSubtle" textAlign="right">
                ~{formatDollarAmount(currencyAUsdValue)}
              </Text>
            </Box>
          </FlexGap>
          <Divider thin />
          <FlexGap justifyContent="space-between" alignItems="center" p="8px 16px 12px">
            <FlexGap gap="8px" alignItems="center">
              <CurrencyLogo currency={currencyB} size="28px" showChainLogo />
              <Text bold>{currencyB?.symbol}</Text>
            </FlexGap>
            <Box>
              <Text bold textAlign="right">
                {parsedAmounts[Field.CURRENCY_B]?.toSignificant(6) || '-'}
              </Text>
              <Text fontSize="12px" color="textSubtle" textAlign="right">
                ~{formatDollarAmount(currencyBUsdValue)}
              </Text>
            </Box>
          </FlexGap>
        </LightGreyCard>

        <LightGreyCard mt="24px" padding="0">
          {details?.poolType && (
            <FlexGap justifyContent="space-between" alignItems="center" p="8px 16px">
              <Text color="textSubtle" small>
                {t('Pool Type')}
              </Text>
              <Text small>{details?.poolType}</Text>
            </FlexGap>
          )}
          {details?.feeTierSetting && (
            <FlexGap justifyContent="space-between" alignItems="center" p="8px 16px">
              <Text color="textSubtle" small>
                {t('Fee Tier Setting')}
              </Text>
              <Text small>{details?.feeTierSetting}</Text>
            </FlexGap>
          )}
          {details?.hookAddress && (
            <FlexGap justifyContent="space-between" alignItems="center" p="8px 16px">
              <Text color="textSubtle" small>
                {t('Hook Address')}
              </Text>
              <Text small>{truncateHash(details?.hookAddress || '')}</Text>
            </FlexGap>
          )}
          {details?.priceRange && (
            <FlexGap justifyContent="space-between" alignItems="center" p="8px 16px">
              <Text color="textSubtle" small>
                {t('Price Range')}
              </Text>
              <Text small>{details?.priceRange}</Text>
            </FlexGap>
          )}

          {details?.startPrice && (
            <FlexGap justifyContent="space-between" alignItems="center" p="8px 16px">
              <Text color="textSubtle" small>
                {t('Initial Price')}
              </Text>
              <Text small>{details?.startPrice}</Text>
            </FlexGap>
          )}
        </LightGreyCard>

        <FlexGap alignItems="center" gap="8px" mt="24px">
          <Checkbox id="ack" checked={ackAccepted} onChange={() => setAckAccepted(!ackAccepted)} scale="sm" />
          <Text small as="label" htmlFor="ack">
            {t('I confirm that I have reviewed the initial price and understand the risks of setting it incorrectly.')}
          </Text>
        </FlexGap>

        <Button
          width="100%"
          mt="24px"
          onClick={onConfirm}
          disabled={!ackAccepted || attemptingTxn}
          isLoading={attemptingTxn}
        >
          {t('Create Pool')}
        </Button>
      </Modal>
    </ModalV2>
  )
}
