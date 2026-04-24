import { Flex, Text, TriangleDownIcon, TriangleUpIcon } from '@pancakeswap/uikit'
import React from 'react'
import styled from 'styled-components'

interface PnLTagProps {
  priceChangePercent: number
  size?: 'sm' | 'md'
  className?: string
}

const Wrapper = styled(Flex)<{ $isPositive: boolean }>`
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 0 6px;
  border-radius: 999px;
  background: ${({ theme, $isPositive }) => ($isPositive ? theme.colors.positive10 : theme.colors.destructive10)};
  svg {
    width: 12px;
    height: 12px;
  }
`

export const PnLTag: React.FC<PnLTagProps> = ({ priceChangePercent, size = 'md', className }) => {
  const isPositive = priceChangePercent >= 0
  const fontSize = size === 'sm' ? '14px' : '16px'
  const Icon = isPositive ? TriangleUpIcon : TriangleDownIcon
  return (
    <Wrapper $isPositive={isPositive} className={className}>
      <Icon />
      <Text fontSize={fontSize} color="text" lineHeight={1.5}>
        {Math.abs(priceChangePercent).toFixed(2)}%
      </Text>
    </Wrapper>
  )
}

export default PnLTag
