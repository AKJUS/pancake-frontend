import { useTranslation } from '@pancakeswap/localization'
import { Currency, Percent } from '@pancakeswap/swap-sdk-core'
import {
  Box,
  Button,
  Flex,
  LinkExternal,
  Message,
  MessageText,
  PreTitle,
  RowBetween,
  ScanLink,
  Text,
  Toggle,
} from '@pancakeswap/uikit'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import { getV2StablePositionCurrencyOverrides } from 'components/PositionModals/shared/v2StablePositionCurrencyOverrides'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import AddLiquidity, { LP2ChildrenProps } from 'views/AddLiquidity'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { CurrencyField as Field } from 'utils/types'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useCallback, useMemo, useState, type ChangeEvent } from 'react'
import { CommitButton } from 'components/CommitButton'
import { useExpertMode } from '@pancakeswap/utils/user'
import { logGTMClickAddLiquidityEvent } from 'utils/customGTMEventTracking'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { BigNumber as BN } from 'bignumber.js'
import ApproveLiquidityTokens from 'views/AddLiquidityV3/components/ApproveLiquidityTokens'
import { ChainLinkSupportChains } from 'state/info/constant'
import { getBlockExploreLink } from 'utils'
import { Pair } from '@pancakeswap/sdk'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import useNativeCurrency from 'hooks/useNativeCurrency'

interface V2PositionAddProps {
  position: V2LPDetail
  poolInfo: PoolInfo
}
export const V2PositionAdd = ({ position, poolInfo }: V2PositionAddProps) => {
  const { t } = useTranslation()

  // Currencies
  const { token0, token1 } = poolInfo
  const { chainId } = poolInfo

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

  const currency0 = useMemo<Currency>(() => {
    if (useNativeInstead && canUseNativeCurrency && (token0 as Currency)?.wrapped?.address === native.wrapped.address) {
      return native as Currency
    }
    return token0 as Currency
  }, [token0, useNativeInstead, canUseNativeCurrency, native])

  const currency1 = useMemo<Currency>(() => {
    if (useNativeInstead && canUseNativeCurrency && (token1 as Currency)?.wrapped?.address === native.wrapped.address) {
      return native as Currency
    }
    return token1 as Currency
  }, [token1, useNativeInstead, canUseNativeCurrency, native])

  return (
    <Box>
      <PreTitle>{t('Amount of Liquidity to Add')}</PreTitle>
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

      <AddLiquidity currencyA={currency0} currencyB={currency1}>
        {(props) => <V2PositionAddInner {...props} position={position} />}
      </AddLiquidity>
    </Box>
  )
}

const V2PositionAddInner = ({
  position,
  formattedAmounts,
  addIsUnsupported,
  shouldShowApprovalGroup,
  approveACallback,
  revokeACallback,
  currentAllowanceA,
  approvalA,
  approvalB,
  approveBCallback,
  revokeBCallback,
  currentAllowanceB,
  showFieldBApproval,
  showFieldAApproval,
  currencies,
  buttonDisabled,
  onAdd,
  onPresentAddLiquidityModal,
  errorText,
  onFieldAInput,
  onFieldBInput,
  maxAmounts,
  isOneWeiAttack,
  pair,
}: LP2ChildrenProps & { position: V2LPDetail }) => {
  const { t } = useTranslation()

  // Pool
  const chainId = pair?.chainId ?? currencies[Field.CURRENCY_A]?.chainId
  const pairExplorerLink = useMemo(
    () => (pair && getBlockExploreLink(Pair.getAddress(pair.token0, pair.token1), 'address', chainId)) || undefined,
    [pair, chainId],
  )

  // User
  const { chainId: activeChainId, account } = useAccountActiveChain()
  const isWrongNetwork = activeChainId !== chainId
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()

  const [expertMode] = useExpertMode()

  // Currencies
  const currency0 = currencies[Field.CURRENCY_A]
  const currency1 = currencies[Field.CURRENCY_B]

  // Amounts
  const amount0 = formattedAmounts[Field.CURRENCY_A]
  const amount1 = formattedAmounts[Field.CURRENCY_B]

  // Total USD Value
  const { data: currencyPrice0 } = useCurrencyUsdPrice(currency0, {
    enabled: !!currency0,
  })
  const { data: currencyPrice1 } = useCurrencyUsdPrice(currency1, {
    enabled: !!currency1,
  })
  const totalDepositUsdValue = useMemo(() => {
    if (!currencyPrice0 || !currencyPrice1) return null

    const usd0 = BN(currencyPrice0).multipliedBy(amount0 || 0)
    const usd1 = BN(currencyPrice1).multipliedBy(amount1 || 0)

    return usd0.plus(usd1)
  }, [currencyPrice0, currencyPrice1, amount0, amount1])

  // Position Breakdown — current (from LP token share) vs. new after deposit
  const { override0: positionBalance0, override1: positionBalance1 } = useMemo(
    () =>
      currency0 && currency1
        ? getV2StablePositionCurrencyOverrides(position, currency0, currency1)
        : { override0: undefined, override1: undefined },
    [position, currency0, currency1],
  )

  const currency0Amount = positionBalance0?.toSignificant(6) ?? '0'
  const currency1Amount = positionBalance1?.toSignificant(6) ?? '0'

  const parsedAddAmount0 = useMemo(
    () => (currency0 && amount0 ? tryParseAmount(amount0, currency0) : undefined),
    [currency0, amount0],
  )
  const parsedAddAmount1 = useMemo(
    () => (currency1 && amount1 ? tryParseAmount(amount1, currency1) : undefined),
    [currency1, amount1],
  )

  const currency0NewAmount = useMemo(() => {
    if (!positionBalance0) return parsedAddAmount0?.toSignificant(6) ?? '0'
    if (!parsedAddAmount0) return currency0Amount
    return positionBalance0.wrapped.add(parsedAddAmount0.wrapped).toSignificant(6)
  }, [positionBalance0, parsedAddAmount0, currency0Amount])

  const currency1NewAmount = useMemo(() => {
    if (!positionBalance1) return parsedAddAmount1?.toSignificant(6) ?? '0'
    if (!parsedAddAmount1) return currency1Amount
    return positionBalance1.wrapped.add(parsedAddAmount1.wrapped).toSignificant(6)
  }, [positionBalance1, parsedAddAmount1, currency1Amount])

  const totalPositionUsdValue = useMemo(() => {
    if (!positionBalance0 || !positionBalance1 || !currencyPrice0 || !currencyPrice1) return null
    const usd0 = BN(currencyPrice0).multipliedBy(positionBalance0.toExact())
    const usd1 = BN(currencyPrice1).multipliedBy(positionBalance1.toExact())
    return usd0.plus(usd1)
  }, [positionBalance0, positionBalance1, currencyPrice0, currencyPrice1])

  const totalPositionUsd = useMemo(() => {
    if (!totalPositionUsdValue) return '$0'
    return `$${totalPositionUsdValue.toFormat(2)}`
  }, [totalPositionUsdValue])

  const totalPositionNewUsd = useMemo(() => {
    if (!totalPositionUsdValue) return '$0'
    if (!totalDepositUsdValue) return totalPositionUsd
    return `$${totalPositionUsdValue.plus(totalDepositUsdValue).toFormat(2)}`
  }, [totalPositionUsdValue, totalDepositUsdValue, totalPositionUsd])

  const hasAddAmount = Boolean(parsedAddAmount0?.greaterThan(0) || parsedAddAmount1?.greaterThan(0))

  const isUserInsufficientBalanceA = useMemo(() => {
    const max = maxAmounts[Field.CURRENCY_A]
    const raw = formattedAmounts[Field.CURRENCY_A]
    if (!account || !currency0 || !max || !raw) return false
    const parsed = tryParseAmount(raw, currency0)
    return Boolean(parsed && max.lessThan(parsed))
  }, [account, currency0, maxAmounts, formattedAmounts])

  const isUserInsufficientBalanceB = useMemo(() => {
    const max = maxAmounts[Field.CURRENCY_B]
    const raw = formattedAmounts[Field.CURRENCY_B]
    if (!account || !currency1 || !max || !raw) return false
    const parsed = tryParseAmount(raw, currency1)
    return Boolean(parsed && max.lessThan(parsed))
  }, [account, currency1, maxAmounts, formattedAmounts])

  const renderButtons = useCallback(() => {
    if (isWrongNetwork)
      return (
        <Button
          width="100%"
          onClick={() => (chainId ? switchNetworkIfNecessary(chainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      )
    if (addIsUnsupported) return <Button disabled>{t('Unsupported Asset')}</Button>
    return (
      <>
        <Box mb={shouldShowApprovalGroup ? '8px' : null}>
          <ApproveLiquidityTokens
            approvalA={approvalA}
            approvalB={approvalB}
            showFieldAApproval={showFieldAApproval}
            showFieldBApproval={showFieldBApproval}
            approveACallback={approveACallback}
            approveBCallback={approveBCallback}
            revokeACallback={revokeACallback}
            revokeBCallback={revokeBCallback}
            currencies={currencies}
            currentAllowanceA={currentAllowanceA}
            currentAllowanceB={currentAllowanceB}
            shouldShowApprovalGroup={shouldShowApprovalGroup}
          />
        </Box>

        {isOneWeiAttack ? (
          <Message variant="warning" mb="8px">
            <Flex flexDirection="column">
              <MessageText>
                {t(
                  'Adding liquidity to this V2 pair is currently not available on PancakeSwap UI. Please follow the instructions to resolve it using blockchain explorer.',
                )}
              </MessageText>
              <LinkExternal
                href="https://docs.pancakeswap.finance/products/pancakeswap-exchange/faq#why-cant-i-add-liquidity-to-a-pair-i-just-created"
                mt="0.25rem"
              >
                {t('Learn more how to fix')}
              </LinkExternal>
              <ScanLink
                useBscCoinFallback={chainId ? ChainLinkSupportChains.includes(chainId) : undefined}
                href={pairExplorerLink}
                mt="0.25rem"
              >
                {t('View pool on explorer')}
              </ScanLink>
            </Flex>
          </Message>
        ) : null}
        <CommitButton
          variant={buttonDisabled ? 'danger' : 'primary'}
          onClick={() => {
            // eslint-disable-next-line no-unused-expressions
            expertMode ? onAdd() : onPresentAddLiquidityModal()
            logGTMClickAddLiquidityEvent()
          }}
          disabled={buttonDisabled}
          width="100%"
        >
          {errorText || t('Add')}
        </CommitButton>
      </>
    )
  }, [
    isWrongNetwork,
    addIsUnsupported,
    shouldShowApprovalGroup,
    approvalA,
    approvalB,
    showFieldAApproval,
    showFieldBApproval,
    approveACallback,
    approveBCallback,
    revokeACallback,
    revokeBCallback,
    currencies,
    currentAllowanceA,
    currentAllowanceB,
    isOneWeiAttack,
    pairExplorerLink,
    expertMode,
    onAdd,
    onPresentAddLiquidityModal,
    formattedAmounts,
    buttonDisabled,
    errorText,
    chainId,
    activeChainId,
    switchNetworkIfNecessary,
    isSwitchNetworkLoading,
    t,
  ])

  return (
    <>
      <LightGreyCard mt="16px" borderRadius="24px" padding="16px">
        <CurrencyInputPanelSimplify
          id="position-modal-increase-v2-A"
          defaultValue={formattedAmounts[Field.CURRENCY_A]}
          currency={currencies[Field.CURRENCY_A]}
          onUserInput={onFieldAInput}
          title={<>&nbsp;</>}
          wrapperProps={{ style: { backgroundColor: 'transparent' } }}
          onPercentInput={(percent) => {
            if (maxAmounts[Field.CURRENCY_A]) {
              onFieldAInput(maxAmounts[Field.CURRENCY_A]?.multiply(new Percent(percent, 100)).toExact() ?? '')
            }
          }}
          onMax={() => {
            onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
          }}
          maxAmount={maxAmounts[Field.CURRENCY_A]}
          showMaxButton
          disableCurrencySelect
          showUSDPrice
          isUserInsufficientBalance={isUserInsufficientBalanceA}
        />
        <Box mt="8px">
          <CurrencyInputPanelSimplify
            id="position-modal-increase-v2-B"
            defaultValue={formattedAmounts[Field.CURRENCY_B]}
            currency={currencies[Field.CURRENCY_B]}
            onUserInput={onFieldBInput}
            title={<>&nbsp;</>}
            wrapperProps={{ style: { backgroundColor: 'transparent' } }}
            onPercentInput={(percent) => {
              if (maxAmounts[Field.CURRENCY_B]) {
                onFieldBInput(maxAmounts[Field.CURRENCY_B]?.multiply(new Percent(percent, 100)).toExact() ?? '')
              }
            }}
            onMax={() => {
              onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
            }}
            maxAmount={maxAmounts[Field.CURRENCY_B]}
            showMaxButton
            disableCurrencySelect
            showUSDPrice
            isUserInsufficientBalance={isUserInsufficientBalanceB}
          />
        </Box>
      </LightGreyCard>

      {currency0 && currency1 && hasAddAmount && (
        <BalanceDifferenceDisplay
          currency0={currency0}
          currency1={currency1}
          currency0Amount={currency0Amount}
          currency0NewAmount={currency0NewAmount}
          currency1Amount={currency1Amount}
          currency1NewAmount={currency1NewAmount}
          totalPositionUsd={totalPositionUsd}
          totalPositionNewUsd={totalPositionNewUsd}
          amountUsd={`$${totalDepositUsdValue?.toFormat(2) ?? 0}`}
          amountUsdLabel={t('Total deposit value (USD)')}
        />
      )}

      <Box mt="16px">
        <MevProtectToggle size="sm" />
      </Box>

      <Box mt="16px">{renderButtons()}</Box>
    </>
  )
}
