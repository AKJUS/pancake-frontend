import styled from 'styled-components'
import { Text } from '@pancakeswap/uikit'

export const LinkText = styled(Text)`
  color: ${({ theme }) => theme.colors.primary60};
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }
`
