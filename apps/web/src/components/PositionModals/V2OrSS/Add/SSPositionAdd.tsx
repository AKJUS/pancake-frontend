import { useTranslation } from '@pancakeswap/localization'
import { Currency, Percent } from '@pancakeswap/swap-sdk-core'
import {
  Box,
  Button,
  Dots,
  Flex,
  FlexGap,
  LinkExternal,
  Message,
  MessageText,
  PreTitle,
  QuestionHelper,
  RowBetween,
  ScanLink,
  Text,
  Toggle,
} from '@pancakeswap/uikit'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import { getV2StablePositionCurrencyOverrides } from 'components/PositionModals/shared/v2StablePositionCurrencyOverrides'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { StableLPDetail } from 'state/farmsV4/state/accountPositions/type'
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
import { ChainId, Pair } from '@pancakeswap/sdk'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import useStableConfig, { StableConfigContext } from 'views/Swap/hooks/useStableConfig'
import AddStableLiquidity, { AddStableChildrenProps } from 'views/AddLiquidity/AddStableLiquidity'
import StableFormView from 'views/AddLiquidityV3/formViews/StableFormView'
import { ApprovalState } from 'hooks/useApproveCallback'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { FormattedSlippage } from 'views/AddLiquidity/AddStableLiquidity/components'
import { useCheckAndSwitchChain } from 'hooks/useCheckAndSwitchChain'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useIsTransactionUnsupported, useIsTransactionWarning } from 'hooks/Trades'

interface SSPositionAddProps {
  position: StableLPDetail
  poolInfo: PoolInfo
}
export const SSPositionAdd = ({ position, poolInfo }: SSPositionAddProps) => {
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

  // Stable config
  const stableConfig = useStableConfig({
    tokenA: currency0,
    tokenB: currency1,
  })

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

      <StableConfigContext.Provider value={stableConfig}>
        <AddStableLiquidity currencyA={currency0} currencyB={currency1}>
          {(props) => <SSPositionAddInner {...props} position={position} />}
        </AddStableLiquidity>
      </StableConfigContext.Provider>
    </Box>
  )
}

const SSPositionAddInner = ({
  position,
  formattedAmounts,
  shouldShowApprovalGroup,
  approveACallback,
  approvalA,
  approvalB,
  approveBCallback,
  showFieldBApproval,
  showFieldAApproval,
  currencies,
  buttonDisabled,
  onAdd,
  onPresentAddLiquidityModal,
  errorText,
  onFieldAInput,
  onFieldBInput,
  // poolTokenPercentage,
  executionSlippage,
  loading,
  maxAmounts,
  inputAmountsTotalUsdValue,
}: AddStableChildrenProps & { position: StableLPDetail }) => {
  const { t } = useTranslation()

  // Currencies
  const currency0 = currencies[Field.CURRENCY_A]
  const currency1 = currencies[Field.CURRENCY_B]

  // Pool
  const chainId = currency0?.chainId
  const addIsUnsupported = useIsTransactionUnsupported(currency0, currency1)
  const addIsWarning = useIsTransactionWarning(currency0, currency1)

  // User
  const { chainId: activeChainId, account } = useAccountActiveChain()
  const isWrongNetwork = activeChainId !== chainId
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()

  const [expertMode] = useExpertMode()

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

  // Position Breakdown — current (from LP share) vs. new after deposit
  const { data: currencyPrice0 } = useCurrencyUsdPrice(currency0)
  const { data: currencyPrice1 } = useCurrencyUsdPrice(currency1)

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
    () =>
      currency0 && formattedAmounts[Field.CURRENCY_A]
        ? tryParseAmount(formattedAmounts[Field.CURRENCY_A], currency0)
        : undefined,
    [currency0, formattedAmounts],
  )
  const parsedAddAmount1 = useMemo(
    () =>
      currency1 && formattedAmounts[Field.CURRENCY_B]
        ? tryParseAmount(formattedAmounts[Field.CURRENCY_B], currency1)
        : undefined,
    [currency1, formattedAmounts],
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
    if (!inputAmountsTotalUsdValue) return totalPositionUsd
    return `$${totalPositionUsdValue.plus(inputAmountsTotalUsdValue).toFormat(2)}`
  }, [totalPositionUsdValue, inputAmountsTotalUsdValue, totalPositionUsd])

  const hasAddAmount = Boolean(parsedAddAmount0?.greaterThan(0) || parsedAddAmount1?.greaterThan(0))

  // Buttons
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
    if (addIsUnsupported || addIsWarning) return <Button disabled>{t('Unsupported Asset')}</Button>
    return (
      <>
        {shouldShowApprovalGroup && (
          <RowBetween style={{ gap: '8px' }} mb="8px">
            {showFieldAApproval && (
              <Button onClick={approveACallback} disabled={approvalA === ApprovalState.PENDING} width="100%">
                {approvalA === ApprovalState.PENDING ? (
                  <Dots>{t('Enabling %asset%', { asset: currencies[Field.CURRENCY_A]?.symbol })}</Dots>
                ) : (
                  t('Enable %asset%', { asset: currencies[Field.CURRENCY_A]?.symbol })
                )}
              </Button>
            )}
            {showFieldBApproval && (
              <Button onClick={approveBCallback} disabled={approvalB === ApprovalState.PENDING} width="100%">
                {approvalB === ApprovalState.PENDING ? (
                  <Dots>{t('Enabling %asset%', { asset: currencies[Field.CURRENCY_B]?.symbol })}</Dots>
                ) : (
                  t('Enable %asset%', { asset: currencies[Field.CURRENCY_B]?.symbol })
                )}
              </Button>
            )}
          </RowBetween>
        )}

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
    addIsWarning,
    shouldShowApprovalGroup,
    showFieldAApproval,
    showFieldBApproval,
    approveACallback,
    approveBCallback,
    approvalA,
    approvalB,
    currencies,
    expertMode,
    onAdd,
    onPresentAddLiquidityModal,
    formattedAmounts,
    buttonDisabled,
    errorText,
    chainId,
    activeChainId,
    isSwitchNetworkLoading,
    switchNetworkIfNecessary,
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

      <RowBetween mt="16px">
        <FlexGap gap="4px" alignItems="center">
          <Text color="textSubtle" small>
            {t('Slippage')}
          </Text>
          <QuestionHelper
            text={t(
              'Based on % contributed to stable pair, fees will vary. Deposits with fees >= 0.15% will be rejected',
            )}
            placement="top-start"
            mt="1px"
          />
        </FlexGap>
        <FormattedSlippage slippage={executionSlippage} loading={loading} small />
      </RowBetween>

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
          amountUsd={formatDollarAmount(inputAmountsTotalUsdValue, 2, false)}
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
