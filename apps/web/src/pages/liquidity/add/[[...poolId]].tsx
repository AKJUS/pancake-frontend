import { useTranslation } from '@pancakeswap/localization'
import { Breadcrumbs, Container, FlexGap, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { LinkText } from 'components/Liquidity/LinkText'
import PageLoader from 'components/Loader/PageLoader'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PoolIdRoute } from 'dynamicRoute'
import { useInfinityPoolIdRouteParams, usePoolIdRoute } from 'hooks/dynamicRoute/usePoolIdRoute'
import dynamic from 'next/dynamic'
import NotFoundPage from 'pages/404'
import { NextPageWithLayout } from 'utils/page.types'
import { CHAIN_IDS } from 'utils/wagmi'
import { AddLiquidityInfinityForm } from 'views/AddLiquidityInfinity'
import { InfinityPoolInfoHeader } from 'views/AddLiquidityInfinity/components/InfinityPoolInfoHeader'

export type RouteType = typeof PoolIdRoute

const AddLiquiditySelectorPage = () => {
  const { t } = useTranslation()
  const { routeParams, routeError } = usePoolIdRoute()
  const { isLg } = useMatchBreakpoints()
  const { chainId, poolId } = useInfinityPoolIdRouteParams()

  if (routeError) {
    console.warn('AddLiquiditySelectorPage routeError', { routeError })
    return <NotFoundPage />
  }

  if (!routeParams || !chainId || !poolId) {
    return <PageLoader />
  }

  return (
    <Container mx="auto" my="24px" maxWidth="1200px">
      <Breadcrumbs>
        <NextLinkFromReactRouter to="/liquidity/pools">
          <LinkText>{t('Farms')}</LinkText>
        </NextLinkFromReactRouter>
        {chainId && poolId && (
          <NextLinkFromReactRouter to={`/liquidity/pool/${CHAIN_QUERY_NAME[chainId]}/${poolId}`}>
            <LinkText>{t('Pool Detail')}</LinkText>
          </NextLinkFromReactRouter>
        )}
        <FlexGap alignItems="center" gap="4px">
          <Text>{t('Add Liquidity')}</Text>
        </FlexGap>
      </Breadcrumbs>
      <FlexGap flexDirection="column" gap={isLg ? '24px' : '16px'} mt={['16px', '24px', '24px', '24px']}>
        <InfinityPoolInfoHeader poolId={poolId} chainId={chainId} />
        <AddLiquidityInfinityForm />
      </FlexGap>
    </Container>
  )
}

const Page = dynamic(() => Promise.resolve(AddLiquiditySelectorPage), {
  ssr: false,
}) as NextPageWithLayout

Page.screen = true
Page.chains = CHAIN_IDS

export default Page
