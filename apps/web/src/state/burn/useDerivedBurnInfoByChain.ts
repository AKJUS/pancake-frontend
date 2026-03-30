import { Currency, CurrencyAmount, Pair, Percent, Token } from '@pancakeswap/sdk'
import { useV2Pair } from 'hooks/usePairs'
import useTotalSupply from 'hooks/useTotalSupply'
import { useMemo } from 'react'
import { wrappedCurrency } from 'utils/wrappedCurrency'

import { useTranslation } from '@pancakeswap/localization'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useRemoveLiquidityV2FormState } from 'state/burn/reducer'
import { useTokenBalancesWithLoadingIndicator } from 'state/wallet/hooks'
import { Field } from 'state/burn/actions'

export type DerivedBurnChainSnapshot = {
  pair: Pair
  totalSupply: CurrencyAmount<Token>
  userLiquidity: CurrencyAmount<Token>
}

export type UseDerivedBurnInfoByChainOptions = {
  targetChainId?: number
  chainSnapshot?: DerivedBurnChainSnapshot
}

/**
 * V2 remove-liquidity derivation with optional chain snapshot when the wallet chain
 * differs from the position chain (e.g. Universal Farms position modal).
 * For same-chain remove pages, use `useDerivedBurnInfo` in `./hooks.ts`.
 */
export function useDerivedBurnInfoByChain(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  options?: UseDerivedBurnInfoByChainOptions,
): {
  pair?: Pair | null
  parsedAmounts: {
    [Field.LIQUIDITY_PERCENT]: Percent
    [Field.LIQUIDITY]?: CurrencyAmount<Token>
    [Field.CURRENCY_A]?: CurrencyAmount<Currency>
    [Field.CURRENCY_B]?: CurrencyAmount<Currency>
  }
  error?: string
  tokenToReceive?: string
  estimateZapOutAmount?: CurrencyAmount<Token>
} {
  const { account, chainId } = useAccountActiveChain()

  const { independentField, typedValue } = useRemoveLiquidityV2FormState()

  const { t } = useTranslation()

  const [, pairFromHook] = useV2Pair(currencyA, currencyB)

  const useSnapshot = Boolean(
    options?.chainSnapshot && options.targetChainId !== undefined && chainId !== options.targetChainId,
  )

  const pair = useMemo(
    () => (useSnapshot ? options!.chainSnapshot!.pair : pairFromHook),
    [useSnapshot, options, pairFromHook],
  )

  const [relevantTokenBalances] = useTokenBalancesWithLoadingIndicator(
    account ?? undefined,
    useMemo(() => [pairFromHook?.liquidityToken], [pairFromHook?.liquidityToken]),
  )
  const userLiquidityFromBalance: undefined | CurrencyAmount<Token> = pairFromHook?.liquidityToken
    ? relevantTokenBalances?.[`${pairFromHook.liquidityToken.chainId}-${pairFromHook.liquidityToken.address}`]
    : undefined

  const userLiquidity = useMemo(
    () => (useSnapshot ? options!.chainSnapshot!.userLiquidity : userLiquidityFromBalance),
    [useSnapshot, options, userLiquidityFromBalance],
  )

  const totalSupplyFromHook = useTotalSupply(pairFromHook?.liquidityToken)
  const totalSupply = useMemo(
    () => (useSnapshot ? options!.chainSnapshot!.totalSupply : totalSupplyFromHook),
    [useSnapshot, options, totalSupplyFromHook],
  )

  const effectiveChainId = useSnapshot ? options!.targetChainId! : chainId
  const [tokenA, tokenB] = [wrappedCurrency(currencyA, effectiveChainId), wrappedCurrency(currencyB, effectiveChainId)]
  const tokens = {
    [Field.CURRENCY_A]: tokenA,
    [Field.CURRENCY_B]: tokenB,
    [Field.LIQUIDITY]: pair?.liquidityToken,
  }

  const liquidityValueA =
    pair && totalSupply && userLiquidity && tokenA && totalSupply.quotient >= userLiquidity.quotient
      ? CurrencyAmount.fromRawAmount(tokenA, pair.getLiquidityValue(tokenA, totalSupply, userLiquidity, false).quotient)
      : undefined

  const liquidityValueB =
    pair && totalSupply && userLiquidity && tokenB && totalSupply.quotient >= userLiquidity.quotient
      ? CurrencyAmount.fromRawAmount(tokenB, pair.getLiquidityValue(tokenB, totalSupply, userLiquidity, false).quotient)
      : undefined
  const liquidityValues: { [Field.CURRENCY_A]?: CurrencyAmount<Token>; [Field.CURRENCY_B]?: CurrencyAmount<Token> } = {
    [Field.CURRENCY_A]: liquidityValueA,
    [Field.CURRENCY_B]: liquidityValueB,
  }

  let percentToRemove: Percent = new Percent('0', '100')
  if (independentField === Field.LIQUIDITY_PERCENT) {
    percentToRemove = new Percent(typedValue, '100')
  } else if (independentField === Field.LIQUIDITY) {
    if (pair?.liquidityToken) {
      const independentAmount = tryParseAmount(typedValue, pair.liquidityToken)
      if (independentAmount && userLiquidity && !independentAmount.greaterThan(userLiquidity)) {
        percentToRemove = new Percent(independentAmount.quotient, userLiquidity.quotient)
      }
    }
  } else if (tokens[independentField]) {
    const independentAmount = tryParseAmount(typedValue, tokens[independentField])
    const liquidityValue = liquidityValues[independentField]
    if (independentAmount && liquidityValue && !independentAmount.greaterThan(liquidityValue)) {
      percentToRemove = new Percent(independentAmount.quotient, liquidityValue.quotient)
    }
  }

  const liquidityToRemove =
    userLiquidity && percentToRemove && percentToRemove.greaterThan('0')
      ? CurrencyAmount.fromRawAmount(userLiquidity.currency, percentToRemove.multiply(userLiquidity.quotient).quotient)
      : undefined

  const amountA =
    tokenA && percentToRemove && percentToRemove.greaterThan('0') && liquidityValueA
      ? CurrencyAmount.fromRawAmount(tokenA, percentToRemove.multiply(liquidityValueA.quotient).quotient)
      : undefined

  const amountB =
    tokenB && percentToRemove && percentToRemove.greaterThan('0') && liquidityValueB
      ? CurrencyAmount.fromRawAmount(tokenB, percentToRemove.multiply(liquidityValueB.quotient).quotient)
      : undefined

  const parsedAmounts: {
    [Field.LIQUIDITY_PERCENT]: Percent
    [Field.LIQUIDITY]?: CurrencyAmount<Token>
    [Field.CURRENCY_A]?: CurrencyAmount<Token>
    [Field.CURRENCY_B]?: CurrencyAmount<Token>
  } = {
    [Field.LIQUIDITY_PERCENT]: percentToRemove,
    [Field.LIQUIDITY]: liquidityToRemove,
    [Field.CURRENCY_A]: amountA,
    [Field.CURRENCY_B]: amountB,
  }

  let error: string | undefined
  if (!account) {
    error = t('Connect Wallet')
  }

  if (!parsedAmounts[Field.LIQUIDITY] || !parsedAmounts[Field.CURRENCY_A] || !parsedAmounts[Field.CURRENCY_B]) {
    error = error ?? t('Enter an amount')
  }

  return { pair, parsedAmounts, error }
}
