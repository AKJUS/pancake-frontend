import {
  ArrowForwardIcon,
  Box,
  BoxProps,
  CheckmarkCircleIcon,
  Flex,
  FlexGap,
  InfoIcon,
  Message,
  Skeleton,
  SwapSpinner,
  Text,
  WarningIcon,
} from '@pancakeswap/uikit'
import { DualCurrencyDisplay } from '@pancakeswap/widgets-internal'
import { useAtomValue } from 'jotai'

import { useTranslation } from '@pancakeswap/localization'
import { UnifiedCurrency, UnifiedCurrencyAmount } from '@pancakeswap/sdk'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import { formatScientificToDecimal } from '@pancakeswap/utils/formatNumber'
import { useUnifiedCurrency } from 'hooks/Tokens'
import { ReactNode, useMemo } from 'react'
import { swapReducerAtom } from 'state/swap/reducer'
import styled from 'styled-components'
import { accountActiveChainAtom } from 'wallet/atoms/accountStateAtoms'
import { getFullChainNameById } from 'utils/getFullChainNameById'
import { isSolana } from '@pancakeswap/chains'
import { Field } from 'state/swap/actions'
import truncateHash from '@pancakeswap/utils/truncateHash'
import { useBridgeStatus } from '../../hooks/useBridgeStatus'
import { ActiveBridgeOrderMetadata, BridgeResponseStatusData, BridgeStatus, Command, RelayStatus } from '../../types'
import { customBridgeStatus } from '../../utils/customBridgeStatus'
import { useOrderStatusTrackingStateMachine } from '../hooks/useOrderStatusTrackingStateMachine'
import { activeBridgeOrderMetadataAtom } from '../state/orderDataState'
import { OrderDetailsPanel } from './OrderDetailsPanel'

const IconContainer = styled(Box)`
  position: relative;
  width: 36px;
  height: 36px;
`

// Since Translation not support interpolation for <element>
// We need to use this component to display partially bold text
function Description({
  showAmounts,
  currencyAmount,
  description,
}: {
  showAmounts: boolean
  currencyAmount: UnifiedCurrencyAmount<UnifiedCurrency>
  description: ReactNode
}) {
  return (
    <FlexGap alignItems="center">
      <p>
        {showAmounts && (
          <Text small bold as="span">
            {formatAmount(currencyAmount)} {currencyAmount.currency.symbol}
          </Text>
        )}
        <Text small as="span">
          {description}
        </Text>
        {showAmounts && (
          <Text small bold as="span">
            {getFullChainNameById(currencyAmount.currency.chainId)}
          </Text>
        )}
      </p>
    </FlexGap>
  )
}

interface OrderResultModalContentProps extends BoxProps {
  overrideActiveOrderMetadata?: ActiveBridgeOrderMetadata
}

export const OrderResultModalContent = ({ overrideActiveOrderMetadata, ...props }: OrderResultModalContentProps) => {
  const { t } = useTranslation()
  const activeBridgeOrderMetadata = useAtomValue(activeBridgeOrderMetadataAtom)
  const bridgeMetadata = overrideActiveOrderMetadata || activeBridgeOrderMetadata
  const swapState = useAtomValue(swapReducerAtom)
  const { account: evmAccount, solanaAccount } = useAtomValue(accountActiveChainAtom)

  const sendAccount = isSolana(swapState[Field.INPUT].chainId) ? solanaAccount : evmAccount
  const receiveAccount = isSolana(swapState[Field.OUTPUT].chainId) ? solanaAccount : evmAccount

  let recipientOnDestChain: string | undefined

  // If overrideActiveOrderMetadata is provided, it will use in Transaction History
  if (overrideActiveOrderMetadata) {
    // expect /orders return recipientOnDestinationChain, otherwise it will be empty to identify error
    recipientOnDestChain = overrideActiveOrderMetadata.metadata?.recipientOnDestinationChain
  } else {
    recipientOnDestChain = (swapState.recipient === null ? receiveAccount : swapState.recipient) || undefined
  }

  const txHash = bridgeMetadata?.txHash
  const originChainId = bridgeMetadata?.originChainId
  const order = bridgeMetadata?.order
  const metadata = bridgeMetadata?.metadata

  const orderInputCurrency = order?.trade.inputAmount.currency
  const orderOutputCurrency = order?.trade.outputAmount.currency

  const { data: bridgeStatus } = useBridgeStatus(
    originChainId,
    txHash,
    metadata,
    bridgeMetadata?.destinationChainId,
    bridgeMetadata?.isMultisig,
  )

  const resultTokenData = useMemo(() => {
    // Derive result token and amount information from last command (swap or bridge)
    // TODO: Verify last command's FAIL condition and the data being sent
    let resultTokenAddress: string | undefined
    let resultAmount: string | undefined
    let resultTokenChainId: number | undefined

    let lastExecutedCommand: BridgeResponseStatusData | undefined
    let lastExecutedCommandIndex: number | undefined

    if (bridgeStatus && bridgeStatus?.data) {
      for (const [index, step] of bridgeStatus.data.toReversed().entries()) {
        if (step.status.code === BridgeStatus.PENDING || step.status.code === BridgeStatus.BRIDGE_PENDING) {
          continue
        }
        lastExecutedCommand = step
        lastExecutedCommandIndex = bridgeStatus.data.length - index - 1
        break
      }
    }

    if (lastExecutedCommand && bridgeStatus && lastExecutedCommand.metadata) {
      switch (lastExecutedCommand.command) {
        case Command.SWAP: {
          resultTokenChainId = lastExecutedCommand.metadata.chainId

          // If swap failed or partially succeeded,
          // 1. If previous step exists and is success, use it's output token
          // 2. otherwise use input token as result token.
          if (
            lastExecutedCommand.status.code === BridgeStatus.PARTIAL_SUCCESS ||
            lastExecutedCommand.status.code === BridgeStatus.FAILED
          ) {
            // If previous step exists and is success, use it's output token
            const previousStep = lastExecutedCommandIndex && bridgeStatus.data?.[lastExecutedCommandIndex - 1]
            if (previousStep && previousStep.status.code === BridgeStatus.SUCCESS && previousStep.metadata) {
              resultTokenAddress = previousStep.metadata.outputToken
              resultAmount = previousStep.metadata.outputAmount
            } else {
              // otherwise use input token as result token.
              resultTokenAddress = lastExecutedCommand.metadata.inputToken
              resultAmount = lastExecutedCommand.metadata.inputAmount
            }
          } else {
            resultTokenAddress = lastExecutedCommand.metadata.outputToken
            resultAmount = lastExecutedCommand.metadata.outputAmount
          }
          break
        }
        case Command.BRIDGE: {
          if (lastExecutedCommand.status.code === BridgeStatus.PARTIAL_SUCCESS) {
            resultTokenAddress = lastExecutedCommand.metadata.inputToken
            resultTokenChainId = lastExecutedCommand.metadata.originChainId
            resultAmount = lastExecutedCommand.metadata.inputAmount
          } else {
            resultTokenChainId = lastExecutedCommand.metadata.destinationChainId

            resultTokenAddress =
              lastExecutedCommand.metadata.bridgeStatus === RelayStatus.REFUND
                ? // If refund case by Relay, lastExecutedCommand.metadata.outputToken
                  lastExecutedCommand.metadata.outputToken
                : // If last command is bridge, safely using bridgeStatus.outputToken
                  // instead of lastExecutedCommand.metadata.outputToken
                  // because in native bridge case, lastExecutedCommand.metadata.outputToken will be WETH
                  // while bridgeStatus.outputToken will be the native token
                  bridgeStatus.outputToken
            resultAmount = lastExecutedCommand.metadata.outputAmount
          }

          break
        }
        default:
          break
      }
    }

    return {
      resultTokenAddress,
      resultTokenChainId,
      resultAmount,
    }
  }, [bridgeStatus])

  // Result currency
  const resultCurrency = useUnifiedCurrency(resultTokenData.resultTokenAddress, resultTokenData.resultTokenChainId)

  const resultCurrencyAmount = useMemo(() => {
    if (!resultCurrency || !resultTokenData.resultAmount) return undefined
    return UnifiedCurrencyAmount.fromRawAmount(resultCurrency, formatScientificToDecimal(resultTokenData.resultAmount))
  }, [resultCurrency, resultTokenData.resultAmount])

  const outputAmount = useMemo(() => {
    if (bridgeStatus?.status === BridgeStatus.SUCCESS) {
      return bridgeStatus.outputCurrencyAmount
    }

    const minOutputAmount =
      bridgeStatus?.outputCurrencyAmount?.currency &&
      bridgeStatus?.minOutputAmount &&
      UnifiedCurrencyAmount.fromRawAmount(
        bridgeStatus.outputCurrencyAmount?.currency,
        formatScientificToDecimal(bridgeStatus.minOutputAmount),
      )

    return minOutputAmount || bridgeStatus?.outputCurrencyAmount || order?.trade.outputAmount
  }, [bridgeStatus, order?.trade.outputAmount])

  const status = customBridgeStatus(bridgeStatus)

  // overrideActiveOrderMetadata is false, mean it's on the confirm modal
  useOrderStatusTrackingStateMachine(!overrideActiveOrderMetadata ? status : undefined)

  const middleIcon = useMemo(() => {
    switch (status) {
      case BridgeStatus.SUCCESS:
        return (
          <IconContainer>
            <CheckmarkCircleIcon width="36px" color="success" />
          </IconContainer>
        )
      case BridgeStatus.MULTISIG_SUBMITTED:
        return (
          <IconContainer>
            <InfoIcon width="36px" color="warning" />
          </IconContainer>
        )
      case BridgeStatus.PARTIAL_SUCCESS:
        return (
          <FlexGap flexDirection="column" alignItems="center" gap="4px">
            <WarningIcon width="20px" color="binance" />
            <ArrowForwardIcon width="24px" ml="4px" color="textSubtle" />
          </FlexGap>
        )
      case BridgeStatus.BRIDGE_PENDING:
      case BridgeStatus.PENDING:
        return (
          <IconContainer>
            <ArrowForwardIcon width="24px" ml="4px" color="textSubtle" />
            <SwapSpinner width="52px" height="52px" style={{ position: 'absolute', top: '-14px', left: '-10px' }} />
          </IconContainer>
        )
      default:
        return undefined
    }
  }, [status])

  const isRefundCase = status === BridgeStatus.PARTIAL_SUCCESS || bridgeStatus?.bridgeStatus === RelayStatus.REFUND

  return (
    <Box {...props}>
      <Box
        style={{
          height: bridgeStatus && resultCurrencyAmount ? 'auto' : '0',
          opacity: bridgeStatus && resultCurrencyAmount ? 1 : 0,
          transition: 'all 0.3s ease-out',
          overflow: 'hidden',
          marginBottom: bridgeStatus && resultCurrencyAmount ? '24px' : '0',
        }}
        maxWidth={[null, null, null, '420px']}
      >
        {status &&
          [BridgeStatus.SUCCESS, BridgeStatus.PARTIAL_SUCCESS, BridgeStatus.FAILED].includes(status) &&
          resultCurrencyAmount && (
            <Message variant={status === BridgeStatus.SUCCESS ? 'success' : isRefundCase ? 'secondary' : 'danger'}>
              <Description
                showAmounts={status !== BridgeStatus.FAILED || bridgeStatus?.bridgeStatus === RelayStatus.REFUND}
                currencyAmount={resultCurrencyAmount}
                description={
                  isRefundCase
                    ? t(' is being refunded to %address% on ', {
                        address: truncateHash(sendAccount || ''),
                      })
                    : status === BridgeStatus.FAILED
                    ? t('Your bridge transaction failed. You will be refunded shortly.')
                    : t(' has been sent to %address% on ', {
                        address: truncateHash(recipientOnDestChain || ''),
                      })
                }
              />
            </Message>
          )}
      </Box>
      <DualCurrencyDisplay
        inputCurrency={bridgeStatus?.inputCurrencyAmount?.currency || orderInputCurrency}
        outputCurrency={bridgeStatus?.outputCurrencyAmount?.currency || orderOutputCurrency}
        inputAmount={formatAmount(bridgeStatus?.inputCurrencyAmount || order?.trade.inputAmount)}
        outputAmount={formatAmount(outputAmount)}
        inputChainName={getFullChainNameById(bridgeStatus?.originChainId || orderInputCurrency?.chainId)}
        outputChainName={getFullChainNameById(bridgeStatus?.destinationChainId || orderOutputCurrency?.chainId)}
        overrideIcon={middleIcon}
        textRightOpacity={status && [BridgeStatus.FAILED, BridgeStatus.PARTIAL_SUCCESS].includes(status) ? 0.5 : 1}
        textLeftOpacity={status && [BridgeStatus.SUCCESS].includes(status) ? 0.5 : 1}
      />
      <Box mt="24px">
        {bridgeStatus && bridgeStatus.data && bridgeStatus.data.length > 0 ? (
          <OrderDetailsPanel overrideActiveOrderMetadata={bridgeMetadata} />
        ) : (
          <Flex justifyContent="center">
            <Skeleton width="78px" height="16px" />
          </Flex>
        )}
      </Box>
    </Box>
  )
}
