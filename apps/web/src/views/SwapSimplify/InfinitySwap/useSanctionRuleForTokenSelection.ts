import { ChainId } from '@pancakeswap/chains'
import { Native, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { USDT } from '@pancakeswap/tokens'
import { isRwaTokenAtom, rwaTokenListAtom, usdonTokenAtom } from 'quoter/atom/rwaTokenAtoms'

type RwaPanelConfig = {
  tokensToShow?: Token[]
  supportCrossChain: boolean
  showCommonBases: boolean
  showNative?: boolean
}

type AllowedTokensResult = {
  tokens?: Token[]
  showNative: boolean
  isRwa: boolean
}

const useAllowedTokensForCurrency = (currency?: UnifiedCurrency | null): AllowedTokensResult => {
  const normalizedChainId = typeof currency?.chainId === 'number' ? (currency.chainId as ChainId) : undefined
  const address = currency?.wrapped?.address ?? ''

  const isRwa = useAtomValue(
    useMemo(
      () =>
        isRwaTokenAtom({
          chainId: normalizedChainId ?? 0,
          address,
        }),
      [normalizedChainId, address],
    ),
  )

  const usdtToken = normalizedChainId !== undefined ? USDT[normalizedChainId] : undefined
  const rwaTokenInfos = useAtomValue(rwaTokenListAtom)
  const rwaTokens = useMemo(
    () =>
      rwaTokenInfos.map((tokenInfo) => {
        const token = new Token(
          tokenInfo.chainId as ChainId,
          tokenInfo.address,
          tokenInfo.decimals,
          tokenInfo.symbol,
          tokenInfo.name,
        )
        // @ts-ignore
        token.logoURI = tokenInfo.logoURI
        return token
      }),
    [rwaTokenInfos],
  )
  const usdOnToken = useAtomValue(usdonTokenAtom(normalizedChainId))

  return useMemo(() => {
    if (!isRwa || !normalizedChainId) {
      return { tokens: undefined, showNative: false, isRwa: false }
    }

    const wNativeToken = Native.onChain(normalizedChainId ?? 0).wrapped
    if (usdOnToken && currency?.wrapped.equals(usdOnToken)) {
      return { tokens: [...rwaTokens], showNative: false, isRwa: true }
    }

    const list: Token[] = []
    if (usdtToken) {
      list.push(usdtToken)
    }
    if (usdOnToken) {
      list.push(usdOnToken)
    }
    if (wNativeToken) {
      list.push(wNativeToken)
    }
    const showNative = normalizedChainId === ChainId.BSC
    return { tokens: list, showNative, isRwa: true }
  }, [currency?.wrapped?.address, isRwa, normalizedChainId, rwaTokens, usdtToken, usdOnToken])
}

export const useSanctionRuleForTokenSelection = (
  inputCurrency?: UnifiedCurrency | null,
  outputCurrency?: UnifiedCurrency | null,
): {
  inputConfig: RwaPanelConfig
  outputConfig: RwaPanelConfig
} => {
  const inputAllowedTokens = useAllowedTokensForCurrency(inputCurrency)
  const outputAllowedTokens = useAllowedTokensForCurrency(outputCurrency)

  const inputIsRwa = inputAllowedTokens.isRwa
  const outputIsRwa = outputAllowedTokens.isRwa

  return useMemo(
    () => ({
      inputConfig: {
        tokensToShow: outputIsRwa ? outputAllowedTokens.tokens : undefined,
        supportCrossChain: !outputIsRwa,
        showCommonBases: !outputIsRwa,
        showNative: outputIsRwa ? outputAllowedTokens.showNative : undefined,
      },
      outputConfig: {
        tokensToShow: inputIsRwa ? inputAllowedTokens.tokens : undefined,
        supportCrossChain: !inputIsRwa,
        showCommonBases: !inputIsRwa,
        showNative: inputIsRwa ? inputAllowedTokens.showNative : undefined,
      },
    }),
    [inputAllowedTokens, inputIsRwa, outputAllowedTokens, outputIsRwa],
  )
}

export type { RwaPanelConfig }
