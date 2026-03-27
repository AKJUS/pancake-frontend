import { useTranslation } from '@pancakeswap/localization'
import { Box, FlexGap, SearchInput, Text } from '@pancakeswap/uikit'

import { NetworkFilter } from '@pancakeswap/widgets-internal'
import { BalanceData } from 'hooks/useAddressBalance'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { safeGetUnifiedAddress } from 'utils/safeGetAddress'
import { useAllChainsOpts } from 'views/universalFarms/hooks/useMultiChains'
import { useSendGiftContext } from 'views/Gift/providers/SendGiftProvider'
import { getSunsetLegacyLink } from 'utils/sunsetLegacyLinks'
import { useWalletPanel } from 'components/Menu/WalletPanelContext'
import { ActionButton } from './ActionButton'
import { AssetsList } from './AssetsList'
import { SendAssetForm } from './SendAssetForm'
import { SEND_ENTRY, ViewState } from './type'
import { useWalletModalV2ViewState } from './WalletModalV2ViewStateProvider'

interface SendAssetsProps {
  assets: BalanceData[]
  isLoading: boolean
  onBack: () => void
  viewState: ViewState
  onViewStateChange: (viewState: ViewState) => void
}

// Convert balances to Asset type for AssetsList component

export const SendAssets: React.FC<SendAssetsProps> = ({ assets, isLoading, onBack, viewState, onViewStateChange }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNetworks, setSelectedNetworks] = useState<number[]>([])
  const [selectedAsset, setSelectedAsset] = useState<BalanceData | null>(null)
  const { t } = useTranslation()
  const { setIsSendGift, setNativeAmount, setIncludeStarterGas } = useSendGiftContext()
  const { sendEntry } = useWalletModalV2ViewState()
  const { pendingSendTarget, clearPendingSendTarget } = useWalletPanel()
  const convertBalancesToAssets = useCallback((balanceItems): BalanceData[] => {
    return balanceItems.map((item) => ({
      id: item.id,
      chainId: item.chainId,
      token: item.token,
      quantity: item.quantity,
      price:
        item.price && item.price.totalUsd !== null
          ? { totalUsd: item.price.totalUsd || 0, usd: item.price.usd, usd24h: item.price.usd24h }
          : undefined,
    }))
  }, [])

  // Get unique networks from assets
  const allChainsOpts = useAllChainsOpts()

  const filteredTokens = useMemo(() => {
    // First filter by networks if any are selected
    const networkFilteredBalances =
      selectedNetworks.length === 0 ? assets : assets.filter((asset) => selectedNetworks.includes(asset.chainId))

    // Then filter by search query if provided
    const searchFilteredBalances = searchQuery
      ? networkFilteredBalances.filter(
          (asset) =>
            asset.token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.token.address.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : networkFilteredBalances

    return convertBalancesToAssets(searchFilteredBalances)
  }, [assets, selectedNetworks, searchQuery, convertBalancesToAssets])

  useEffect(() => {
    if (!pendingSendTarget || isLoading) return

    const { chainId, tokenAddress } = pendingSendTarget
    const normalizedTargetAddress = safeGetUnifiedAddress(chainId, tokenAddress)

    const matchedAsset = assets.find((asset) => {
      if (asset.chainId !== chainId) return false
      const normalizedAssetAddress = safeGetUnifiedAddress(asset.chainId, asset.token.address)
      return normalizedAssetAddress === normalizedTargetAddress
    })

    clearPendingSendTarget()

    if (!matchedAsset) return

    setSelectedAsset(matchedAsset)
    onViewStateChange(ViewState.SEND_FORM)
    setIsSendGift(false)
    setNativeAmount(undefined)
    setIncludeStarterGas(false)
  }, [
    assets,
    clearPendingSendTarget,
    isLoading,
    onViewStateChange,
    pendingSendTarget,
    setIncludeStarterGas,
    setIsSendGift,
    setNativeAmount,
  ])

  if (viewState >= ViewState.SEND_FORM && selectedAsset)
    return <SendAssetForm asset={selectedAsset} onViewStateChange={onViewStateChange} viewState={viewState} />

  return (
    <>
      <Text fontSize="20px" fontWeight="bold" mb="16px" mt="12px">
        {t('Send Assets')}
      </Text>
      <FlexGap gap="16px" flexDirection="column" mb="16px">
        <Box>
          <NetworkFilter data={allChainsOpts} value={selectedNetworks} onChange={setSelectedNetworks} multiple />
        </Box>

        <Box>
          <SearchInput
            placeholder="Search by name or paste address"
            onChange={(e) => setSearchQuery(e.target.value)}
            initialValue={searchQuery}
          />
        </Box>
      </FlexGap>
      <AssetsList
        assets={filteredTokens}
        isLoading={isLoading}
        onRowClick={(asset) => {
          if (getSunsetLegacyLink(asset.chainId) && typeof window !== 'undefined') {
            window.open(getSunsetLegacyLink(asset.chainId), '_blank', 'noopener noreferrer')
            return
          }
          setSelectedAsset(asset)
          onViewStateChange(ViewState.SEND_FORM)
          if (sendEntry === SEND_ENTRY.CREATE_GIFT) {
            setIsSendGift(true)
          } else {
            setIsSendGift(false)
          }
          // reset the native amount and include starter gas
          setNativeAmount(undefined)
          setIncludeStarterGas(false)
        }}
      />
      <FlexGap gap="16px" mt="16px">
        <ActionButton onClick={onBack} variant="tertiary">
          {t('Cancel')}
        </ActionButton>
      </FlexGap>
    </>
  )
}
