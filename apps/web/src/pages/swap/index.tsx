import { Box, Skeleton, useMatchBreakpoints } from '@pancakeswap/uikit'
import dynamic from 'next/dynamic'
import styled from 'styled-components'
import { NextPageWithLayout } from 'utils/page.types'
import { CHAIN_IDS } from 'utils/wagmi'
import SwapLayout from 'views/Swap/SwapLayout'
import SwapSimplify from 'views/SwapSimplify'
import { useWallets } from '@privy-io/react-auth'

const StyledSkeleton = styled(Skeleton)`
  background: ${({ theme }) => theme.colors.backgroundBubblegum};
  opacity: 0.1;
`
const BgBox = styled(Box)`
  background: ${({ theme }) => theme.colors.backgroundBubblegum};
`
const Container = styled.div<{ isMobile: boolean }>`
  min-height: ${({ isMobile }) => (isMobile ? '100vh' : '100%')};
  background: ${({ theme }) => theme.colors.backgroundBubblegum};
`
const SwapFallback = () => {
  const { isMobile } = useMatchBreakpoints()

  return (
    <BgBox
      style={{
        minHeight: isMobile ? '100vh' : '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <StyledSkeleton
        variant="rect"
        animation="waves"
        style={{
          minHeight: isMobile ? '100vh' : '100%',
        }}
      />
    </BgBox>
  )
}

const View = () => {
  const { isMobile } = useMatchBreakpoints()
  const { wallets } = useWallets()
  console.info(wallets, 'wallets')
  return (
    <SwapLayout>
      <Container isMobile={isMobile}>
        <SwapSimplify />
      </Container>
    </SwapLayout>
  )
}

const SwapPage = dynamic(() => Promise.resolve(View), {
  ssr: false,
  loading: () => <SwapFallback />,
}) as NextPageWithLayout

SwapPage.chains = CHAIN_IDS
SwapPage.screen = true

export default SwapPage
