import { BinPool } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { AddIcon, AtomBoxProps, AutoColumn, Text, usePrompt } from '@pancakeswap/uikit'
import BigNumber from 'bignumber.js'
import PageLoader from 'components/Loader/PageLoader'
import { useIsTransactionUnsupported, useIsTransactionWarning } from 'hooks/Trades'
import { useInfinityPoolIdRouteParams } from 'hooks/dynamicRoute/usePoolIdRoute'
import { usePoolCurrentPrice } from 'hooks/infinity/usePoolCurrentPrice'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { usePermit2 } from 'hooks/usePermit2'
import { usePoolMarketPriceSlippage } from 'hooks/usePoolMarketPriceSlippage'
import { useCallback, useMemo } from 'react'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { useInverted } from 'state/infinity/shared'
import { useCurrencyBalances } from 'state/wallet/hooks'
import { getInfinityPositionManagerAddress } from 'utils/addressHelpers'
import { CurrencyField } from 'utils/types'
import { V3SubmitButton } from 'views/AddLiquidityV3/components/V3SubmitButton'
import {
  InvalidBinRangeMessage,
  InvalidCLRangeMessage,
  LowTVLMessage,
  MarketPriceSlippageWarning,
  OutOfRangeMessage,
} from 'views/CreateLiquidityPool/components/SubmitCreateButton'
import { useAccount } from 'wagmi'
import { useAddDepositAmounts, useAddDepositAmountsEnabled } from '../hooks/useAddDepositAmounts'
import { useAddFormSubmitCallback } from '../hooks/useAddFormSubmitCallback'
import { useAddFormSubmitEnabled } from '../hooks/useAddFormSubmitEnabled'
import { useBinIdRange } from '../hooks/useBinIdRange'
import { usePool } from '../hooks/usePool'

export const SubmitButton = (props: AtomBoxProps) => {
  const { t } = useTranslation()
  const { isWrongNetwork } = useActiveChainId()
  const { address: account } = useAccount()

  const { chainId, poolId } = useInfinityPoolIdRouteParams()
  const [inverted] = useInverted()
  const pool = usePool()
  const poolInfo = usePoolInfo({ poolAddress: poolId, chainId })

  const [currencyA, currencyB] = useMemo(() => {
    return [pool?.token0, pool?.token1]
  }, [pool])

  const currencies = useMemo(() => ({ CURRENCY_A: currencyA, CURRENCY_B: currencyB }), [currencyA, currencyB])
  const poolCurrentPrice = usePoolCurrentPrice(pool)
  const [, marketPriceSlippage] = usePoolMarketPriceSlippage(pool?.token0, pool?.token1, poolCurrentPrice)
  const displayMarketPriceSlippageWarning = useMemo(() => {
    if (marketPriceSlippage === undefined) return false
    const slippage = new BigNumber(marketPriceSlippage.toFixed(0)).abs()
    return slippage.gt(5) // 5% slippage
  }, [marketPriceSlippage])
  const addIsUnsupported = useIsTransactionUnsupported(currencyA, currencyB)
  const addIsWarning = useIsTransactionWarning(currencyA, currencyB)

  const { onSubmit, attemptingTx } = useAddFormSubmitCallback()
  const prompt = usePrompt()
  const handleSubmit = useCallback(async () => {
    if (displayMarketPriceSlippageWarning) {
      const confirmWord = 'confirm'
      let resolve: (value: boolean) => void
      const p = new Promise<boolean>((res) => {
        resolve = res
      })

      prompt({
        message: (
          <>
            <AutoColumn gap="8px">
              <Text>
                {t(
                  'The pool price shows a significant deviation from current market rates (%slippage%). This increases the risk of losses from arbitrage.',
                  {
                    slippage: `${marketPriceSlippage?.toFixed(0)}%`,
                  },
                )}
              </Text>
              <Text>{t('To proceed, please type the word "%word%"', { word: confirmWord })}</Text>
            </AutoColumn>
          </>
        ),
        onConfirm: (value: string) => {
          return resolve(value === confirmWord)
        },
      })
      await p.then(async (confirmed) => {
        if (!confirmed) {
          return
        }

        await onSubmit()
      })
    } else {
      await onSubmit()
    }
    // router.push('/liquidity/pools')
  }, [onSubmit, displayMarketPriceSlippageWarning, marketPriceSlippage, prompt, t])

  const { depositCurrencyAmount0, depositCurrencyAmount1 } = useAddDepositAmounts()
  const parsedAmounts = useMemo(
    () => ({
      [CurrencyField.CURRENCY_A]: depositCurrencyAmount0 ?? undefined,
      [CurrencyField.CURRENCY_B]: depositCurrencyAmount1 ?? undefined,
    }),
    [depositCurrencyAmount0, depositCurrencyAmount1],
  )
  const [currency0Balance, currency1Balance] = useCurrencyBalances(
    account ?? undefined,
    useMemo(() => [currencyA, currencyB], [currencyA, currencyB]),
  )

  const {
    approve: approveACallback,
    revoke: revokeACallback,

    isApproving: isApprovingA,

    requireApprove: requireApproveA,
    requireRevoke: requireRevokeA,
  } = usePermit2(
    currencyA?.isNative ? undefined : depositCurrencyAmount0?.wrapped,
    pool?.poolType ? getInfinityPositionManagerAddress(pool.poolType, chainId) : undefined,
    {
      overrideChainId: chainId,
    },
  )

  const {
    approve: approveBCallback,
    revoke: revokeBCallback,

    isApproving: isApprovingB,

    requireApprove: requireApproveB,
    requireRevoke: requireRevokeB,
  } = usePermit2(
    currencyB?.isNative ? undefined : depositCurrencyAmount1?.wrapped,
    pool?.poolType ? getInfinityPositionManagerAddress(pool.poolType, chainId) : undefined,
    {
      overrideChainId: chainId,
    },
  )
  const { isDeposit0Enabled, isDeposit1Enabled } = useAddDepositAmountsEnabled()

  // we need an existence check on parsed amounts for single-asset deposits
  const showApprovalA = useMemo(
    () =>
      Boolean(currencyA?.isToken) &&
      (requireApproveA || requireRevokeA) &&
      Boolean(depositCurrencyAmount0) &&
      isDeposit0Enabled,
    [currencyA?.isToken, requireApproveA, requireRevokeA, depositCurrencyAmount0, isDeposit0Enabled],
  )
  const showApprovalB = useMemo(
    () =>
      Boolean(currencyB?.isToken) &&
      (requireApproveB || requireRevokeB) &&
      Boolean(depositCurrencyAmount1) &&
      isDeposit1Enabled,
    [currencyB?.isToken, requireApproveB, requireRevokeB, depositCurrencyAmount1, isDeposit1Enabled],
  )

  const { currentAllowance: currentAllowanceA } = useApproveCallback(
    currencyA?.isNative ? undefined : depositCurrencyAmount0?.wrapped,
    pool?.poolType ? getInfinityPositionManagerAddress(pool.poolType, chainId) : undefined,
  )

  const { currentAllowance: currentAllowanceB } = useApproveCallback(
    currencyB?.isNative ? undefined : depositCurrencyAmount1?.wrapped,
    pool?.poolType ? getInfinityPositionManagerAddress(pool.poolType, chainId) : undefined,
  )

  const approvalA = useMemo(() => {
    if (showApprovalA) {
      if (isApprovingA) return ApprovalState.PENDING
      if (requireRevokeA || requireApproveA) return ApprovalState.NOT_APPROVED
      return ApprovalState.APPROVED
    }
    return ApprovalState.APPROVED
  }, [isApprovingA, requireApproveA, requireRevokeA, showApprovalA])

  const approvalB = useMemo(() => {
    if (showApprovalB) {
      if (isApprovingB) return ApprovalState.PENDING
      if (requireRevokeB || requireApproveB) return ApprovalState.NOT_APPROVED
      return ApprovalState.APPROVED
    }
    return ApprovalState.APPROVED
  }, [isApprovingB, requireApproveB, requireRevokeB, showApprovalB])

  const { errorMessage, enabled, outOfRange, invalidClRange, invalidBinRange } = useAddFormSubmitEnabled()
  const { minBinId, maxBinId } = useBinIdRange()

  const [buttonText, buttonIcon] = useMemo(() => {
    if ((isDeposit0Enabled && !depositCurrencyAmount0) || (isDeposit1Enabled && !depositCurrencyAmount1)) {
      return [t('Enter an amount'), undefined]
    }

    if (isDeposit0Enabled && depositCurrencyAmount0 && currency0Balance?.lessThan(depositCurrencyAmount0)) {
      return [t('Insufficient %symbol% balance', { symbol: currencyA?.symbol ?? 'Unknown' }), undefined]
    }

    if (isDeposit1Enabled && depositCurrencyAmount1 && currency1Balance?.lessThan(depositCurrencyAmount1)) {
      return [t('Insufficient %symbol% balance', { symbol: currencyB?.symbol ?? 'Unknown' }), undefined]
    }

    return [t('Add'), <AddIcon key="add-icon" color={!enabled ? 'textDisabled' : 'invertedContrast'} width="24px" />]
  }, [
    currency0Balance,
    currency1Balance,
    currencyA?.symbol,
    currencyB?.symbol,
    depositCurrencyAmount0,
    depositCurrencyAmount1,
    enabled,
    isDeposit0Enabled,
    isDeposit1Enabled,
    t,
  ])

  if (!pool) {
    return <PageLoader />
  }

  return (
    <AutoColumn gap="8px" {...props}>
      {displayMarketPriceSlippageWarning ? (
        <MarketPriceSlippageWarning slippage={`${marketPriceSlippage?.toFixed(0)} %`} />
      ) : null}
      {Number(poolInfo?.tvlUsd) < 1000 ? <LowTVLMessage /> : null}
      {outOfRange && <OutOfRangeMessage />}
      {invalidClRange && <InvalidCLRangeMessage />}
      {invalidBinRange && (
        <InvalidBinRangeMessage
          inverted={inverted}
          baseCurrency={currencyA}
          quoteCurrency={currencyB}
          minBinId={minBinId}
          maxBinId={maxBinId}
          binStep={(pool as BinPool)?.binStep}
        />
      )}
      <V3SubmitButton
        addIsUnsupported={addIsUnsupported}
        addIsWarning={addIsWarning}
        account={account ?? undefined}
        isWrongNetwork={Boolean(isWrongNetwork)}
        showApprovalA={showApprovalA}
        approveACallback={approveACallback}
        currentAllowanceA={currentAllowanceA}
        revokeACallback={revokeACallback}
        currencies={currencies}
        showApprovalB={showApprovalB}
        approveBCallback={approveBCallback}
        currentAllowanceB={currentAllowanceB}
        revokeBCallback={revokeBCallback}
        parsedAmounts={parsedAmounts}
        onClick={handleSubmit}
        attemptingTxn={attemptingTx}
        buttonText={buttonText}
        endIcon={buttonIcon}
        errorMessage={errorMessage}
        isValid={enabled}
        depositADisabled={!depositCurrencyAmount0 || depositCurrencyAmount0.equalTo(0)}
        depositBDisabled={!depositCurrencyAmount1 || depositCurrencyAmount1.equalTo(0)}
        approvalA={approvalA}
        approvalB={approvalB}
      />
    </AutoColumn>
  )
}
