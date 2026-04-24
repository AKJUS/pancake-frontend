import { useMemo, useCallback } from 'react'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { useTranslation } from '@pancakeswap/localization'
import { BoxProps, Skeleton } from '@pancakeswap/uikit'
import { DepositAmountPanel } from 'components/Liquidity/DepositAmountPanel'
import { useMaxAmount } from 'hooks/useMaxAmount'
import { useUsdDepositAmount } from 'hooks/useUsdDepositAmount'
import { useClTokenValueRatio } from 'hooks/useClTokenValueRatio'
import { useUnifiedTokenUsdPrice } from 'hooks/useUnifiedTokenUsdPrice'
import { useInfinityPoolIdRouteParams } from 'hooks/dynamicRoute/usePoolIdRoute'
import { useInverted, useClRangeQueryState } from 'state/infinity/shared'
import { useCurrencyBalances } from 'state/wallet/hooks'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useAddDepositAmounts, useAddDepositAmountsEnabled } from '../hooks/useAddDepositAmounts'
import { usePool } from '../hooks/usePool'

type FieldAddDepositAmountProps = BoxProps & {
  baseCurrency: Currency | undefined
  quoteCurrency: Currency | undefined
}

export const FieldAddDepositAmount: React.FC<FieldAddDepositAmountProps> = ({
  baseCurrency,
  quoteCurrency,
  ...boxProps
}) => {
  const { t } = useTranslation()
  const { chainId } = useInfinityPoolIdRouteParams()
  const { account } = useAccountActiveChain()
  const { inputValue0, inputValue1, handleDepositAmountChange } = useAddDepositAmounts()
  const { isDepositEnabled, isDeposit0Enabled, isDeposit1Enabled } = useAddDepositAmountsEnabled()
  const [inverted] = useInverted()
  const pool = usePool()
  const [{ lowerTick, upperTick }] = useClRangeQueryState()

  // --- Map 0/1 to base/quote based on inversion ---
  const baseInput = useMemo(() => (inverted ? inputValue1 : inputValue0), [inverted, inputValue0, inputValue1])
  const quoteInput = useMemo(() => (inverted ? inputValue0 : inputValue1), [inverted, inputValue0, inputValue1])

  const onBaseInput = useCallback(
    (amount: string) => handleDepositAmountChange(amount, inverted ? 1 : 0),
    [inverted, handleDepositAmountChange],
  )
  const onQuoteInput = useCallback(
    (amount: string) => handleDepositAmountChange(amount, inverted ? 0 : 1),
    [inverted, handleDepositAmountChange],
  )

  // Deposit enabled in display order
  const isBaseDepositEnabled = inverted ? isDeposit1Enabled : isDeposit0Enabled
  const isQuoteDepositEnabled = inverted ? isDeposit0Enabled : isDeposit1Enabled

  // --- Balances ---
  const [baseBalance, quoteBalance] = useCurrencyBalances(
    account ?? undefined,
    useMemo(() => [baseCurrency, quoteCurrency], [baseCurrency, quoteCurrency]),
  )
  const maxBaseAmount = useMaxAmount(baseCurrency)
  const maxQuoteAmount = useMaxAmount(quoteCurrency)

  // --- USD Prices (for ratio calculation) ---
  const { data: basePriceUsd } = useUnifiedTokenUsdPrice(baseCurrency, Boolean(baseCurrency))
  const { data: quotePriceUsd } = useUnifiedTokenUsdPrice(quoteCurrency, Boolean(quoteCurrency))

  // --- Token value ratio ---
  const isBinPool = pool?.poolType === 'Bin'
  const sqrtRatioX96 = useMemo(() => {
    if (!pool || pool.poolType !== 'CL') return undefined
    return (pool as { sqrtRatioX96: bigint }).sqrtRatioX96
  }, [pool])

  // For CL pools: compute ratio in pool token order (0/1), then flip for display order
  const token0Ratio = useClTokenValueRatio(
    sqrtRatioX96,
    lowerTick,
    upperTick,
    pool?.token0?.decimals,
    pool?.token1?.decimals,
    inverted ? quotePriceUsd ?? 0 : basePriceUsd ?? 0,
    inverted ? basePriceUsd ?? 0 : quotePriceUsd ?? 0,
  )
  const baseTokenRatio = useMemo(() => {
    if (isBinPool) return 0.5
    return inverted ? 1 - token0Ratio : token0Ratio
  }, [isBinPool, inverted, token0Ratio])

  // --- USD deposit hook ---
  const {
    usdDisplayValue,
    onUsdInput,
    totalUsdValue,
    canUseUsdMode,
    onBaseInputWrapped,
    onQuoteInputWrapped,
    basePriceUsd: hookBasePriceUsd,
    quotePriceUsd: hookQuotePriceUsd,
  } = useUsdDepositAmount({
    baseCurrency,
    quoteCurrency,
    baseInputValue: baseInput ?? '',
    quoteInputValue: quoteInput ?? '',
    onBaseInput,
    onQuoteInput,
    baseTokenRatio,
    independentQuote: isBinPool,
    isBaseDepositEnabled,
    isQuoteDepositEnabled,
  })

  if (!baseCurrency || !quoteCurrency) {
    return <Skeleton height="220px" width="100%" />
  }

  return (
    <DepositAmountPanel
      baseCurrency={baseCurrency}
      quoteCurrency={quoteCurrency}
      baseInputValue={baseInput ?? ''}
      quoteInputValue={quoteInput ?? ''}
      onBaseInput={onBaseInputWrapped}
      onQuoteInput={onQuoteInputWrapped}
      usdDisplayValue={usdDisplayValue}
      onUsdInput={onUsdInput}
      canUseUsdMode={canUseUsdMode}
      totalUsdValue={totalUsdValue}
      isDepositEnabled={isDepositEnabled}
      isBaseDepositEnabled={isBaseDepositEnabled}
      isQuoteDepositEnabled={isQuoteDepositEnabled}
      baseBalance={baseBalance}
      quoteBalance={quoteBalance}
      maxBaseAmount={maxBaseAmount}
      maxQuoteAmount={maxQuoteAmount}
      basePriceUsd={hookBasePriceUsd}
      quotePriceUsd={hookQuotePriceUsd}
      disabledMessage={t('Set price range first')}
      baseDisabledMessage={
        !isDepositEnabled ? t('Set price range first') : t('The price range is outside current pool price')
      }
      quoteDisabledMessage={
        !isDepositEnabled ? t('Set price range first') : t('The price range is outside current pool price')
      }
      showSettings
      {...boxProps}
    />
  )
}
