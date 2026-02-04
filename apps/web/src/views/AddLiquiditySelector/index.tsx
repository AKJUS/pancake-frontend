import { useTranslation } from '@pancakeswap/localization'
import { Token, UnifiedCurrency } from '@pancakeswap/swap-sdk-core'
import {
  AddIcon,
  Button,
  ButtonMenu,
  ButtonMenuItem,
  Card,
  CardBody,
  FlexGap,
  PreTitle,
  useMatchBreakpoints,
} from '@pancakeswap/uikit'
import { PoolTypeFilter, getCurrencyAddress } from '@pancakeswap/widgets-internal'
import { NetworkSelector } from 'components/NetworkSelector'
import { CommonBasesType } from 'components/SearchModal/types'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { useUnifiedCurrency } from 'hooks/Tokens'
import NextLink from 'next/link'
import { useCallback, useEffect, useMemo } from 'react'
import styled from 'styled-components'
import currencyId from 'utils/currencyId'
import { TokenFilterContainer } from 'views/AddLiquidityInfinity/components/styles'
import { usePoolTypes } from 'views/universalFarms/hooks'
import { Chain } from '@pancakeswap/chains'

import { INFINITY_SUPPORTED_CHAINS } from '@pancakeswap/infinity-sdk'
import { CurrencySelectV2 } from 'components/CurrencySelectV2'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { useStableSwapSupportedTokens } from 'hooks/useStableSwapSupportedTokens'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { COMPACT_LIQUIDITY_TYPES, LIQUIDITY_TYPES, LiquidityType } from 'utils/types'
import { bscTokens } from '@pancakeswap/tokens'
import { isStableSwapSupported } from '@pancakeswap/stable-swap-sdk'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { usePoolTypeQuery } from './hooks/usePoolTypeQuery'

const StyledCard = styled(Card)`
  width: 100%;
  max-width: 432px;
`

const StyledButtonMenuItem = styled(ButtonMenuItem)`
  height: 38px;
  text-transform: capitalize;
`

export const AddLiquiditySelector = () => {
  /// Hooks
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  const poolTypesTree = usePoolTypes()
  const { poolType, setPoolType, poolTypeQuery } = usePoolTypeQuery()

  const { chainId, protocol, currencyIdA, currencyIdB, updateParams } = useSelectIdRouteParams()
  const queryChainName = chainId && CHAIN_QUERY_NAME[chainId]
  const baseCurrency = useUnifiedCurrency(currencyIdA, chainId)
  const currencyB = useUnifiedCurrency(currencyIdB, chainId)
  const quoteCurrency =
    baseCurrency && currencyB && baseCurrency.wrapped.equals(currencyB.wrapped) ? undefined : currencyB

  const { data: ssSupportedBaseToken } = useStableSwapSupportedTokens(chainId)
  const { data: ssSupportedQuoteToken } = useStableSwapSupportedTokens(
    chainId,
    isStableSwapSupported(chainId) ? (baseCurrency?.wrapped as Token) : undefined,
  )
  const [baseTokensToSelect, quoteTokensToSelect] = useMemo(
    () => (protocol === 'stableSwap' ? [ssSupportedBaseToken, ssSupportedQuoteToken] : [undefined, undefined]),
    [ssSupportedBaseToken, ssSupportedQuoteToken, protocol],
  )

  const types = useMemo(() => {
    return isMobile ? COMPACT_LIQUIDITY_TYPES : LIQUIDITY_TYPES
  }, [isMobile])

  /// Functions
  const onLiquidityTypeClick = useCallback(
    (index: number) => {
      updateParams({ protocol: LIQUIDITY_TYPES[index] })
    },
    [updateParams],
  )

  // TODO: implement relevant checks for native, token collision, etc. like in AddLiquidityV3
  const handleCurrencyASelect = useCallback(
    (currency: UnifiedCurrency) => {
      updateParams({ currencyIdA: currencyId(currency) })
    },
    [updateParams],
  )

  const handleCurrencyBSelect = useCallback(
    (currency: UnifiedCurrency) => {
      updateParams({ currencyIdB: currencyId(currency) })
    },
    [updateParams],
  )

  const nextStepURLMap = useMemo(() => {
    const queries = {
      poolType: poolTypeQuery,
      chain: queryChainName,
      [PERSIST_CHAIN_KEY]: 1,
    }

    const queryParams = new URLSearchParams()
    for (const [key, value] of Object.entries(queries)) {
      if (typeof value === 'undefined' || value === '') {
        continue
      }
      if (Array.isArray(value)) {
        value.forEach((item) => queryParams.append(key, item))
      } else {
        queryParams.append(key, value)
      }
    }
    const tokenParams =
      baseCurrency && quoteCurrency ? `${getCurrencyAddress(baseCurrency)}/${getCurrencyAddress(quoteCurrency)}` : ''

    const baseToken = baseCurrency?.isNative ? baseCurrency.symbol : baseCurrency?.wrapped.address
    const quoteToken = quoteCurrency?.isNative ? quoteCurrency.symbol : quoteCurrency?.wrapped.address

    return {
      infinity: `/liquidity/select/pools/${chainId}/infinity/${tokenParams}?${queryParams.toString()}`,
      v3: `/add/${baseToken}/${quoteToken}?${queryParams.toString()}`,
      v2: `/v2/add/${baseToken}/${quoteToken}?${queryParams.toString()}`,
      stableSwap: `/stable/add/${baseToken}/${quoteToken}?${queryParams.toString()}`,
    } satisfies Record<LiquidityType, string>
  }, [baseCurrency, quoteCurrency, poolTypeQuery, chainId, queryChainName])

  const nextStep = useMemo(() => {
    const key = protocol ?? 'infinity'
    return nextStepURLMap[key]
  }, [protocol, nextStepURLMap])

  const disabled = useMemo(() => {
    const noCurrency = !baseCurrency || !quoteCurrency
    const networkNoSupport = !chainId || (protocol === 'infinity' && !INFINITY_SUPPORTED_CHAINS.includes(chainId))

    return noCurrency || networkNoSupport
  }, [baseCurrency, chainId, protocol, quoteCurrency])

  const { switchNetwork } = useSwitchNetwork()

  const handleNetworkChange = useCallback(
    async (chain: Chain) => {
      await switchNetwork?.(chain.id)
      updateParams({ chainId: chain.id })
    },
    [switchNetwork, updateParams],
  )

  useEffect(() => {
    if (protocol === 'stableSwap') {
      const prioritySymbols = [bscTokens.cake.symbol, bscTokens.wbnb.symbol, 'btc'].map((s) => s.toLowerCase())
      const preferredTokens = ssSupportedBaseToken
        ?.filter((token) => prioritySymbols.some((key) => token?.symbol?.toLowerCase()?.includes(key)))
        ?.sort((a, b) => {
          const aSymbol = a.symbol.toLowerCase()
          const bSymbol = b.symbol.toLowerCase()

          const aIndex = prioritySymbols.findIndex((p) => aSymbol.includes(p))
          const bIndex = prioritySymbols.findIndex((p) => bSymbol.includes(p))

          return aIndex - bIndex
        })

      const baseDefaultToken = preferredTokens?.length ? preferredTokens?.[0] : ssSupportedBaseToken?.[0]
      const quoteDefaultToken = ssSupportedQuoteToken?.[0]
      updateParams({
        currencyIdA:
          baseCurrency?.wrapped?.address && ssSupportedBaseToken?.find((token) => token.equals(baseCurrency))
            ? baseCurrency?.wrapped?.address
            : baseDefaultToken?.wrapped?.address,
        currencyIdB: quoteDefaultToken?.wrapped?.address,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, baseCurrency, ssSupportedQuoteToken])

  return (
    <StyledCard mt="48px" mb={['120px', null, null, '0px']} mx="auto" style={{ overflow: 'visible' }}>
      <CardBody>
        <FlexGap gap="24px" flexDirection="column">
          <FlexGap gap="6px" flexDirection="column">
            <PreTitle>{t('1. Select where to provide liquidity')}</PreTitle>
            <ButtonMenu
              activeIndex={protocol ? LIQUIDITY_TYPES.indexOf(protocol) : 0}
              onItemClick={onLiquidityTypeClick}
              scale="sm"
              variant="subtle"
              fullWidth
            >
              {types.map((type) => (
                <StyledButtonMenuItem key={type}>{type}</StyledButtonMenuItem>
              ))}
            </ButtonMenu>

            <NetworkSelector version={protocol} chainId={chainId} onChange={handleNetworkChange} />
          </FlexGap>

          <FlexGap gap="6px" flexDirection="column">
            <PreTitle>{t('2. Choose token pair')}</PreTitle>

            <TokenFilterContainer>
              <CurrencySelectV2
                id="add-liquidity-select-tokenA"
                chainId={chainId}
                selectedCurrency={baseCurrency}
                onCurrencySelect={handleCurrencyASelect}
                showCommonBases={protocol !== 'stableSwap'}
                commonBasesType={CommonBasesType.LIQUIDITY}
                tokensToShow={baseTokensToSelect}
                hideBalance
                showNative={protocol !== 'stableSwap'}
              />
              <AddIcon color="textSubtle" />
              <CurrencySelectV2
                id="add-liquidity-select-tokenB"
                chainId={chainId}
                selectedCurrency={quoteCurrency}
                onCurrencySelect={handleCurrencyBSelect}
                tokensToShow={quoteTokensToSelect}
                showCommonBases={protocol !== 'stableSwap'}
                commonBasesType={CommonBasesType.LIQUIDITY}
                hideBalance
                showNative={protocol !== 'stableSwap'}
              />
            </TokenFilterContainer>
          </FlexGap>

          {protocol === 'infinity' && (
            <FlexGap gap="6px" flexDirection="column">
              <PreTitle>{t('3. Pool Filter (Optional)')}</PreTitle>
              <PoolTypeFilter value={poolType} onChange={(e) => setPoolType(e.value)} data={poolTypesTree} />
            </FlexGap>
          )}

          <NextLink href={nextStep}>
            <Button px="100px" width="100%" disabled={disabled}>
              {t('Next.step')}
            </Button>
          </NextLink>
        </FlexGap>
      </CardBody>
    </StyledCard>
  )
}
