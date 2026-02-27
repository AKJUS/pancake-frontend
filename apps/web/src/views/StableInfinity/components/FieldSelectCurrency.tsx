import { useTranslation } from '@pancakeswap/localization'
import { Currency, ERC20Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { AutoRow, Box, PreTitle } from '@pancakeswap/uikit'
import { CurrencySelectV2 } from 'components/CurrencySelectV2'
import { CommonBasesType } from 'components/SearchModal/types'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { useEffect } from 'react'
import { Address, Hex } from 'viem'
import { useCurrencies } from 'views/CreateLiquidityPool/hooks/useCurrencies'
import { useFieldSelectCurrencies } from 'views/CreateLiquidityPool/hooks/useFieldSelectCurrencies'
import { CurrencyField } from 'utils/types'
import { TokenType, ADDRESS_ZERO, NULL_METHOD_ID } from '@pancakeswap/infinity-stable-sdk'
import { useTokenConfig } from '../contexts/TokenConfigContext'
import { CardCheckBox } from './shared/CardCheckBox'

export const FieldSelectCurrency = ({
  selectedCurrency,
  otherSelectedCurrency,
  onCurrencySelect,
}: {
  selectedCurrency?: Currency | ERC20Token
  otherSelectedCurrency?: Currency | ERC20Token
  onCurrencySelect: (currency: UnifiedCurrency) => void
}) => {
  const { chainId } = useSelectIdRouteParams()

  return (
    <CurrencySelectV2
      id="create-liquidity-form-select-base-currency"
      chainId={chainId}
      selectedCurrency={selectedCurrency}
      otherSelectedCurrency={otherSelectedCurrency}
      onCurrencySelect={onCurrencySelect}
      showCommonBases
      commonBasesType={CommonBasesType.LIQUIDITY}
      hideBalance
      showNative={false}
    />
  )
}

// NOTE: This component will be used when implementing oracle tokens.
export const CardCheckRadioGroup = ({ field }: { field: CurrencyField }) => {
  const { t } = useTranslation()
  const { tokenAConfig, tokenBConfig, setTokenAConfig, setTokenBConfig } = useTokenConfig()

  const config = field === CurrencyField.CURRENCY_A ? tokenAConfig : tokenBConfig
  const setConfig = field === CurrencyField.CURRENCY_A ? setTokenAConfig : setTokenBConfig

  const handleTypeChange = (type: TokenType) => {
    setConfig({
      ...config,
      type,
      ...(type === TokenType.STANDARD && {
        oracleAddress: ADDRESS_ZERO,
        methodId: NULL_METHOD_ID as Hex,
      }),
    })
  }

  // Temporarily disable Oracle tokens: always enforce Standard config.
  useEffect(() => {
    if (config.type !== TokenType.STANDARD) {
      handleTypeChange(TokenType.STANDARD)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.type])

  return (
    <AutoRow gap="16px">
      <CardCheckBox label={t('Standard')} checked={config.type === TokenType.STANDARD} onChange={() => {}} />
    </AutoRow>
  )
}

export const InfinityStableFieldSelectCurrencies = () => {
  const { t } = useTranslation()
  const { baseCurrency, quoteCurrency } = useCurrencies()
  const { handleBaseCurrencySelect, handleQuoteCurrencySelect } = useFieldSelectCurrencies()

  return (
    <Box>
      <PreTitle mb="8px">{t('Choose Token Pair')}</PreTitle>
      <AutoRow gap="24px">
        <AutoRow gap="8px">
          <PreTitle color="textSubtle">{t('TOKEN A')}</PreTitle>
          <FieldSelectCurrency
            selectedCurrency={baseCurrency as Currency | undefined}
            otherSelectedCurrency={quoteCurrency as Currency | undefined}
            onCurrencySelect={handleBaseCurrencySelect}
          />
        </AutoRow>
        <AutoRow gap="8px">
          <PreTitle color="textSubtle">{t('TOKEN B')}</PreTitle>
          <FieldSelectCurrency
            selectedCurrency={quoteCurrency as Currency | undefined}
            otherSelectedCurrency={baseCurrency as Currency | undefined}
            onCurrencySelect={handleQuoteCurrencySelect}
          />
        </AutoRow>
      </AutoRow>
    </Box>
  )
}
