import { useTranslation } from '@pancakeswap/localization'
import { Currency } from '@pancakeswap/sdk'
import { Pool } from '@pancakeswap/v3-sdk'
import {
  AutoColumn,
  AutoRow,
  Button,
  Flex,
  IconButton,
  MinusIcon,
  Text,
  useModal,
  useModalV2,
} from '@pancakeswap/uikit'
import { ConfirmationModalContent } from '@pancakeswap/widgets-internal'
import { LightGreyCard } from 'components/Card'
import { CurrencyLogo } from 'components/Logo'
import TransactionConfirmationModal from 'components/TransactionConfirmationModal'
import { useV3PositionFees } from 'hooks/v3/useV3PositionFees'
import { useCallback, useMemo, memo, useState } from 'react'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import styled from 'styled-components'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import { logGTMClickStakeFarmEvent } from 'utils/customGTMEventTracking'
import useFarmV3Actions from 'views/Farms/hooks/v3/useFarmV3Actions'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { useV3CakeEarning } from 'views/universalFarms/hooks/useCakeEarning'
import useV3CollectFeeAction from 'views/universalFarms/hooks/useV3CollectFeeAction'
import { useOpenHarvestModal } from 'components/HarvestPositionsModal'
import { V3StakeModal } from '../Modals/V3StakeModal'
import { StopPropagation } from '../StopPropagation'
import { ActionPanelContainer } from '../shared/styled'

const StyledButton = styled(Button)`
  color: ${({ theme }) => theme.colors.primary60};
`

type ActionPanelProps = {
  removed: boolean
  outOfRange: boolean
  tokenId?: bigint
  isStaked?: boolean
  isFarmLive?: boolean
  modalContent: React.ReactNode
  chainId: number
  detailMode?: boolean
  pool?: Pool
  currency0?: Currency
  currency1?: Currency
  /** Show Collect (LP fees) button - only used in universalFarms PositionsTable */
  showCollectButton?: boolean
  /** Hide Stake and Unstake buttons - used in mobile PositionListCard */
  hideStakeButtons?: boolean
}

export const V3PositionActions = memo(
  ({
    isFarmLive,
    chainId,
    isStaked,
    removed,
    outOfRange,
    tokenId,
    modalContent,
    detailMode = false,
    pool,
    currency0,
    currency1,
    showCollectButton = false,
    hideStakeButtons = false,
  }: ActionPanelProps) => {
    const {
      t,
      currentLanguage: { locale },
    } = useTranslation()
    const [, setLatestTxReceipt] = useLatestTxReceipt()
    const openHarvestModal = useOpenHarvestModal()
    const { onStake, onUnstake, attemptingTxn } = useFarmV3Actions({
      tokenId: tokenId?.toString() ?? '',
      onDone: setLatestTxReceipt,
    })
    const stakeModal = useModalV2()
    const { switchNetworkIfNecessary, isLoading: isSwitchingNetwork } = useCheckShouldSwitchNetwork()

    // Collect fee functionality
    const [feeValue0, feeValue1] = useV3PositionFees(pool, tokenId, false)
    const {
      onCollect,
      attemptingTx: isCollecting,
      isLoadingStakedPositions,
    } = useV3CollectFeeAction({
      chainId,
    })
    const [collectHash, setCollectHash] = useState<string | null>(null)
    const [collectErrorMessage, setCollectErrorMessage] = useState<string | undefined>()

    const hasFees = useMemo(() => {
      return (feeValue0 && feeValue0.greaterThan(0)) || (feeValue1 && feeValue1.greaterThan(0))
    }, [feeValue0, feeValue1])

    const handleStakeAndCheckInactive = useCallback(async () => {
      logGTMClickStakeFarmEvent()
      if (outOfRange && !isStaked) {
        stakeModal.onOpen()
      } else {
        const shouldSwitch = await switchNetworkIfNecessary(chainId)
        if (!shouldSwitch) {
          await onStake()
        }
      }
    }, [isStaked, onStake, outOfRange, stakeModal, switchNetworkIfNecessary, chainId])

    const handleStake = useCallback(async () => {
      logGTMClickStakeFarmEvent()
      const shouldSwitch = await switchNetworkIfNecessary(chainId)
      if (!shouldSwitch) {
        await onStake()
      }
    }, [onStake, switchNetworkIfNecessary, chainId])

    const handleUnStake = useCallback(async () => {
      const shouldSwitch = await switchNetworkIfNecessary(chainId)
      if (!shouldSwitch) {
        await onUnstake()
        stakeModal.onDismiss()
      }
    }, [onUnstake, switchNetworkIfNecessary, chainId, stakeModal])

    const handleCollect = useCallback(async () => {
      if (!pool || !tokenId) return
      const shouldSwitch = await switchNetworkIfNecessary(chainId)
      if (shouldSwitch) return
      try {
        setCollectErrorMessage(undefined)
        setCollectHash(null)
        const hash = await onCollect({
          pool,
          tokenId,
          feeValue0,
          feeValue1,
          receiveWNATIVE: false,
        })
        if (hash) {
          setCollectHash(hash)
        }
      } catch (error: any) {
        console.error('[V3PositionActions] Collect error:', error)
        setCollectErrorMessage(error?.message || t('Transaction failed'))
        setCollectHash(null)
      }
    }, [pool, tokenId, onCollect, feeValue0, feeValue1, t, switchNetworkIfNecessary, chainId])

    const handleDismissCollectConfirmation = useCallback(() => {
      setCollectErrorMessage(undefined)
      setCollectHash(null)
    }, [])

    const collectModalHeader = useCallback(
      () => (
        <>
          <LightGreyCard mb="16px">
            <AutoRow justifyContent="space-between" mb="8px">
              <Flex>
                <CurrencyLogo currency={feeValue0?.currency} size="24px" />
                <Text color="textSubtle" ml="4px">
                  {feeValue0?.currency?.symbol}
                </Text>
              </Flex>
              <Text>{feeValue0 ? formatCurrencyAmount(feeValue0, 4, locale) : '-'}</Text>
            </AutoRow>
            <AutoRow justifyContent="space-between">
              <Flex>
                <CurrencyLogo currency={feeValue1?.currency} size="24px" />
                <Text color="textSubtle" ml="4px">
                  {feeValue1?.currency?.symbol}
                </Text>
              </Flex>
              <Text>{feeValue1 ? formatCurrencyAmount(feeValue1, 4, locale) : '-'}</Text>
            </AutoRow>
          </LightGreyCard>
          <Text mb="16px" px="16px">
            {t('Collecting fees will withdraw currently available fees for you')}
          </Text>
        </>
      ),
      [feeValue0, feeValue1, t],
    )

    const collectModalContent = useCallback(
      () => (
        <ConfirmationModalContent
          topContent={collectModalHeader}
          bottomContent={() => (
            <Button width="100%" onClick={handleCollect} disabled={isCollecting}>
              {isCollecting ? t('Collecting') : t('Collect')}
            </Button>
          )}
        />
      ),
      [collectModalHeader, handleCollect, isCollecting, t],
    )

    const effectiveAttemptingTxn = isCollecting && !collectHash

    const [onOpenCollectModal] = useModal(
      <TransactionConfirmationModal
        title={t('Claim fees')}
        attemptingTxn={effectiveAttemptingTxn}
        customOnDismiss={handleDismissCollectConfirmation}
        hash={collectHash ?? ''}
        errorMessage={collectErrorMessage}
        content={collectModalContent}
        pendingText={t('Collecting fees')}
      />,
      true,
      true,
      'TransactionConfirmationModalCollectFees',
    )

    const stakeButton = useMemo(
      () => (
        <>
          <Button
            scale="md"
            width={['100px']}
            style={{ alignSelf: 'center' }}
            onClick={handleStakeAndCheckInactive}
            disabled={attemptingTxn || isSwitchingNetwork}
          >
            {t('Stake')}
          </Button>
          <V3StakeModal
            isOpen={stakeModal.isOpen}
            staking={outOfRange && !isStaked}
            onStake={handleStake}
            onDismiss={stakeModal.onDismiss}
          >
            {modalContent}
          </V3StakeModal>
        </>
      ),
      [
        isSwitchingNetwork,
        handleStake,
        handleStakeAndCheckInactive,
        isStaked,
        modalContent,
        t,
        outOfRange,
        stakeModal,
        attemptingTxn,
      ],
    )

    const unstakeButton = useMemo(
      () => (
        <>
          {detailMode ? (
            <IconButton variant="secondary" disabled={attemptingTxn || isSwitchingNetwork} onClick={stakeModal.onOpen}>
              <MinusIcon color="primary" width="24px" />
            </IconButton>
          ) : (
            <StyledButton
              scale="md"
              width={['100px']}
              style={{ alignSelf: 'center' }}
              variant="secondary"
              onClick={stakeModal.onOpen}
              disabled={attemptingTxn || isSwitchingNetwork}
            >
              {t('Unstake')}
            </StyledButton>
          )}
          <V3StakeModal
            disabled={attemptingTxn || isSwitchingNetwork}
            isOpen={stakeModal.isOpen}
            staking={outOfRange && !isStaked}
            onUnStake={handleUnStake}
            onDismiss={stakeModal.onDismiss}
          >
            {modalContent}
          </V3StakeModal>
        </>
      ),
      [detailMode, isSwitchingNetwork, handleUnStake, isStaked, modalContent, t, outOfRange, stakeModal, attemptingTxn],
    )

    const { hasEarnings, isLoading: isEarningsLoading } = useV3CakeEarning(
      useMemo(() => (isStaked && tokenId ? [tokenId] : []), [tokenId, isStaked]),
      chainId,
    )

    return (
      <StopPropagation>
        <ActionPanelContainer>
          {!hideStakeButtons && (isStaked ? unstakeButton : !removed && isFarmLive ? stakeButton : null)}
          {showCollectButton && !removed && hasFees ? (
            <Button
              width={['100px']}
              scale="md"
              disabled={isCollecting || isSwitchingNetwork || isLoadingStakedPositions || !pool}
              onClick={onOpenCollectModal}
            >
              {isCollecting ? t('Collecting') : t('Collect')}
            </Button>
          ) : null}
          {isStaked && !removed ? (
            <Button
              width={['100px']}
              scale="md"
              disabled={isEarningsLoading || !hasEarnings}
              onClick={() => openHarvestModal?.('evm', chainId)}
            >
              {t('Harvest')}
            </Button>
          ) : null}
        </ActionPanelContainer>
      </StopPropagation>
    )
  },
)
