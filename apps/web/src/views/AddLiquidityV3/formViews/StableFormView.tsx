import {
  AutoColumn,
  Box,
  Card,
  CardBody,
  Column,
  FlexGap,
  PreTitle,
  QuestionHelper,
  RowBetween,
  Text,
} from '@pancakeswap/uikit'

import { useTranslation } from '@pancakeswap/localization'
import { useIsExpertMode } from '@pancakeswap/utils/user'
import { Percent } from '@pancakeswap/sdk'

import { useIsTransactionUnsupported, useIsTransactionWarning } from 'hooks/Trades'
import { AddStableChildrenProps } from 'views/AddLiquidity/AddStableLiquidity'
import { CurrencyField as Field } from 'utils/types'

import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { DepositAmountPanel } from 'components/Liquidity/DepositAmountPanel'
import { V2EstimatedFeesPanel } from 'components/Liquidity/V2EstimatedFeesPanel'
import { useUsdDepositAmount } from 'hooks/useUsdDepositAmount'
import { usePoolInfo } from 'state/farmsV4/hooks'
import type { StablePoolInfo } from 'state/farmsV4/state/type'
import { useContext } from 'react'
import { StableConfigContext } from 'views/Swap/hooks/useStableConfig'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { FormattedSlippage } from 'views/AddLiquidity/AddStableLiquidity/components'
import { StableFormButtons } from './components/StableFormButtons'

export default function StableFormView({
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
  poolTokenPercentage,
  executionSlippage,
  loading,
  maxAmounts,
  inputAmountsTotalUsdValue,
}: AddStableChildrenProps & {
  stableTotalFee?: number
}) {
  const { t } = useTranslation()
  const { account, isWrongNetwork } = useAccountActiveChain()

  const addIsUnsupported = useIsTransactionUnsupported(currencies?.CURRENCY_A, currencies?.CURRENCY_B)
  const addIsWarning = useIsTransactionWarning(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

  const expertMode = useIsExpertMode()

  const usdDeposit = useUsdDepositAmount({
    baseCurrency: currencies[Field.CURRENCY_A],
    quoteCurrency: currencies[Field.CURRENCY_B],
    baseInputValue: formattedAmounts[Field.CURRENCY_A] ?? '',
    quoteInputValue: formattedAmounts[Field.CURRENCY_B] ?? '',
    onBaseInput: onFieldAInput,
    onQuoteInput: onFieldBInput,
    baseTokenRatio: 0.5,
    independentQuote: true,
  })

  // Pool info for Estimated Fees panel. AddEVMLiquidityV3Layout uses stableSwapAddress for its
  // own usePoolInfo call — use the same so we hit the same cache entry (no extra fetch, and no
  // fallback to queryV3PoolInfoOnChain which would revert for a stable swap address).
  const { stableSwapConfig } = useContext(StableConfigContext) || {}
  const stablePoolInfo = usePoolInfo<StablePoolInfo>({
    poolAddress: stableSwapConfig?.stableSwapAddress,
    chainId: stableSwapConfig?.liquidityToken?.chainId,
  })

  return (
    <Box mx="auto" pb="16px" width="100%" maxWidth={[null, null, null, null, '480px']}>
      <Column gap="16px">
        <V2EstimatedFeesPanel poolInfo={stablePoolInfo} totalUsdValue={usdDeposit.totalUsdValue} />
        <Card>
          <CardBody>
            <AutoColumn>
              <DepositAmountPanel
                baseCurrency={currencies[Field.CURRENCY_A]}
                quoteCurrency={currencies[Field.CURRENCY_B]}
                baseInputValue={formattedAmounts[Field.CURRENCY_A] ?? ''}
                quoteInputValue={formattedAmounts[Field.CURRENCY_B] ?? ''}
                onBaseInput={usdDeposit.onBaseInputWrapped}
                onQuoteInput={usdDeposit.onQuoteInputWrapped}
                usdDisplayValue={usdDeposit.usdDisplayValue}
                onUsdInput={usdDeposit.onUsdInput}
                canUseUsdMode={usdDeposit.canUseUsdMode}
                totalUsdValue={usdDeposit.totalUsdValue}
                isDepositEnabled
                isBaseDepositEnabled
                isQuoteDepositEnabled
                baseBalance={maxAmounts[Field.CURRENCY_A]}
                quoteBalance={maxAmounts[Field.CURRENCY_B]}
                maxBaseAmount={maxAmounts[Field.CURRENCY_A]}
                maxQuoteAmount={maxAmounts[Field.CURRENCY_B]}
                basePriceUsd={usdDeposit.basePriceUsd}
                quotePriceUsd={usdDeposit.quotePriceUsd}
                showSettings={false}
              />
              <Column mt="16px" gap="16px">
                <RowBetween>
                  <FlexGap gap="4px" alignItems="center">
                    <Text color="textSubtle">{t('Slippage bonus')}</Text>
                    <QuestionHelper
                      text={t(
                        'Extra LP tokens earned when depositing the low-balance coin in the pool, appearing as a bonus for helping rebalance.',
                      )}
                      placement="top-start"
                      mt="1px"
                    />
                  </FlexGap>
                  <FormattedSlippage slippage={executionSlippage} loading={loading} />
                </RowBetween>
                <RowBetween>
                  <Text color="textSubtle">{t('Slippage Tolerance')}</Text>
                  <LiquiditySlippageButton />
                </RowBetween>
                <RowBetween>
                  <Text color="textSubtle">{t('Your share in pool')}</Text>
                  <Text>{poolTokenPercentage ? `${poolTokenPercentage?.toSignificant(4)}%` : '-'}</Text>
                </RowBetween>
              </Column>
              <Box mt="8px">
                <MevProtectToggle size="sm" />
              </Box>
              <Box mt="16px">
                <StableFormButtons
                  account={account}
                  isWrongNetwork={isWrongNetwork}
                  addIsUnsupported={addIsUnsupported}
                  addIsWarning={addIsWarning}
                  shouldShowApprovalGroup={shouldShowApprovalGroup}
                  showFieldAApproval={showFieldAApproval}
                  showFieldBApproval={showFieldBApproval}
                  approvalA={approvalA}
                  approvalB={approvalB}
                  approveACallback={approveACallback}
                  approveBCallback={approveBCallback}
                  currencies={currencies}
                  buttonDisabled={buttonDisabled}
                  errorText={errorText}
                  expertMode={expertMode}
                  onAdd={onAdd}
                  onPresentAddLiquidityModal={onPresentAddLiquidityModal}
                />
              </Box>
            </AutoColumn>
          </CardBody>
        </Card>
      </Column>
    </Box>
  )
}
