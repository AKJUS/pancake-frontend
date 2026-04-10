import { ChainId, isSolana, UnifiedChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { Native, SOL, Token, UnifiedCurrency } from '@pancakeswap/sdk'
import { SPLToken } from '@pancakeswap/swap-sdk-core'
import { WrappedTokenInfo } from '@pancakeswap/token-lists'
import { AutoColumn, FlexGap, HistoryIcon, Text } from '@pancakeswap/uikit'
import { CurrencyLogo } from '@pancakeswap/widgets-internal'
import { useCallback, useMemo } from 'react'
import { useCombinedActiveList } from 'state/lists/hooks'
import { useRecentlySwappedTokens } from 'state/transactions/hooks'
import { SwapTokenRecord } from 'state/transactions/reducer'
import { useSolanaTokenList } from 'hooks/solana/useSolanaTokenList'
import { safeGetAddress } from 'utils'
import { BaseWrapper, ButtonWrapper, RowWrapper } from './CommonBases'

export default function RecentSwaps({
  onSelect,
  selectedCurrency,
  supportCrossChain,
  allowedChainIds,
}: {
  onSelect: (currency: UnifiedCurrency) => void
  selectedCurrency?: UnifiedCurrency | null
  supportCrossChain?: boolean
  allowedChainIds?: UnifiedChainId[]
}) {
  const { t } = useTranslation()
  const recentTokens = useRecentlySwappedTokens()
  const tokenListMap = useCombinedActiveList()
  const { tokenList: solanaTokens } = useSolanaTokenList()

  // Resolve a SwapTokenRecord into a currency with logoURI when possible.
  // Looks up the token list first so WrappedTokenInfo (with logoURI) is used;
  // falls back to bare Token/SPLToken when not found.
  const recordToCurrency = useCallback(
    (record: SwapTokenRecord): UnifiedCurrency | null => {
      try {
        if (record.isNative) {
          if (isSolana(record.chainId)) return SOL
          return Native.onChain(record.chainId)
        }
        if (!record.address) return null

        // Solana SPL tokens — check the Solana token list for logoURI
        if (isSolana(record.chainId)) {
          const solToken = solanaTokens.find((t) => t.address === record.address)
          if (solToken) return solToken
          return new SPLToken({
            chainId: record.chainId,
            address: record.address,
            decimals: record.decimals,
            symbol: record.symbol,
            name: record.name,
            logoURI: '',
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          })
        }

        // EVM tokens — check the combined active list for WrappedTokenInfo (has logoURI)
        const checksummed = safeGetAddress(record.address)
        if (checksummed) {
          const listEntry = (tokenListMap[record.chainId] ?? {})[checksummed] as { token: WrappedTokenInfo } | undefined
          if (listEntry) return listEntry.token
        }

        return new Token(record.chainId, record.address as `0x${string}`, record.decimals, record.symbol, record.name)
      } catch {
        return null
      }
    },
    [tokenListMap, solanaTokens],
  )

  const filteredTokens = useMemo(() => {
    if (!allowedChainIds) return recentTokens
    return recentTokens.filter((record) => allowedChainIds.includes(record.chainId as UnifiedChainId))
  }, [recentTokens, allowedChainIds])

  if (filteredTokens.length === 0) return null

  return (
    <AutoColumn gap="sm">
      <FlexGap gap="3px">
        <HistoryIcon width="18px" color="textSubtle" />
        <Text color="textSubtle" fontSize="14px" mb="2px">
          {t('Recent Swaps')}
        </Text>
      </FlexGap>
      <RowWrapper>
        {filteredTokens.map((record) => {
          const currency = recordToCurrency(record)
          if (!currency) return null
          const selected = Boolean(selectedCurrency?.equals?.(currency))
          return (
            <ButtonWrapper key={`recent-${record.chainId}-${record.address ?? 'native'}`}>
              <BaseWrapper onClick={() => !selected && onSelect(currency)} disable={selected}>
                <CurrencyLogo
                  showChainLogo={supportCrossChain}
                  currency={currency}
                  style={{ borderRadius: '50%' }}
                  containerStyle={{ position: 'relative', top: '1px' }}
                />
                <Text px="4px" color="inherit">
                  {record.chainId === ChainId.OPBNB ? `${record.symbol} (opBNB)` : record.symbol}
                </Text>
              </BaseWrapper>
            </ButtonWrapper>
          )
        })}
      </RowWrapper>
    </AutoColumn>
  )
}
