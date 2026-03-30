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
export const V2PositionAdd = ({ poolInfo }: V2PositionAddProps) => {
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
        {(props) => <V2PositionAddInner {...props} />}
      </AddLiquidity>
    </Box>
  )
}

const V2PositionAddInner = ({
  formattedAmounts,
  addIsUnsupported,
  addIsWarning,
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
}: LP2ChildrenProps) => {
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
    enabled: !!currency0 && !!amount0,
  })
  const { data: currencyPrice1 } = useCurrencyUsdPrice(currency1, {
    enabled: !!currency1 && !!amount1,
  })
  const totalDepositUsdValue = useMemo(() => {
    if (!currencyPrice0 || !currencyPrice1) return 0

    const usd0 = BN(currencyPrice0).multipliedBy(amount0 || 0)
    const usd1 = BN(currencyPrice1).multipliedBy(amount1 || 0)

    return usd0.plus(usd1).toFormat(2)
  }, [currencyPrice0, currencyPrice1, amount0, amount1])

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
    if (addIsUnsupported || addIsWarning) return <Button disabled>{t('Unsupported Asset')}</Button>
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
    addIsWarning,
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
        <br />
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

      <Box mt="16px">{renderButtons()}</Box>
    </>
  )
}
