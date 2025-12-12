import { useTranslation } from '@pancakeswap/localization'
import { UnifiedCurrencyAmount } from '@pancakeswap/sdk'
import {
  AutoColumn,
  Box,
  BoxProps,
  Button,
  ChevronDownIcon,
  ChevronUpIcon,
  FlexGap,
  Link,
  QuestionHelperV2,
  RowBetween,
  RowFixed,
  SkeletonV2,
  Text,
} from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import { LightGreyCard } from 'components/Card'
import { DISPLAY_PRECISION } from 'config/constants/formatting'
import { useAutoSlippageWithFallback } from 'hooks/useAutoSlippageWithFallback'
import { useAtomValue } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { Field } from 'state/swap/actions'
import styled from 'styled-components'
import { computeSlippageAdjustedAmounts as computeSlippageAdjustedAmountsWithSmartRouter } from 'views/Swap/V3Swap/utils/exchange'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'

import { formatScientificToDecimal } from '@pancakeswap/utils/formatNumber'
import { SwapUIV2 } from '@pancakeswap/widgets-internal'
import { BridgeFeeToolTip, TradingFeeToolTip } from '../../components/FeeToolTip'
import { useBridgeStatus } from '../../hooks'
import { ActiveBridgeOrderMetadata, BridgeStatus, BridgeStatusData } from '../../types'
import { Timeline } from '../components/Timeline'
import { useTimelineItems } from '../hooks/useTimelineItems'
import { activeBridgeOrderMetadataAtom } from '../state/orderDataState'

const ProgressPill = styled(Box)<{ $color: string }>`
  width: 16px;
  height: 4px;
  border-radius: 8px;
  background-color: ${({ theme, $color }) => theme.colors[$color]};
`

const DetailsTitle = styled(Text)`
  text-decoration: underline dotted;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSubtle};
  line-height: 150%;
  cursor: help;
`

const FeePanelCard = styled(LightGreyCard)`
  background-color: ${({ theme }) => (theme.isDark ? theme.colors.backgroundAlt : theme.colors.backgroundAlt3)};
`

interface OrderDetailsPanelProps extends BoxProps {
  overrideActiveOrderMetadata?: ActiveBridgeOrderMetadata | null
}
export const OrderDetailsPanel = ({ overrideActiveOrderMetadata }: OrderDetailsPanelProps) => {
  const { t } = useTranslation()

  const activeBridgeOrderMetadata = useAtomValue(activeBridgeOrderMetadataAtom)
  const bridgeMetadata = overrideActiveOrderMetadata || activeBridgeOrderMetadata

  const order = bridgeMetadata?.order
  const originChainId = bridgeMetadata?.originChainId
  const originTxHash = bridgeMetadata?.txHash
  const metadata = bridgeMetadata?.metadata

  const { data: bridgeStatus } = useBridgeStatus(
    originChainId,
    originTxHash,
    metadata,
    bridgeMetadata?.destinationChainId,
    bridgeMetadata?.isMultisig,
  )

  const timelineItems = useTimelineItems({ bridgeStatus, order })

  // If the order is failed or partial success, open the details panel by default
  const [detailsExpanded, setDetailsExpanded] = useState(
    bridgeStatus?.status === BridgeStatus.PARTIAL_SUCCESS || bridgeStatus?.status === BridgeStatus.FAILED,
  )
  const [progressExpanded, setProgressExpanded] = useState(true)

  // TODO: Remove/Update auto-slippage usage in bridging
  const { slippageTolerance: allowedSlippage } = useAutoSlippageWithFallback()

  const slippageAdjustedAmounts = useMemo(
    () => computeSlippageAdjustedAmountsWithSmartRouter(order, allowedSlippage),
    [order, allowedSlippage],
  )

  const minimumReceived = useMemo(() => {
    const slippageAdjustedAmount = formatAmount(slippageAdjustedAmounts?.[Field.OUTPUT], DISPLAY_PRECISION)
    if (slippageAdjustedAmount) return slippageAdjustedAmount

    if (!bridgeStatus?.outputCurrencyAmount?.currency || !bridgeStatus.minOutputAmount) return undefined
    return UnifiedCurrencyAmount.fromRawAmount(
      bridgeStatus?.outputCurrencyAmount?.currency,
      formatScientificToDecimal(bridgeStatus?.minOutputAmount),
    ).toSignificant(DISPLAY_PRECISION)
  }, [bridgeStatus, slippageAdjustedAmounts])

  const toggleDetailsExpanded = useCallback(() => {
    setDetailsExpanded(!detailsExpanded)
  }, [detailsExpanded, setDetailsExpanded])

  const toggleProgressExpanded = useCallback(() => {
    setProgressExpanded(!progressExpanded)
  }, [progressExpanded, setProgressExpanded])

  return (
    <Box>
      {!detailsExpanded ? (
        <AutoColumn justify="center" style={{ marginTop: '-24px' }}>
          <Button variant="text" onClick={toggleDetailsExpanded}>
            <Text color="primary60" bold>
              {t('Details')}
            </Text>
            <ChevronDownIcon ml="2px" color="primary60" />
          </Button>
        </AutoColumn>
      ) : (
        <LightGreyCard padding="16px 16px 0 16px">
          <AutoColumn gap="16px">
            {bridgeStatus && bridgeStatus?.data && bridgeStatus?.data.length > 0 && (
              <>
                <SwapUIV2.Collapse
                  isOpen={progressExpanded}
                  onToggle={toggleProgressExpanded}
                  title={
                    <RowBetween width="100%">
                      <Text color="textSubtle" small>
                        {t('Progress')}
                      </Text>
                      <FlexGap gap="4px" alignItems="center">
                        {bridgeStatus?.data?.map((step) => {
                          return (
                            <ProgressPill
                              $color={
                                step.status.code === BridgeStatus.SUCCESS
                                  ? 'success'
                                  : step.status.code === BridgeStatus.FAILED
                                  ? 'failure'
                                  : step.status.code === BridgeStatus.PARTIAL_SUCCESS ||
                                    step.status.code === BridgeStatus.MULTISIG_SUBMITTED
                                  ? 'warning'
                                  : 'inputSecondary'
                              }
                            />
                          )
                        })}
                      </FlexGap>
                    </RowBetween>
                  }
                  content={
                    <RowFixed width="100%" mt="16px">
                      <Timeline items={timelineItems} />
                    </RowFixed>
                  }
                />
              </>
            )}

            <BridgeFeesBreakdown feesBreakdown={bridgeStatus?.feesBreakdown} status={bridgeStatus?.status} />

            <RowBetween>
              <Text color="textSubtle" small>
                {t('Minimum received')}
              </Text>
              <Text small>
                {minimumReceived}
                &nbsp;
                {bridgeStatus?.outputCurrencyAmount?.currency.symbol || order?.trade.outputAmount.currency.symbol}
              </Text>
            </RowBetween>
          </AutoColumn>
          <AutoColumn justify="center">
            <Button variant="text" onClick={toggleDetailsExpanded}>
              <Text color="primary60" bold>
                {t('Hide')}
              </Text>
              <ChevronUpIcon ml="2px" color="primary60" />
            </Button>
          </AutoColumn>
        </LightGreyCard>
      )}
    </Box>
  )
}

const BridgeFeesBreakdown = ({
  feesBreakdown,
  status,
}: {
  // Fees breakdown for data from status API
  feesBreakdown?: BridgeStatusData['feesBreakdown']

  status?: BridgeStatus
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  // NOTE: bridgeFeesUSD should always be > 0; if not, it meants the API is not ready yet
  // swapFeesUSD is null if swap fee is not loaded yet or returned as 0 in the bridge order having swap
  const isDataReady = Boolean(feesBreakdown?.bridgeFeesUSD && feesBreakdown?.swapFeesUSD !== null)

  return (
    <SwapUIV2.Collapse
      isOpen={isOpen}
      onToggle={() => isDataReady && setIsOpen(!isOpen)}
      title={
        <RowBetween>
          <RowFixed>
            <QuestionHelperV2
              text={
                <>
                  <Text mb="12px">
                    <Text bold display="inline-block">
                      {t('AMM')}
                    </Text>
                    : {t('Trading fee varies by pool fee tier. Check it via the magnifier icon under "Route."')}
                  </Text>
                  <Text mt="12px">
                    <Link
                      style={{ display: 'inline' }}
                      ml="4px"
                      external
                      href="https://docs.pancakeswap.finance/products/pancakeswap-exchange/faq#what-will-be-the-trading-fee-breakdown-for-v3-exchange"
                    >
                      {t('Fee Breakdown and Tokenomics')}
                    </Link>
                  </Text>
                  <Text mt="10px">
                    <Text bold display="inline-block">
                      {t('X')}
                    </Text>
                    : {t('No fee when trading through PancakeSwap X (subject to change).')}
                  </Text>
                </>
              }
              placement="top"
            >
              <DetailsTitle fontSize="14px" color="textSubtle">
                {status === BridgeStatus.PARTIAL_SUCCESS ? t('Partial Fee') : t('Total Fee')}
              </DetailsTitle>
            </QuestionHelperV2>
          </RowFixed>
          <SkeletonV2 width="70px" height="16px" borderRadius="8px" minHeight="auto" isDataReady={isDataReady}>
            <Text fontSize="14px" textAlign="right">
              {formatDollarAmount(feesBreakdown?.totalFeesUSD || 0, 3)}
            </Text>
          </SkeletonV2>
        </RowBetween>
      }
      content={
        <FeePanelCard mt="4px" padding="8px 16px">
          <RowBetween>
            <QuestionHelperV2 text={<BridgeFeeToolTip />}>
              <DetailsTitle fontSize="14px" color="textSubtle">
                {t('Bridge Fee')}
              </DetailsTitle>
            </QuestionHelperV2>

            <Text fontSize="14px" textAlign="right">
              {`${formatDollarAmount(feesBreakdown?.bridgeFeesUSD || 0, 3)}`}
            </Text>
          </RowBetween>
          {Number(feesBreakdown?.swapFeesUSD || 0) > 0 ? (
            <RowBetween>
              <QuestionHelperV2 text={<TradingFeeToolTip />}>
                <DetailsTitle fontSize="14px" color="textSubtle">
                  {t('Trading Fee')}
                </DetailsTitle>
              </QuestionHelperV2>
              <Text fontSize="14px" textAlign="right">
                {`${formatDollarAmount(feesBreakdown?.swapFeesUSD || 0, 3)}`}
              </Text>
            </RowBetween>
          ) : null}
        </FeePanelCard>
      }
    />
  )
}
