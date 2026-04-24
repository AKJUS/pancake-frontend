import React from 'react'
import { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { Column, Flex, Text, WalletFilledIcon } from '@pancakeswap/uikit'
import { CurrencyLogo, NumericalInput } from '@pancakeswap/widgets-internal'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import { styled } from 'styled-components'
import { getChainFullName } from 'views/universalFarms/utils'

const RowWrapper = styled(Column)`
  gap: 8px;
  width: 100%;
`

const HeaderRow = styled(Flex)`
  align-items: center;
  justify-content: space-between;
  width: 100%;
`

const TokenInfo = styled(Flex)`
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
`

const SymbolBlock = styled(Column)`
  margin-top: 2px;
  min-width: 0;
`

const BalanceButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  flex-shrink: 0;
  background: transparent;
  border: none;
  font: inherit;
  color: inherit;

  &:hover:not(:disabled) {
    opacity: 0.65;
  }

  &:disabled {
    cursor: not-allowed;
  }
`

const AmountInputField = styled(Column)`
  background-color: ${({ theme }) => theme.colors.input};
  border: 1px solid ${({ theme }) => theme.colors.inputSecondary};
  border-radius: 16px;
  padding: 12px 16px;
  width: 100%;
  box-shadow: ${({ theme }) => theme.shadows.inset};
  gap: 4px;
`

const StyledInput = styled(NumericalInput)`
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  text-align: right;
  font-size: 20px;
  font-weight: 600;
  width: 100%;
  min-width: 0;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSubtle};
  }
`

interface TokenDepositRowProps {
  currency: Currency | undefined
  balance?: CurrencyAmount<Currency>
  value: string
  onUserInput: (value: string) => void
  onMax?: () => void
  disabled?: boolean
  usdValue?: number
  disabledMessage?: string
}

export const TokenDepositRow: React.FC<TokenDepositRowProps> = ({
  currency,
  balance,
  value,
  onUserInput,
  onMax,
  disabled,
  usdValue,
  disabledMessage,
}) => {
  const formattedBalance = balance ? formatAmount(balance, 6) : '0'
  const chainName = currency?.chainId ? getChainFullName(currency.chainId) : ''
  const showUsd = usdValue !== undefined && usdValue > 0 && !disabled

  return (
    <RowWrapper>
      <HeaderRow>
        <TokenInfo>
          <CurrencyLogo currency={currency} size="32px" showChainLogo />
          <SymbolBlock>
            <Text bold fontSize="20px" lineHeight="1.1">
              {currency?.symbol ?? ''}
            </Text>
            {chainName && (
              <Text fontSize="12px" color="textSubtle">
                {chainName}
              </Text>
            )}
          </SymbolBlock>
        </TokenInfo>

        <BalanceButton type="button" onClick={onMax} disabled={disabled || !onMax}>
          <WalletFilledIcon width="14px" height="14px" color="textSubtle" />
          <Text fontSize="12px" color="textSubtle" bold>
            {formattedBalance}
          </Text>
        </BalanceButton>
      </HeaderRow>

      <AmountInputField>
        <div style={{ position: 'relative' }}>
          <StyledInput
            value={disabled && disabledMessage ? '' : disabled ? '' : value}
            onUserInput={onUserInput}
            placeholder={disabled && disabledMessage ? '' : '0.0'}
            disabled={disabled}
            style={disabled && disabledMessage ? { visibility: 'hidden' } : undefined}
          />
          {disabled && disabledMessage && (
            <Text
              fontSize="14px"
              color="textSubtle"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {disabledMessage}
            </Text>
          )}
        </div>
        <Text
          fontSize="12px"
          color="textSubtle"
          textAlign="right"
          style={{ visibility: disabled && disabledMessage ? 'hidden' : 'visible' }}
        >
          ~$
          {(showUsd ? usdValue : 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </AmountInputField>
    </RowWrapper>
  )
}
