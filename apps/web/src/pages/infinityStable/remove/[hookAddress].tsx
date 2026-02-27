import { useTranslation } from '@pancakeswap/localization'
import { Box, Text, Breadcrumbs, FlexGap, Container, SkeletonV2, useMatchBreakpoints } from '@pancakeswap/uikit'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { LinkText } from 'components/Liquidity/LinkText'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { useCurrenciesByHookAddress } from 'hooks/infinity/useCurrenciesByHookAddress'
import { useActiveChainId } from 'hooks/useActiveChainId'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { NextPageWithLayout } from 'utils/page.types'
import { CHAIN_IDS } from 'utils/wagmi'
import RemoveLiquidityV2FormProvider from 'views/RemoveLiquidity/RemoveLiquidityV2FormProvider'
import { StableInfinityPoolInfoHeader } from 'views/AddLiquidityInfinity/components/InfinityPoolInfoHeader'
import InfinityStableRemoveLiquidityProvider from 'views/StableInfinity/components/InfinityStableRemoveLiquidityProvider'

const RemoveLiquidityInfinityStablePage = () => {
  const router = useRouter()
  const { chainId } = useActiveChainId()
  const hookAddress = router.query.hookAddress as `0x${string}` | undefined
  const { isLg } = useMatchBreakpoints()
  const { t } = useTranslation()

  const { data: currencies } = useCurrenciesByHookAddress(hookAddress, chainId)

  const currencyIdA = currencies?.currency0
  const currencyIdB = currencies?.currency1

  return (
    <RemoveLiquidityV2FormProvider>
      <Container mx="auto" my="24px" maxWidth="1200px">
        <Box mb="24px">
          <Breadcrumbs>
            <NextLinkFromReactRouter to="/liquidity/pools">
              <LinkText>{t('Farms')}</LinkText>
            </NextLinkFromReactRouter>
            {chainId && hookAddress && (
              <NextLinkFromReactRouter to={`/liquidity/pool/${CHAIN_QUERY_NAME[chainId]}/${hookAddress}`}>
                <LinkText>{t('Pool Detail')}</LinkText>
              </NextLinkFromReactRouter>
            )}
            <FlexGap alignItems="center" gap="4px">
              <Text>{t('Remove Liquidity')}</Text>
            </FlexGap>
          </Breadcrumbs>
        </Box>
        <FlexGap flexDirection="column" gap={isLg ? '24px' : '16px'} mt={['16px', '24px', '24px', '24px']}>
          <SkeletonV2 isDataReady={Boolean(hookAddress && chainId)}>
            <StableInfinityPoolInfoHeader hookAddress={hookAddress as `0x${string}`} chainId={chainId} />
          </SkeletonV2>
          <SkeletonV2 isDataReady={Boolean(hookAddress && currencyIdA && currencyIdB)}>
            <InfinityStableRemoveLiquidityProvider
              currencyId0={currencyIdA as `0x${string}`}
              currencyId1={currencyIdB as `0x${string}`}
              hookAddress={hookAddress as `0x${string}`}
            />
          </SkeletonV2>
        </FlexGap>
      </Container>
    </RemoveLiquidityV2FormProvider>
  )
}

const Page = dynamic(() => Promise.resolve(RemoveLiquidityInfinityStablePage), {
  ssr: false,
}) as NextPageWithLayout

Page.chains = CHAIN_IDS

export default Page
