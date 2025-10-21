import { useTranslation } from '@pancakeswap/localization'
import { Column, useMatchBreakpoints } from '@pancakeswap/uikit'
import { useCallback, useMemo } from 'react'
import uniqBy from 'lodash/uniqBy'
import { WalletAdaptedNetwork, WalletConfigV3 } from '../../types'
import { scrollbarClass } from '../WalletModal.css'
import { MoreWalletSection } from './MoreWalletSection'
import { WalletSelectItem, WalletSelectSection } from './WalletSelectSection'
import { useWalletFilterValue, WalletFilterValue } from '../../state/hooks'

export type WalletSelectProps = {
  wallets: WalletConfigV3[]
  topWallets: WalletConfigV3[]
  previouslyUsedWallets: [WalletConfigV3[], WalletConfigV3[]]
  onMultiChainWalletSelected?: (wallet: WalletConfigV3) => void
  onWalletSelected?: (wallet: WalletConfigV3, network: WalletAdaptedNetwork) => void
  style?: React.CSSProperties
}

export const WalletSelect: React.FC<WalletSelectProps> = ({
  wallets,
  topWallets,
  previouslyUsedWallets,
  onMultiChainWalletSelected,
  onWalletSelected,
  style = {},
}) => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  const walletFilter = useWalletFilterValue()

  const moreWallets = useMemo(() => {
    return wallets.filter(
      (wallet) =>
        !(
          topWallets.includes(wallet) ||
          previouslyUsedWallets?.[0]?.includes(wallet) ||
          previouslyUsedWallets?.[1]?.includes(wallet)
        ),
    )
  }, [wallets, topWallets, previouslyUsedWallets])

  const previous = useMemo(() => {
    return uniqBy([...(previouslyUsedWallets?.[0] ?? []), ...(previouslyUsedWallets?.[1] ?? [])], 'id')
  }, [previouslyUsedWallets])

  const topWallets_ = useMemo(() => {
    return topWallets.filter((wallet) => !previous.some((prev) => prev.id === wallet.id))
  }, [topWallets, previous])

  const handleWalletClick = useCallback(
    (wallet: WalletConfigV3) => {
      if (walletFilter === WalletFilterValue.SolanaOnly) {
        if (wallet.networks.includes(WalletAdaptedNetwork.Solana)) {
          onWalletSelected?.(wallet, WalletAdaptedNetwork.Solana)
        }
        return
      }

      if (walletFilter === WalletFilterValue.EVMOnly) {
        if (wallet.networks.includes(WalletAdaptedNetwork.EVM)) {
          onWalletSelected?.(wallet, WalletAdaptedNetwork.EVM)
        }
        return
      }

      if (wallet.networks.length === 1) {
        onWalletSelected?.(wallet, wallet.networks[0])
        return
      }

      onMultiChainWalletSelected?.(wallet)
    },
    [walletFilter, onWalletSelected, onMultiChainWalletSelected],
  )

  return (
    <Column
      overflowY="auto"
      overflowX="hidden"
      gap="16px"
      style={{
        ...(isMobile
          ? {
              maxHeight: '60vh',
              overflowY: 'auto',
            }
          : { paddingRight: '16px', marginRight: '-16px' }),
        ...style,
      }}
      className={scrollbarClass}
    >
      {previous?.length > 0 && (
        <WalletSelectSection label={t('Previously used')}>
          {previous.map((wallet) => (
            <WalletSelectItem key={wallet.id} wallet={wallet} onClick={handleWalletClick} />
          ))}
        </WalletSelectSection>
      )}
      {topWallets_.length > 0 && (
        <WalletSelectSection label={t('Top Wallets')}>
          {topWallets_.map((wallet) => (
            <WalletSelectItem key={wallet.id} wallet={wallet} onClick={handleWalletClick} />
          ))}
        </WalletSelectSection>
      )}
      <MoreWalletSection onClick={handleWalletClick} wallets={moreWallets} />
    </Column>
  )
}
