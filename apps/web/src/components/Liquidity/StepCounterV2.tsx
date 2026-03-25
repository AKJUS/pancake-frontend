import { useTranslation } from '@pancakeswap/localization'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { AddCircleIcon, AutoColumn, AutoRow, IconButton, RemoveIcon, Text } from '@pancakeswap/uikit'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import { Card, LightCardProps, NumericalInput } from '@pancakeswap/widgets-internal'
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

type StepCounterV2Props<TPrice = string | undefined> = {
  value: TPrice
  onUserInput: (value: TPrice) => void
  decrement: () => void
  increment: () => void
  decrementDisabled?: boolean
  incrementDisabled?: boolean
  feeAmount?: FeeAmount
  label?: string
  width?: string
  locked?: boolean // disable input
  title: ReactNode
  baseCurrency: Currency | undefined | null
  quoteCurrency: Currency | undefined | null
  parsePrice?: (localPrice: string) => TPrice
  error?: boolean
} & Omit<LightCardProps, 'title'>

const StepCounterCard = styled(Card).withConfig({
  shouldForwardProp: (props) => !['error'].includes(props),
})<{
  error?: boolean
}>`
  box-shadow: ${({ theme, error }) => (error ? theme.shadows.danger : 'none')};
  background-color: ${({ theme }) => theme.colors.input};
  border: 1px solid ${({ theme, error }) => (error ? theme.colors.failure : theme.colors.inputSecondary)};

  display: flex;
  align-items: center;
`

export const StepCounterV2 = ({
  value,
  decrement,
  increment,
  decrementDisabled = false,
  incrementDisabled = false,
  locked,
  onUserInput,
  title,
  baseCurrency,
  quoteCurrency,
  parsePrice,
  error,
  ...props
}: StepCounterV2Props) => {
  const { t } = useTranslation()
  //  for focus state, styled components doesn't let you select input parent container
  const [, setActive] = useState(false)

  const isButtonClick = useRef(false)

  // let user type value and only update parent value on blur
  const [localValue, setLocalValue] = useState('')
  const [useLocalValue, setUseLocalValue] = useState(false)

  const handleOnFocus = useCallback(() => {
    setUseLocalValue(true)
    setActive(true)
  }, [])

  const handleOnBlur = useCallback(() => {
    setActive(false)
    if (isButtonClick.current) {
      isButtonClick.current = false
      return
    }
    setUseLocalValue(false)
    onUserInput(parsePrice ? parsePrice(localValue) : localValue)
  }, [localValue, onUserInput, parsePrice])

  // for button clicks
  const handleDecrement = useCallback(() => {
    isButtonClick.current = true
    setUseLocalValue(false)
    decrement()
  }, [decrement])

  const handleIncrement = useCallback(() => {
    isButtonClick.current = true
    setUseLocalValue(false)
    increment()
  }, [increment])

  useEffect(() => {
    if (localValue !== value && !useLocalValue) {
      setTimeout(() => {
        setLocalValue(value ?? '') // reset local value to match parent
      }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLocalValue, value])

  return (
    <StepCounterCard error={error} padding="0" {...props}>
      <AutoColumn py="12px" textAlign="center" gap="4px" width="100%" onFocus={handleOnFocus} onBlur={handleOnBlur}>
        {title}
        <AutoRow>
          {!locked && (
            <IconButton
              onClick={handleDecrement}
              disabled={decrementDisabled}
              scale="xs"
              variant="text"
              ml="10px"
              style={{ width: 20, padding: 16 }}
            >
              <RemoveIcon color="primary60" width={20} height={20} />
            </IconButton>
          )}
          <NumericalInput
            maxDecimals={9}
            value={localValue}
            fontSize="20px"
            align="center"
            disabled={locked}
            onUserInput={setLocalValue}
            style={{ fontWeight: 600, fontSize: '20px' }}
          />
          {!locked && (
            <IconButton
              onClick={handleIncrement}
              disabled={incrementDisabled}
              scale="xs"
              variant="text"
              mr="10px"
              style={{ width: 20, padding: 16 }}
            >
              <AddCircleIcon color="primary60" width={20} height={20} />
            </IconButton>
          )}
        </AutoRow>
        {baseCurrency && quoteCurrency && (
          <Text color="textSubtle" small>
            {t('%assetA% = 1 %assetB%', { assetA: quoteCurrency?.symbol, assetB: baseCurrency?.symbol })}
          </Text>
        )}
      </AutoColumn>
    </StepCounterCard>
  )
}
