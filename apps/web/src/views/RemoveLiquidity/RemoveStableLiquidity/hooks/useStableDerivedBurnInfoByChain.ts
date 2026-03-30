import { ChainId } from '@pancakeswap/chains'
import { Currency, CurrencyAmount, ERC20Token, Percent, Token } from '@pancakeswap/sdk'
import { LegacyStableSwapPair } from '@pancakeswap/smart-router/legacy-router'

import { useTranslation } from '@pancakeswap/localization'
import { useQuery } from '@tanstack/react-query'
import { infoStableSwapABI } from 'config/abi/infoStableSwap'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useInfoStableSwapContract } from 'hooks/useContract'
import { useContext, useMemo } from 'react'
import { Field } from 'state/burn/actions'
import { useRemoveLiquidityV2FormState } from 'state/burn/reducer'
import { useTokenBalancesWithLoadingIndicator } from 'state/wallet/hooks'
import { publicClient } from 'utils/viem'
import { Address } from 'viem'
import { StablePair, useStablePair } from 'views/AddLiquidity/AddStableLiquidity/hooks/useStableLPDerivedMintInfo'
import { StableConfigContext } from 'views/Swap/hooks/useStableConfig'

type StableCalcCoinsCrossChainRead = {
  chainId: ChainId
  infoStableSwapAddress: Address
  stableSwapAddress: Address
}

/**
 * Same as `useGetRemovedTokenAmountsNoContext` in `./useStableDerivedBurnInfo.ts`, plus optional
 * `crossChainRead` for position-modal preview when the wallet chain ≠ position chain.
 */
export function useGetRemovedTokenAmountsNoContextWithCrossChain({
  lpAmount,
  stableSwapAddress,
  token0,
  token1,
  stableSwapInfoContract,
  crossChainRead,
}: {
  lpAmount?: string
  stableSwapAddress?: string
  token0?: Token
  token1?: Token
  stableSwapInfoContract?: ReturnType<typeof useInfoStableSwapContract>
  crossChainRead?: StableCalcCoinsCrossChainRead
}) {
  const { data } = useQuery({
    queryKey: [
      'stableSwapInfoContract',
      'calc_coins_amount',
      stableSwapAddress,
      lpAmount,
      crossChainRead?.chainId,
      crossChainRead?.infoStableSwapAddress,
    ],

    queryFn: async () => {
      if (!lpAmount) return undefined
      if (crossChainRead) {
        const client = publicClient({ chainId: crossChainRead.chainId })
        return client.readContract({
          address: crossChainRead.infoStableSwapAddress,
          abi: infoStableSwapABI,
          functionName: 'calc_coins_amount',
          args: [crossChainRead.stableSwapAddress, BigInt(lpAmount)],
        })
      }
      if (!stableSwapInfoContract || !stableSwapAddress) return undefined
      return stableSwapInfoContract.read.calc_coins_amount([stableSwapAddress as Address, BigInt(lpAmount)])
    },

    enabled: Boolean(lpAmount) && (crossChainRead ? true : Boolean(stableSwapInfoContract && stableSwapAddress)),
  })

  if (!Array.isArray(data) || !token0 || !token1) return []

  const tokenAAmount = CurrencyAmount.fromRawAmount(token0, data[0].toString())
  const tokenBAmount = CurrencyAmount.fromRawAmount(token1, data[1].toString())

  return [tokenAAmount, tokenBAmount]
}

export type StableDerivedBurnChainSnapshot = {
  pair: LegacyStableSwapPair
  nativeBalance: CurrencyAmount<ERC20Token>
}

export type UseStableDerivedBurnInfoByChainOptions = {
  targetChainId?: number
  chainSnapshot?: StableDerivedBurnChainSnapshot
}

/**
 * Stable remove-liquidity derivation with optional chain snapshot when the wallet chain
 * differs from the position chain. For same-chain stable remove pages, use
 * `useStableDerivedBurnInfo` in `./useStableDerivedBurnInfo.ts`.
 */
export function useStableDerivedBurnInfoByChain(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  options?: UseStableDerivedBurnInfoByChainOptions,
): {
  pair?: StablePair | null
  parsedAmounts: {
    [Field.LIQUIDITY_PERCENT]: Percent
    [Field.LIQUIDITY]?: CurrencyAmount<Token>
    [Field.CURRENCY_A]?: CurrencyAmount<Currency>
    [Field.CURRENCY_B]?: CurrencyAmount<Currency>
  }
  error?: string
  tokenToReceive?: string
} {
  const { account, chainId } = useAccountActiveChain()

  const { independentField, typedValue } = useRemoveLiquidityV2FormState()

  const { t } = useTranslation()

  const stableConfigContext = useContext(StableConfigContext)

  const { pair: pairFromHook } = useStablePair(currencyA?.wrapped, currencyB?.wrapped)

  const useSnapshot = Boolean(
    options?.chainSnapshot && options.targetChainId !== undefined && chainId !== options.targetChainId,
  )

  const pair = useMemo((): StablePair | undefined => {
    if (useSnapshot && options?.chainSnapshot?.pair) {
      const p = options.chainSnapshot.pair
      const zero = CurrencyAmount.fromRawAmount(p.token0.wrapped, '0')
      return {
        liquidityToken: p.liquidityToken,
        tokenAmounts: [],
        token0: p.token0,
        token1: p.token1,
        priceOf: () => zero,
        token0Price: () => zero,
        token1Price: () => zero,
        reserve0: p.reserve0,
        reserve1: p.reserve1,
        getLiquidityValue: () => zero,
      }
    }
    return pairFromHook
  }, [useSnapshot, options?.chainSnapshot?.pair, pairFromHook])

  const [relevantTokenBalances] = useTokenBalancesWithLoadingIndicator(
    account ?? undefined,
    useMemo(() => [pairFromHook?.liquidityToken || undefined], [pairFromHook?.liquidityToken]),
  )
  const userLiquidityFromBalance: undefined | CurrencyAmount<Token> = pairFromHook?.liquidityToken
    ? relevantTokenBalances?.[`${pairFromHook.liquidityToken.chainId}-${pairFromHook.liquidityToken.address}`]
    : undefined

  const userLiquidity = useMemo(
    () => (useSnapshot ? options!.chainSnapshot!.nativeBalance : userLiquidityFromBalance),
    [useSnapshot, options, userLiquidityFromBalance],
  )

  let percentToRemove: Percent = new Percent('0', '100')
  if (independentField === Field.LIQUIDITY_PERCENT) {
    percentToRemove = new Percent(typedValue, '100')
  }

  const liquidityToRemove =
    userLiquidity && percentToRemove && percentToRemove.greaterThan('0')
      ? CurrencyAmount.fromRawAmount(userLiquidity.currency, percentToRemove.multiply(userLiquidity.quotient).quotient)
      : undefined

  const [amountA, amountB] = useGetRemovedTokenAmountsNoContextWithCrossChain({
    lpAmount: liquidityToRemove?.quotient?.toString(),
    stableSwapAddress: useSnapshot
      ? options!.chainSnapshot!.pair.stableSwapAddress
      : stableConfigContext?.stableSwapConfig?.stableSwapAddress,
    token0: useSnapshot
      ? options!.chainSnapshot!.pair.token0.wrapped
      : stableConfigContext?.stableSwapConfig?.token0.wrapped,
    token1: useSnapshot
      ? options!.chainSnapshot!.pair.token1.wrapped
      : stableConfigContext?.stableSwapConfig?.token1.wrapped,
    stableSwapInfoContract: useSnapshot ? undefined : stableConfigContext?.stableSwapInfoContract,
    crossChainRead:
      useSnapshot && options?.targetChainId && options.chainSnapshot
        ? {
            chainId: options.targetChainId as ChainId,
            infoStableSwapAddress: options.chainSnapshot.pair.infoStableSwapAddress,
            stableSwapAddress: options.chainSnapshot.pair.stableSwapAddress as Address,
          }
        : undefined,
  })

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

  if (!parsedAmounts[Field.LIQUIDITY]) {
    error = error ?? t('Enter an amount')
  }

  return { pair, parsedAmounts, error }
}
