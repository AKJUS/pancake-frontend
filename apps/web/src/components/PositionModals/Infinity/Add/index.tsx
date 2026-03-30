import { Permit2Signature } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { Box, Button, FlexGap, IconButton, PreTitle, RowBetween, SwapHorizIcon, Text } from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { useAddCLPoolAndPosition } from 'hooks/infinity/useAddCLLiquidity'
import useIsTickAtLimit from 'hooks/infinity/useIsTickAtLimit'
import { usePositionAmount } from 'hooks/infinity/usePositionAmount'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { ApprovalState } from 'hooks/useApproveCallback'
import { usePermit2 } from 'hooks/usePermit2'
import { useCallback, useMemo, useState } from 'react'
import { useExtraInfinityPositionInfo } from 'state/farmsV4/hooks'
import { InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { getInfinityPositionManagerAddress } from 'utils/addressHelpers'
import { calculateSlippageAmount } from 'utils/exchange'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { CurrencyField } from 'utils/types'
import { V3SubmitButton } from 'views/AddLiquidityV3/components/V3SubmitButton'
import { useErrorMsg } from 'views/IncreaseLiquidity/hooks/useErrorMsg'
import { useIncreaseForm } from 'views/IncreaseLiquidity/hooks/useIncreaseForm'
import { PriceRangeDisplay } from 'views/PoolDetail/components/ProtocolPositionsTables'
import { calculateTickBasedPriceRange } from 'views/PoolDetail/utils/priceRange'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { maxUint128, zeroAddress } from 'viem'
import { BigNumber as BN } from 'bignumber.js'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'

interface InfinityPositionAddProps {
  position: InfinityCLPositionDetail
  poolInfo: PoolInfo
}
export const InfinityCLPositionAdd = ({ position, poolInfo }: InfinityPositionAddProps) => {
  const { t } = useTranslation()

  const { account, chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()

  // Pool Info
  const { token0, token1, token0Price, token1Price } = poolInfo
  const { pool } = useExtraInfinityPositionInfo(position)

  // Currencies
  const currency0 = token0 as Currency
  const currency1 = token1 as Currency
  const currencies = useMemo(
    () => ({ [CurrencyField.CURRENCY_A]: currency0, [CurrencyField.CURRENCY_B]: currency1 }),
    [currency0, currency1],
  )
  const chainId = position.chainId || poolInfo.chainId

  // Price Display
  const [inverted, setInverted] = useState(false)
  const ticksAtLimit = useIsTickAtLimit(position.tickLower, position.tickUpper, position.tickSpacing)

  const priceDisplay = useMemo(() => {
    return calculateTickBasedPriceRange(
      position.tickLower,
      position.tickUpper,
      poolInfo.token0,
      poolInfo.token1,
      pool || poolInfo,
      ticksAtLimit,
      inverted,
    )
  }, [position, pool, poolInfo, ticksAtLimit, inverted])

  const toggleInverted = useCallback(() => {
    setInverted(!inverted)
  }, [inverted, setInverted])

  // Main Form
  const isOutOfRange = useMemo(() => {
    if (!pool || typeof position.tickLower === 'undefined' || typeof position.tickUpper === 'undefined') return false
    return pool.tickCurrent < position.tickLower || pool.tickCurrent > position.tickUpper
  }, [pool, position.tickLower, position.tickUpper])

  const { amount0, amount1, deposit0Disabled, deposit1Disabled, invalidRange } = usePositionAmount({
    token0: currency0,
    token1: currency1,
    tickCurrent: pool?.tickCurrent,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    sqrtRatioX96: pool?.sqrtRatioX96,
    liquidity: position.liquidity,
  })

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
    invalidRange,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    outOfRange: isOutOfRange,
    poolKey: position.poolKey,
  })

  // Convert to standard structure
  const parsedAmounts = useMemo(
    () => ({
      [CurrencyField.CURRENCY_A]: inputAmount,
      [CurrencyField.CURRENCY_B]: outputAmount,
    }),
    [inputAmount, outputAmount],
  )

  const isUserInsufficientBalanceA = useMemo(() => {
    const max = maxAmountSpend(inputBalance)
    if (!account || !inputAmount || !max) return false
    return max.lessThan(inputAmount)
  }, [account, inputAmount, inputBalance])

  const isUserInsufficientBalanceB = useMemo(() => {
    const max = maxAmountSpend(outputBalance)
    if (!account || !outputAmount || !max) return false
    return max.lessThan(outputAmount)
  }, [account, outputAmount, outputBalance])

  // Total USD Value
  const { data: currencyPrice0 } = useCurrencyUsdPrice(currency0, { enabled: !!currency0 && !!inputAmount?.quotient })
  const { data: currencyPrice1 } = useCurrencyUsdPrice(currency1, { enabled: !!currency1 && !!outputAmount?.quotient })
  const totalDepositUsdValue = useMemo(() => {
    if (!currencyPrice0 || !currencyPrice1) return 0

    const usd0 = BN(currencyPrice0).multipliedBy(inputAmount?.toExact() || 0)
    const usd1 = BN(currencyPrice1).multipliedBy(outputAmount?.toExact() || 0)

    return usd0.plus(usd1).toFormat(2)
  }, [currencyPrice0, currencyPrice1, inputAmount, outputAmount])

  // Token Approvals
  const {
    requirePermit: requirePermitA,
    requireApprove: requireApproveA,
    permit2Allowance: currentAllowanceA,
    isApproving: isApprovingA,
    isPermitting: isPermittingA,
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
    isPermitting: isPermittingB,
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

  const showApprovalA = approveAState !== ApprovalState.APPROVED && !!amount0
  const showApprovalB = approveBState !== ApprovalState.APPROVED && !!amount1

  // Validation
  const { errorMessage } = useErrorMsg({
    currencyA: currency0,
    currencyB: currency1,
    currencyAAmount: inputAmount,
    currencyBAmount: outputAmount,
    allowSingleSide: deposit0Disabled !== deposit1Disabled,
  })

  const isValid = !(invalidRange || errorMessage)

  // Slippage
  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]

  // Add CL Liquidity
  const currency0Address = currency0?.isNative ? zeroAddress : currency0?.address ?? zeroAddress
  const currency1Address = currency1?.isNative ? zeroAddress : currency1?.address ?? zeroAddress
  const { addCLLiquidity, attemptingTx } = useAddCLPoolAndPosition(
    chainId ?? 0,
    account ?? zeroAddress,
    currency0Address,
    currency1Address,
  )
  const handleIncreaseLiquidity = useCallback(async () => {
    if (!position || !position.tokenId || !pool || !currency0 || !currency1 || !account) {
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
      tokenId: BigInt(position.tokenId),
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
    pool,
    currency0,
    currency1,
    account,
    inputAmount,
    outputAmount,
    requirePermitA,
    requirePermitB,
    allowedSlippage,
    lastEditCurrency,
    addCLLiquidity,
    permitCallbackA,
    permitCallbackB,
  ])

  return (
    <Box>
      <LightGreyCard borderRadius="24px" padding="16px">
        <PreTitle mb="8px">{t('Price Range (Min-Max)')}</PreTitle>
        <Box px={isOutOfRange ? '16px' : '0'}>
          <PriceRangeDisplay
            minPrice={priceDisplay.minPriceFormatted}
            maxPrice={priceDisplay.maxPriceFormatted}
            currentPrice={priceDisplay.currentPrice}
            minPriceRaw={priceDisplay.minPrice}
            maxPriceRaw={priceDisplay.maxPrice}
            currentPriceRaw={priceDisplay.currentPriceValue}
            minPercentage={priceDisplay.minPercentage}
            maxPercentage={priceDisplay.maxPercentage}
            showPercentages={priceDisplay.showPercentages}
            rangePosition={priceDisplay.rangePosition}
            outOfRange={isOutOfRange}
            maxWidth="unset"
          />
        </Box>
        <RowBetween mt="8px">
          <Text color="textSubtle" small>
            {t('Current Price')}
          </Text>
          <FlexGap gap="2px">
            <Text small>
              {token0Price && token1Price
                ? formatNumber(inverted ? token0Price : token1Price, {
                    maximumDecimalTrailingZeroes: 5,
                    maximumSignificantDigits: 8,
                  })
                : '-'}
            </Text>
            <Text color="textSubtle" small>
              {t('%symbol0% per %symbol1%', {
                symbol0: inverted ? token0.symbol : token1.symbol,
                symbol1: inverted ? token1.symbol : token0.symbol,
              })}
            </Text>
            <IconButton variant="text" onClick={toggleInverted} scale="xs">
              <SwapHorizIcon color="primary60" width="16px" mt="2px" />
            </IconButton>
          </FlexGap>
        </RowBetween>
      </LightGreyCard>

      <PreTitle mt="16px">{t('Amount of liquidity to add')}</PreTitle>
      <RowBetween mt="8px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      <LightGreyCard mt="16px" borderRadius="24px" padding="16px">
        <CurrencyInputPanelSimplify
          id="position-modal-clamm-increase-A"
          defaultValue={inputAmountRaw}
          currency={currency0}
          onUserInput={onInputAmountChange}
          maxAmount={inputBalance}
          onMax={() => onInputAmountChange(inputBalance?.toExact() ?? '')}
          onPercentInput={onInputPercentChange}
          showUSDPrice
          showMaxButton
          disableCurrencySelect
          title={<>&nbsp;</>}
          wrapperProps={{ style: { backgroundColor: 'transparent' } }}
          isUserInsufficientBalance={isUserInsufficientBalanceA}
        />
        <br />
        <CurrencyInputPanelSimplify
          id="position-modal-clamm-increase-B"
          defaultValue={outputAmountRaw}
          currency={currency1}
          onUserInput={onOutputAmountChange}
          maxAmount={outputBalance}
          onMax={() => onOutputAmountChange(outputBalance?.toExact() ?? '')}
          onPercentInput={onOutputPercentChange}
          showUSDPrice
          showMaxButton
          disableCurrencySelect
          title={<>&nbsp;</>}
          wrapperProps={{ style: { backgroundColor: 'transparent' } }}
          isUserInsufficientBalance={isUserInsufficientBalanceB}
        />
      </LightGreyCard>

      <RowBetween mt="16px">
        <Text color="textSubtle" small>
          {t('Total Deposit Value')}
        </Text>
        <Text small>~${totalDepositUsdValue}</Text>
      </RowBetween>

      <Box mt="16px">
        <MevProtectToggle size="sm" />
      </Box>

      <Box mt="16px">
        {activeChainId !== chainId ? (
          <Button
            width="100%"
            onClick={() => (chainId ? switchNetworkIfNecessary(chainId) : undefined)}
            disabled={isSwitchNetworkLoading}
          >
            {t('Switch Network')}
          </Button>
        ) : (
          <V3SubmitButton
            addIsWarning={false}
            addIsUnsupported={false}
            account={account ?? undefined}
            isWrongNetwork={false}
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
            buttonText={t('Add')}
            depositADisabled={deposit0Disabled}
            depositBDisabled={deposit1Disabled}
          />
        )}
      </Box>
    </Box>
  )
}
