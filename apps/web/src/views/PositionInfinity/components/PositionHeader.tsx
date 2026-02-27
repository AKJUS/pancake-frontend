import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { Button, FlexGap, Grid, useMatchBreakpoints } from '@pancakeswap/uikit'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { $path } from 'next-typesafe-url'
import { PropsWithChildren, useMemo } from 'react'
import { Hex } from 'viem'
import { LiquidityDetailHeaderProps, LiquidityTitle } from 'views/PositionDetails/components/PositionTitle'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { StyledCardHeader } from '../style'

type PositionHeaderProps = LiquidityDetailHeaderProps & {
  poolId?: Hex | undefined
  isOwner?: boolean
}

const FlexContainer: React.FC<PropsWithChildren> = ({ children }) => {
  const { isMobile } = useMatchBreakpoints()
  return isMobile ? (
    <Grid style={{ gap: '8px' }} mt="16px" gridTemplateColumns="1fr 1fr">
      {children}
    </Grid>
  ) : (
    <FlexGap gap="8px">{children}</FlexGap>
  )
}

export const PositionHeader: React.FC<PositionHeaderProps> = ({
  protocol,
  chainId,
  isRemoved,
  poolId,
  tokenId,
  isOwner = true,
  ...props
}) => {
  const { t } = useTranslation()

  const addPath = useMemo(() => {
    if (!poolId) return ''
    if (protocol === Protocol.InfinityBIN) {
      return $path({
        route: '/liquidity/add/[[...poolId]]',
        routeParams: {
          poolId: [chainId, 'infinity', poolId],
        },
        // @ts-ignore
        searchParams: {
          chain: CHAIN_QUERY_NAME[chainId],
          [PERSIST_CHAIN_KEY]: 1,
        },
      })
    }

    if ((protocol === Protocol.InfinityCLAMM || protocol === Protocol.InfinitySTABLE) && tokenId) {
      return $path({
        route: '/liquidity/position/[[...positionId]]',
        routeParams: {
          positionId: [Protocol.InfinityCLAMM, Number(tokenId), 'increase'],
        },
        // @ts-ignore
        searchParams: {
          chain: CHAIN_QUERY_NAME[chainId],
          [PERSIST_CHAIN_KEY]: 1,
        },
      })
    }
    return ''
  }, [chainId, poolId, protocol, tokenId])

  const removePath = useMemo(() => {
    if (!poolId) return ''
    if (protocol === Protocol.InfinityBIN) {
      return $path({
        route: '/liquidity/position/[[...positionId]]',
        routeParams: {
          positionId: [Protocol.InfinityBIN, poolId, 'decrease'],
        },
        // @ts-ignore
        searchParams: {
          chain: CHAIN_QUERY_NAME[chainId],
          [PERSIST_CHAIN_KEY]: 1,
        },
      })
    }
    if ((protocol === Protocol.InfinityCLAMM || protocol === Protocol.InfinitySTABLE) && tokenId) {
      return $path({
        route: '/liquidity/position/[[...positionId]]',
        routeParams: {
          positionId: [Protocol.InfinityCLAMM, Number(tokenId), 'decrease'],
        },
        // @ts-ignore
        searchParams: {
          chain: CHAIN_QUERY_NAME[chainId],
          [PERSIST_CHAIN_KEY]: 1,
        },
      })
    }
    return ''
  }, [poolId, protocol, tokenId, chainId])

  return (
    <StyledCardHeader variant="pale">
      <LiquidityTitle
        poolId={poolId}
        isRemoved={isRemoved}
        protocol={protocol}
        chainId={chainId}
        tokenId={tokenId}
        {...props}
      />
      <FlexContainer>
        <NextLinkFromReactRouter to={addPath}>
          <Button width="100%" disabled={!isOwner}>
            {t('Add')}
          </Button>
        </NextLinkFromReactRouter>
        {!isRemoved ? (
          <NextLinkFromReactRouter to={removePath}>
            <Button variant="secondary" width="100%" disabled={!isOwner}>
              {t('Remove')}
            </Button>
          </NextLinkFromReactRouter>
        ) : null}
      </FlexContainer>
    </StyledCardHeader>
  )
}
