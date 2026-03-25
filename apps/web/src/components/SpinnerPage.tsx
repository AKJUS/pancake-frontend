import { Box, Spinner } from '@pancakeswap/uikit'
import styled from 'styled-components'

const FullScreenBox = styled(Box)`
  width: 100%;
  height: 50vh;
  display: flex;
  align-items: center;
  justify-content: center;
`

export const SpinnerPage = () => {
  return (
    <FullScreenBox>
      <Spinner />
    </FullScreenBox>
  )
}
