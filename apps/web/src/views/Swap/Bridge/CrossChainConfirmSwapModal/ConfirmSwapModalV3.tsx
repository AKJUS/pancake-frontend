import { useTranslation } from '@pancakeswap/localization'
import { ChainId, Currency, CurrencyAmount, Token, TradeType } from '@pancakeswap/sdk'
import { useCallback, useMemo } from 'react'

import { WrappedTokenInfo } from '@pancakeswap/token-lists'
import { Box, BscScanIcon, Flex, InjectedModalProps, Link, Text } from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import truncateHash from '@pancakeswap/utils/truncateHash'
import {
  ApproveModalContent,
  ApproveModalContentV3,
  ConfirmModalState,
  SwapPendingModalContent,
  SwapPendingModalContentV3,
  SwapTransactionReceiptModalContent,
} from '@pancakeswap/widgets-internal'
import AddToWalletButton, { AddToWalletTextOptions } from 'components/AddToWallet/AddToWalletButton'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import { Field } from 'state/swap/actions'
import { useSwapState } from 'state/swap/hooks'
import { useBlockExploreLink, useBlockExploreName } from 'utils'
import { wrappedCurrency } from 'utils/wrappedCurrency'
import { SwapTransactionErrorContent } from 'views/Swap/components/SwapTransactionErrorContent'

import { DISPLAY_PRECISION } from 'config/constants/formatting'
import { useAtom } from 'jotai'
import { getFullChainNameById } from 'utils/getFullChainNameById'
import { Hash } from 'viem'
import { EVMInterfaceOrder, InterfaceOrder, isBridgeOrder, isXOrder } from 'views/Swap/utils'

import { ConfirmAction } from 'views/Swap/V3Swap/hooks/steps/step.type'
import { useSlippageAdjustedAmounts } from 'views/Swap/V3Swap/hooks'
import { AllowedAllowanceState } from 'views/Swap/V3Swap/types'
import { useBridgeStatus } from '../hooks'
import { customBridgeStatus } from '../utils/customBridgeStatus'

import { getBridgeTitle } from '../utils/bridgeTitle'
import ConfirmSwapModalV3Container from './ConfirmSwapModalV3Container'
import { OrderResultModalContent } from './OrderStatus/OrderResultModalContent'
import { TransactionConfirmSwapContentV3 } from './TransactionConfirmSwapContentV3'
import { activeBridgeOrderMetadataAtom } from './state/orderDataState'
import { BridgeStatus } from '../types'

export const useApprovalPhaseStepTitles: ({ trade }: { trade: InterfaceOrder['trade'] | undefined }) => {
  [step in AllowedAllowanceState]: string
} = ({ trade }) => {
  const { t } = useTranslation()
  return useMemo(() => {
    return {
      [ConfirmModalState.RESETTING_APPROVAL]: t('Reset approval on USDT.'),
      [ConfirmModalState.APPROVING_TOKEN]: t('Approve %symbol%', {
        symbol: trade ? trade.inputAmount.currency.symbol : '',
      }),
      [ConfirmModalState.PERMITTING]: t('Permit %symbol%', { symbol: trade ? trade.inputAmount.currency.symbol : '' }),
    }
  }, [t, trade])
}

type ConfirmSwapModalV3Props = InjectedModalProps & {
  customOnDismiss?: () => void
  onDismiss?: () => void
  confirmModalState: ConfirmModalState
  pendingModalSteps: ConfirmAction[]
  order?: EVMInterfaceOrder | null
  originalOrder?: EVMInterfaceOrder | null
  currencyBalances?: { [field in Field]?: CurrencyAmount<Currency> }
  txHash?: string
  orderHash?: Hash
  swapErrorMessage?: string
  onAcceptChanges: () => void
  onConfirm: (setConfirmModalState?: () => void) => void
  openSettingModal?: () => void
}

export const ConfirmSwapModalV3: React.FC<ConfirmSwapModalV3Props> = ({
  confirmModalState,
  pendingModalSteps,
  order,
  originalOrder,
  currencyBalances,
  swapErrorMessage,
  onDismiss,
  customOnDismiss,
  txHash,
  orderHash,
  openSettingModal,
  onAcceptChanges,
  onConfirm,
}) => {
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()
  const blockExplorerName = useBlockExploreName(chainId)
  const getBlockExploreLink = useBlockExploreLink()

  // @ts-ignore
  const { slippageTolerance: allowedSlippage } = useAutoSlippageWithFallback(originalOrder?.trade)

  const [activeBridgeOrderMetadata, setActiveBridgeOrderMetadata] = useAtom(activeBridgeOrderMetadataAtom)

  const { data: bridgeStatus } = useBridgeStatus(
    activeBridgeOrderMetadata?.originChainId,
    activeBridgeOrderMetadata?.txHash,
    activeBridgeOrderMetadata?.metadata,
    activeBridgeOrderMetadata?.destinationChainId,
    activeBridgeOrderMetadata?.isMultisig,
  )

  const slippageAdjustedAmounts = useSlippageAdjustedAmounts(originalOrder)
  const { recipient } = useSwapState()
  const loadingAnimationVisible = useMemo(() => {
    return [
      ConfirmModalState.RESETTING_APPROVAL,
      ConfirmModalState.APPROVING_TOKEN,
      ConfirmModalState.PERMITTING,
    ].includes(confirmModalState)
  }, [confirmModalState])

  const hasError = useMemo(() => swapErrorMessage !== undefined, [swapErrorMessage])

  const stepContents = useApprovalPhaseStepTitles({ trade: originalOrder?.trade })
  const token: Token | undefined = useMemo(
    () => wrappedCurrency(originalOrder?.trade?.outputAmount?.currency, chainId),
    [chainId, originalOrder?.trade?.outputAmount?.currency],
  )

  const showAddToWalletButton = useMemo(() => {
    if (token && originalOrder?.trade?.outputAmount?.currency) {
      return !originalOrder?.trade?.outputAmount?.currency?.isNative
    }
    return false
  }, [token, originalOrder])

  const handleDismiss = useCallback(() => {
    // Reset the active bridge order metadata when the modal is dismissed
    setActiveBridgeOrderMetadata(null)

    if (typeof customOnDismiss === 'function') {
      customOnDismiss()
    }

    onDismiss?.()
  }, [customOnDismiss, setActiveBridgeOrderMetadata, onDismiss])

  const modalTitle = useMemo(() => {
    switch (confirmModalState) {
      case ConfirmModalState.APPROVING_TOKEN:
        return t('Approve %token%', {
          token: currencyBalances?.INPUT?.currency.symbol ?? originalOrder?.trade?.inputAmount?.currency.symbol,
        })
      case ConfirmModalState.PENDING_CONFIRMATION:
        return isBridgeOrder(order) ? t('Submit Order') : ''
      case ConfirmModalState.REVIEWING:
        return hasError ? '' : t('Confirm Swap')
      case ConfirmModalState.ORDER_SUBMITTED:
        return getBridgeTitle(t, customBridgeStatus(bridgeStatus))
      case ConfirmModalState.MULTISIG_SUBMITTED:
        return getBridgeTitle(t, BridgeStatus.MULTISIG_SUBMITTED)
      default:
        return ''
    }
  }, [
    t,
    order,
    hasError,
    confirmModalState,
    currencyBalances?.INPUT?.currency.symbol,
    originalOrder?.trade?.inputAmount?.currency.symbol,
    bridgeStatus,
  ])

  const modalContent = useMemo(() => {
    const isExactIn = originalOrder?.trade.tradeType === TradeType.EXACT_INPUT
    const currencyA = currencyBalances?.INPUT?.currency ?? originalOrder?.trade?.inputAmount?.currency
    const currencyB = currencyBalances?.OUTPUT?.currency ?? originalOrder?.trade?.outputAmount?.currency
    const amountAWithSlippage = formatAmount(slippageAdjustedAmounts[Field.INPUT], DISPLAY_PRECISION) ?? ''
    const amountBWithSlippage = formatAmount(slippageAdjustedAmounts[Field.OUTPUT], DISPLAY_PRECISION) ?? ''
    const amountA = isExactIn ? amountAWithSlippage : `Max ${amountAWithSlippage}`
    const amountB = isExactIn ? `Min ${amountBWithSlippage}` : amountBWithSlippage

    if (swapErrorMessage) {
      return (
        <Flex width="100%" alignItems="center" padding="12px 0">
          <SwapTransactionErrorContent
            message={swapErrorMessage}
            onDismiss={handleDismiss}
            openSettingModal={openSettingModal}
          />
        </Flex>
      )
    }

    if (
      confirmModalState === ConfirmModalState.APPROVING_TOKEN ||
      confirmModalState === ConfirmModalState.PERMITTING ||
      confirmModalState === ConfirmModalState.RESETTING_APPROVAL
    ) {
      if (isBridgeOrder(originalOrder)) {
        return (
          <ApproveModalContentV3
            mt="8px"
            title={stepContents}
            isX={isXOrder(order)}
            // TODO
            isBonus={false}
            currencyA={currencyA as Currency}
            chainName={getFullChainNameById(currencyA?.chainId)}
            asBadge
            currentStep={confirmModalState}
            approvalModalSteps={pendingModalSteps.map((step) => step.step) as any}
          />
        )
      }
      return (
        <ApproveModalContent
          title={stepContents}
          isX={isXOrder(order)}
          // TODO
          isBonus={false}
          currencyA={currencyA as Currency}
          asBadge
          currentStep={confirmModalState}
          approvalModalSteps={pendingModalSteps.map((step) => step.step) as any}
        />
      )
    }

    // TODO: x wrap flow
    if (confirmModalState === ConfirmModalState.WRAPPING) {
      return (
        <SwapPendingModalContent
          title={t('Wrap')}
          currencyA={currencyA}
          currencyB={currencyA?.wrapped}
          amountA={amountAWithSlippage}
          amountB={amountAWithSlippage}
          currentStep={confirmModalState}
        >
          {showAddToWalletButton && (txHash || orderHash) ? (
            <AddToWalletButton
              mt="39px"
              height="auto"
              variant="tertiary"
              width="fit-content"
              padding="6.5px 20px"
              marginTextBetweenLogo="6px"
              textOptions={AddToWalletTextOptions.TEXT_WITH_ASSET}
              tokenAddress={token?.address}
              tokenSymbol={currencyB?.symbol}
              tokenDecimals={token?.decimals}
              tokenLogo={token instanceof WrappedTokenInfo ? (token as WrappedTokenInfo)?.logoURI : undefined}
            />
          ) : null}
        </SwapPendingModalContent>
      )
    }

    if (confirmModalState === ConfirmModalState.PENDING_CONFIRMATION) {
      if (isBridgeOrder(originalOrder)) {
        return (
          <SwapPendingModalContentV3
            currencyA={order?.trade.inputAmount.currency}
            currencyB={order?.trade.outputAmount.currency}
            amountA={formatAmount(order?.trade.inputAmount)}
            amountB={formatAmount(order?.trade.outputAmount)}
            chainNameA={getFullChainNameById(order?.trade?.inputAmount?.currency?.chainId)}
            chainNameB={getFullChainNameById(order?.trade?.outputAmount?.currency?.chainId)}
          >
            {showAddToWalletButton && (txHash || orderHash) ? (
              <AddToWalletButton
                mt="39px"
                height="auto"
                variant="tertiary"
                width="fit-content"
                padding="6.5px 20px"
                marginTextBetweenLogo="6px"
                textOptions={AddToWalletTextOptions.TEXT_WITH_ASSET}
                tokenAddress={token?.address}
                tokenSymbol={currencyB?.symbol}
                tokenDecimals={token?.decimals}
                tokenLogo={token instanceof WrappedTokenInfo ? (token as WrappedTokenInfo)?.logoURI : undefined}
              />
            ) : null}
          </SwapPendingModalContentV3>
        )
      }

      let title = txHash ? t('Transaction Submitted') : t('Confirm Swap')

      if (isXOrder(originalOrder)) {
        title = txHash ? t('Order Filled') : orderHash ? t('Order Submitted') : t('Confirm Swap')
      }

      return (
        <SwapPendingModalContent
          title={title}
          currencyA={currencyA}
          currencyB={currencyB}
          amountA={amountA}
          amountB={amountB}
          currentStep={confirmModalState}
        >
          {showAddToWalletButton && (txHash || orderHash) ? (
            <AddToWalletButton
              mt="39px"
              height="auto"
              variant="tertiary"
              width="fit-content"
              padding="6.5px 20px"
              marginTextBetweenLogo="6px"
              textOptions={AddToWalletTextOptions.TEXT_WITH_ASSET}
              tokenAddress={token?.address}
              tokenSymbol={currencyB?.symbol}
              tokenDecimals={token?.decimals}
              tokenLogo={token instanceof WrappedTokenInfo ? (token as WrappedTokenInfo)?.logoURI : undefined}
            />
          ) : null}
        </SwapPendingModalContent>
      )
    }

    if (
      confirmModalState === ConfirmModalState.ORDER_SUBMITTED &&
      isBridgeOrder(order) &&
      isBridgeOrder(originalOrder)
    ) {
      return <OrderResultModalContent />
    }

    if (
      (confirmModalState === ConfirmModalState.COMPLETED ||
        confirmModalState === ConfirmModalState.MULTISIG_SUBMITTED) &&
      txHash
    ) {
      const isMultisig = confirmModalState === ConfirmModalState.MULTISIG_SUBMITTED
      return (
        <SwapTransactionReceiptModalContent
          explorerLink={
            chainId ? (
              <Link external small href={getBlockExploreLink(txHash, 'transaction', chainId)}>
                {t('View on %site%', { site: blockExplorerName })}: {truncateHash(txHash, 8, 0)}
                {chainId === ChainId.BSC && <BscScanIcon color="primary" ml="4px" />}
              </Link>
            ) : (
              <></>
            )
          }
          isMultisig
        >
          {!isMultisig && showAddToWalletButton && (
            <AddToWalletButton
              mt="39px"
              height="auto"
              variant="tertiary"
              width="fit-content"
              padding="6.5px 20px"
              marginTextBetweenLogo="6px"
              textOptions={AddToWalletTextOptions.TEXT_WITH_ASSET}
              tokenAddress={token?.address}
              tokenSymbol={currencyB?.symbol}
              tokenDecimals={token?.decimals}
              tokenLogo={token instanceof WrappedTokenInfo ? token.logoURI : undefined}
            />
          )}
        </SwapTransactionReceiptModalContent>
      )
    }

    return (
      <TransactionConfirmSwapContentV3
        order={order}
        recipient={recipient}
        originalOrder={originalOrder}
        allowedSlippage={allowedSlippage}
        currencyBalances={currencyBalances}
        onConfirm={onConfirm}
        onAcceptChanges={onAcceptChanges}
      />
    )
  }, [
    slippageAdjustedAmounts,
    currencyBalances,
    order,
    swapErrorMessage,
    confirmModalState,
    txHash,
    recipient,
    originalOrder,
    allowedSlippage,
    onConfirm,
    onAcceptChanges,
    chainId,
    t,
    handleDismiss,
    openSettingModal,
    stepContents,
    pendingModalSteps,
    showAddToWalletButton,
    orderHash,
    token,
    blockExplorerName,
    getBlockExploreLink,
  ])

  if (!chainId) return null

  return (
    <ConfirmSwapModalV3Container
      minHeight={hasError ? 'auto' : '251px'}
      width={['100%', '100%', '100%', '480px']}
      title={modalTitle}
      // hideTitleAndBackground={confirmModalState !== ConfirmModalState.REVIEWING || hasError}
      headerPadding={loadingAnimationVisible ? '12px 24px 0px 24px !important' : '12px 24px'}
      headerBackground="transparent"
      bodyPadding={!hasError ? '8px 24px 24px 24px' : '24px'}
      bodyTop={loadingAnimationVisible ? '-15px' : '0'}
      handleDismiss={handleDismiss}
    >
      <Box>{modalContent}</Box>
    </ConfirmSwapModalV3Container>
  )
}
