import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Percent } from '@pancakeswap/swap-sdk-core'
import { Box, Button, FlexGap, IconButton, PreTitle, RowBetween, SwapHorizIcon, Text, Toggle } from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import { PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { basisPointsToPercent } from 'utils/exchange'
import { CurrencyField as Field } from 'utils/types'
import { V3SubmitButton } from 'views/AddLiquidityV3/components/V3SubmitButton'
import { PriceRangeDisplay } from 'views/PoolDetail/components/ProtocolPositionsTables'
import { calculateTickBasedPriceRange } from 'views/PoolDetail/utils/priceRange'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { hexToBigInt } from 'viem'
import { BigNumber as BN } from 'bignumber.js'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useMasterchefV3, useV3NFTPositionManagerContract } from 'hooks/useContract'
import { useTransactionAdder } from 'state/transactions/hooks'
import { useV3TokenIdsByAccount } from 'hooks/v3/useV3Positions'
import { FeeAmount, MasterChefV3, NonfungiblePositionManager, Pool } from '@pancakeswap/v3-sdk'
import useV3DerivedInfo from 'hooks/v3/useV3DerivedInfo'
import { useV3FormState } from 'views/AddLiquidityV3/formViews/V3FormView/form/reducer'
import { useDerivedPositionInfo } from 'hooks/v3/useDerivedPositionInfo'
import { useV3MintActionHandlers } from 'views/AddLiquidityV3/formViews/V3FormView/form/hooks/useV3MintActionHandlers'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { useSendTransaction } from 'wagmi'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { getViemClients } from 'utils/viem'
import { calculateGasMargin } from 'utils'
import { isUserRejected } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { formatRawAmount } from 'utils/formatCurrencyAmount'
import { useIsTransactionUnsupported, useIsTransactionWarning } from 'hooks/Trades'
import { ZAP_V3_POOL_ADDRESSES } from 'config/constants/zap'
import { ZapLiquidityWidget } from 'components/ZapLiquidityWidget'
import { useRouter } from 'next/router'
import LockedDeposit from 'views/AddLiquidityV3/formViews/V3FormView/components/LockedDeposit'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import useNativeCurrency from 'hooks/useNativeCurrency'

interface V3PositionAddProps {
  position: PositionDetail
  poolInfo: PoolInfo
}
export const V3PositionAdd = ({ position: existingPositionDetail, poolInfo }: V3PositionAddProps) => {
  const { t } = useTranslation()
  const router = useRouter()

  // User Account
  const { account, chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const [deadline] = useTransactionDeadline() // custom from users settings

  // Transaction Management
  const addTransaction = useTransactionAdder()
  const { sendTransactionAsync } = useSendTransaction()

  // TODO: Remove txnHash or txnErrorMessage if not using in this page, or start using it.
  const [txHash, setTxHash] = useState<string>('')
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm
  const [txnErrorMessage, setTxnErrorMessage] = useState<string | undefined>()

  // Pool Info
  const { token0, token1, token0Price, token1Price, feeTier } = poolInfo
  const feeAmount: FeeAmount = useMemo(() => feeTier as FeeAmount, [feeTier])

  // Position Info
  const { tokenId } = existingPositionDetail
  const chainId = existingPositionDetail.chainId || poolInfo.chainId
  const { position: existingPosition } = useDerivedPositionInfo(existingPositionDetail, chainId)

  // Native token toggle
  const native = useNativeCurrency(chainId)
  const [useNativeInstead, setUseNativeInstead] = useState(true)

  const canUseNativeCurrency = useMemo(() => {
    return (
      (token0 as Currency)?.wrapped?.address === native.wrapped.address ||
      (token1 as Currency)?.wrapped?.address === native.wrapped.address
    )
  }, [token0, token1, native])

  const handleToggleNative = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setUseNativeInstead(e.target.checked)
    },
    [setUseNativeInstead],
  )

  // Currencies — swap wrapped → native when the toggle is active
  const baseCurrency = useMemo<Currency>(() => {
    if (useNativeInstead && canUseNativeCurrency && (token0 as Currency)?.wrapped?.address === native.wrapped.address) {
      return native as Currency
    }
    return token0 as Currency
  }, [token0, useNativeInstead, canUseNativeCurrency, native])

  const quoteCurrency = useMemo<Currency>(() => {
    if (useNativeInstead && canUseNativeCurrency && (token1 as Currency)?.wrapped?.address === native.wrapped.address) {
      return native as Currency
    }
    return token1 as Currency
  }, [token1, useNativeInstead, canUseNativeCurrency, native])

  const currency0 = baseCurrency
  const currency1 = quoteCurrency

  // Masterchef V3
  const masterchefV3 = useMasterchefV3()
  const positionManager = useV3NFTPositionManagerContract()

  const isMasterChefV3Available = useMemo(
    () => Boolean(masterchefV3?.address && masterchefV3?.address !== '0x'),
    [masterchefV3],
  )
  const { tokenIds: stakedTokenIds, loading: tokenIdsInMCv3Loading } = useV3TokenIdsByAccount(
    isMasterChefV3Available ? masterchefV3?.address : undefined,
    account,
  )

  const isStakedInMCv3 = useMemo(() => {
    if (!isMasterChefV3Available) {
      return 'false'
    }
    if (tokenIdsInMCv3Loading) {
      return 'loading'
    }
    return tokenId && stakedTokenIds.find((id) => id === BigInt(tokenId)) ? 'true' : 'false'
  }, [isMasterChefV3Available, tokenIdsInMCv3Loading, tokenId, stakedTokenIds])

  const manager =
    isStakedInMCv3 !== 'loading' ? (isStakedInMCv3 === 'true' ? masterchefV3 : positionManager) : undefined
  const interfaceManager =
    isStakedInMCv3 !== 'loading' ? (isStakedInMCv3 === 'true' ? MasterChefV3 : NonfungiblePositionManager) : undefined

  // Main Form
  const formState = useV3FormState()
  const { independentField, typedValue } = formState

  const {
    pool,
    dependentField,
    parsedAmounts,
    position,
    noLiquidity,
    hasInsufficentBalance,
    currencies,
    errorMessage,
    invalidRange,
    outOfRange,
    depositADisabled,
    depositBDisabled,
    ticksAtLimit,
    currencyBalances,
  } = useV3DerivedInfo(
    baseCurrency ?? undefined,
    quoteCurrency ?? undefined,
    feeAmount,
    baseCurrency ?? undefined,
    existingPosition,
    formState,
  )
  const { onFieldAInput, onFieldBInput } = useV3MintActionHandlers(noLiquidity)

  const formattedAmounts = useMemo(
    () => ({
      [independentField]: typedValue,
      [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? '',
    }),
    [parsedAmounts, typedValue, independentField, dependentField],
  )

  const maxAmounts: { [field in Field]?: CurrencyAmount<Currency> } = useMemo(
    () =>
      [Field.CURRENCY_A, Field.CURRENCY_B].reduce((accumulator, field) => {
        return {
          ...accumulator,
          [field]: maxAmountSpend(currencyBalances[field]),
        }
      }, {}),
    [currencyBalances],
  )

  const isUserInsufficientBalanceA = useMemo(() => {
    const parsed = parsedAmounts[Field.CURRENCY_A]
    const max = maxAmounts[Field.CURRENCY_A]
    if (!account || !parsed || !max) return false
    return max.lessThan(parsed)
  }, [account, parsedAmounts, maxAmounts])

  const isUserInsufficientBalanceB = useMemo(() => {
    const parsed = parsedAmounts[Field.CURRENCY_B]
    const max = maxAmounts[Field.CURRENCY_B]
    if (!account || !parsed || !max) return false
    return max.lessThan(parsed)
  }, [account, parsedAmounts, maxAmounts])

  // Price Display
  const [inverted, setInverted] = useState(false)

  const priceDisplay = useMemo(() => {
    return calculateTickBasedPriceRange(
      existingPositionDetail.tickLower,
      existingPositionDetail.tickUpper,
      poolInfo.token0,
      poolInfo.token1,
      pool || poolInfo,
      ticksAtLimit,
      inverted,
    )
  }, [existingPositionDetail, pool, poolInfo, ticksAtLimit, inverted])

  const toggleInverted = useCallback(() => {
    setInverted(!inverted)
  }, [inverted, setInverted])

  // Total USD Value
  const { data: currencyPrice0 } = useCurrencyUsdPrice(currency0, {
    enabled: !!currency0 && !!parsedAmounts[Field.CURRENCY_A],
  })
  const { data: currencyPrice1 } = useCurrencyUsdPrice(currency1, {
    enabled: !!currency1 && !!parsedAmounts[Field.CURRENCY_B],
  })
  const totalDepositUsdValue = useMemo(() => {
    if (!currencyPrice0 || !currencyPrice1) return 0

    const usd0 = BN(currencyPrice0).multipliedBy(parsedAmounts[Field.CURRENCY_A]?.toExact() || 0)
    const usd1 = BN(currencyPrice1).multipliedBy(parsedAmounts[Field.CURRENCY_B]?.toExact() || 0)

    return usd0.plus(usd1).toFormat(2)
  }, [currencyPrice0, currencyPrice1, parsedAmounts[Field.CURRENCY_A], parsedAmounts[Field.CURRENCY_B]])

  // Token Approvals
  const {
    approvalState: approvalA,
    approveCallback: approveACallback,
    revokeCallback: revokeACallback,
    currentAllowance: currentAllowanceA,
  } = useApproveCallback(parsedAmounts[Field.CURRENCY_A], manager?.address)
  const {
    approvalState: approvalB,
    approveCallback: approveBCallback,
    revokeCallback: revokeBCallback,
    currentAllowance: currentAllowanceB,
  } = useApproveCallback(parsedAmounts[Field.CURRENCY_B], manager?.address)

  // we need an existence check on parsed amounts for single-asset deposits
  const showApprovalA = approvalA !== ApprovalState.APPROVED && !!parsedAmounts[Field.CURRENCY_A]
  const showApprovalB = approvalB !== ApprovalState.APPROVED && !!parsedAmounts[Field.CURRENCY_B]

  // Validation
  const isValid = !errorMessage && !invalidRange && !tokenIdsInMCv3Loading
  const addIsWarning = useIsTransactionWarning(currencies?.CURRENCY_A, currencies?.CURRENCY_B)
  const addIsUnsupported = useIsTransactionUnsupported(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

  // Slippage
  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]

  const handleIncreaseLiquidity = useCallback(async () => {
    // Skip MasterChef V3 loading check if MasterChef V3 is not deployed on this chain
    const masterChefV3Address = masterchefV3?.address
    const isMasterChefV3Available = masterChefV3Address && masterChefV3Address !== '0x'

    if (
      (isMasterChefV3Available && tokenIdsInMCv3Loading) ||
      !chainId ||
      !sendTransactionAsync ||
      !account ||
      !interfaceManager ||
      !manager ||
      !positionManager ||
      !baseCurrency ||
      !quoteCurrency ||
      !deadline ||
      !position
    )
      return

    const useNative = baseCurrency.isNative ? baseCurrency : quoteCurrency.isNative ? quoteCurrency : undefined
    const { calldata, value } = tokenId
      ? interfaceManager.addCallParameters(position, {
          tokenId,
          slippageTolerance: basisPointsToPercent(allowedSlippage),
          deadline: deadline.toString(),
          useNative,
        })
      : interfaceManager.addCallParameters(position, {
          slippageTolerance: basisPointsToPercent(allowedSlippage),
          recipient: account,
          deadline: deadline.toString(),
          useNative,
          createPool: noLiquidity,
        })

    setAttemptingTxn(true)
    getViemClients({ chainId })
      ?.estimateGas({
        account,
        to: manager.address,
        data: calldata,
        value: hexToBigInt(value),
      })
      .then((gasLimit) => {
        return sendTransactionAsync({
          account,
          to: manager.address,
          data: calldata,
          value: hexToBigInt(value),
          gas: calculateGasMargin(gasLimit),
          chainId,
        })
      })
      .then((response) => {
        const baseAmount = formatRawAmount(
          parsedAmounts[Field.CURRENCY_A]?.quotient?.toString() ?? '0',
          baseCurrency.decimals,
          4,
        )
        const quoteAmount = formatRawAmount(
          parsedAmounts[Field.CURRENCY_B]?.quotient?.toString() ?? '0',
          quoteCurrency.decimals,
          4,
        )

        setAttemptingTxn(false)
        addTransaction(
          { hash: response },
          {
            type: 'increase-liquidity-v3',
            summary: `Increase ${baseAmount} ${baseCurrency?.symbol} and ${quoteAmount} ${quoteCurrency?.symbol}`,
          },
        )
        setTxHash(response)
      })
      .catch((err) => {
        // we only care if the error is something _other_ than the user rejected the tx
        if (!isUserRejected(err)) {
          setTxnErrorMessage(transactionErrorToUserReadableMessage(err, t))
        }
        setAttemptingTxn(false)
        console.error(err)
      })
  }, [
    account,
    addTransaction,
    allowedSlippage,
    baseCurrency,
    chainId,
    deadline,
    masterchefV3,
    interfaceManager,
    manager,
    noLiquidity,
    parsedAmounts,
    position,
    positionManager,
    quoteCurrency,
    sendTransactionAsync,
    tokenId,
    tokenIdsInMCv3Loading,
    t,
  ])

  // Zap Widget
  const hasZapV3Pool = useMemo(() => {
    if (pool) {
      const zapV3Whitelist = ZAP_V3_POOL_ADDRESSES[pool.chainId]
      if (zapV3Whitelist) {
        if (zapV3Whitelist.length === 0) return true
        return zapV3Whitelist.includes(Pool.getAddress(pool.token0, pool.token1, pool.fee))
      }
    }
    return false
  }, [pool])

  const handleOnZapSubmit = useCallback(() => {
    router.push(`/liquidity/${tokenId}`)
  }, [router, tokenId])

  return (
    <Box>
      <LightGreyCard borderRadius="24px" padding="16px">
        <PreTitle mb="8px">{t('Price Range (Min-Max)')}</PreTitle>
        {priceDisplay && (
          <Box px={outOfRange ? '16px' : '0'}>
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
              outOfRange={outOfRange}
              maxWidth="unset"
            />
          </Box>
        )}
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

      {canUseNativeCurrency && (
        <RowBetween mt="16px">
          <Text color="textSubtle" small>
            {t('Use %symbol% instead', { symbol: native.symbol })}
          </Text>
          <Toggle scale="sm" checked={useNativeInstead} onChange={handleToggleNative} />
        </RowBetween>
      )}

      <LightGreyCard mt="16px" borderRadius="24px" padding="16px">
        <LockedDeposit locked={depositADisabled}>
          <CurrencyInputPanelSimplify
            id="position-modal-v3-increase-A"
            defaultValue={formattedAmounts[Field.CURRENCY_A] ?? '0'}
            currency={currency0}
            onUserInput={onFieldAInput}
            maxAmount={maxAmounts[Field.CURRENCY_A]}
            onMax={() => onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')}
            onPercentInput={(percent) =>
              onFieldAInput(maxAmounts?.[Field.CURRENCY_A]?.multiply(new Percent(percent, 100))?.toExact() ?? '')
            }
            showUSDPrice
            showMaxButton
            disableCurrencySelect
            title={<>&nbsp;</>}
            wrapperProps={{ style: { backgroundColor: 'transparent' } }}
            disabled={depositADisabled}
            isUserInsufficientBalance={isUserInsufficientBalanceA}
          />
        </LockedDeposit>
        <br />

        <LockedDeposit locked={depositBDisabled}>
          <CurrencyInputPanelSimplify
            id="position-modal-v3-increase-B"
            defaultValue={formattedAmounts[Field.CURRENCY_B] ?? '0'}
            currency={currency1}
            onUserInput={onFieldBInput}
            maxAmount={maxAmounts[Field.CURRENCY_B]}
            onMax={() => onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')}
            onPercentInput={(percent) =>
              onFieldBInput(maxAmounts?.[Field.CURRENCY_B]?.multiply(new Percent(percent, 100))?.toExact() ?? '')
            }
            showUSDPrice
            showMaxButton
            disableCurrencySelect
            title={<>&nbsp;</>}
            wrapperProps={{ style: { backgroundColor: 'transparent' } }}
            disabled={depositBDisabled}
            isUserInsufficientBalance={isUserInsufficientBalanceB}
          />
        </LockedDeposit>
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
            addIsWarning={addIsWarning}
            addIsUnsupported={addIsUnsupported}
            account={account ?? undefined}
            approvalA={approvalA}
            approvalB={approvalB}
            isValid={isValid}
            showApprovalA={showApprovalA}
            approveACallback={approveACallback}
            currentAllowanceA={currentAllowanceA}
            revokeACallback={revokeACallback}
            currencies={currencies}
            approveBCallback={approveBCallback}
            currentAllowanceB={currentAllowanceB}
            revokeBCallback={revokeBCallback}
            showApprovalB={showApprovalB}
            parsedAmounts={parsedAmounts}
            onClick={handleIncreaseLiquidity}
            attemptingTxn={attemptingTxn}
            errorMessage={errorMessage}
            buttonText={t('Add')}
            depositADisabled={depositADisabled}
            depositBDisabled={depositBDisabled}
            isWrongNetwork={false}
          />
        )}
      </Box>
      {hasZapV3Pool && hasInsufficentBalance && (
        <Box mt="16px" mx="auto" maxWidth={['auto', 'auto', 'auto', '370px']}>
          <ZapLiquidityWidget
            tokenId={tokenId.toString()}
            pool={pool}
            baseCurrency={baseCurrency}
            baseCurrencyAmount={formattedAmounts[Field.CURRENCY_A]}
            quoteCurrency={quoteCurrency}
            quoteCurrencyAmount={formattedAmounts[Field.CURRENCY_B]}
            onSubmit={handleOnZapSubmit}
          />
        </Box>
      )}
    </Box>
  )
}
