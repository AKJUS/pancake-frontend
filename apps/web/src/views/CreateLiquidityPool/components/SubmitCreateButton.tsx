import { getCurrencyPriceFromId, MAX_BIN_STEP, MIN_BIN_STEP } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, isCurrencySorted, Price } from '@pancakeswap/swap-sdk-core'
import { isSolana } from '@pancakeswap/chains'
import {
  AutoColumn,
  Box,
  BoxProps,
  Button,
  FlexGap,
  IconButton,
  Message,
  MessageText,
  RowBetween,
  SwapHorizIcon,
  Text,
  useModalV2,
} from '@pancakeswap/uikit'
import ConnectWalletButton from 'components/ConnectWalletButton'
import ApproveLiquidityTokens from 'components/Liquidity/ApproveLiquidityTokens'
import { useSelectIdRouteParams } from 'hooks/dynamicRoute/useSelectIdRoute'
import { useCLPriceRange } from 'hooks/infinity/useCLPriceRange'
import { usePermit2 } from 'hooks/usePermit2'
import { useStablecoinPriceAmount } from 'hooks/useStablecoinPrice'
import React, { useMemo } from 'react'
import { useInverted } from 'state/infinity/shared'
import { useCurrencyBalances } from 'state/wallet/hooks'
import { getInfinityPositionManagerAddress } from 'utils/addressHelpers'
import { CurrencyField as Field } from 'utils/types'
import { useAccount } from 'wagmi'
import { formatPreviewPrice } from '../utils'
import { useBinIdRange } from '../hooks/useBinIdRange'
import { useCreateDepositAmounts, useCreateDepositAmountsEnabled } from '../hooks/useCreateDepositAmounts'
import { useCurrencies } from '../hooks/useCurrencies'
import { useFormSubmitCallback } from '../hooks/useFormSubmitCallback'
import {
  useInfinityBinQueryState,
  useInfinityCLQueryState,
  useInfinityCreateFormQueryState,
} from '../hooks/useInfinityFormState/useInfinityFormQueryState'
import { useStartPriceAsFraction } from '../hooks/useStartPriceAsFraction'
import { isFeeOutOfRange } from './FieldFeeLevel'
import { PreviewModal } from './PreviewModal'

type SubmitCreateButtonProps = BoxProps

export const LowLiquidityMessage = () => {
  const { t } = useTranslation()
  return (
    <Message variant="warning">
      <RowBetween>
        <Text ml="12px" fontSize="12px">
          {t(
            'New pools with low liquidity can have bigger price swings, increasing the risk of losses. Please proceed carefully.',
          )}
        </Text>
      </RowBetween>
    </Message>
  )
}

export const OutOfRangeMessage = () => {
  const { t } = useTranslation()
  return (
    <Message variant="warning">
      <RowBetween>
        <Text ml="12px" fontSize="12px">
          {t('Your position will not earn fees or be used in trades until the market price moves into your range.')}
        </Text>
      </RowBetween>
    </Message>
  )
}

export const InvalidCLRangeMessage = () => {
  const { t } = useTranslation()
  return (
    <Message variant="warning">
      <MessageText>{t('Invalid range selected. The min price must be lower than the max price.')}</MessageText>
    </Message>
  )
}

export const LowTVLMessage = () => {
  const { t } = useTranslation()
  return (
    <Message variant="warning">
      <RowBetween>
        <Text ml="12px" fontSize="12px">
          {t(
            'Adding liquidity to a low TVL pool carries higher risk of losses from price fluctuations. Proceed with caution.',
          )}
        </Text>
      </RowBetween>
    </Message>
  )
}

export const MarketPriceSlippageWarning = ({ slippage }) => {
  const { t } = useTranslation()
  return (
    <Message variant="warning">
      <RowBetween>
        <Text ml="12px" fontSize="12px">
          <b>{t('Warning')}: </b>
          {t(
            'The pool price shows a significant deviation from current market rates (%slippage%). This increases the risk of losses from arbitrage. Please proceed with caution.',
            { slippage },
          )}
        </Text>
      </RowBetween>
    </Message>
  )
}

export const InvalidBinRangeMessage: React.FC<{
  minBinId?: number | null
  maxBinId?: number | null
  baseCurrency?: Currency
  quoteCurrency?: Currency
  binStep?: number | null
  inverted?: boolean | null
}> = ({ minBinId, maxBinId, baseCurrency, quoteCurrency, binStep, inverted }) => {
  const [minPrice, maxPrice] = useMemo(() => {
    if (!minBinId || !maxBinId || !binStep || !baseCurrency || !quoteCurrency) return [null, null]
    const minPrice_ = getCurrencyPriceFromId(minBinId, binStep, baseCurrency, quoteCurrency)
    const maxPrice_ = getCurrencyPriceFromId(maxBinId, binStep, baseCurrency, quoteCurrency)
    if (inverted) {
      return [minPrice_.invert(), maxPrice_.invert()]
    }
    return [minPrice_, maxPrice_]
  }, [inverted, minBinId, maxBinId, binStep, baseCurrency, quoteCurrency])

  const { t } = useTranslation()
  return (
    <Message variant="warning">
      <MessageText>
        {minPrice && maxPrice
          ? t(
              'Invalid range selected. The min price must be lower than the max price. And price should around the start price: %minPrice% - %maxPrice%',
              {
                minPrice: minPrice.denominator ? minPrice.toFixed(8) : 0,
                maxPrice: maxPrice.denominator ? maxPrice.toFixed(8) : 0,
              },
            )
          : t('Invalid range selected. The min price must be lower than the max price.')}
      </MessageText>
    </Message>
  )
}

export const SubmitCreateButton: React.FC<SubmitCreateButtonProps> = ({ ...boxProps }) => {
  const { address: account } = useAccount()
  const { t } = useTranslation()
  const { onOpen: onOpenPreviewModal, isOpen: isPreviewModalOpen, onDismiss: onDismissPreviewModal } = useModalV2()

  // Common
  const { chainId, switchCurrencies } = useSelectIdRouteParams()
  const { currency0, currency1 } = useCurrencies()
  const [inverted] = useInverted()
  const startPriceAsFraction = useStartPriceAsFraction()
  const { depositCurrencyAmount0, depositCurrencyAmount1 } = useCreateDepositAmounts()
  const { isDeposit0Enabled, isDeposit1Enabled } = useCreateDepositAmountsEnabled()
  const { poolType, feeTierSetting, feeLevel, hookAddress, hookEnabled } = useInfinityCreateFormQueryState()

  // CL
  const { tickSpacing } = useInfinityCLQueryState()
  const c0 = currency0 && !isSolana(currency0.chainId) ? (currency0 as unknown as Currency) : undefined
  const c1 = currency1 && !isSolana(currency1.chainId) ? (currency1 as unknown as Currency) : undefined
  const { lowerPrice, upperPrice, minPrice, maxPrice } = useCLPriceRange(
    c0,
    c1,
    tickSpacing ?? undefined,
    formatPreviewPrice,
  )

  // Bin
  const { binStep, lowerBinId, upperBinId, activeId } = useInfinityBinQueryState()
  const { maxBinId, minBinId } = useBinIdRange()

  const [currency0Balance, currency1Balance] = useCurrencyBalances(
    account,
    useMemo(() => [currency0, currency1], [currency0, currency1]),
  )
  const {
    approve: approveACallback,
    revoke: revokeACallback,

    isApproving: isApprovingA,
    isRevoking: isRevokingA,

    requireApprove: requireApproveA,
    requireRevoke: requireRevokeA,
  } = usePermit2(
    currency0?.isNative ? undefined : depositCurrencyAmount0?.wrapped,
    getInfinityPositionManagerAddress(poolType, chainId),
    {
      overrideChainId: chainId,
    },
  )
  const {
    approve: approveBCallback,
    revoke: revokeBCallback,

    isApproving: isApprovingB,
    isRevoking: isRevokingB,

    requireApprove: requireApproveB,
    requireRevoke: requireRevokeB,
  } = usePermit2(
    currency1?.isNative ? undefined : depositCurrencyAmount1?.wrapped,
    getInfinityPositionManagerAddress(poolType, chainId),
    {
      overrideChainId: chainId,
    },
  )

  const isDepositFilled = useMemo(
    () => Boolean(depositCurrencyAmount0 || depositCurrencyAmount1),
    [depositCurrencyAmount0, depositCurrencyAmount1],
  )
  const currencies = useMemo(() => ({ [Field.CURRENCY_A]: c0, [Field.CURRENCY_B]: c1 }), [c0, c1])
  const shouldShowApprovalGroup = useMemo(
    () =>
      isDepositFilled &&
      (requireApproveA ||
        isApprovingA ||
        isRevokingA ||
        requireRevokeA ||
        requireApproveB ||
        isApprovingB ||
        isRevokingB ||
        requireRevokeB),
    [
      isDepositFilled,
      isApprovingA,
      isRevokingA,
      requireRevokeA,
      isApprovingB,
      isRevokingB,
      requireRevokeB,
      requireApproveA,
      requireApproveB,
    ],
  )

  const showApprovalA = useMemo(
    () =>
      (currencies[Field.CURRENCY_A]?.isToken ?? false) &&
      (requireApproveA || requireRevokeA) &&
      Boolean(depositCurrencyAmount0) &&
      isDeposit0Enabled,
    [requireApproveA, requireRevokeA, depositCurrencyAmount0, currencies, isDeposit0Enabled],
  )
  const showApprovalB = useMemo(
    () =>
      (currencies[Field.CURRENCY_B]?.isToken ?? false) &&
      (requireApproveB || requireRevokeB) &&
      Boolean(depositCurrencyAmount1) &&
      isDeposit1Enabled,
    [requireApproveB, requireRevokeB, depositCurrencyAmount1, currencies, isDeposit1Enabled],
  )

  const isBinStepValid = useMemo(() => {
    if (poolType === 'Bin') {
      return binStep !== null && binStep >= MIN_BIN_STEP && binStep <= MAX_BIN_STEP
    }
    return true
  }, [binStep, poolType])

  const outOfRange = useMemo(() => {
    if (poolType === 'Bin' && lowerBinId && upperBinId && activeId) {
      return activeId < lowerBinId || activeId > upperBinId
    }
    // @TODO: check
    if (poolType === 'CL' && lowerPrice && upperPrice && startPriceAsFraction) {
      const p = isCurrencySorted(startPriceAsFraction.baseCurrency, startPriceAsFraction.quoteCurrency)
        ? startPriceAsFraction
        : startPriceAsFraction.invert()
      return p.lessThan(lowerPrice) || p.greaterThan(upperPrice)
    }
    return false
  }, [poolType, lowerBinId, upperBinId, activeId, lowerPrice, upperPrice, startPriceAsFraction])

  const invalidBinRange = useMemo(() => {
    if (poolType === 'Bin' && lowerBinId && upperBinId) {
      if (!lowerBinId || !upperBinId) return true

      return lowerBinId > upperBinId || (minBinId && lowerBinId < minBinId) || (maxBinId && upperBinId > maxBinId)
    }
    return false
  }, [lowerBinId, maxBinId, minBinId, poolType, upperBinId])
  const invalidClRange = useMemo(() => {
    if (poolType === 'CL' && lowerPrice && upperPrice) {
      return lowerPrice.greaterThan(upperPrice)
    }
    return false
  }, [poolType, lowerPrice, upperPrice])

  const isSubmitEnabled = useMemo(
    () =>
      isBinStepValid &&
      isDepositFilled &&
      (feeTierSetting === 'static' ? Boolean(feeLevel) && !isFeeOutOfRange(feeLevel, poolType) : true),
    [isBinStepValid, isDepositFilled, feeTierSetting, feeLevel, poolType],
  )

  const onSubmit = useFormSubmitCallback()

  const submitDisabled = useMemo(() => {
    return !isSubmitEnabled || showApprovalA || showApprovalB || invalidBinRange || invalidClRange
  }, [invalidBinRange, invalidClRange, isSubmitEnabled, showApprovalA, showApprovalB])

  const buttonText = useMemo(() => {
    if ((isDeposit0Enabled && !depositCurrencyAmount0) || (isDeposit1Enabled && !depositCurrencyAmount1)) {
      return t('Enter an amount')
    }

    if (isDeposit0Enabled && depositCurrencyAmount0 && currency0Balance?.lessThan(depositCurrencyAmount0)) {
      return t('Insufficient %symbol% balance', { symbol: currency0?.symbol ?? 'Unknown' })
    }

    if (isDeposit1Enabled && depositCurrencyAmount1 && currency1Balance?.lessThan(depositCurrencyAmount1)) {
      return t('Insufficient %symbol% balance', { symbol: currency1?.symbol ?? 'Unknown' })
    }

    return t('Preview Pool')
  }, [
    currency0?.symbol,
    currency0Balance,
    currency1?.symbol,
    currency1Balance,
    depositCurrencyAmount0,
    depositCurrencyAmount1,
    isDeposit0Enabled,
    isDeposit1Enabled,
    t,
  ])

  const currency0UsdValue = useStablecoinPriceAmount(
    c0,
    depositCurrencyAmount0 ? Number(depositCurrencyAmount0.toExact()) : undefined,
    {
      enabled: Boolean(depositCurrencyAmount0),
    },
  )
  const currency1UsdValue = useStablecoinPriceAmount(
    c1,
    depositCurrencyAmount1 ? Number(depositCurrencyAmount1.toExact()) : undefined,
  )
  const lowLiquidity = useMemo(() => {
    if (depositCurrencyAmount0?.equalTo(0) || depositCurrencyAmount1?.equalTo(0)) return false
    const value0 = currency0UsdValue ?? 0
    const value1 = currency1UsdValue ?? 0
    if (value0 === 0 && value1 === 0) return false
    return value0 + value1 < 1000
  }, [currency0UsdValue, currency1UsdValue, depositCurrencyAmount0, depositCurrencyAmount1])

  // Get Bin min and max price for the preview modal
  const [minPriceBin, maxPriceBin] = useMemo(() => {
    if (!c0 || !c1 || binStep === null) return [undefined, undefined]

    let lowerPrice: Price<Currency, Currency> | undefined
    let upperPrice: Price<Currency, Currency> | undefined

    if (lowerBinId) {
      lowerPrice = getCurrencyPriceFromId(lowerBinId, binStep, c0, c1)
    }

    if (upperBinId) {
      upperPrice = getCurrencyPriceFromId(upperBinId, binStep, c0, c1)
    }

    return inverted ? [upperPrice?.invert(), lowerPrice?.invert()] : [lowerPrice, upperPrice]
  }, [c0, c1, binStep, lowerBinId, upperBinId, inverted])

  return (
    <Box {...boxProps}>
      <AutoColumn gap="8px">
        {lowLiquidity && <LowLiquidityMessage />}
        {outOfRange && <OutOfRangeMessage />}
        {invalidClRange && <InvalidCLRangeMessage />}
        {invalidBinRange && (
          <InvalidBinRangeMessage
            minBinId={minBinId}
            maxBinId={maxBinId}
            binStep={binStep}
            inverted={inverted}
            baseCurrency={c0}
            quoteCurrency={c1}
          />
        )}
      </AutoColumn>
      <Box mb="8px" mt={lowLiquidity || outOfRange || invalidClRange || invalidBinRange ? '8px' : undefined}>
        <ApproveLiquidityTokens
          isApprovingA={isApprovingA}
          isApprovingB={isApprovingB}
          isRevokingA={isRevokingA}
          isRevokingB={isRevokingB}
          requireRevokeA={requireRevokeA}
          requireRevokeB={requireRevokeB}
          approveACallback={approveACallback}
          approveBCallback={approveBCallback}
          revokeACallback={revokeACallback}
          revokeBCallback={revokeBCallback}
          currencies={currencies}
          shouldShowApprovalGroup={shouldShowApprovalGroup}
          showFieldAApproval={showApprovalA}
          showFieldBApproval={showApprovalB}
        />
      </Box>
      {account ? (
        <Button width="100%" onClick={onOpenPreviewModal} disabled={submitDisabled}>
          {buttonText}
        </Button>
      ) : (
        <ConnectWalletButton width="100%" />
      )}

      <PreviewModal
        isOpen={isPreviewModalOpen}
        onDismiss={onDismissPreviewModal}
        currencies={currencies}
        parsedAmounts={{
          [Field.CURRENCY_A]: depositCurrencyAmount0 ?? undefined,
          [Field.CURRENCY_B]: depositCurrencyAmount1 ?? undefined,
        }}
        onConfirm={onSubmit}
        details={{
          poolType: poolType === 'Bin' ? t('LBAMM') : t('CLAMM'),
          feeTierSetting: feeTierSetting === 'dynamic' ? t('Dynamic') : t('Static %fee%%', { fee: feeLevel || '' }),
          hookAddress: hookEnabled ? hookAddress : undefined,
          startPrice:
            startPriceAsFraction && startPriceAsFraction.denominator !== 0n && startPriceAsFraction.numerator !== 0n
              ? `${startPriceAsFraction.toSignificant(6)} ${t('%assetA% = 1 %assetB%', {
                  assetA: startPriceAsFraction.quoteCurrency.symbol,
                  assetB: startPriceAsFraction.baseCurrency.symbol,
                })}`
              : undefined,
          priceRange: (
            <>
              <FlexGap gap="4px" alignItems="center">
                <AutoColumn>
                  <div>
                    {poolType === 'Bin' ? (
                      <>
                        {formatPreviewPrice(minPriceBin)} - {formatPreviewPrice(maxPriceBin)}
                      </>
                    ) : (
                      <>
                        {minPrice} - {maxPrice}
                      </>
                    )}
                  </div>
                  <div>
                    {t('%assetA% = 1 %assetB%', {
                      assetA: !inverted ? currency1?.symbol : currency0?.symbol,
                      assetB: !inverted ? currency0?.symbol : currency1?.symbol,
                    })}
                  </div>
                </AutoColumn>
                <IconButton variant="text" scale="sm" onClick={switchCurrencies}>
                  <SwapHorizIcon color="textSubtle" />
                </IconButton>
              </FlexGap>
            </>
          ),
        }}
      />
    </Box>
  )
}
