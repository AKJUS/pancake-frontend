import { Text, TriangleDownIcon, TriangleUpIcon, useMatchBreakpoints } from '@pancakeswap/uikit'
import { HomePageToken } from 'edge/home/types'
import styled from 'styled-components'

const getFontSize = (isMobile: boolean, isTablet: boolean) => {
  if (isMobile) return '12px'
  if (isTablet) return '14px'
  return '16px'
}

const Percent = styled(Text)<{ isMobile?: boolean; isTablet?: boolean }>`
  font-family: Kanit;
  font-weight: 600;
  font-size: ${({ isMobile, isTablet }) => getFontSize(Boolean(isMobile), Boolean(isTablet))};
  line-height: 21px;
  letter-spacing: 0%;
  color: ${({ theme }) => theme.colors.textSubtle};
  display: flex;
  align-items: center;
  justify-content: center;
`

export const HomepagePriceChange = ({ token }: { token: HomePageToken }) => {
  const { isMobile, isTablet } = useMatchBreakpoints()
  return (
    <Percent isMobile={isMobile} isTablet={isTablet} ml="2px">
      {token.percent > 0 && <TriangleUpIcon />}
      {token.percent < 0 && <TriangleDownIcon />}
      {token.percent.toFixed(2)}%
    </Percent>
  )
}
