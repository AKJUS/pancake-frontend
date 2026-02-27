import { AutoRow, Box, Button, Card, CardBody, Flex, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { NextLinkFromReactRouter } from '@pancakeswap/widgets-internal'
import { AppHeader } from 'components/App'
import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { NextPageWithLayout } from 'utils/page.types'

import { useRouter } from 'next/router'
import { styled } from 'styled-components'
import { CHAIN_IDS } from 'utils/wagmi'
import Page from 'views/Page'

import { useTranslation } from '@pancakeswap/localization'
import { CurrencyAmount, Percent } from '@pancakeswap/sdk'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { LightGreyCard } from 'components/Card'
import { CurrencyLogo } from 'components/Logo'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useTotalPriceUSD } from 'hooks/useTotalPriceUSD'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import { useAccount } from 'wagmi'
import { DISABLED_ADD_LIQUIDITY_CHAINS } from 'config/constants/liquidity'
import { useCurrenciesByHookAddress } from 'hooks/infinity/useCurrenciesByHookAddress'
import { useCurrency } from 'hooks/Tokens'
import { usePoolBalances, useTotalSupply, useUserLPBalance } from 'views/StableInfinity/hooks/useCalcTokenAmount'
import { usePoolInfo } from 'state/farmsV4/hooks'

export const BodyWrapper = styled(Card)`
  border-radius: 24px;
  max-width: 858px;
  width: 100%;
  z-index: 1;
`

function InfinityStableLiquidity() {
  const {
    t,
    currentLanguage: { locale },
  } = useTranslation()

  const router = useRouter()

  const { address: account } = useAccount()

  const hookAddress = router.query.hookAddress as `0x${string}` | undefined

  const { chainId } = useActiveChainId()

  // Get currencies from hook address
  const { data: currencies } = useCurrenciesByHookAddress(hookAddress, chainId)

  // Get pool info for APR and metadata
  const poolInfo = usePoolInfo({ poolAddress: hookAddress as `0x${string}`, chainId })

  // Get currencies
  const currency0 = useCurrency(currencies?.currency0)
  const currency1 = useCurrency(currencies?.currency1)

  // Pool address is the hook address for Infinity Stable
  const poolAddress = hookAddress ?? ''

  // Get pool balances (reserves)
  const [balance0, balance1] = usePoolBalances({ poolAddress })

  // Get total supply
  const totalSupply = useTotalSupply({ poolAddress })

  // Get user's LP balance
  const userLPBalance = useUserLPBalance({ poolAddress, account })

  // Calculate user's token amounts based on LP balance and pool reserves
  const [token0Deposited, token1Deposited] = useMemo(() => {
    if (!userLPBalance || !balance0 || !balance1 || !totalSupply || totalSupply === 0n) {
      return [undefined, undefined]
    }
    const amount0 = (userLPBalance * balance0) / totalSupply
    const amount1 = (userLPBalance * balance1) / totalSupply

    const token0Amount = currency0 ? CurrencyAmount.fromRawAmount(currency0, amount0) : undefined
    const token1Amount = currency1 ? CurrencyAmount.fromRawAmount(currency1, amount1) : undefined

    return [token0Amount, token1Amount]
  }, [userLPBalance, balance0, balance1, totalSupply, currency0, currency1])

  // Pool reserves as CurrencyAmount
  const reserve0 = useMemo(() => {
    return currency0 && balance0 ? CurrencyAmount.fromRawAmount(currency0, balance0) : undefined
  }, [currency0, balance0])

  const reserve1 = useMemo(() => {
    return currency1 && balance1 ? CurrencyAmount.fromRawAmount(currency1, balance1) : undefined
  }, [currency1, balance1])

  // Calculate USD values
  const totalUSDValue = useTotalPriceUSD({
    currency0,
    currency1,
    amount0: token0Deposited,
    amount1: token1Deposited,
  })

  const totalLiquidityUSD = useTotalPriceUSD({
    currency0,
    currency1,
    amount0: reserve0,
    amount1: reserve1,
  })

  // Calculate pool token percentage
  const poolTokenPercentage = useMemo(() => {
    if (!userLPBalance || !totalSupply || totalSupply === 0n) return undefined
    return new Percent(userLPBalance, totalSupply)
  }, [userLPBalance, totalSupply])

  const { isMobile } = useMatchBreakpoints()

  if (!currencies || !currency0 || !currency1) return null

  return (
    <Page>
      <BodyWrapper>
        <AppHeader
          title={`${currency0.symbol}-${currency1.symbol} LP`}
          backTo="/liquidity/positions"
          noConfig
          buttons={
            !isMobile && (
              <>
                <NextLinkFromReactRouter to={`/infinityStable/add/${hookAddress}`}>
                  <Button width="100%" disabled={!!DISABLED_ADD_LIQUIDITY_CHAINS[chainId]}>
                    {t('Add')}
                  </Button>
                </NextLinkFromReactRouter>
                <NextLinkFromReactRouter to={`/infinityStable/remove/${hookAddress}`}>
                  <Button ml="16px" variant="secondary" width="100%">
                    {t('Remove')}
                  </Button>
                </NextLinkFromReactRouter>
              </>
            )
          }
        />
        <CardBody>
          {isMobile && (
            <>
              <NextLinkFromReactRouter to={`/infinityStable/add/${hookAddress}`}>
                <Button mb="8px" width="100%" disabled={!!DISABLED_ADD_LIQUIDITY_CHAINS[chainId]}>
                  {t('Add')}
                </Button>
              </NextLinkFromReactRouter>
              <NextLinkFromReactRouter to={`/infinityStable/remove/${hookAddress}`}>
                <Button mb="8px" variant="secondary" width="100%">
                  {t('Remove')}
                </Button>
              </NextLinkFromReactRouter>
            </>
          )}
          <AutoRow style={{ gap: 4 }}>
            <Flex
              alignItems="center"
              justifyContent="space-between"
              style={{ gap: 4 }}
              width="100%"
              flexWrap={['wrap', 'wrap', 'nowrap']}
            >
              <Box width="100%">
                <Text fontSize="12px" color="secondary" bold textTransform="uppercase">
                  {t('Liquidity')}
                </Text>
                <Text fontSize="24px" fontWeight={600}>
                  {totalUSDValue ? formatFiatNumber(totalUSDValue) : '-'}
                </Text>
                <LightGreyCard mr="4px">
                  <AutoRow justifyContent="space-between" mb="8px">
                    <Flex>
                      <CurrencyLogo currency={currency0} />
                      <Text small color="textSubtle" id="remove-liquidity-tokena-symbol" ml="4px">
                        {currency0.symbol}
                      </Text>
                    </Flex>
                    <Flex justifyContent="center">
                      <Text mr="4px">{formatCurrencyAmount(token0Deposited, 4, locale)}</Text>
                    </Flex>
                  </AutoRow>
                  <AutoRow justifyContent="space-between" mb="8px">
                    <Flex>
                      <CurrencyLogo currency={currency1} />
                      <Text small color="textSubtle" id="remove-liquidity-tokenb-symbol" ml="4px">
                        {currency1.symbol}
                      </Text>
                    </Flex>
                    <Flex justifyContent="center">
                      <Text mr="4px">{formatCurrencyAmount(token1Deposited, 4, locale)}</Text>
                    </Flex>
                  </AutoRow>
                </LightGreyCard>
              </Box>
              <Box width="100%">
                <Text fontSize="12px" color="secondary" bold textTransform="uppercase">
                  {t('Pool reserves')}
                </Text>
                <Text fontSize="24px" fontWeight={600}>
                  {totalLiquidityUSD ? formatFiatNumber(totalLiquidityUSD) : '-'}
                </Text>
                <LightGreyCard mr="4px">
                  <AutoRow justifyContent="space-between" mb="8px">
                    <Flex>
                      <CurrencyLogo currency={currency0} />
                      <Text small color="textSubtle" id="remove-liquidity-tokena-symbol" ml="4px">
                        {currency0.symbol}
                      </Text>
                    </Flex>
                    <Flex justifyContent="center">
                      <Text mr="4px">{formatCurrencyAmount(reserve0, 4, locale)}</Text>
                    </Flex>
                  </AutoRow>
                  <AutoRow justifyContent="space-between" mb="8px">
                    <Flex>
                      <CurrencyLogo currency={currency1} />
                      <Text small color="textSubtle" id="remove-liquidity-tokenb-symbol" ml="4px">
                        {currency1.symbol}
                      </Text>
                    </Flex>
                    <Flex justifyContent="center">
                      <Text mr="4px">{formatCurrencyAmount(reserve1, 4, locale)}</Text>
                    </Flex>
                  </AutoRow>
                </LightGreyCard>
              </Box>
            </Flex>
            <Flex flexDirection={isMobile ? 'column' : 'row'} justifyContent="flex-end" width="100%" style={{ gap: 4 }}>
              <Flex
                flexDirection="column"
                alignItems={isMobile ? 'flex-start' : 'flex-end'}
                justifyContent="center"
                mr="4px"
                style={{ gap: 4 }}
              >
                <Text color="textSubtle" ml="4px">
                  {t('Your share in pool')}: {poolTokenPercentage ? `${poolTokenPercentage.toSignificant(6)}%` : '-'}
                </Text>
              </Flex>
            </Flex>
          </AutoRow>
        </CardBody>
      </BodyWrapper>
    </Page>
  )
}

const InfinityStableLiquidityPage = dynamic(() => Promise.resolve(InfinityStableLiquidity), {
  ssr: false,
}) as NextPageWithLayout

InfinityStableLiquidityPage.chains = CHAIN_IDS

export default InfinityStableLiquidityPage
