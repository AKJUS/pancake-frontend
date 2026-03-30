import { useTranslation } from '@pancakeswap/localization'
import { ButtonMenu, ButtonMenuItem, FlexGap, ModalV2, ModalV2Props, MotionModal } from '@pancakeswap/uikit'
import { useSetAtom } from 'jotai'
import { useCallback, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { resetHarvestStatusAtom } from './state/atoms'
import { EvmHarvestPanel } from './EvmHarvestPanel'
import { SolanaHarvestPanel } from './SolanaHarvestPanel'
import { useHarvestModalData } from './hooks/useHarvestModalData'
import type { HarvestTab } from './HarvestModalContext'

export { useHarvestModalData } from './hooks/useHarvestModalData'
export { TotalEarningsBanner } from './TotalEarningsBanner'
export { HarvestModalContext, useOpenHarvestModal } from './HarvestModalContext'
export type { HarvestTab } from './HarvestModalContext'

interface HarvestEarningsModalProps extends Pick<ModalV2Props, 'isOpen' | 'onDismiss'> {
  defaultTab?: HarvestTab
  /** When set, the EVM panel will prompt to switch to this chain if it doesn't match the active chain */
  focusedChainId?: number
}

export function HarvestEarningsModal({
  isOpen,
  onDismiss,
  defaultTab = 'evm',
  focusedChainId: initialFocusedChainId,
}: HarvestEarningsModalProps) {
  const { t } = useTranslation()
  const resetStatus = useSetAtom(resetHarvestStatusAtom)
  const { publicKey: solanaPublicKey } = useWallet()
  const { switchNetwork } = useSwitchNetwork()

  const hasSolanaWallet = Boolean(solanaPublicKey)
  const [activeTab, setActiveTab] = useState<HarvestTab>(defaultTab)

  // Local chain override — initialised from the position that triggered the modal open,
  // then updated whenever the user switches chain from within the modal (either via the
  // "Switch to X" button or via the "other chains" earnings hint).
  const [focusedChainId, setFocusedChainId] = useState<number | undefined>(initialFocusedChainId)

  const {
    v3HarvestPositions,
    infinityHarvestPositions,
    v2Positions,
    stablePositions,
    v3StakedTokenIds,
    v2Targets,
    v2StableEarningsByKey,
    otherChainsWithRewards,
    solanaPositions,
    solanaTotalEarningsUSD,
    solanaHarvestTargets,
    solanaInitialLoading,
    solanaRefreshing,
    isCurrentChainEvmLoading,
    isOtherChainsEvmLoading,
    effectiveEvmChainId,
  } = useHarvestModalData(focusedChainId)

  const handleDismiss = useCallback(() => {
    onDismiss?.()
  }, [onDismiss])

  const handleSwitchChain = useCallback(
    (chainId: number) => {
      resetStatus()
      setFocusedChainId(chainId)
      switchNetwork(chainId)
    },
    [resetStatus, switchNetwork],
  )

  const handleTabChange = useCallback(
    (index: number) => {
      const tab: HarvestTab = index === 0 ? 'evm' : 'solana'
      if (tab === 'solana' && !hasSolanaWallet) return
      setActiveTab(tab)
    },
    [hasSolanaWallet],
  )

  return (
    <ModalV2 isOpen={isOpen} onDismiss={handleDismiss} closeOnOverlayClick>
      <MotionModal
        title={t('Harvest Earnings')}
        headerBorderColor="transparent"
        bodyPadding="0 24px 16px"
        onDismiss={handleDismiss}
        width={['100%', null, '480px']}
      >
        <FlexGap flexDirection="column" gap="16px" py="3px">
          <ButtonMenu
            activeIndex={activeTab === 'evm' ? 0 : 1}
            onItemClick={handleTabChange}
            scale="sm"
            variant="subtle"
            fullWidth
          >
            <ButtonMenuItem>{t('EVM')}</ButtonMenuItem>
            <ButtonMenuItem disabled={!hasSolanaWallet} style={{ opacity: hasSolanaWallet ? 1 : 0.5 }}>
              {t('Solana')}
            </ButtonMenuItem>
          </ButtonMenu>

          {activeTab === 'evm' && (
            <EvmHarvestPanel
              v3HarvestPositions={v3HarvestPositions}
              infinityHarvestPositions={infinityHarvestPositions}
              v2Positions={v2Positions}
              stablePositions={stablePositions}
              v3StakedTokenIds={v3StakedTokenIds}
              v2Targets={v2Targets}
              v2StableEarningsByKey={v2StableEarningsByKey}
              harvestModalChainId={effectiveEvmChainId}
              otherChainsWithRewards={otherChainsWithRewards}
              otherChainsLoading={isOtherChainsEvmLoading}
              positionsLoading={isCurrentChainEvmLoading}
              onSwitchChain={handleSwitchChain}
              focusedChainId={focusedChainId}
            />
          )}

          {activeTab === 'solana' && (
            <SolanaHarvestPanel
              initialLoading={solanaInitialLoading}
              refreshing={solanaRefreshing}
              positions={solanaPositions}
              totalEarningsUSD={solanaTotalEarningsUSD}
              harvestTargets={solanaHarvestTargets}
            />
          )}
        </FlexGap>
      </MotionModal>
    </ModalV2>
  )
}
