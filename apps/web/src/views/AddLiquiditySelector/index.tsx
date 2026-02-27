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
  Message,
  MessageText,
  PreTitle,
  Text,
  Select,
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
import { LIQUIDITY_TYPES, LiquidityType } from 'utils/types'
import { bscTokens, USDT } from '@pancakeswap/tokens'
import { isStableSwapSupported } from '@pancakeswap/stable-swap-sdk'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { useStableInfinitySupportedTokens } from 'views/StableInfinity/hooks/useStableInfinitySupportedTokens'
import { useInfinityStablePoolByPair } from 'views/StableInfinity/hooks/useInfinityStablePoolByPair'
import { isInfinityStableSupported } from '@pancakeswap/infinity-stable-sdk'
import { usePoolTypeQuery } from './hooks/usePoolTypeQuery'
import { STABLE_POOL_OPTIONS, STABLE_POOL_TYPE, useStablePoolTypeQuery } from './hooks/useStablePoolTypeQuery'

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
  const { stablePoolTypeQuery, setStablePoolType } = useStablePoolTypeQuery()

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

  const { data: infinityStableSupportedTokens } = useStableInfinitySupportedTokens(chainId)

  const { data: infinityStableHookAddress, isLoading: isInfinityStablePoolLoading } = useInfinityStablePoolByPair(
    chainId,
    protocol === LiquidityType.StableSwap && stablePoolTypeQuery === STABLE_POOL_TYPE.infinity
      ? (baseCurrency?.wrapped as Token)
      : undefined,
    protocol === LiquidityType.StableSwap && stablePoolTypeQuery === STABLE_POOL_TYPE.infinity
      ? (quoteCurrency?.wrapped as Token)
      : undefined,
  )

  const isStableContext = protocol === LiquidityType.StableSwap

  const [baseTokensToSelect, quoteTokensToSelect] = useMemo(() => {
    // Use stablePoolTypeQuery to determine which tokens to show for stable protocols

    if (isStableContext) {
      if (stablePoolTypeQuery === STABLE_POOL_TYPE.infinity) {
        // For infinity stable, both selectors show all tokens from existing pairs
        return [infinityStableSupportedTokens, infinityStableSupportedTokens]
      }
      // Default to classic
      return [ssSupportedBaseToken, ssSupportedQuoteToken]
    }

    return [undefined, undefined]
  }, [isStableContext, ssSupportedBaseToken, ssSupportedQuoteToken, infinityStableSupportedTokens, stablePoolTypeQuery])

  // Determine if we're in stable context for UI behavior

  /// Functions
  const onLiquidityTypeClick = useCallback(
    (index: number) => {
      const protocol = LIQUIDITY_TYPES[index]

      updateParams({ protocol })
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
      [LiquidityType.Infinity]: `/liquidity/select/pools/${chainId}/infinity/${tokenParams}?${queryParams.toString()}`,
      [LiquidityType.V3]: `/add/${baseToken}/${quoteToken}?${queryParams.toString()}`,
      [LiquidityType.V2]: `/v2/add/${baseToken}/${quoteToken}?${queryParams.toString()}`,
      [LiquidityType.StableSwap]: `/stable/add/${baseToken}/${quoteToken}?${queryParams.toString()}`,
      infinityStable: `/infinityStable/add/${infinityStableHookAddress}?chain=${queryChainName}&${PERSIST_CHAIN_KEY}=1`,
      infinityStableCreate: `/liquidity/create/${queryChainName}/stableSwap/${baseToken}/${quoteToken}?${queryParams.toString()}`,
    } as Record<LiquidityType | 'infinityStable' | 'infinityStableCreate', string>
  }, [baseCurrency, quoteCurrency, poolTypeQuery, chainId, queryChainName, infinityStableHookAddress])

  const isInfinityStableMode = isStableContext && stablePoolTypeQuery === STABLE_POOL_TYPE.infinity
  const infinityStablePoolMissing = isInfinityStableMode && baseCurrency && quoteCurrency && !infinityStableHookAddress

  const nextStep = useMemo(() => {
    if (isStableContext) {
      // Use stablePoolTypeQuery to determine the actual next step
      if (stablePoolTypeQuery === STABLE_POOL_TYPE.infinity) {
        // If pool is missing, go to create page
        return infinityStablePoolMissing ? nextStepURLMap.infinityStableCreate : nextStepURLMap.infinityStable
      }
      return nextStepURLMap[LiquidityType.StableSwap]
    }

    const key = protocol ?? LiquidityType.Infinity
    return nextStepURLMap[key]
  }, [protocol, stablePoolTypeQuery, nextStepURLMap, isStableContext, infinityStablePoolMissing])

  const disabled = useMemo(() => {
    const noCurrency = !baseCurrency || !quoteCurrency
    const networkNoSupport =
      !chainId || (protocol === LiquidityType.Infinity && !INFINITY_SUPPORTED_CHAINS.includes(chainId))

    // For infinity stable, if pool is missing, we allow them to create it (not disabled)
    // Only disable if currencies are missing or network is not supported
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

  // NOTE: if chainId not support infinity stable, set stablePoolTypeQuery to classic
  useEffect(() => {
    if (chainId && !isInfinityStableSupported(chainId) && stablePoolTypeQuery === STABLE_POOL_TYPE.infinity) {
      setStablePoolType(STABLE_POOL_TYPE.classic)
    }
  }, [chainId, setStablePoolType, stablePoolTypeQuery])

  useEffect(() => {
    if (isStableContext && stablePoolTypeQuery === STABLE_POOL_TYPE.classic) {
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

      if (!baseDefaultToken) return

      updateParams({
        currencyIdA:
          baseCurrency?.wrapped?.address && ssSupportedBaseToken?.find((token) => token.equals(baseCurrency))
            ? baseCurrency?.wrapped?.address
            : baseDefaultToken.wrapped.address,
        currencyIdB: quoteDefaultToken?.wrapped?.address,
      })
    } else if (isStableContext && stablePoolTypeQuery === STABLE_POOL_TYPE.infinity) {
      if (!infinityStableSupportedTokens || infinityStableSupportedTokens.length === 0) return

      const baseDefaultToken = infinityStableSupportedTokens?.[0]
      const quoteInSupported =
        quoteCurrency?.wrapped?.address && infinityStableSupportedTokens?.find((token) => token.equals(quoteCurrency))

      const usdtFallback = chainId
        ? infinityStableSupportedTokens?.find(
            (token) => USDT[chainId] && token.address.toLowerCase() === USDT[chainId]!.address.toLowerCase(),
          )
        : undefined

      const quoteDefaultToken =
        quoteInSupported ??
        usdtFallback ??
        (infinityStableSupportedTokens?.length > 1
          ? infinityStableSupportedTokens?.[1]
          : infinityStableSupportedTokens?.[0])

      if (!baseDefaultToken || !quoteDefaultToken) return

      updateParams({
        currencyIdA:
          baseCurrency?.wrapped?.address && infinityStableSupportedTokens?.find((token) => token.equals(baseCurrency))
            ? baseCurrency?.wrapped?.address
            : baseDefaultToken.wrapped.address,
        currencyIdB: quoteDefaultToken.wrapped.address,
      })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    protocol,
    stablePoolTypeQuery,
    baseCurrency,
    ssSupportedBaseToken,
    ssSupportedQuoteToken,
    infinityStableSupportedTokens,
  ])

  const liquidityTypeTabs = useMemo(() => {
    const index = LIQUIDITY_TYPES.findIndex((type) => type === protocol)

    if (index === -1) {
      return 0
    }

    return index
  }, [protocol])

  const stablePoolOptions = useMemo(() => {
    return chainId && isInfinityStableSupported(chainId)
      ? STABLE_POOL_OPTIONS
      : STABLE_POOL_OPTIONS.filter((option) => option.value === STABLE_POOL_TYPE.classic)
  }, [chainId])

  const stablePoolDefaultOptionIndex = useMemo(() => {
    const selectedIndex = stablePoolOptions.findIndex((option) => option.value === stablePoolTypeQuery)
    const normalizedIndex = selectedIndex >= 0 ? selectedIndex : 0

    // Select uses 1-based defaultOptionIndex when syncing updates.
    return normalizedIndex + 1
  }, [stablePoolOptions, stablePoolTypeQuery])

  return (
    <StyledCard mt="48px" mb={['120px', null, null, '0px']} mx="auto" style={{ overflow: 'visible' }}>
      <CardBody>
        <FlexGap gap="24px" flexDirection="column">
          <FlexGap gap="6px" flexDirection="column">
            <PreTitle>{t('1. Select where to provide liquidity')}</PreTitle>
            <ButtonMenu
              activeIndex={liquidityTypeTabs}
              onItemClick={onLiquidityTypeClick}
              scale="sm"
              variant="subtle"
              fullWidth
            >
              {LIQUIDITY_TYPES.map((type) => (
                <StyledButtonMenuItem key={type}>
                  {type === LiquidityType.StableSwap && isMobile ? 'SS' : type}
                </StyledButtonMenuItem>
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
                showCommonBases={!isStableContext}
                commonBasesType={CommonBasesType.LIQUIDITY}
                tokensToShow={baseTokensToSelect}
                hideBalance
                showNative={!isStableContext}
              />
              <AddIcon color="textSubtle" />
              <CurrencySelectV2
                id="add-liquidity-select-tokenB"
                chainId={chainId}
                selectedCurrency={quoteCurrency}
                onCurrencySelect={handleCurrencyBSelect}
                tokensToShow={quoteTokensToSelect}
                showCommonBases={!isStableContext}
                commonBasesType={CommonBasesType.LIQUIDITY}
                hideBalance
                showNative={!isStableContext}
              />
            </TokenFilterContainer>
          </FlexGap>

          {protocol === LiquidityType.StableSwap && (
            <FlexGap gap="6px" flexDirection="column">
              <PreTitle>{t('3. Pool Filter')}</PreTitle>
              <Select
                key={`${chainId}-stable-pool-type`}
                options={stablePoolOptions}
                defaultOptionIndex={stablePoolDefaultOptionIndex}
                onOptionChange={(option) => setStablePoolType(option.value)}
              />
            </FlexGap>
          )}

          {protocol === LiquidityType.Infinity && (
            <FlexGap gap="6px" flexDirection="column">
              <PreTitle>{t('3. Pool Filter (Optional)')}</PreTitle>
              <PoolTypeFilter value={poolType} onChange={(e) => setPoolType(e.value)} data={poolTypesTree} />
            </FlexGap>
          )}

          {!isInfinityStablePoolLoading && infinityStablePoolMissing && (
            <Message variant="warning">
              <MessageText>{t('Pool is not created yet.')}</MessageText>
            </Message>
          )}

          <NextLink href={nextStep}>
            <Button px="100px" width="100%" disabled={disabled || isInfinityStablePoolLoading}>
              {isInfinityStablePoolLoading
                ? t('Checking...')
                : infinityStablePoolMissing
                ? t('Create')
                : t('Next.step')}
            </Button>
          </NextLink>
        </FlexGap>
      </CardBody>
    </StyledCard>
  )
}
