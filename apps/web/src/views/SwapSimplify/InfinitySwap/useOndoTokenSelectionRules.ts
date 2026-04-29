import { ChainId } from '@pancakeswap/chains'
import { Native, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { USDT } from '@pancakeswap/tokens'
import { isOndoTokenAtom, ondoTokenListAtom, usdonTokenAtom } from 'quoter/atom/ondoTokenAtoms'

type OndoPanelConfig = {
  tokensToShow?: Token[]
  supportCrossChain: boolean
  showCommonBases: boolean
  showNative?: boolean
}

type AllowedTokensResult = {
  tokens?: Token[]
  showNative: boolean
  isOndo: boolean
}

const useAllowedTokensForCurrency = (currency?: UnifiedCurrency | null): AllowedTokensResult => {
  const normalizedChainId = typeof currency?.chainId === 'number' ? (currency.chainId as ChainId) : undefined
  const address = currency?.wrapped?.address ?? ''
  const wrappedCurrency = currency?.wrapped

  const isOndo = useAtomValue(
    useMemo(
      () =>
        isOndoTokenAtom({
          chainId: normalizedChainId ?? 0,
          address,
        }),
      [normalizedChainId, address],
    ),
  )

  const usdtToken = normalizedChainId !== undefined ? USDT[normalizedChainId] : undefined
  const ondoTokenInfos = useAtomValue(ondoTokenListAtom)
  const ondoTokens = useMemo(
    () =>
      ondoTokenInfos.map((tokenInfo) => {
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
    [ondoTokenInfos],
  )
  const usdOnToken = useAtomValue(usdonTokenAtom(normalizedChainId))

  return useMemo(() => {
    if (!isOndo || !normalizedChainId) {
      return { tokens: undefined, showNative: false, isOndo: false }
    }

    const wNativeToken = Native.onChain(normalizedChainId).wrapped
    if (usdOnToken && wrappedCurrency?.equals(usdOnToken)) {
      return { tokens: [...ondoTokens], showNative: false, isOndo: true }
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
    return { tokens: list, showNative, isOndo: true }
  }, [isOndo, normalizedChainId, ondoTokens, usdtToken, usdOnToken, wrappedCurrency])
}

export const useOndoTokenSelectionRules = (
  inputCurrency?: UnifiedCurrency | null,
  outputCurrency?: UnifiedCurrency | null,
): {
  inputConfig: OndoPanelConfig
  outputConfig: OndoPanelConfig
} => {
  const inputAllowedTokens = useAllowedTokensForCurrency(inputCurrency)
  const outputAllowedTokens = useAllowedTokensForCurrency(outputCurrency)

  const inputIsOndo = inputAllowedTokens.isOndo
  const outputIsOndo = outputAllowedTokens.isOndo

  return useMemo(
    () => ({
      inputConfig: {
        tokensToShow: outputIsOndo ? outputAllowedTokens.tokens : undefined,
        supportCrossChain: !outputIsOndo,
        showCommonBases: !outputIsOndo,
        showNative: outputIsOndo ? outputAllowedTokens.showNative : undefined,
      },
      outputConfig: {
        tokensToShow: inputIsOndo ? inputAllowedTokens.tokens : undefined,
        supportCrossChain: !inputIsOndo,
        showCommonBases: !inputIsOndo,
        showNative: inputIsOndo ? inputAllowedTokens.showNative : undefined,
      },
    }),
    [inputAllowedTokens, inputIsOndo, outputAllowedTokens, outputIsOndo],
  )
}

export type { OndoPanelConfig }
