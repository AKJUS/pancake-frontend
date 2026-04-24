import React, { useMemo } from 'react'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { Box, Column, Flex, PreTitle, RowBetween, Text } from '@pancakeswap/uikit'
import { LightGreyCard, NumericalInput } from '@pancakeswap/widgets-internal'
import { styled } from 'styled-components'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { TokenDepositRow } from './TokenDepositRow'

// --- Styled components ---

const UsdInputWrapper = styled(Flex)<{ $disabled?: boolean }>`
  align-items: center;
  background-color: ${({ theme, $disabled }) => ($disabled ? theme.colors.backgroundDisabled : theme.colors.input)};
  border: 1px solid ${({ theme }) => theme.colors.inputSecondary};
  border-radius: 16px;
  padding: 16px;
  box-shadow: ${({ theme }) => theme.shadows.inset};
  gap: 4px;
`

const UsdPrefix = styled(Text).attrs({ bold: true, fontSize: '24px' })`
  color: ${({ theme }) => theme.colors.textSubtle};
  flex-shrink: 0;
`

const StyledUsdInput = styled(NumericalInput)`
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  font-size: 24px;
  font-weight: 600;
  width: 100%;
  min-width: 0;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSubtle};
  }
`

const TokenRowDivider = styled(Box)`
  height: 1px;
  background-color: ${({ theme }) => theme.colors.cardBorder};
`

// --- Props ---

export interface DepositAmountPanelProps {
  /** Display-order currencies (already inverted if needed) */
  baseCurrency: Currency | undefined
  quoteCurrency: Currency | undefined

  /** Current token input values (display order) */
  baseInputValue: string
  quoteInputValue: string

  /** Handlers for individual token amount changes */
  onBaseInput: (amount: string) => void
  onQuoteInput: (amount: string) => void

  /** USD input */
  usdDisplayValue: string
  onUsdInput: (value: string) => void
  canUseUsdMode: boolean

  /** Total USD value derived from token amounts */
  totalUsdValue: number

  /** Deposit enabled states */
  isDepositEnabled: boolean
  isBaseDepositEnabled: boolean
  isQuoteDepositEnabled: boolean

  /** Balances */
  baseBalance?: CurrencyAmount<Currency>
  quoteBalance?: CurrencyAmount<Currency>

  /** Max amounts */
  maxBaseAmount?: CurrencyAmount<Currency>
  maxQuoteAmount?: CurrencyAmount<Currency>

  /** Disabled message when range not set */
  disabledMessage?: string

  /** Whether to show slippage and MEV controls */
  showSettings?: boolean

  /** USD prices per token for inline USD display */
  basePriceUsd?: number
  quotePriceUsd?: number

  /** Per-token disabled messages (e.g. "price range is outside") */
  baseDisabledMessage?: string
  quoteDisabledMessage?: string
}

export const DepositAmountPanel: React.FC<DepositAmountPanelProps> = ({
  baseCurrency,
  quoteCurrency,
  baseInputValue,
  quoteInputValue,
  onBaseInput,
  onQuoteInput,
  usdDisplayValue,
  onUsdInput,
  canUseUsdMode,
  totalUsdValue,
  isDepositEnabled,
  isBaseDepositEnabled,
  isQuoteDepositEnabled,
  baseBalance,
  quoteBalance,
  maxBaseAmount,
  maxQuoteAmount,
  disabledMessage,
  showSettings = true,
  basePriceUsd,
  quotePriceUsd,
  baseDisabledMessage,
  quoteDisabledMessage,
}) => {
  const { t } = useTranslation()

  const isBaseDisabled = !isDepositEnabled || !isBaseDepositEnabled
  const isQuoteDisabled = !isDepositEnabled || !isQuoteDepositEnabled
  const allDisabled = isBaseDisabled && isQuoteDisabled

  const baseUsdValue = useMemo(() => {
    if (!baseInputValue || !basePriceUsd) return undefined
    const n = Number(baseInputValue)
    return Number.isFinite(n) && n > 0 ? n * basePriceUsd : undefined
  }, [baseInputValue, basePriceUsd])

  const quoteUsdValue = useMemo(() => {
    if (!quoteInputValue || !quotePriceUsd) return undefined
    const n = Number(quoteInputValue)
    return Number.isFinite(n) && n > 0 ? n * quotePriceUsd : undefined
  }, [quoteInputValue, quotePriceUsd])

  return (
    <Column gap="8px">
      {/* USD Input — only when both tokens have USD prices so we can convert the typed value
          back into token amounts. When canUseUsdMode=false the Total row below still surfaces
          the derived total, so users aren't missing information. */}
      {canUseUsdMode && (
        <Column gap="4px">
          <PreTitle color="secondary">{t('Deposit Amount')}</PreTitle>
          <UsdInputWrapper $disabled={allDisabled}>
            <UsdPrefix>$</UsdPrefix>
            <StyledUsdInput
              value={usdDisplayValue}
              onUserInput={onUsdInput}
              placeholder="0"
              disabled={allDisabled}
              align="left"
            />
          </UsdInputWrapper>
        </Column>
      )}

      {/* Token Rows */}
      <LightGreyCard padding="0" borderRadius="24px">
        <Column gap="16px">
          <Box padding="16px 16px 0">
            <TokenDepositRow
              currency={baseCurrency}
              balance={baseBalance}
              value={isBaseDisabled ? '' : baseInputValue}
              onUserInput={onBaseInput}
              onMax={isBaseDisabled ? undefined : () => onBaseInput(maxBaseAmount?.toExact() ?? '')}
              disabled={isBaseDisabled}
              usdValue={baseUsdValue}
              disabledMessage={isBaseDisabled ? baseDisabledMessage : undefined}
            />
          </Box>
          <TokenRowDivider />
          <Box padding="0 16px 16px">
            <TokenDepositRow
              currency={quoteCurrency}
              balance={quoteBalance}
              value={isQuoteDisabled ? '' : quoteInputValue}
              onUserInput={onQuoteInput}
              onMax={isQuoteDisabled ? undefined : () => onQuoteInput(maxQuoteAmount?.toExact() ?? '')}
              disabled={isQuoteDisabled}
              usdValue={quoteUsdValue}
              disabledMessage={isQuoteDisabled ? quoteDisabledMessage : undefined}
            />
          </Box>
        </Column>
      </LightGreyCard>

      {/* Disabled message */}
      {!isDepositEnabled && disabledMessage && (
        <Text color="textSubtle" fontSize="14px" textAlign="center">
          {disabledMessage}
        </Text>
      )}

      {/* Settings */}
      {showSettings && (
        <Column mt="8px" gap="16px">
          <RowBetween>
            <Text color="textSubtle">{t('Slippage Tolerance')}</Text>
            <LiquiditySlippageButton />
          </RowBetween>
          {totalUsdValue > 0 && (
            <RowBetween>
              <Text color="textSubtle">{t('Total')}</Text>
              <Text bold>
                ~$
                {totalUsdValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </RowBetween>
          )}
          <MevProtectToggle size="sm" />
        </Column>
      )}
    </Column>
  )
}

export { TokenDepositRow } from './TokenDepositRow'
