import { useMemo } from 'react'
import { SUGGESTED_BASES } from 'config/constants/exchange'
import { useUnifiedNativeCurrency } from 'hooks/useNativeCurrency'
import { styled } from 'styled-components'

import { UnifiedChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { UnifiedCurrency, UnifiedToken } from '@pancakeswap/sdk'
import { AutoColumn, QuestionHelper, Text } from '@pancakeswap/uikit'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'

import { AutoRow } from '../Layout/Row'
import { CommonBasesType } from './types'

export const ButtonWrapper = styled.div`
  display: inline-block;
  vertical-align: top;
  margin-right: 8px;
`

export const BaseWrapper = styled.div<{ disable?: boolean }>`
  display: flex;
  align-items: center;
  padding: 6px 4px;
  transition: background-color 0.15s;

  border-radius: ${({ theme }) => theme.radii.default};
  color: ${({ theme, disable }) => (disable ? theme.colors.backgroundAlt : theme.colors.textSubtle)} !important;
  background-color: ${({ theme, disable }) => (disable ? theme.colors.textSubtle : theme.colors.input)};

  &:hover {
    cursor: ${({ disable }) => !disable && 'pointer'};
    background-color: ${({ theme, disable }) => !disable && theme.colors.background};
  }
`

export const RowWrapper = styled.div`
  white-space: nowrap;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar {
    display: none;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
  }
`

export default function CommonBases({
  chainId,
  onSelect,
  selectedCurrency,
  commonBasesType,
  supportCrossChain,
  disabledCurrencies,
  showNative = true,
}: {
  chainId?: UnifiedChainId
  commonBasesType?: CommonBasesType
  selectedCurrency?: UnifiedCurrency | null
  onSelect: (currency: UnifiedCurrency) => void
  supportCrossChain?: boolean
  disabledCurrencies?: UnifiedCurrency[]
  showNative?: boolean
}) {
  const native = useUnifiedNativeCurrency(chainId)
  const { t } = useTranslation()
  const pinTokenDescText = commonBasesType === CommonBasesType.SWAP_LIMITORDER ? t('Popular tokens') : t('Common bases')

  const isNativeDisabled = useMemo(
    () =>
      (selectedCurrency?.isNative && selectedCurrency?.chainId === chainId) ||
      Boolean(disabledCurrencies?.find((c) => c.equals(native))),
    [chainId, disabledCurrencies, native, selectedCurrency?.chainId, selectedCurrency?.isNative],
  )

  return (
    <AutoColumn gap="sm">
      <AutoRow>
        <Text color="textSubtle" fontSize="14px">
          {pinTokenDescText}
        </Text>
        {commonBasesType === CommonBasesType.LIQUIDITY && (
          <QuestionHelper text={t('These tokens are commonly paired with other tokens.')} ml="4px" />
        )}
      </AutoRow>
      <RowWrapper>
        {showNative && (
          <ButtonWrapper>
            <BaseWrapper
              onClick={() => {
                if (isNativeDisabled) {
                  return
                }

                onSelect(native)
              }}
              disable={isNativeDisabled}
            >
              <CurrencyLogo
                showChainLogo={supportCrossChain}
                currency={native}
                containerStyle={{
                  position: 'relative',
                  top: '1px',
                }}
              />
              <Text px="4px" color="inherit">
                {native?.symbol}
              </Text>
            </BaseWrapper>
          </ButtonWrapper>
        )}
        {(chainId ? SUGGESTED_BASES[chainId] || [] : []).map((token: UnifiedToken) => {
          const selected = selectedCurrency?.equals?.(token)
          const disabled = selected || Boolean(disabledCurrencies?.find((c) => c.equals(token)))
          return (
            <ButtonWrapper key={`buttonBase#${token.address}`}>
              <BaseWrapper onClick={() => !disabled && onSelect(token)} disable={disabled}>
                <CurrencyLogo
                  showChainLogo={supportCrossChain}
                  currency={token}
                  style={{ borderRadius: '50%' }}
                  containerStyle={{
                    position: 'relative',
                    top: '1px',
                  }}
                />
                <Text px="4px" color="inherit">
                  {token.symbol}
                </Text>
              </BaseWrapper>
            </ButtonWrapper>
          )
        })}
      </RowWrapper>
    </AutoColumn>
  )
}
