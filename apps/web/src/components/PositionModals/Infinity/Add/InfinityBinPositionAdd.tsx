import {
  BinLiquidityShape,
  getCurrencyPriceFromId,
  getIdSlippage,
  Permit2Signature,
  PoolKey,
} from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { CurrencyAmount, Percent } from '@pancakeswap/swap-sdk-core'
import { Box, Button, FlexGap, IconButton, PreTitle, RowBetween, SwapHorizIcon, Text } from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage, useUserSlippagePercent } from '@pancakeswap/utils/user'
import { CurrencyLogo, LightGreyCard } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { BinRangeSelector } from 'components/Liquidity/Form/BinRangeSelector'
import { FieldLiquidityShape } from 'components/Liquidity/Form/FieldLiquidityShape'
import { usePoolById } from 'hooks/infinity/usePool'
import { usePoolKeyByPoolId } from 'hooks/infinity/usePoolKeyByPoolId'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { ApprovalState } from 'hooks/useApproveCallback'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { usePermit2 } from 'hooks/usePermit2'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { InfinityBinPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useBinNumQueryState, useBinRangeQueryState, useLiquidityShapeQueryState } from 'state/infinity/shared'
import { useCurrencyBalancesWithChain } from 'state/wallet/hooks'
import { getInfinityPositionManagerAddress } from 'utils/addressHelpers'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { calculateSlippageAmount } from 'utils/exchange'
import { CurrencyField } from 'utils/types'
import { V3SubmitButton } from 'views/AddLiquidityV3/components/V3SubmitButton'
import { AddBinLiquidityParams, useAddBinLiquidity } from 'views/CreateLiquidityPool/hooks/useAddBinLiquidity'
import { useErrorMsg } from 'views/IncreaseLiquidity/hooks/useErrorMsg'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { PriceRangeDisplay } from 'views/PoolDetail/components/ProtocolPositionsTables'
import { maxUint128, zeroAddress } from 'viem'
import { parseUnits } from 'viem/utils'

interface InfinityBinPositionAddProps {
  position: InfinityBinPositionDetail
  poolInfo: PoolInfo
}

export const InfinityBinPositionAdd = ({ position, poolInfo }: InfinityBinPositionAddProps) => {
  const { t } = useTranslation()
  const { account, chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const chainId = position.chainId ?? poolInfo.chainId

  const [, pool] = usePoolById<'Bin'>(position.poolId, chainId)
  const poolKeyResult = usePoolKeyByPoolId(position.poolId, chainId, 'Bin')
  const poolKey = (position.poolKey ?? poolKeyResult?.data) as PoolKey<'Bin'> | undefined

  const currency0 = pool?.token0
  const currency1 = pool?.token1
  const currencies = useMemo(
    () => ({ [CurrencyField.CURRENCY_A]: currency0, [CurrencyField.CURRENCY_B]: currency1 }),
    [currency0, currency1],
  )

  const [inverted, setInverted] = useState(false)
  const toggleInverted = useCallback(() => setInverted((prev) => !prev), [])

  const currentPrice = useMemo(() => {
    if (!pool) return undefined
    return getCurrencyPriceFromId(pool.activeId, pool.binStep, pool.token0, pool.token1)
  }, [pool])

  const positionMinPrice = useMemo(() => {
    if (!pool || !position.minBinId) return undefined
    return getCurrencyPriceFromId(position.minBinId, pool.binStep, pool.token0, pool.token1)
  }, [pool, position.minBinId])

  const positionMaxPrice = useMemo(() => {
    if (!pool || !position.maxBinId) return undefined
    return getCurrencyPriceFromId(position.maxBinId, pool.binStep, pool.token0, pool.token1)
  }, [pool, position.maxBinId])

  const priceRangeProps = useMemo(() => {
    if (!currentPrice || !positionMinPrice || !positionMaxPrice) {
      return {
        minPrice: '-',
        maxPrice: '-',
        minPriceRaw: 0,
        maxPriceRaw: 0,
        currentPriceRaw: 0,
        showPercentages: false,
      }
    }

    const min = inverted ? positionMaxPrice.invert() : positionMinPrice
    const max = inverted ? positionMinPrice.invert() : positionMaxPrice
    const cur = inverted ? currentPrice.invert() : currentPrice

    const minNum = parseFloat(min.toSignificant(8))
    const maxNum = parseFloat(max.toSignificant(8))
    const curNum = parseFloat(cur.toSignificant(8))

    const minPct = curNum > 0 ? (((minNum - curNum) / curNum) * 100).toFixed(2) : '0'
    const maxPct = curNum > 0 ? (((maxNum - curNum) / curNum) * 100).toFixed(2) : '0'

    return {
      minPrice: formatNumber(minNum, { maximumDecimalTrailingZeroes: 5, maximumSignificantDigits: 8 }),
      maxPrice: formatNumber(maxNum, { maximumDecimalTrailingZeroes: 5, maximumSignificantDigits: 8 }),
      minPriceRaw: minNum,
      maxPriceRaw: maxNum,
      currentPriceRaw: curNum,
      minPercentage: `${Number(minPct) >= 0 ? '+' : ''}${minPct}%`,
      maxPercentage: `${Number(maxPct) >= 0 ? '+' : ''}${maxPct}%`,
      showPercentages: curNum > 0,
    }
  }, [currentPrice, positionMinPrice, positionMaxPrice, inverted])

  const currentPriceFormatted = useMemo(() => {
    if (!currentPrice) return '-'
    const p = inverted ? currentPrice.invert() : currentPrice
    return formatNumber(parseFloat(p.toSignificant(8)), {
      maximumDecimalTrailingZeroes: 5,
      maximumSignificantDigits: 8,
    })
  }, [currentPrice, inverted])

  // ── Distribution ──
  const { data: currency0Usd } = useCurrencyUsdPrice(currency0)
  const { data: currency1Usd } = useCurrencyUsdPrice(currency1)

  const totalAmount0 = useMemo(() => {
    if (!currency0 || !position.reserveOfBins) return undefined
    const total = position.reserveOfBins.reduce((acc, bin) => {
      if (bin.userSharesOfBin === 0n || bin.totalShares === 0n) return acc
      return acc + (bin.userSharesOfBin * bin.reserveX) / bin.totalShares
    }, 0n)
    return CurrencyAmount.fromRawAmount(currency0, total)
  }, [position.reserveOfBins, currency0])

  const totalAmount1 = useMemo(() => {
    if (!currency1 || !position.reserveOfBins) return undefined
    const total = position.reserveOfBins.reduce((acc, bin) => {
      if (bin.userSharesOfBin === 0n || bin.totalShares === 0n) return acc
      return acc + (bin.userSharesOfBin * bin.reserveY) / bin.totalShares
    }, 0n)
    return CurrencyAmount.fromRawAmount(currency1, total)
  }, [position.reserveOfBins, currency1])

  const distributionPercent0 = useMemo(() => {
    if (!totalAmount0 || !totalAmount1 || !currency0Usd || !currency1Usd) return 50
    const usd0 = BN(totalAmount0.toExact()).multipliedBy(currency0Usd)
    const usd1 = BN(totalAmount1.toExact()).multipliedBy(currency1Usd)
    const total = usd0.plus(usd1)
    if (total.isZero()) return 50
    return usd0.dividedBy(total).multipliedBy(100).toNumber()
  }, [totalAmount0, totalAmount1, currency0Usd, currency1Usd])

  // ── Bin Range (shared query state, like Remove does) ──
  const [{ lowerBinId, upperBinId }, setBinRangeQueryState] = useBinRangeQueryState()
  const [numBin, setNumBinQueryState] = useBinNumQueryState()
  const [liquidityShape] = useLiquidityShapeQueryState()

  const minBinId = position.minBinId ?? null
  const maxBinId = position.maxBinId ?? null

  useEffect(() => {
    if (minBinId === null || maxBinId === null) return

    const hasUnsetRange = lowerBinId === null || upperBinId === null
    const hasInvalidOrder = lowerBinId !== null && upperBinId !== null && lowerBinId > upperBinId
    const isOutsidePositionRange =
      lowerBinId !== null &&
      upperBinId !== null &&
      (lowerBinId < minBinId || upperBinId > maxBinId || upperBinId < minBinId || lowerBinId > maxBinId)

    if (hasUnsetRange || hasInvalidOrder || isOutsidePositionRange) {
      setBinRangeQueryState({ lowerBinId: minBinId, upperBinId: maxBinId })
    }

    const safeLower = hasUnsetRange || hasInvalidOrder || isOutsidePositionRange ? minBinId : lowerBinId
    const safeUpper = hasUnsetRange || hasInvalidOrder || isOutsidePositionRange ? maxBinId : upperBinId
    if (safeLower !== null && safeUpper !== null && safeUpper >= safeLower) {
      const expectedNumBins = safeUpper - safeLower + 1
      if ((numBin === null || numBin <= 0) && Number.isFinite(expectedNumBins) && expectedNumBins > 0) {
        setNumBinQueryState(expectedNumBins)
      }
    }
  }, [lowerBinId, maxBinId, minBinId, numBin, setBinRangeQueryState, setNumBinQueryState, upperBinId])

  const invalidBinRange = useMemo(() => {
    if (!lowerBinId || !upperBinId) return true
    if (lowerBinId > upperBinId) return true
    if (minBinId !== null && (lowerBinId < minBinId || upperBinId < minBinId)) return true
    if (maxBinId !== null && (lowerBinId > maxBinId || upperBinId > maxBinId)) return true
    return false
  }, [lowerBinId, upperBinId, minBinId, maxBinId])

  const outOfRange = useMemo(() => {
    return Boolean(lowerBinId && upperBinId && pool && (pool.activeId < lowerBinId || pool.activeId > upperBinId))
  }, [lowerBinId, upperBinId, pool])

  const isInRange = useMemo(() => {
    if (!pool || !lowerBinId || !upperBinId) return false
    return lowerBinId <= pool.activeId && pool.activeId <= upperBinId
  }, [pool, lowerBinId, upperBinId])

  const isDeposit0Enabled = useMemo(() => {
    if (!pool || !lowerBinId) return false
    return lowerBinId >= pool.activeId || isInRange
  }, [pool, lowerBinId, isInRange])

  const isDeposit1Enabled = useMemo(() => {
    if (!pool || !upperBinId) return false
    return upperBinId <= pool.activeId || isInRange
  }, [pool, upperBinId, isInRange])

  // ── Deposit Amounts ──
  const [inputValue0, setInputValue0] = useState('')
  const [inputValue1, setInputValue1] = useState('')

  const depositAmount0 = useMemo(() => {
    if (!currency0 || !inputValue0) return undefined
    try {
      return CurrencyAmount.fromRawAmount(currency0, parseUnits(inputValue0, currency0.decimals))
    } catch {
      return undefined
    }
  }, [currency0, inputValue0])

  const depositAmount1 = useMemo(() => {
    if (!currency1 || !inputValue1) return undefined
    try {
      return CurrencyAmount.fromRawAmount(currency1, parseUnits(inputValue1, currency1.decimals))
    } catch {
      return undefined
    }
  }, [currency1, inputValue1])

  const [balance0, balance1] = useCurrencyBalancesWithChain(
    account ?? undefined,
    useMemo(() => [currency0, currency1], [currency0, currency1]),
    chainId,
  )

  const handlePercent0Change = useCallback(
    (percent: number) => {
      if (balance0) setInputValue0(balance0.multiply(new Percent(percent, 100)).toExact())
    },
    [balance0],
  )

  const handlePercent1Change = useCallback(
    (percent: number) => {
      if (balance1) setInputValue1(balance1.multiply(new Percent(percent, 100)).toExact())
    },
    [balance1],
  )

  const parsedAmounts = useMemo(
    () => ({
      [CurrencyField.CURRENCY_A]: depositAmount0,
      [CurrencyField.CURRENCY_B]: depositAmount1,
    }),
    [depositAmount0, depositAmount1],
  )

  const isUserInsufficientBalanceA = useMemo(() => {
    const max = maxAmountSpend(balance0)
    if (!account || !depositAmount0 || !max) return false
    return max.lessThan(depositAmount0)
  }, [account, depositAmount0, balance0])

  const isUserInsufficientBalanceB = useMemo(() => {
    const max = maxAmountSpend(balance1)
    if (!account || !depositAmount1 || !max) return false
    return max.lessThan(depositAmount1)
  }, [account, depositAmount1, balance1])

  // ── Total USD ──
  const totalDepositUsdValue = useMemo(() => {
    if (!currency0Usd || !currency1Usd) return '0.00'
    const usd0 = BN(currency0Usd).multipliedBy(depositAmount0?.toExact() || 0)
    const usd1 = BN(currency1Usd).multipliedBy(depositAmount1?.toExact() || 0)
    return usd0.plus(usd1).toFormat(2)
  }, [currency0Usd, currency1Usd, depositAmount0, depositAmount1])

  // ── Validation ──
  const { errorMessage } = useErrorMsg({
    currencyA: currency0,
    currencyB: currency1,
    currencyAAmount: isDeposit0Enabled ? depositAmount0 : undefined,
    currencyBAmount: isDeposit1Enabled ? depositAmount1 : undefined,
    allowSingleSide: true,
  })

  const isValid = !errorMessage && !invalidBinRange

  // ── Slippage ──
  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]
  const [userSlippagePercent] = useUserSlippagePercent()

  const idSlippage = useMemo(() => {
    if (!pool) return 0
    return getIdSlippage(parseFloat(userSlippagePercent.toSignificant(2)), pool.binStep, pool.activeId)
  }, [userSlippagePercent, pool])

  // ── Token Approvals ──
  const positionManagerAddress = getInfinityPositionManagerAddress('Bin', chainId)

  const {
    requirePermit: requirePermitA,
    requireApprove: requireApproveA,
    permit2Allowance: currentAllowanceA,
    isApproving: isApprovingA,
    permit: permitCallbackA,
    revoke: revokeCallbackA,
    approve: approveCallbackA,
  } = usePermit2(currency0?.isNative ? undefined : depositAmount0?.wrapped, positionManagerAddress, {
    overrideChainId: chainId,
  })

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
  } = usePermit2(currency1?.isNative ? undefined : depositAmount1?.wrapped, positionManagerAddress, {
    overrideChainId: chainId,
  })

  const approveBState = useMemo(
    () =>
      isApprovingB ? ApprovalState.PENDING : requireApproveB ? ApprovalState.NOT_APPROVED : ApprovalState.APPROVED,
    [isApprovingB, requireApproveB],
  )

  const showApprovalA = approveAState !== ApprovalState.APPROVED && !!depositAmount0
  const showApprovalB = approveBState !== ApprovalState.APPROVED && !!depositAmount1

  // ── Submit ──
  const currency0Address = currency0?.isNative ? zeroAddress : currency0?.address ?? zeroAddress
  const currency1Address = currency1?.isNative ? zeroAddress : currency1?.address ?? zeroAddress

  const { addBinLiquidity, attemptingTx } = useAddBinLiquidity(
    chainId ?? 0,
    account ?? zeroAddress,
    currency0Address,
    currency1Address,
  )

  const handleAddLiquidity = useCallback(async () => {
    if (!pool || !account || !poolKey || !currency0 || !currency1) return
    if (!depositAmount0?.greaterThan(0) && !depositAmount1?.greaterThan(0)) return
    if (lowerBinId === null || upperBinId === null || liquidityShape === null || numBin === null) return

    let permit2Sig0: Permit2Signature | undefined
    let permit2Sig1: Permit2Signature | undefined

    if (!currency0.isNative && requirePermitA && depositAmount0 && depositAmount0.greaterThan(0)) {
      permit2Sig0 = await permitCallbackA()
    }
    if (!currency1.isNative && requirePermitB && depositAmount1 && depositAmount1.greaterThan(0)) {
      permit2Sig1 = await permitCallbackB()
    }

    const [, amount0Max] = depositAmount0 ? calculateSlippageAmount(depositAmount0, allowedSlippage) : [0n, maxUint128]
    const [, amount1Max] = depositAmount1 ? calculateSlippageAmount(depositAmount1, allowedSlippage) : [0n, maxUint128]

    const params: AddBinLiquidityParams = {
      poolKey,
      liquidityShape: liquidityShape as unknown as BinLiquidityShape,
      binNums: numBin,
      activeIdDesired: pool.activeId,
      idSlippage: BigInt(idSlippage),
      amount0Desired: depositAmount0?.quotient ?? 0n,
      amount1Desired: depositAmount1?.quotient ?? 0n,
      amount0Max,
      amount1Max,
      recipient: account,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
      currency0,
      currency1,
      lowerBinId,
      upperBinId,
      token0Permit2Signature: permit2Sig0,
      token1Permit2Signature: permit2Sig1,
    }

    await addBinLiquidity(params)
  }, [
    pool,
    account,
    poolKey,
    currency0,
    currency1,
    depositAmount0,
    depositAmount1,
    lowerBinId,
    upperBinId,
    liquidityShape,
    numBin,
    requirePermitA,
    requirePermitB,
    permitCallbackA,
    permitCallbackB,
    allowedSlippage,
    idSlippage,
    addBinLiquidity,
  ])

  if (!pool) return null

  const symbol0 = inverted ? pool.token1.symbol : pool.token0.symbol
  const symbol1 = inverted ? pool.token0.symbol : pool.token1.symbol

  return (
    <Box>
      {/* Price Range (Min-Max) — read-only position range */}
      <LightGreyCard borderRadius="24px" padding="16px">
        <PreTitle mb="8px">{t('Price Range (Min-Max)')}</PreTitle>
        <PriceRangeDisplay
          minPrice={priceRangeProps.minPrice}
          maxPrice={priceRangeProps.maxPrice}
          minPriceRaw={priceRangeProps.minPriceRaw}
          maxPriceRaw={priceRangeProps.maxPriceRaw}
          currentPriceRaw={priceRangeProps.currentPriceRaw}
          minPercentage={priceRangeProps.minPercentage}
          maxPercentage={priceRangeProps.maxPercentage}
          showPercentages={priceRangeProps.showPercentages}
          outOfRange={outOfRange}
          maxWidth="unset"
        />
        <RowBetween mt="8px">
          <Text color="textSubtle" small>
            {t('Current Price')}
          </Text>
          <FlexGap gap="2px">
            <Text small>{currentPriceFormatted}</Text>
            <Text color="textSubtle" small>
              {t('%symbol0% per %symbol1%', { symbol0, symbol1 })}
            </Text>
            <IconButton variant="text" onClick={toggleInverted} scale="xs">
              <SwapHorizIcon color="primary60" width="16px" mt="2px" />
            </IconButton>
          </FlexGap>
        </RowBetween>
      </LightGreyCard>

      {/* Distribution — read-only position balances */}
      {currency0 && currency1 && (
        <LightGreyCard borderRadius="24px" padding="16px" mt="16px">
          <RowBetween>
            <PreTitle>{t('Distribution')}</PreTitle>
          </RowBetween>
          <RowBetween mt="12px">
            <FlexGap gap="8px" alignItems="center">
              <CurrencyLogo currency={currency0} size="24px" />
              <Text bold>{currency0.symbol}</Text>
            </FlexGap>
            <FlexGap gap="8px" alignItems="center">
              <Text bold>{currency1.symbol}</Text>
              <CurrencyLogo currency={currency1} size="24px" />
            </FlexGap>
          </RowBetween>
          <RowBetween mt="4px">
            <Text small>{totalAmount0?.toSignificant(6) ?? '0'}</Text>
            <Text small>{totalAmount1?.toSignificant(6) ?? '0'}</Text>
          </RowBetween>
          <Box mt="8px" height="5px" borderRadius="4px" overflow="hidden" backgroundColor="primary">
            <Box height="100%" borderRadius="4px" width={`${distributionPercent0}%`} backgroundColor="textSubtle" />
          </Box>
          <RowBetween mt="4px">
            <Text small color="textSubtle">
              {distributionPercent0.toFixed(2)}%
            </Text>
            <Text small color="textSubtle">
              {(100 - distributionPercent0).toFixed(2)}%
            </Text>
          </RowBetween>
        </LightGreyCard>
      )}

      {/* Set Price Range */}
      <PreTitle mt="16px">{t('Set Price Range')}</PreTitle>
      <Box mt="8px">
        <BinRangeSelector
          currency0={currency0}
          currency1={currency1}
          binStep={pool.binStep}
          activeBinId={pool.activeId}
          minBinId={minBinId}
          maxBinId={maxBinId}
        />
      </Box>

      {/* Choose Liquidity Shape */}
      <FieldLiquidityShape mt="16px" />

      {/* Amount of Liquidity to Add */}
      <PreTitle mt="16px">{t('Amount of Liquidity to Add')}</PreTitle>
      <RowBetween mt="8px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      <LightGreyCard mt="16px" borderRadius="24px" padding="16px">
        <CurrencyInputPanelSimplify
          id="position-modal-bin-increase-A"
          defaultValue={inputValue0}
          currency={currency0}
          onUserInput={setInputValue0}
          maxAmount={balance0}
          onMax={() => setInputValue0(balance0?.toExact() ?? '')}
          onPercentInput={handlePercent0Change}
          showUSDPrice
          showMaxButton
          disableCurrencySelect
          title={<>&nbsp;</>}
          wrapperProps={{ style: { backgroundColor: 'transparent' } }}
          isUserInsufficientBalance={isUserInsufficientBalanceA}
        />
        <br />
        <CurrencyInputPanelSimplify
          id="position-modal-bin-increase-B"
          defaultValue={inputValue1}
          currency={currency1}
          onUserInput={setInputValue1}
          maxAmount={balance1}
          onMax={() => setInputValue1(balance1?.toExact() ?? '')}
          onPercentInput={handlePercent1Change}
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
          {t('Total deposit value (USD):')}
        </Text>
        <Text small>${totalDepositUsdValue}</Text>
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
            onClick={handleAddLiquidity}
            attemptingTxn={attemptingTx}
            errorMessage={errorMessage}
            buttonText={t('Add')}
            depositADisabled={!isDeposit0Enabled}
            depositBDisabled={!isDeposit1Enabled}
          />
        )}
      </Box>
    </Box>
  )
}
