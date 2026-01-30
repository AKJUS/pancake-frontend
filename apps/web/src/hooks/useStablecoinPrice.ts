import BigNumber from 'bignumber.js'
import { ChainId, isSolana } from '@pancakeswap/chains'
import { Currency, ERC20Token, getCurrencyAddress, Native, Price, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { STABLE_COIN } from '@pancakeswap/tokens'
import { getFullDecimalMultiplier } from '@pancakeswap/utils/getFullDecimalMultiplier'
import isUndefinedOrNull from '@pancakeswap/utils/isUndefinedOrNull'
import { SLOW_INTERVAL } from 'config/constants'
import { queryTokenPrice } from 'edge/tokenPrice'
import { useAtomValue } from 'jotai'
import { atomFamily } from 'jotai/utils'
import { atomWithLoadable } from 'quoter/atom/atomWithLoadable'
import { useMemo } from 'react'
import { DeepKeyMap, isEqual } from 'utils/hash'
import { multiplyPriceByAmount } from 'utils/prices'
import { getViemClients } from 'utils/viem'
import { useSolanaTokenPrice } from './solana/useSolanaTokenPrice'

type UseStablecoinPriceConfig = {
  enabled?: boolean
}
const DEFAULT_CONFIG: UseStablecoinPriceConfig = {
  enabled: true,
}

interface StableCoinPriceParams {
  currency?: Currency
  chainId?: number
  enabled?: boolean
  version: number
}

const placeHolderMap = new DeepKeyMap<StableCoinPriceParams, Price<Currency, ERC20Token>>()
const stableCoinPriceAtom = atomFamily((params: StableCoinPriceParams) => {
  return atomWithLoadable(
    async () => {
      const enabled = params.enabled ?? true
      if (!params.currency || !enabled) {
        return undefined
      }
      const { currency, chainId } = params
      const stableCoin = STABLE_COIN[currency.chainId as ChainId] as ERC20Token | undefined
      if (!stableCoin || !chainId) {
        return undefined
      }
      const result = await queryTokenPrice(
        {
          chainId,
          address: getCurrencyAddress(currency),
          isNative: currency.isNative,
        },
        getViemClients,
      )
      const priceUSD = result?.price
      // const priceUSD = await queryStablecoinPrice(params.currency, params.chainId)
      if (isUndefinedOrNull(priceUSD)) {
        return undefined
      }
      const price = new Price(
        currency,
        stableCoin,
        1 * 10 ** currency.decimals,
        getFullDecimalMultiplier(stableCoin.decimals).times(priceUSD!.toFixed(stableCoin.decimals)).toString(),
      )
      if (price?.denominator === 0n) {
        return undefined
      }
      placeHolderMap.set({ ...params, version: 0 }, price)
      return price
    },
    {
      placeHolderBehavior: 'stale',
      placeHolderValue: placeHolderMap.get({ ...params, version: 0 }),
    },
  )
}, isEqual)

export function useStablecoinPrice(
  currency?: Currency | null,
  config: UseStablecoinPriceConfig = DEFAULT_CONFIG,
): Price<Currency, Currency> | undefined {
  const { enabled } = { ...DEFAULT_CONFIG, ...config }
  const chainId = currency?.chainId
  const version = Math.floor(Date.now() / SLOW_INTERVAL)

  const price = useAtomValue(
    stableCoinPriceAtom({
      currency: currency || undefined,
      chainId,
      enabled,
      version,
    }),
  )
  return price.unwrapOr(undefined)
}

export const useStablecoinPriceAmount = (
  currency?: Currency,
  amount?: number,
  config?: UseStablecoinPriceConfig,
): number | undefined => {
  const stablePrice = useStablecoinPrice(currency, { enabled: Boolean(currency && amount), ...config })

  return useMemo(() => {
    if (amount) {
      if (stablePrice) {
        return multiplyPriceByAmount(stablePrice, amount)
      }
    }
    return undefined
  }, [amount, stablePrice])
}

export const useUnifiedUSDPriceAmount = (
  currency?: UnifiedCurrency,
  amount?: number,
  config?: UseStablecoinPriceConfig,
): number | undefined => {
  const stablePrice = useStablecoinPrice(
    currency instanceof Token || currency instanceof Native ? currency : undefined,
    { enabled: Boolean(currency && amount && !isSolana(currency.chainId)), ...config },
  )
  const { data: solanaPrice } = useSolanaTokenPrice({
    mint: currency?.wrapped.address,
    enabled: Boolean(currency && amount && isSolana(currency.chainId)),
  })

  return useMemo(() => {
    if (!currency) {
      return undefined
    }
    if (amount) {
      if (isSolana(currency.chainId)) {
        return new BigNumber(solanaPrice ?? 0).times(amount).toNumber()
      }
      if (stablePrice) {
        return multiplyPriceByAmount(stablePrice, amount)
      }
    }
    return 0
  }, [amount, stablePrice, currency, solanaPrice])
}
