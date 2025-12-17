import { ChainId } from '@pancakeswap/chains'
import { memo, useMemo } from 'react'
import { Box, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import styled from 'styled-components'
import { useTranslation } from '@pancakeswap/localization'

import { getFullChainNameById } from 'utils/getFullChainNameById'
import { getChainBasedImageUrl } from '../helpers'

const BACKGROUND = {
  [ChainId.BSC]: '#D8A70A',
  [ChainId.BSC_TESTNET]: '#D8A70A',
  [ChainId.ETHEREUM]: '#627AD8',
  [ChainId.GOERLI]: '#627AD8',
  [ChainId.ARBITRUM_ONE]: '#2D364D',
  [ChainId.MONAD_MAINNET]: '#6954F6',
}

const Container = styled(Box)`
  width: 100%;
`

const Tag = styled(Box)<{ $isHistory?: boolean }>`
  position: absolute;
  top: 0;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  padding: 0.25rem 0.75rem;
  border-radius: 2.75rem;

  z-index: 2;

  ${({ $isHistory }) =>
    $isHistory &&
    `
    transform: translate(-50%, 170%);
  `}

  ${({ theme }) => theme.mediaQueries.sm} {
    top: 2rem;
    right: 1.625rem;
    transform: translateX(100%);
  }
`

type Props = {
  chainId?: ChainId
  isHistory?: boolean
}

export const IfoChainBoard = memo(function IfoChainBoard({ chainId, isHistory = false }: Props) {
  const { isMobile } = useMatchBreakpoints()
  const { t } = useTranslation()
  const boardImageUrl = useMemo(() => getChainBasedImageUrl({ chainId, name: 'chain-board' }), [chainId])

  const chainName = getFullChainNameById(chainId)

  if (!chainId) {
    return null
  }

  return (
    <Container>
      {!isMobile && (
        <img
          alt={`chain-${chainId}`}
          src={boardImageUrl}
          width={chainId === ChainId.MONAD_MAINNET ? 70 : 100}
          height={85}
        />
      )}

      <Tag background={BACKGROUND[chainId]} $isHistory={isHistory}>
        <Text fontSize="0.875rem" bold color="white">
          {t('On %chainName%', { chainName })}
        </Text>
      </Tag>
    </Container>
  )
})
