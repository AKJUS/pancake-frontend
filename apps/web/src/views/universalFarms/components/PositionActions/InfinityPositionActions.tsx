import { useCallback, useMemo, memo, useState } from 'react'
import styled from 'styled-components'

import { Protocol } from '@pancakeswap/farms'
import { getPoolId, PoolKey } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { AutoColumn, AutoRow, Button, Flex, Text, useModal } from '@pancakeswap/uikit'
import { ConfirmationModalContent } from '@pancakeswap/widgets-internal'
import { LightGreyCard } from 'components/Card'
import { CurrencyLogo, DoubleCurrencyLogo } from 'components/Logo'
import TransactionConfirmationModal from 'components/TransactionConfirmationModal'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { useFeesEarned } from 'hooks/infinity/useFeesEarned'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import type { InfinityBinPositionDetail, InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import useFarmInfinityActions from 'views/universalFarms/hooks/useFarmInfinityActions'
import useInfinityCollectFeeAction from 'views/universalFarms/hooks/useInfinityCollectFeeAction'
import { useInfinityPositionsData } from 'views/universalFarms/hooks/useInfinityPositions'

import { useOpenHarvestModal } from 'components/HarvestPositionsModal'
import { StopPropagation } from '../StopPropagation'
import { ActionPanelContainer } from '../shared/styled'

interface ActionPanelProps {
  pos?: InfinityCLPositionDetail | InfinityBinPositionDetail
  positionList?: (InfinityCLPositionDetail | InfinityBinPositionDetail)[]
  chainId?: number
  showPositionFees?: boolean
  /** Show Collect (LP fees) button - only used in universalFarms PositionsTable */
  showCollectButton?: boolean
}

export const InfinityPositionActions = memo(
  ({
    pos: pos_,
    positionList = [],
    showPositionFees = true,
    chainId: chainId_,
    showCollectButton = false,
  }: ActionPanelProps) => {
    const {
      t,
      currentLanguage: { locale },
    } = useTranslation()
    const [, setLatestTxReceipt] = useLatestTxReceipt()
    const openHarvestModal = useOpenHarvestModal()

    // Fetch all infinity positions if not provided via props
    const { data: allInfinityPositions } = useInfinityPositionsData()
    const effectivePositionList = positionList.length > 0 ? positionList : allInfinityPositions

    const pos = useMemo(
      (): InfinityCLPositionDetail | InfinityBinPositionDetail | undefined =>
        pos_ ?? effectivePositionList?.find((x) => x.chainId === chainId_),
      [pos_, effectivePositionList, chainId_],
    )

    const chainId = chainId_ ?? pos?.chainId ?? 0

    const { isMerkleRootMismatch, hasRewards, hasUnclaimedRewards } = useFarmInfinityActions({
      chainId,
      onDone: setLatestTxReceipt,
    })
    const { onCollect, attemptingTx: collectAttemptingTxn } = useInfinityCollectFeeAction({
      chainId,
    })

    const currency0 = useCurrencyByChainId(pos?.poolKey?.currency0, chainId) ?? undefined
    const currency1 = useCurrencyByChainId(pos?.poolKey?.currency1, chainId) ?? undefined

    // Fetch fee amounts for CLAMM positions only
    const poolId = useMemo(() => {
      if (pos?.protocol === Protocol.InfinityCLAMM && pos.poolKey) {
        return getPoolId(pos.poolKey)
      }
      return undefined
    }, [pos?.protocol, pos?.poolKey])

    const clPosition = useMemo(
      (): InfinityCLPositionDetail | undefined =>
        pos?.protocol === Protocol.InfinityCLAMM ? (pos as InfinityCLPositionDetail) : undefined,
      [pos],
    )
    const [feeAmount0, feeAmount1] = useFeesEarned({
      currency0,
      currency1,
      tokenId: clPosition?.tokenId,
      poolId,
      tickLower: clPosition?.tickLower,
      tickUpper: clPosition?.tickUpper,
      enabled: pos?.protocol === Protocol.InfinityCLAMM,
    })

    const hasFees = useMemo(() => {
      return (
        pos?.protocol === Protocol.InfinityCLAMM &&
        ((feeAmount0 && feeAmount0.greaterThan(0)) || (feeAmount1 && feeAmount1.greaterThan(0)))
      )
    }, [pos?.protocol, feeAmount0, feeAmount1])

    const [collectErrorMessage, setCollectErrorMessage] = useState<string | undefined>()

    const handleCollect = useCallback(async () => {
      if (pos?.protocol !== Protocol.InfinityCLAMM || !pos.poolKey) {
        return
      }
      try {
        setCollectErrorMessage(undefined)
        await onCollect({
          tokenId: pos.tokenId,
          poolKey: pos.poolKey as PoolKey<'CL'>,
        })
        // Note: Modal auto-dismisses on successful transaction via TransactionConfirmationModal's internal logic
      } catch (error: unknown) {
        console.error('[InfinityPositionActions] Collect error:', error)
        const errorMessage = error instanceof Error ? error.message : t('Transaction failed')
        setCollectErrorMessage(errorMessage)
      }
    }, [onCollect, pos, t])

    const handleDismissCollectConfirmation = useCallback(() => {
      setCollectErrorMessage(undefined)
    }, [])

    const collectModalHeader = useCallback(
      () => (
        <>
          <LightGreyCard mb="16px">
            <AutoRow justifyContent="space-between" mb="8px">
              <Flex>
                <CurrencyLogo currency={currency0} size="24px" />
                <Text color="textSubtle" ml="4px">
                  {currency0?.symbol}
                </Text>
              </Flex>
              <Text>{feeAmount0 ? formatCurrencyAmount(feeAmount0, 4, locale) : '0'}</Text>
            </AutoRow>
            <AutoRow justifyContent="space-between">
              <Flex>
                <CurrencyLogo currency={currency1} size="24px" />
                <Text color="textSubtle" ml="4px">
                  {currency1?.symbol}
                </Text>
              </Flex>
              <Text>{feeAmount1 ? formatCurrencyAmount(feeAmount1, 4, locale) : '0'}</Text>
            </AutoRow>
          </LightGreyCard>
          <Text mb="16px" px="16px">
            {t('Collecting fees will withdraw currently available fees for you')}
          </Text>
        </>
      ),
      [currency0, currency1, feeAmount0, feeAmount1, locale, clPosition?.tokenId, t],
    )

    const collectModalContent = useCallback(
      () => (
        <ConfirmationModalContent
          topContent={collectModalHeader}
          bottomContent={() => (
            <Button width="100%" onClick={handleCollect} disabled={collectAttemptingTxn}>
              {collectAttemptingTxn ? t('Collecting') : t('Collect')}
            </Button>
          )}
        />
      ),
      [collectModalHeader, handleCollect, collectAttemptingTxn, clPosition?.tokenId, t],
    )

    const positionKey = useMemo(() => {
      if (clPosition?.tokenId) return clPosition.tokenId.toString()
      if (pos?.protocol === Protocol.InfinityBIN) {
        return (pos as InfinityBinPositionDetail).activeId?.toString() ?? 'unknown'
      }
      return 'unknown'
    }, [clPosition, pos])

    const [onOpenCollectModal] = useModal(
      <TransactionConfirmationModal
        key={`collect-${chainId}-${positionKey}-${currency0?.symbol}-${currency1?.symbol}`}
        title={t('Claim fees')}
        attemptingTxn={collectAttemptingTxn}
        customOnDismiss={handleDismissCollectConfirmation}
        hash=""
        errorMessage={collectErrorMessage}
        content={collectModalContent}
        pendingText={t('Collecting fees')}
      />,
      true,
      true,
      `TransactionConfirmationModalCollectFees-${chainId}-${positionKey}`,
    )

    if (!currency0 || !currency1) {
      return null
    }

    return (
      <StopPropagation>
        <ActionPanelContainer>
          {showCollectButton && hasFees ? (
            <Button width={['100px']} scale="md" disabled={collectAttemptingTxn} onClick={onOpenCollectModal}>
              {collectAttemptingTxn ? t('Collecting') : t('Collect')}
            </Button>
          ) : null}
          <Button
            width={['100px']}
            scale="md"
            disabled={isMerkleRootMismatch || !hasRewards || !hasUnclaimedRewards}
            onClick={() => openHarvestModal?.('evm', chainId)}
          >
            {t('Harvest')}
          </Button>
        </ActionPanelContainer>
      </StopPropagation>
    )
  },
)
