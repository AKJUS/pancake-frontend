import { Box, Column, Flex, useMatchBreakpoints, useTooltip, TokenLogo } from '@pancakeswap/uikit'
import { getCurrencyLogoSrcs, TokenPairLogo } from 'components/TokenImage'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { useRouter } from 'next/router'
import React, { PropsWithChildren, useCallback, useMemo } from 'react'
import styled from 'styled-components'
import { addQueryToPath } from 'utils/addQueryToPath'
import { useTranslation } from '@pancakeswap/localization'
import { NonEVMChainId } from '@pancakeswap/chains'
import { UnifiedCurrency } from '@pancakeswap/sdk'
import { SolanaV3PoolInfo } from 'state/farmsV4/state/type'
import { AddressChip } from './AddressChip'
import { Container } from './styled'
import { PositionItemSkeleton } from './PositionItemSkeleton'
import { PositionInfo, PositionInfoProps } from './PositionInfo'

type PositionItemProps = PositionInfoProps

const SolanaPoolAddressTooltip: React.FC<{
  chainId: number
  currency0: UnifiedCurrency | undefined
  currency1: UnifiedCurrency | undefined
  poolId: string | undefined
}> = ({ chainId, currency0, currency1, poolId }) => {
  const { t } = useTranslation()

  if (!currency0 || !currency1 || chainId !== NonEVMChainId.SOLANA || !poolId) {
    return null
  }
  return (
    <Box>
      <AddressChip address={poolId} label={`${t('Pool id')}:`} mb="2" textProps={{ fontSize: 'xs', ml: '2px' }} />
      <AddressChip
        address={currency0.wrapped.address}
        label={
          <TokenLogo
            srcs={getCurrencyLogoSrcs(currency0)}
            sizes="xs"
            width={16}
            height={16}
            style={{ borderRadius: '50%' }}
          />
        }
        textProps={{ fontSize: 'xs' }}
      />
      <AddressChip
        address={currency1.wrapped.address}
        label={
          <TokenLogo
            srcs={getCurrencyLogoSrcs(currency1)}
            sizes="xs"
            width={16}
            height={16}
            style={{ borderRadius: '50%' }}
          />
        }
        textProps={{ fontSize: 'xs' }}
      />
    </Box>
  )
}

export const PositionItem: React.FC<PropsWithChildren<PositionItemProps>> = (props) => {
  const { isDesktop } = useMatchBreakpoints()
  const { link, currency0, currency1, chainId, children, miniMode = !isDesktop } = props
  const showTooltip = Boolean(
    currency0 && currency1 && chainId === NonEVMChainId.SOLANA && (props.pool as SolanaV3PoolInfo)?.poolId,
  )
  const { targetRef, tooltip, tooltipVisible } = useTooltip(
    showTooltip ? (
      <SolanaPoolAddressTooltip
        chainId={chainId}
        currency0={currency0}
        currency1={currency1}
        poolId={(props.pool as SolanaV3PoolInfo)?.poolId}
      />
    ) : null,
  )

  const router = useRouter()
  const linkWithChain = useMemo(
    () =>
      link && (!link.startsWith('http') || !link.startsWith('//'))
        ? addQueryToPath(link, {
            chain: CHAIN_QUERY_NAME[chainId],
            [PERSIST_CHAIN_KEY]: '1',
          })
        : link,
    [link, chainId],
  )
  const handleItemClick = useCallback(() => {
    if (!linkWithChain) {
      return
    }
    if (linkWithChain.startsWith('http') || linkWithChain.startsWith('//')) {
      window.open(linkWithChain, '_blank', 'noreferrer')
      return
    }
    router.push(linkWithChain)
  }, [router, linkWithChain])

  if (!(currency0 && currency1)) {
    return <PositionItemSkeleton />
  }

  const content = (
    <Container $withLink={Boolean(linkWithChain)}>
      {!miniMode && (
        <TokenPairLogo
          ref={showTooltip ? targetRef : undefined}
          width={48}
          height={48}
          variant="inverted"
          primaryToken={currency0}
          secondaryToken={currency1}
          withChainLogo
        />
      )}
      {showTooltip && tooltipVisible && tooltip}
      <DetailsContainer>
        <Column gap="8px">
          <PositionInfo {...props} />
        </Column>
        <Column justifyContent="flex-end">{children}</Column>
      </DetailsContainer>
    </Container>
  )

  if (!linkWithChain) {
    return content
  }
  return (
    <div
      onClick={handleItemClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleItemClick()
        }
      }}
    >
      {content}
    </div>
  )
}

const DetailsContainer = styled(Flex)`
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  gap: 8px;
  color: ${({ theme }) => theme.colors.textSubtle};

  ${({ theme }) => theme.mediaQueries.md} {
    flex-direction: row;
  }
`
