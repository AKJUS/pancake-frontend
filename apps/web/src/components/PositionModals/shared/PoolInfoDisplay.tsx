import { Currency } from '@pancakeswap/swap-sdk-core'
import { unwrappedToken } from '@pancakeswap/tokens'
import { Box, FlexGap, Text } from '@pancakeswap/uikit'
import { DoubleCurrencyLogo } from '@pancakeswap/widgets-internal'
import React from 'react'

interface PoolInfoDisplayProps {
  currency0: Currency
  currency1: Currency

  feeTierDisplay?: React.ReactNode
  rangeTags?: React.ReactNode
  aprDisplay?: React.ReactNode
}
export function PoolInfoDisplay({ currency0, currency1, feeTierDisplay, rangeTags, aprDisplay }: PoolInfoDisplayProps) {
  const displayCurrency0 = currency0.isToken ? unwrappedToken(currency0) ?? currency0 : currency0
  const displayCurrency1 = currency1.isToken ? unwrappedToken(currency1) ?? currency1 : currency1

  return (
    <Box>
      <FlexGap gap="8px" alignItems="center">
        <DoubleCurrencyLogo
          currency0={displayCurrency0}
          currency1={displayCurrency1}
          showChainLogoCurrency1
          size={34}
          innerMargin="-8px"
        />
        <FlexGap gap="2px" alignItems="center" mb="1px">
          <Text fontSize="20px" bold>
            {displayCurrency0.symbol}
          </Text>
          <Text fontSize="20px" color="textSubtle" bold>
            /
          </Text>
          <Text fontSize="20px" bold>
            {displayCurrency1.symbol}
          </Text>
        </FlexGap>
        <Box>{feeTierDisplay}</Box>
      </FlexGap>
      <FlexGap mt="8px" gap="4px" alignItems="center">
        {rangeTags} {aprDisplay}
      </FlexGap>
    </Box>
  )
}
