import { Currency } from '@pancakeswap/swap-sdk-core'
import { Box, Button } from '@pancakeswap/uikit'
import React, { memo, useCallback, useMemo } from 'react'

import { useTranslation } from '@pancakeswap/localization'
import { PriceOrder } from '@pancakeswap/price-api-sdk'
import { CommitButton } from 'components/CommitButton'
import { useCurrency } from 'hooks/Tokens'
import { useIsTransactionUnsupported } from 'hooks/Trades'
import { useRouter } from 'next/router'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import currencyId from 'utils/currencyId'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { useSwapCurrency } from '../../Swap/V3Swap/hooks/useSwapCurrency'
import { CommitButtonProps } from '../../Swap/V3Swap/types'

interface SwapCommitButtonPropsType {
  order?: PriceOrder
  tradeError?: Error | null
  tradeLoading?: boolean
}

const useSwapCurrencies = () => {
  const {
    [Field.INPUT]: { currencyId: inputCurrencyId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId },
  } = useSwapState()
  const inputCurrency = useCurrency(inputCurrencyId) as Currency
  const outputCurrency = useCurrency(outputCurrencyId) as Currency
  return { inputCurrency, outputCurrency }
}

const UnsupportedSwapButtonReplace = ({ children }) => {
  const { t } = useTranslation()
  const { inputCurrency, outputCurrency } = useSwapCurrencies()
  const swapIsUnsupported = useIsTransactionUnsupported(inputCurrency, outputCurrency)

  if (swapIsUnsupported) {
    return (
      <Button width="100%" disabled>
        {t('Unsupported Asset')}
      </Button>
    )
  }
  return children
}

const SwapCommitButtonComp: React.FC<SwapCommitButtonPropsType & CommitButtonProps> = (props) => {
  return (
    <UnsupportedSwapButtonReplace>
      <SwapCommitButtonInner {...props} />
    </UnsupportedSwapButtonReplace>
  )
}

export const SwapCommitButton = memo(SwapCommitButtonComp)

const SwapCommitButtonInner = memo(function SwapCommitButtonInner() {
  const { t } = useTranslation()
  // form data
  const { independentField, typedValue } = useSwapState()
  const [inputCurrency, outputCurrency] = useSwapCurrency()
  const { chainId } = useAccountActiveChain()
  const router = useRouter()

  const handleSwap = useCallback(() => {
    const [input, output] = [inputCurrency, outputCurrency].map((currency) => {
      try {
        return currencyId(currency)
      } catch {
        return undefined
      }
    })
    const searchParams = new URLSearchParams()
    searchParams.append('chain', CHAIN_QUERY_NAME[inputCurrency?.chainId ?? chainId])
    searchParams.append('chainOut', CHAIN_QUERY_NAME[outputCurrency?.chainId ?? chainId])
    if (input) searchParams.append('inputCurrency', input)
    if (output) searchParams.append('outputCurrency', output)
    searchParams.append('exactAmount', typedValue)
    searchParams.append('exactField', independentField)

    const url = `/swap?${searchParams.toString()}`

    if (!input || !output) {
      // Full page reload, needed when input/output is missing (potential list loading issue)
      if (typeof window !== 'undefined') {
        window.location.href = url
      }
    } else {
      router.push(url)
    }
  }, [chainId, inputCurrency, outputCurrency, typedValue, independentField, router])

  return (
    <Box mt="0.25rem">
      <CommitButton id="swap-button" width="100%" data-dd-action-name="Swap commit button" onClick={handleSwap}>
        {t('Get Started')}
      </CommitButton>
    </Box>
  )
})
