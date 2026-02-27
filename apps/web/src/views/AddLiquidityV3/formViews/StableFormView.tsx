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
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
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

  return (
    <Box mx="auto" pb="16px" width="100%" maxWidth={[null, null, null, null, '480px']}>
      <Card>
        <CardBody>
          <AutoColumn>
            <CurrencyInputPanelSimplify
              showUSDPrice
              maxAmount={maxAmounts[Field.CURRENCY_A]}
              onMax={() => onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')}
              onPercentInput={(percent) => {
                if (maxAmounts[Field.CURRENCY_A]) {
                  onFieldAInput(maxAmounts[Field.CURRENCY_A]?.multiply(new Percent(percent, 100)).toExact() ?? '')
                }
              }}
              disableCurrencySelect
              defaultValue={formattedAmounts[Field.CURRENCY_A]}
              onUserInput={onFieldAInput}
              showQuickInputButton
              showMaxButton
              currency={currencies[Field.CURRENCY_A]}
              id="stable-add-liquidity-input-tokena"
              title={<PreTitle>{t('Deposit Amount')}</PreTitle>}
            />
            <Box my="4px" />
            <CurrencyInputPanelSimplify
              showUSDPrice
              disableCurrencySelect
              maxAmount={maxAmounts[Field.CURRENCY_B]}
              onPercentInput={(percent) => {
                if (maxAmounts[Field.CURRENCY_B]) {
                  onFieldBInput(maxAmounts[Field.CURRENCY_B]?.multiply(new Percent(percent, 100)).toExact() ?? '')
                }
              }}
              onMax={() => onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')}
              defaultValue={formattedAmounts[Field.CURRENCY_B]}
              onUserInput={onFieldBInput}
              showQuickInputButton
              showMaxButton
              currency={currencies[Field.CURRENCY_B]}
              id="stable-add-liquidity-input-tokenb"
              title={<>&nbsp;</>}
            />
            <Column mt="16px" gap="16px">
              <RowBetween>
                <Text color="textSubtle">{t('Total.amount')}</Text>
                <Text>~{formatDollarAmount(inputAmountsTotalUsdValue, 2, false)}</Text>
              </RowBetween>
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
    </Box>
  )
}
