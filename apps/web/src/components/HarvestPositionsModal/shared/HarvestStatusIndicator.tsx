import { Box, CheckmarkCircleFillIcon, ErrorFillIcon, SwapLoading } from '@pancakeswap/uikit'
import styled from 'styled-components'
import { HarvestTxStatus } from '../state/atoms'

const PendingBox = styled(Box)`
  padding: 2px;
  background-color: ${({ theme }) => theme.colors.secondary};
  border-radius: 50%;
`

const StyledSwapLoading = styled(SwapLoading)`
  filter: grayscale(1) brightness(2);
`

export function HarvestStatusIndicator({ status }: { status?: HarvestTxStatus }) {
  if (status === HarvestTxStatus.Success) {
    return <CheckmarkCircleFillIcon width="24px" color="positive60" />
  }

  if (status === HarvestTxStatus.Failed) {
    return <ErrorFillIcon width="24px" color="failure" />
  }

  if (status === HarvestTxStatus.Pending) {
    return (
      <PendingBox>
        <StyledSwapLoading size={16} />
      </PendingBox>
    )
  }

  return null
}
