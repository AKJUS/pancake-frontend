import { FlexGap } from '@pancakeswap/uikit'
import styled from 'styled-components'

export const VerticalList = styled(FlexGap)<{ $maxHeight?: string }>`
  flex-direction: column;
  max-height: ${({ $maxHeight }) => $maxHeight ?? '200px'};
  overflow-y: auto;
  padding-right: 8px;
`
