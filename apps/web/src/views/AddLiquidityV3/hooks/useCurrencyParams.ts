import { ChainId } from '@pancakeswap/chains'
import { CAKE, STABLE_COIN, USDC, USDT } from '@pancakeswap/tokens'
import { FeeAmount } from '@pancakeswap/v3-sdk'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useRouter } from 'next/router'

export function useCurrencyParams(): {
  currencyIdA: string | undefined
  currencyIdB: string | undefined
  feeAmount: FeeAmount | undefined
} {
  const { chainId } = useActiveChainId()
  const router = useRouter()
  const native = useNativeCurrency()

  // Get default currency pair based on chain
  const getDefaultCurrencyPair = () => {
    if (!chainId) return [undefined, undefined]

    // BNB-USDT on BNB Chain
    if (chainId === ChainId.BSC) {
      return [
        native.symbol,
        USDT[chainId]?.address || CAKE[chainId]?.address || STABLE_COIN[chainId]?.address || USDC[chainId]?.address,
      ]
    }

    // ETH-USDC on all other EVM deployments
    return [
      native.symbol,
      USDC[chainId]?.address || USDT[chainId]?.address || CAKE[chainId]?.address || STABLE_COIN[chainId]?.address,
    ]
  }

  const [currencyIdA, currencyIdB, feeAmountFromUrl] =
    router.isReady && chainId ? router.query.currency || getDefaultCurrencyPair() : [undefined, undefined, undefined]

  const feeAmount: FeeAmount | undefined =
    feeAmountFromUrl && Object.values(FeeAmount).includes(parseFloat(feeAmountFromUrl))
      ? parseFloat(feeAmountFromUrl)
      : undefined

  return { currencyIdA, currencyIdB, feeAmount }
}
