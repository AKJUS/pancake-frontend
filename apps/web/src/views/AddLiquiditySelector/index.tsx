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
import { PoolTypeFilter, fromSelectedNodes, getCurrencyAddress, toSelectedNodes } from '@pancakeswap/widgets-internal'
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
import { Chain, ChainId } from '@pancakeswap/chains'

import { INFINITY_SUPPORTED_CHAINS } from '@pancakeswap/infinity-sdk'
import { CurrencySelectV2 } from 'components/CurrencySelectV2'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { useStableSwapSupportedTokens } from 'hooks/useStableSwapSupportedTokens'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { LIQUIDITY_TYPES, LiquidityType } from 'utils/types'
import { arbitrumTokens, ethereumTokens, USDT } from '@pancakeswap/tokens'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { useStableInfinitySupportedTokens } from 'views/StableInfinity/hooks/useStableInfinitySupportedTokens'
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

const uniqueTokenList = (tokens?: Token[]) => {
  return Array.from(new Map((tokens ?? []).map((token) => [token.address.toLowerCase(), token])).values())
}

const defaultStableBaseToken: Record<number, { address: string } | undefined> = {
  [ChainId.BSC]: USDT[ChainId.BSC],
  [ChainId.ETHEREUM]: ethereumTokens.wbtc,
  [ChainId.ARBITRUM_ONE]: arbitrumTokens.wbtc,
}

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
    baseCurrency?.wrapped as Token | undefined,
  )

  const { data: infinityStableSupportedBaseToken } = useStableInfinitySupportedTokens(chainId)
  const { data: infinityStableSupportedQuoteToken } = useStableInfinitySupportedTokens(
    chainId,
    baseCurrency?.wrapped as Token | undefined,
  )

  const isStableContext = protocol === LiquidityType.StableSwap

  const [baseTokensToSelect, quoteTokensToSelect] = useMemo(() => {
    if (isStableContext) {
      return [
        uniqueTokenList([...(ssSupportedBaseToken ?? []), ...(infinityStableSupportedBaseToken ?? [])]),
        uniqueTokenList([...(ssSupportedQuoteToken ?? []), ...(infinityStableSupportedQuoteToken ?? [])]),
      ]
    }

    return [undefined, undefined]
  }, [
    isStableContext,
    ssSupportedBaseToken,
    ssSupportedQuoteToken,
    infinityStableSupportedBaseToken,
    infinityStableSupportedQuoteToken,
    baseCurrency,
    quoteCurrency,
  ])

  // Default base token when entering StableSwap, and auto-fix quote when it's not pairable
  useEffect(() => {
    if (!isStableContext || !chainId || !baseTokensToSelect?.length) return

    const baseValid =
      baseCurrency &&
      baseTokensToSelect.some((t) => t.address.toLowerCase() === baseCurrency.wrapped.address.toLowerCase())

    if (!baseValid) {
      const fallback = defaultStableBaseToken[chainId]
      const defaultBase = fallback
        ? baseTokensToSelect.find((t) => t.address.toLowerCase() === fallback.address.toLowerCase())
        : undefined
      updateParams({ currencyIdA: (defaultBase ?? baseTokensToSelect[0]).address })
      return
    }

    if (!quoteTokensToSelect?.length) return

    const quoteValid =
      quoteCurrency &&
      quoteTokensToSelect.some((t) => t.address.toLowerCase() === quoteCurrency.wrapped.address.toLowerCase())

    if (!quoteValid) {
      updateParams({ currencyIdB: quoteTokensToSelect[0].address })
    }
  }, [isStableContext, chainId, baseTokensToSelect, quoteTokensToSelect])

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
      stablePoolType: stablePoolTypeQuery,
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
      [LiquidityType.StableSwap]: `/liquidity/select/pools/${chainId}/stableSwap/${tokenParams}?${queryParams.toString()}`,
    } as Record<LiquidityType, string>
  }, [baseCurrency, quoteCurrency, poolTypeQuery, stablePoolTypeQuery, chainId, queryChainName])

  const nextStep = useMemo(() => {
    const key = protocol ?? LiquidityType.Infinity
    return nextStepURLMap[key]
  }, [protocol, nextStepURLMap])

  const disabled = useMemo(() => {
    const noCurrency = !baseCurrency || !quoteCurrency
    const networkNoSupport =
      !chainId || (protocol === LiquidityType.Infinity && !INFINITY_SUPPORTED_CHAINS.includes(chainId))

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

  const liquidityTypeTabs = useMemo(() => {
    const index = LIQUIDITY_TYPES.findIndex((type) => type === protocol)

    if (index === -1) {
      return 0
    }

    return index
  }, [protocol])

  const stablePoolOptions = useMemo(() => STABLE_POOL_OPTIONS, [])

  const stablePoolTypeData = useMemo(
    () => [
      {
        key: '0',
        label: t('Pool Type'),
        data: 'stableSwapPoolType',
        children: stablePoolOptions.map((option, index) => ({
          key: `0-${index}`,
          label: t(option.label),
          data: option.value,
        })),
      },
    ],
    [stablePoolOptions, t],
  )

  const stablePoolTypeSelectedValues = useMemo(() => {
    const childValues = stablePoolOptions.map((option) => option.value)
    const allChildrenSelected =
      childValues.length > 0 && childValues.every((value) => stablePoolTypeQuery.includes(value))

    return allChildrenSelected ? ['stableSwapPoolType', ...stablePoolTypeQuery] : stablePoolTypeQuery
  }, [stablePoolOptions, stablePoolTypeQuery])

  const stablePoolType = useMemo(
    () => fromSelectedNodes(stablePoolTypeData, stablePoolTypeSelectedValues),
    [stablePoolTypeData, stablePoolTypeSelectedValues],
  )

  const handleStablePoolTypeChange = useCallback(
    (e) => {
      if (!e.value || Object.keys(e.value).length === 0) {
        setStablePoolType([])
        return
      }
      const values = toSelectedNodes(stablePoolTypeData, e.value)
        .map((node) => node.data)
        .filter((v): v is string => v === STABLE_POOL_TYPE.classic)
      setStablePoolType(values)
    },
    [setStablePoolType, stablePoolTypeData],
  )

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
              <PoolTypeFilter value={stablePoolType} onChange={handleStablePoolTypeChange} data={stablePoolTypeData} />
            </FlexGap>
          )}

          {protocol === LiquidityType.Infinity && (
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
