import { useTranslation } from '@pancakeswap/localization'
import { Pair, Percent } from '@pancakeswap/sdk'
import {
  AutoColumn,
  Box,
  Button,
  Card,
  CardBody,
  Column,
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
import { useIsExpertMode } from '@pancakeswap/utils/user'
import { ReactNode, useMemo } from 'react'
import { ChainLinkSupportChains } from 'state/info/constant'
import useNativeCurrency from 'hooks/useNativeCurrency'

import { CommitButton } from 'components/CommitButton'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { getBlockExploreLink } from 'utils'
import { logGTMClickAddLiquidityEvent } from 'utils/customGTMEventTracking'
import { CurrencyField as Field } from 'utils/types'
import { LP2ChildrenProps } from 'views/AddLiquidity'

import useAccountActiveChain from 'hooks/useAccountActiveChain'
import ApproveLiquidityTokens from 'views/AddLiquidityV3/components/ApproveLiquidityTokens'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { useTotalUsdValue } from '../../AddLiquidity/hooks/useTotalUsdValue'
import { useNativeCurrencyInstead } from '../hooks/useNativeCurrencyInstead'

export default function V2FormView({
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
}: LP2ChildrenProps) {
  const { t } = useTranslation()
  const { account, chainId, isWrongNetwork } = useAccountActiveChain()
  const expertMode = useIsExpertMode()

  const native = useNativeCurrency()

  let buttons: ReactNode = null

  // Parse formatted amounts to CurrencyAmount objects
  const parsedAmountA = useMemo(
    () => tryParseAmount(formattedAmounts[Field.CURRENCY_A], currencies[Field.CURRENCY_A]),
    [formattedAmounts, currencies],
  )
  const parsedAmountB = useMemo(
    () => tryParseAmount(formattedAmounts[Field.CURRENCY_B], currencies[Field.CURRENCY_B]),
    [formattedAmounts, currencies],
  )

  const { canUseNativeCurrency, handleUseNative, useNativeInstead } = useNativeCurrencyInstead({
    baseCurrency: currencies[Field.CURRENCY_A],
    quoteCurrency: currencies[Field.CURRENCY_B],
    feeAmount: 0,
  })

  // Get total USD Value of input amounts
  const { totalUsdValue } = useTotalUsdValue({
    parsedAmountA,
    parsedAmountB,
  })

  const pairExplorerLink = useMemo(
    () => (pair && getBlockExploreLink(Pair.getAddress(pair.token0, pair.token1), 'address', chainId)) || undefined,
    [pair, chainId],
  )

  if (addIsUnsupported) {
    buttons = (
      <Button disabled mb="4px">
        {t('Unsupported Asset')}
      </Button>
    )
  } else if (!account) {
    buttons = <ConnectWalletButton width="100%" />
  } else if (isWrongNetwork) {
    buttons = <CommitButton />
  } else {
    buttons = (
      <AutoColumn gap="md">
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
        {isOneWeiAttack ? (
          <Message variant="warning">
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
        >
          {errorText || t('Add')}
        </CommitButton>
      </AutoColumn>
    )
  }

  return (
    <Box mx="auto" pb="16px" width="100%" maxWidth={[null, null, null, null, '480px']}>
      <Card>
        <CardBody>
          <AutoColumn>
            <Box mb="8px">
              <CurrencyInputPanelSimplify
                maxAmount={maxAmounts[Field.CURRENCY_A]}
                showUSDPrice
                onMax={() => {
                  onFieldAInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
                }}
                onPercentInput={(percent) => {
                  if (maxAmounts[Field.CURRENCY_A]) {
                    onFieldAInput(maxAmounts[Field.CURRENCY_A]?.multiply(new Percent(percent, 100)).toExact() ?? '')
                  }
                }}
                disableCurrencySelect
                defaultValue={formattedAmounts[Field.CURRENCY_A] ?? '0'}
                onUserInput={onFieldAInput}
                showQuickInputButton
                showMaxButton
                currency={currencies[Field.CURRENCY_A]}
                id="v2-add-liquidity-input-tokena"
                title={<PreTitle>{t('Deposit Amount')}</PreTitle>}
              />
            </Box>

            <CurrencyInputPanelSimplify
              showUSDPrice
              onPercentInput={(percent) => {
                if (maxAmounts[Field.CURRENCY_B]) {
                  onFieldBInput(maxAmounts[Field.CURRENCY_B]?.multiply(new Percent(percent, 100)).toExact() ?? '')
                }
              }}
              onMax={() => {
                onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
              }}
              maxAmount={maxAmounts[Field.CURRENCY_B]}
              disableCurrencySelect
              defaultValue={formattedAmounts[Field.CURRENCY_B] ?? '0'}
              onUserInput={onFieldBInput}
              showQuickInputButton
              showMaxButton
              currency={currencies[Field.CURRENCY_B]}
              id="v2-add-liquidity-input-tokenb"
              title={<>&nbsp;</>}
            />
            <Column mt="16px" gap="16px">
              {canUseNativeCurrency && (
                <RowBetween>
                  <Text color="textSubtle">Use {native.symbol} instead</Text>
                  <Toggle scale="sm" checked={useNativeInstead} onChange={handleUseNative} />
                </RowBetween>
              )}
              <RowBetween>
                <Text color="textSubtle">{t('Total.amount')}</Text>
                <Text>~{formatDollarAmount(totalUsdValue, 2, false)}</Text>
              </RowBetween>
              <RowBetween>
                <Text color="textSubtle">{t('Slippage Tolerance')}</Text>
                <LiquiditySlippageButton />
              </RowBetween>
            </Column>
            <Box mt="8px">
              <MevProtectToggle size="sm" />
            </Box>
            <Box mt="16px">{buttons}</Box>
          </AutoColumn>
        </CardBody>
      </Card>
    </Box>
  )
}
