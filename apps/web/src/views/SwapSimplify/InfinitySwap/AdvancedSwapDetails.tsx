import { useTranslation } from '@pancakeswap/localization'
import {
  Currency,
  CurrencyAmount,
  Percent,
  SPLToken,
  TradeType,
  UnifiedCurrency,
  UnifiedCurrencyAmount,
} from '@pancakeswap/sdk'
import { LegacyPair as Pair } from '@pancakeswap/smart-router/legacy-router'
import { AutoColumn, Box, Link, QuestionHelperV2, SkeletonV2, Text } from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import { memo, useMemo, useState } from 'react'

import { BridgeOrder, OrderType, PriceOrder } from '@pancakeswap/price-api-sdk'
import { SwapUIV2 } from '@pancakeswap/widgets-internal'
import BigNumber from 'bignumber.js'
import { LightGreyCard } from 'components/Card'
import { RowBetween, RowFixed } from 'components/Layout/Row'
import { currenciesUSDPriceAtom } from 'hooks/useCurrencyUsdPrice'
import { useAtomValue } from 'jotai'
import { Field } from 'state/swap/actions'
import { styled } from 'styled-components'
import { BridgeFeeToolTip, TotalFeeToolTip, TradingFeeToolTip } from 'views/Swap/Bridge/components/FeeToolTip'
import { BridgeOrderFee, getBridgeOrderPriceImpact } from 'views/Swap/Bridge/utils'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'

import { isSolanaBridge, isSVMOrder } from 'views/Swap/utils'
import { useStablecoinPriceAmount } from 'hooks/useStablecoinPrice'
import { EstimatedTime } from '../../Swap/Bridge/CrossChainConfirmSwapModal/components/EstimatedTime'
import { SlippageAdjustedAmounts, SVMTradePriceBreakdown, TradePriceBreakdown } from '../../Swap/V3Swap/utils/exchange'
import FormattedPriceImpact from '../../Swap/components/FormattedPriceImpact'
import { SVMTradingFee } from './TradingFee'

export const DetailsTitle = styled(Text)`
  text-decoration: underline dotted;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSubtle};
  line-height: 150%;
  cursor: help;
`

type DisplayFee = {
  label: string
  amount: BigNumber
  hasDynamicFee: boolean
}

interface BridgeFeeData {
  groupedFees: Record<OrderType, DisplayFee>
  totalFeeUsd: BigNumber
  isDataReady: boolean
  hasApproximateFees: boolean
}

interface BridgeFeeViewProps {
  feeData: BridgeFeeData
  isOpen: boolean
  onToggle: () => void
}

const useBridgeFeeData = (priceBreakdown: BridgeOrderFee[]): BridgeFeeData => {
  const { t } = useTranslation()

  const lpFeeAmounts = useMemo(() => {
    return priceBreakdown.filter((p) => p.lpFeeAmount).map((p) => p.lpFeeAmount as CurrencyAmount<Currency>)
  }, [priceBreakdown])

  const currencies = useMemo(() => {
    return lpFeeAmounts.map((lp) => lp.currency)
  }, [lpFeeAmounts])

  const usdPrices = useAtomValue(currenciesUSDPriceAtom(currencies))

  const currencyUsdPrices = useMemo(() => {
    return lpFeeAmounts.map((lpFeeAmount, index) => {
      return new BigNumber(lpFeeAmount?.toExact() ?? 0).times(usdPrices[index] ?? 0)
    })
  }, [usdPrices, lpFeeAmounts])

  // Group and sum up fees by type
  const groupedFees = useMemo(() => {
    return priceBreakdown
      .filter((p) => p.lpFeeAmount)
      .reduce((acc, curr, index) => {
        const { type } = curr
        const existingFee = acc[type] || {
          label: curr.type === OrderType.PCS_BRIDGE ? t('Bridge Fee') : t('Trading Fee'),
          amount: new BigNumber(0),
          hasDynamicFee: false,
        }

        // eslint-disable-next-line no-param-reassign
        acc[type] = {
          ...existingFee,
          amount: existingFee.amount.plus(currencyUsdPrices[index] || 0),
          hasDynamicFee: Boolean(existingFee.hasDynamicFee || curr.hasDynamicFee),
        }

        return acc
      }, {} as Record<OrderType, DisplayFee>)
  }, [currencyUsdPrices, priceBreakdown, t])

  const totalFeeUsd = useMemo(() => {
    return currencyUsdPrices.reduce((acc, curr) => acc.plus(curr), new BigNumber(0))
  }, [currencyUsdPrices])

  const isDataReady = lpFeeAmounts.length > 0
  const hasApproximateFees = priceBreakdown.some((p) => p.type === OrderType.PCS_CLASSIC)

  return {
    groupedFees,
    totalFeeUsd,
    isDataReady,
    hasApproximateFees,
  }
}

const BridgeFeeView = ({ feeData, isOpen, onToggle }: BridgeFeeViewProps) => {
  const { t } = useTranslation()
  const { groupedFees, totalFeeUsd, isDataReady, hasApproximateFees } = feeData

  return (
    <Box mt="10px" mr="-4px">
      <SwapUIV2.Collapse
        isOpen={isOpen}
        onToggle={onToggle}
        title={
          <RowBetween>
            <RowFixed>
              <QuestionHelperV2 text={<TotalFeeToolTip />} placement="top">
                <DetailsTitle fontSize="14px" color="textSubtle">
                  {t('Total Fee')}
                </DetailsTitle>
              </QuestionHelperV2>
            </RowFixed>
            <SkeletonV2 width="70px" height="16px" borderRadius="8px" minHeight="auto" isDataReady={isDataReady}>
              <Text fontSize="14px" textAlign="right">
                {hasApproximateFees ? '~' : ''}
                {formatDollarAmount(totalFeeUsd.toNumber(), 3)}
              </Text>
            </SkeletonV2>
          </RowBetween>
        }
        content={
          <LightGreyCard mt="4px" padding="8px 16px">
            {/** display grouped fees */}
            {Object.values(groupedFees).map((fee, index) => {
              const type = Object.keys(groupedFees)[index]

              return (
                <RowBetween key={fee.label}>
                  <QuestionHelperV2
                    text={type === OrderType.PCS_BRIDGE ? <BridgeFeeToolTip /> : <TradingFeeToolTip />}
                    placement="top"
                  >
                    <DetailsTitle fontSize="14px" color="textSubtle">
                      {fee.label}
                    </DetailsTitle>
                  </QuestionHelperV2>
                  <Text fontSize="14px" textAlign="right">
                    {`${
                      // if key of groupedFees is OrderType.PCS_CLASSIC, then it's a dynamic fee
                      type === OrderType.PCS_CLASSIC ? '~' : ''
                    }${formatDollarAmount(fee.amount.toNumber(), 3)}`}
                  </Text>
                </RowBetween>
              )
            })}
          </LightGreyCard>
        }
      />
    </Box>
  )
}

const BridgeTradingViewSection = ({ priceBreakdown }: { priceBreakdown: BridgeOrderFee[] }) => {
  const [isOpen, setIsOpen] = useState(false)
  const feeData = useBridgeFeeData(priceBreakdown)

  return <BridgeFeeView feeData={feeData} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />
}

const SolanaBridgeTradingFeeViewSection = ({ order }: { order: BridgeOrder }) => {
  const [isOpen, setIsOpen] = useState(false)

  const { t } = useTranslation()

  const feeData = useMemo(() => {
    return {
      groupedFees: {
        [OrderType.PCS_BRIDGE]: {
          label: t('Bridge Fee'),
          amount: new BigNumber(order.bridgeFee.toExact()),
          hasDynamicFee: false,
        },
      },
      totalFeeUsd: new BigNumber(order.bridgeFee.toExact()),
      isDataReady: true,
      hasApproximateFees: false,
    } as BridgeFeeData
  }, [order, t])

  return <BridgeFeeView feeData={feeData} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />
}

const TradingFeeDisplay = memo(function TradingFeeDisplay({
  priceBreakdown,
  inputAmount,
  isX,
  hasDynamicHook,
  loading,
  order,
}: {
  priceBreakdown: TradePriceBreakdown | SVMTradePriceBreakdown
  inputAmount?: UnifiedCurrencyAmount<UnifiedCurrency>
  isX?: boolean
  hasDynamicHook?: boolean
  loading?: boolean
  order?: PriceOrder
}) {
  const { t } = useTranslation()
  const lpFeeAmount = priceBreakdown?.lpFeeAmount

  const feeAmountNumber = useMemo(() => {
    if (!lpFeeAmount) return undefined
    return parseFloat(lpFeeAmount.toExact())
  }, [lpFeeAmount])

  const feeCurrency = useMemo(() => {
    if (!lpFeeAmount || SPLToken.isSPLToken(lpFeeAmount.currency)) return undefined
    return lpFeeAmount.currency as Currency
  }, [lpFeeAmount])

  const feeUsdValue = useStablecoinPriceAmount(feeCurrency, feeAmountNumber, {
    enabled: Boolean(feeCurrency && feeAmountNumber && !isX),
  })

  return (
    <RowBetween mt="10px">
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
            {t('Trading Fee')}
          </DetailsTitle>
        </QuestionHelperV2>
      </RowFixed>
      {isSVMOrder(order) && inputAmount?.currency?.symbol ? (
        <SVMTradingFee routes={order.trade.routes} inputCurrencySymbol={inputAmount?.currency?.symbol} />
      ) : (
        <SkeletonV2 width="70px" height="16px" borderRadius="8px" minHeight="auto" isDataReady={!loading}>
          {isX ? (
            <Text color="primary" fontSize="14px">
              0 {inputAmount?.currency?.symbol}
            </Text>
          ) : hasDynamicHook ? (
            <QuestionHelperV2 text={t('This route uses a dynamic fee pool; actual fees may vary.')}>
              <Text fontSize="14px" style={{ textDecoration: 'underline dotted', cursor: 'help' }}>
                {feeUsdValue !== undefined
                  ? `~${formatDollarAmount(feeUsdValue, 3)}`
                  : `~${formatAmount(priceBreakdown.lpFeeAmount, 4)} ${inputAmount?.currency?.symbol}`}
              </Text>
            </QuestionHelperV2>
          ) : (
            <Text fontSize="14px">
              {feeUsdValue !== undefined
                ? formatDollarAmount(feeUsdValue, 3)
                : `${formatAmount(priceBreakdown.lpFeeAmount, 4)} ${inputAmount?.currency?.symbol}`}
            </Text>
          )}
        </SkeletonV2>
      )}
    </RowBetween>
  )
})

export const TradeSummary = memo(function TradeSummary({
  inputAmount,
  outputAmount,
  tradeType,
  slippageAdjustedAmounts,
  isX = false,
  loading = false,
  hasDynamicHook,
  priceBreakdown,
  expectedFillTimeSec,
  order,
}: {
  expectedFillTimeSec?: number
  priceBreakdown: BridgeOrderFee[] | TradePriceBreakdown | SVMTradePriceBreakdown
  hasStablePair?: boolean
  inputAmount?: UnifiedCurrencyAmount<UnifiedCurrency>
  outputAmount?: UnifiedCurrencyAmount<UnifiedCurrency>
  tradeType?: TradeType
  slippageAdjustedAmounts: SlippageAdjustedAmounts
  isX?: boolean
  loading?: boolean
  hasDynamicHook?: boolean
  order?: PriceOrder
}) {
  const { t } = useTranslation()
  const isExactIn = tradeType === TradeType.EXACT_INPUT

  return (
    <AutoColumn px="4px">
      <RowBetween>
        <RowFixed>
          <QuestionHelperV2
            text={
              isExactIn
                ? t('Amount you are guaranteed to receive.')
                : t(
                    'Your transaction will revert if there is a large, unfavorable price movement before it is confirmed.',
                  )
            }
            placement="top"
          >
            <DetailsTitle>{isExactIn ? t('Minimum received') : t('Maximum sold')}</DetailsTitle>
          </QuestionHelperV2>
        </RowFixed>
        <RowFixed>
          <SkeletonV2 width="80px" height="16px" borderRadius="8px" minHeight="auto" isDataReady={!loading}>
            <Text fontSize="14px">
              {isExactIn
                ? `${formatAmount(slippageAdjustedAmounts[Field.OUTPUT], 4) ?? '-'} ${outputAmount?.currency?.symbol}`
                : `${formatAmount(slippageAdjustedAmounts[Field.INPUT], 4) ?? '-'} ${inputAmount?.currency?.symbol}`}
            </Text>
          </SkeletonV2>
        </RowFixed>
      </RowBetween>
      {priceBreakdown && (
        <RowBetween mt="10px">
          <RowFixed>
            <QuestionHelperV2
              text={
                <>
                  <Text>{t('The change in pool price caused by your swap.')}</Text>
                </>
              }
              placement="top"
            >
              <DetailsTitle>{t('Price Impact')}</DetailsTitle>
            </QuestionHelperV2>
          </RowFixed>
          <SkeletonV2 width="50px" height="16px" borderRadius="8px" minHeight="auto" isDataReady={!loading}>
            {isX ? (
              <Text color="primary">0%</Text>
            ) : (
              <FormattedPriceImpact priceImpact={getBridgeOrderPriceImpact(priceBreakdown)} />
            )}
          </SkeletonV2>
        </RowBetween>
      )}

      {Array.isArray(priceBreakdown) ? (
        <BridgeTradingViewSection priceBreakdown={priceBreakdown} />
      ) : isSolanaBridge(order) ? (
        <SolanaBridgeTradingFeeViewSection order={order as BridgeOrder} />
      ) : priceBreakdown?.lpFeeAmount || isX ? (
        <TradingFeeDisplay
          priceBreakdown={priceBreakdown}
          inputAmount={inputAmount}
          isX={isX}
          hasDynamicHook={hasDynamicHook}
          loading={loading}
          order={order}
        />
      ) : null}

      {expectedFillTimeSec && (
        <RowBetween mt="10px">
          <RowFixed>
            <QuestionHelperV2 text={t('Estimated time to complete this transaction.')}>
              <DetailsTitle fontSize="14px" color="textSubtle">
                {t('Est. Time')}
              </DetailsTitle>
            </QuestionHelperV2>
          </RowFixed>
          <Text fontSize="14px" textAlign="right">
            <EstimatedTime expectedFillTimeSec={expectedFillTimeSec} />
          </Text>
        </RowBetween>
      )}
    </AutoColumn>
  )
})

export interface AdvancedSwapDetailsProps {
  hasStablePair?: boolean
  pairs?: Pair[]
  path?: Currency[]
  priceImpactWithoutFee?: Percent
  realizedLPFee?: CurrencyAmount<Currency> | null
  slippageAdjustedAmounts: SlippageAdjustedAmounts
  inputAmount?: CurrencyAmount<Currency>
  outputAmount?: CurrencyAmount<Currency>
  tradeType?: TradeType
}
