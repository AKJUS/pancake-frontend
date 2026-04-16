/* eslint-disable jsx-a11y/anchor-is-valid */
import { Protocol } from '@pancakeswap/farms'
import { Permit2Signature } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, Price } from '@pancakeswap/swap-sdk-core'
import {
  AutoRow,
  Box,
  Card,
  CardBody,
  Container,
  Flex,
  FlexGap,
  Grid,
  Image,
  PreTitle,
  RowBetween,
  Spinner,
  Text,
} from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { CurrencyLogo, Liquidity } from '@pancakeswap/widgets-internal'
import { LightGreyCard } from 'components/Card'
import CurrencyInputPanel from 'components/CurrencyInputPanel'
import Divider from 'components/Divider'
import FormattedCurrencyAmount from 'components/FormattedCurrencyAmount/FormattedCurrencyAmount'
import { RangePriceSection } from 'components/RangePriceSection'
import { Bound } from 'config/constants/types'
import { useInfinityClammPositionIdRouteParams } from 'hooks/dynamicRoute/usePositionIdRoute'
import { useAddCLPoolAndPosition } from 'hooks/infinity/useAddCLLiquidity'
import { useInfinityClPositionFromTokenId } from 'hooks/infinity/useInfinityPositions'
import useIsTickAtLimit from 'hooks/infinity/useIsTickAtLimit'
import { usePositionAmount } from 'hooks/infinity/usePositionAmount'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { ApprovalState } from 'hooks/useApproveCallback'
import { usePermit2 } from 'hooks/usePermit2'
import { useStablecoinPrice } from 'hooks/useStablecoinPrice'
import { formatTickPrice } from 'hooks/v3/utils/formatTickPrice'
import { useCallback, useMemo, useState } from 'react'
import { useExtraInfinityPositionInfo } from 'state/farmsV4/hooks'
import styled from 'styled-components'
import { getInfinityPositionManagerAddress } from 'utils/addressHelpers'
import { formatPrice } from 'utils/formatCurrencyAmount'
import { CurrencyField } from 'utils/types'
import { maxUint128, zeroAddress } from 'viem'
import { V3SubmitButton } from 'views/AddLiquidityV3/components/V3SubmitButton'
import { LiquidityTitle } from 'views/PositionDetails/components'

import { INITIAL_ALLOWED_SLIPPAGE, useUserSlippage } from '@pancakeswap/utils/user'
import { useHookByPoolId } from 'hooks/infinity/useHooksList'
import { calculateSlippageAmount } from 'utils/exchange'
import { NavBreadcrumbs } from 'views/RemoveLiquidityInfinity/components/NavBreadcrumbs'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useErrorMsg } from './hooks/useErrorMsg'
import { useIncreaseForm } from './hooks/useIncreaseForm'

const StyledCard = styled(Card)`
  width: 100%;
  max-width: 440px;
`

export const useInverter = ({
  priceLower,
  priceUpper,
  quote,
  base,
  invert,
}: {
  priceLower?: Price<Currency, Currency>
  priceUpper?: Price<Currency, Currency>
  quote?: Currency
  base?: Currency
  invert?: boolean
}): {
  priceLower?: Price<Currency, Currency>
  priceUpper?: Price<Currency, Currency>
  quote?: Currency
  base?: Currency
} => {
  return {
    priceUpper: invert ? priceLower?.invert() : priceUpper,
    priceLower: invert ? priceUpper?.invert() : priceLower,
    quote: invert ? base : quote,
    base: invert ? quote : base,
  }
}

/**
 * Infinity Increase Liquidity
 */
export const IncreaseLiquidity = () => {
  const {
    t,
    currentLanguage: { locale },
  } = useTranslation()
  const { account, chainId, isWrongNetwork } = useAccountActiveChain()
  const { tokenId } = useInfinityClammPositionIdRouteParams()

  const { position } = useInfinityClPositionFromTokenId(tokenId, chainId)
  const { token0: token0Address, token1: token1Address, fee, dynamic, liquidity, tickLower, tickUpper } = position || {}

  const currency0 = useCurrencyByChainId(token0Address, chainId)
  const currency1 = useCurrencyByChainId(token1Address, chainId)
  const {
    priceLower: priceLower_,
    priceUpper: priceUpper_,
    base: base_,
    quote: quote_,
    pool,
    poolId,
  } = useExtraInfinityPositionInfo(position)

  const hookData = useHookByPoolId(chainId, poolId)
  const feeAmount = hookData?.defaultFee ?? fee

  const isOutOfRange = useMemo(() => {
    if (!pool || typeof tickLower === 'undefined' || typeof tickUpper === 'undefined') return false
    return pool.tickCurrent < tickLower || pool.tickCurrent > tickUpper
  }, [pool, tickLower, tickUpper])

  const [manuallyInverted, setManuallyInverted] = useState(false)
  const { priceLower, priceUpper, base } = useInverter({
    priceLower: priceLower_,
    priceUpper: priceUpper_,
    quote: quote_,
    base: base_,
    invert: manuallyInverted,
  })

  const { amount0, amount1, deposit0Disabled, deposit1Disabled, invalidRange } = usePositionAmount({
    token0: currency0,
    token1: currency1,
    tickCurrent: pool?.tickCurrent,
    tickLower,
    tickUpper,
    sqrtRatioX96: pool?.sqrtRatioX96,
    liquidity,
  })

  const price0 = useStablecoinPrice(currency0, { enabled: Boolean(amount0?.greaterThan(0)) })
  const price1 = useStablecoinPrice(currency1, { enabled: Boolean(amount1?.greaterThan(0)) })

  const inverted = currency1 && base ? base.equals(currency1) : undefined
  const currencyQuote = inverted ? currency0 : currency1
  const currencyBase = inverted ? currency1 : currency0

  const ticksAtLimit = useIsTickAtLimit(tickLower, tickUpper, pool?.tickSpacing)

  const currency0Address = currency0?.isNative ? zeroAddress : currency0?.address ?? zeroAddress
  const currency1Address = currency1?.isNative ? zeroAddress : currency1?.address ?? zeroAddress

  const {
    inputAmountRaw,
    outputAmountRaw,
    inputBalance,
    outputBalance,
    onInputAmountChange,
    onOutputAmountChange,
    onInputPercentChange,
    onOutputPercentChange,
    inputAmount,
    outputAmount,
    lastEditCurrency,
  } = useIncreaseForm({
    currency0,
    currency1,
    poolKey: position?.poolKey,
    tickLower,
    tickUpper,
    outOfRange: isOutOfRange,
    invalidRange,
  })

  const parsedAmounts = useMemo(
    () => ({
      [CurrencyField.CURRENCY_A]: inputAmount,
      [CurrencyField.CURRENCY_B]: outputAmount,
    }),
    [inputAmount, outputAmount],
  )

  const { errorMessage } = useErrorMsg({
    currencyA: currency0,
    currencyB: currency1,
    currencyAAmount: inputAmount,
    currencyBAmount: outputAmount,
    allowSingleSide: deposit0Disabled !== deposit1Disabled,
  })

  const isValid = !(invalidRange || errorMessage)

  const [allowedSlippage] = useUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]

  const { addCLLiquidity, attemptingTx } = useAddCLPoolAndPosition(
    chainId ?? 0,
    account ?? zeroAddress,
    currency0Address,
    currency1Address,
  )

  const {
    requirePermit: requirePermitA,
    requireApprove: requireApproveA,
    permit2Allowance: currentAllowanceA,
    isApproving: isApprovingA,
    permit: permitCallbackA,
    revoke: revokeCallbackA,
    approve: approveCallbackA,
  } = usePermit2(
    currency0?.isNative ? undefined : inputAmount?.wrapped,
    pool?.poolType ? getInfinityPositionManagerAddress(pool.poolType, chainId) : undefined,
    {
      overrideChainId: chainId,
    },
  )

  const approveAState = useMemo(
    () =>
      isApprovingA ? ApprovalState.PENDING : requireApproveA ? ApprovalState.NOT_APPROVED : ApprovalState.APPROVED,
    [isApprovingA, requireApproveA],
  )

  const {
    requirePermit: requirePermitB,
    requireApprove: requireApproveB,
    permit2Allowance: currentAllowanceB,
    isApproving: isApprovingB,
    permit: permitCallbackB,
    revoke: revokeCallbackB,
    approve: approveCallbackB,
  } = usePermit2(
    currency1?.isNative ? undefined : outputAmount?.wrapped,
    pool?.poolType ? getInfinityPositionManagerAddress(pool.poolType, chainId) : undefined,
    {
      overrideChainId: chainId,
    },
  )
  const approveBState = useMemo(
    () =>
      isApprovingB ? ApprovalState.PENDING : requireApproveB ? ApprovalState.NOT_APPROVED : ApprovalState.APPROVED,
    [isApprovingB, requireApproveB],
  )

  const handleIncreaseLiquidity = useCallback(async () => {
    if (!position || !tokenId || !pool || !currency0 || !currency1 || !account) {
      return
    }

    if (deposit0Disabled && inputAmount?.greaterThan(0)) return
    if (deposit1Disabled && outputAmount?.greaterThan(0)) return
    if (inputAmount?.equalTo(0) && outputAmount?.equalTo(0)) return

    let permit2Signature0: Permit2Signature | undefined
    let permit2Signature1: Permit2Signature | undefined

    if (!currency0?.isNative && requirePermitA) {
      permit2Signature0 = await permitCallbackA()
    }

    if (!currency1?.isNative && requirePermitB) {
      permit2Signature1 = await permitCallbackB()
    }
    const [, amount0Max] = inputAmount ? calculateSlippageAmount(inputAmount, allowedSlippage) : [0n, maxUint128]
    const [, amount1Max] = outputAmount ? calculateSlippageAmount(outputAmount, allowedSlippage) : [0n, maxUint128]
    await addCLLiquidity({
      tokenId: BigInt(tokenId),
      currency0,
      currency1,
      lastEditCurrency,
      poolKey: position.poolKey,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      sqrtPriceX96: pool.sqrtRatioX96,
      amount0Desired: inputAmount?.quotient ?? 0n,
      amount1Desired: outputAmount?.quotient ?? 0n,
      recipient: account,
      amount0Max,
      amount1Max,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 20), // 20 minutes,
      token0Permit2Signature: permit2Signature0,
      token1Permit2Signature: permit2Signature1,
    })
  }, [
    position,
    tokenId,
    pool,
    currency0,
    currency1,
    account,
    inputAmount,
    outputAmount,
    requirePermitA,
    requirePermitB,
    allowedSlippage,
    addCLLiquidity,
    lastEditCurrency,
    permitCallbackA,
    permitCallbackB,
  ])

  const showApprovalA = approveAState !== ApprovalState.APPROVED && !!amount0
  const showApprovalB = approveBState !== ApprovalState.APPROVED && !!amount1
  const currencies = useMemo(
    () => ({ [CurrencyField.CURRENCY_A]: currency0, [CurrencyField.CURRENCY_B]: currency1 }),
    [currency0, currency1],
  )
  if (!chainId) {
    return (
      <Grid style={{ placeItems: 'center', minHeight: '50vh' }}>
        <Spinner />
      </Grid>
    )
  }

  if (!position) {
    return <Image src="/images/decorations/3dpan.png" alt="Pancake illustration" width={120} height={103} />
  }

  return (
    <Container width={['100%', '100%', '100%', '60rem']}>
      <NavBreadcrumbs currency0={currency0} currency1={currency1}>
        <Text>{t('Increase Liquidity')}</Text>
      </NavBreadcrumbs>
      <StyledCard mt="24px" mx="auto">
        <CardBody>
          <Flex alignItems="center">
            <LiquidityTitle
              showPoolFeature={false}
              poolId={poolId}
              tokenId={tokenId ? BigInt(tokenId) : undefined}
              protocol={Protocol.InfinityCLAMM}
              currency0={currency0}
              currency1={currency1}
              isOutOfRange={isOutOfRange}
              chainId={chainId}
              dynamic={dynamic}
              feeTier={fee}
              size="sm"
              displayLabelOnMobile={false}
              displayGlobalSettings
            />
          </Flex>
          <LightGreyCard mt="24px">
            <Flex justifyContent="space-between" alignItems="center">
              <FlexGap gap="4px">
                <CurrencyLogo currency={currency0} />
                <Text color="textSubtle">{currency0?.symbol}</Text>
              </FlexGap>
              <div>
                <Text textAlign="right">
                  <FormattedCurrencyAmount currencyAmount={amount0} />
                </Text>
                <Text color="textSubtle" textAlign="right" small>
                  ~${formatNumber(amount0?.multiply(price0 ?? 0).toExact() ?? 0)}
                </Text>
              </div>
            </Flex>
            <Flex mt="12px" justifyContent="space-between" alignItems="center">
              <FlexGap gap="4px">
                <CurrencyLogo currency={currency1} />
                <Text color="textSubtle">{currency1?.symbol}</Text>
              </FlexGap>
              <div>
                <Text textAlign="right">
                  <FormattedCurrencyAmount currencyAmount={amount1} />
                </Text>
                <Text color="textSubtle" textAlign="right" small>
                  ~${formatNumber(amount1?.multiply(price1 ?? 0).toExact() ?? 0)}
                </Text>
              </div>
            </Flex>

            <Divider style={{ margin: '12px 0' }} />

            <Flex justifyContent="space-between">
              <Text color="textSubtle">{t('Fee Tier')}</Text>
              <Text>
                {dynamic ? '↕️ ' : null}
                {(feeAmount ?? 0) / 1e4}%
              </Text>
            </Flex>
          </LightGreyCard>
          <RowBetween mt="20px">
            <PreTitle>{t('Price Range')}</PreTitle>
            <Liquidity.RateToggle
              currencyA={currencyBase}
              handleRateToggle={() => setManuallyInverted(!manuallyInverted)}
            />
          </RowBetween>
          <AutoRow my="8px">
            <Flex alignItems="center" justifyContent="space-between" width="100%" flexWrap={['wrap', 'wrap', 'nowrap']}>
              <RangePriceSection
                mr={['0', '0', '16px']}
                mb={['8px', '8px', '0']}
                title={t('MIN PRICE')}
                price={formatTickPrice(priceLower, ticksAtLimit, Bound.LOWER, locale)}
                currency0={currencyQuote}
                currency1={currencyBase}
              />
              <RangePriceSection
                ml={['0', '0', '16px']}
                title={t('MAX PRICE')}
                price={formatTickPrice(priceUpper, ticksAtLimit, Bound.UPPER, locale)}
                currency0={currencyQuote}
                currency1={currencyBase}
              />
            </Flex>
          </AutoRow>
          <FlexGap mt="16px">
            {pool && currencyQuote && currencyBase ? (
              <RangePriceSection
                title={t('Current Price')}
                currency0={currencyQuote}
                currency1={currencyBase}
                price={formatPrice(inverted ? pool.token1Price : pool.token0Price, 6, locale)}
              />
            ) : null}
          </FlexGap>
          <Box mt="24px">
            <CurrencyInputPanel
              id="add-liquidity-input-tokenA"
              onUserInput={onInputAmountChange}
              onPercentInput={onInputPercentChange}
              onMax={() => onInputAmountChange(inputBalance?.toExact() ?? '')}
              value={inputAmountRaw}
              currency={currency0}
              maxAmount={inputBalance}
              disabled={deposit0Disabled}
              showUSDPrice
              showMaxButton
              showQuickInputButton
              disableCurrencySelect
            />
          </Box>
          <Box my="16px">
            <CurrencyInputPanel
              id="add-liquidity-input-tokenA"
              onUserInput={onOutputAmountChange}
              onPercentInput={onOutputPercentChange}
              onMax={() => onOutputAmountChange(outputBalance?.toExact() ?? '')}
              value={outputAmountRaw}
              currency={currency1}
              maxAmount={outputBalance}
              showUSDPrice
              showMaxButton
              showQuickInputButton
              disableCurrencySelect
              disabled={deposit1Disabled}
            />
          </Box>

          <RowBetween my="16px">
            <Text color="textSubtle">{t('Slippage Tolerance')}</Text>
            <LiquiditySlippageButton />
          </RowBetween>

          <V3SubmitButton
            addIsUnsupported={false}
            account={account ?? undefined}
            isWrongNetwork={Boolean(isWrongNetwork)}
            approvalA={approveAState}
            approvalB={approveBState}
            isValid={isValid}
            showApprovalA={showApprovalA}
            approveACallback={approveCallbackA}
            currentAllowanceA={currentAllowanceA}
            revokeACallback={revokeCallbackA}
            currencies={currencies}
            approveBCallback={approveCallbackB}
            currentAllowanceB={currentAllowanceB}
            revokeBCallback={revokeCallbackB}
            showApprovalB={showApprovalB}
            parsedAmounts={parsedAmounts}
            onClick={handleIncreaseLiquidity}
            attemptingTxn={attemptingTx}
            errorMessage={errorMessage}
            buttonText={t('Add +')}
            depositADisabled={deposit0Disabled}
            depositBDisabled={deposit1Disabled}
          />
        </CardBody>
      </StyledCard>
    </Container>
  )
}
