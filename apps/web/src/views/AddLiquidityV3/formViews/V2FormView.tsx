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
import { DepositAmountPanel } from 'components/Liquidity/DepositAmountPanel'
import { V2EstimatedFeesPanel } from 'components/Liquidity/V2EstimatedFeesPanel'
import { usePoolInfo } from 'state/farmsV4/hooks'
import type { V2PoolInfo } from 'state/farmsV4/state/type'
import { getBlockExploreLink } from 'utils'
import { logGTMClickAddLiquidityEvent } from 'utils/customGTMEventTracking'
import { CurrencyField as Field } from 'utils/types'
import { LP2ChildrenProps } from 'views/AddLiquidity'

import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useUsdDepositAmount } from 'hooks/useUsdDepositAmount'
import ApproveLiquidityTokens from 'views/AddLiquidityV3/components/ApproveLiquidityTokens'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
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

  // USD deposit hook (V2 uses ~0.5 ratio)
  const usdDeposit = useUsdDepositAmount({
    baseCurrency: currencies[Field.CURRENCY_A],
    quoteCurrency: currencies[Field.CURRENCY_B],
    baseInputValue: formattedAmounts[Field.CURRENCY_A] ?? '',
    quoteInputValue: formattedAmounts[Field.CURRENCY_B] ?? '',
    onBaseInput: onFieldAInput,
    onQuoteInput: onFieldBInput,
    baseTokenRatio: 0.5,
  })

  // Pool info for Estimated Fees panel (V2 pair LP token address)
  const v2PoolInfo = usePoolInfo<V2PoolInfo>({
    poolAddress: pair?.liquidityToken.address,
    chainId: pair?.liquidityToken.chainId,
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
      <Column gap="16px">
        <V2EstimatedFeesPanel poolInfo={v2PoolInfo} totalUsdValue={usdDeposit.totalUsdValue} />
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
                showSettings
              />
              {canUseNativeCurrency && (
                <RowBetween mt="8px">
                  <Text color="textSubtle">Use {native.symbol} instead</Text>
                  <Toggle scale="sm" checked={useNativeInstead} onChange={handleUseNative} />
                </RowBetween>
              )}
              <Box mt="16px">{buttons}</Box>
            </AutoColumn>
          </CardBody>
        </Card>
      </Column>
    </Box>
  )
}
