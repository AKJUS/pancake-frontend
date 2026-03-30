/**
 * Shared styled components used across universal farms components
 */
import styled from 'styled-components'
import { Flex, Text } from '@pancakeswap/uikit'

/**
 * Action panel container for position action buttons
 */
export const ActionPanelContainer = styled(Flex)<{ $detailMode?: boolean }>`
  flex-direction: row;
  gap: 8px;

  & button {
    flex: 1;
  }

  ${({ $detailMode }) =>
    $detailMode &&
    `
    /* Icon buttons in detail mode have fixed width/height */
    #sol-v3-remove-btn, #sol-v3-add-btn {
      width: 48px;
      height: 48px;
      flex: none;
    }
  `}
`

/**
 * Error message text for charts and components
 */
export const ErrorText = styled(Text)`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.failure};
  text-align: center;
  padding: 40px 0;
`

/**
 * Full range indicator text for charts
 */
export const FullRangeText = styled(Text)`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSubtle};
  text-align: center;
  padding: 40px 0;
`

/**
 * Styled list item with bullet point for APR tooltips
 */
export const StyledLi = styled.li`
  flex-wrap: nowrap;
  display: flex;
  gap: 5px;
  position: relative;
  padding-left: 22px;
  &::before {
    content: '';
    position: absolute;
    transform: translateY(-50%);
    top: 50%;
    border-radius: 50%;
    left: 0;
    width: 6px;
    height: 6px;
    background: ${({ theme }) => theme.colors.text};
  }
  & > a {
    cursor: pointer;
  }
`
