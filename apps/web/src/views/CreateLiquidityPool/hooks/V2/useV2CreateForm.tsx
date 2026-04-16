import { useTranslation } from '@pancakeswap/localization'
import { useIsExpertMode, useUserSlippage } from '@pancakeswap/utils/user'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useRouter } from 'next/router'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { useTransactionAdder } from 'state/transactions/hooks'
import { useWalletClient, useGasPrice } from 'wagmi'
import { usePairAdder } from 'state/user/hooks'
import { useAddLiquidityV2FormState } from 'state/mint/reducer'
import { useDerivedMintInfo, useMintActionHandlers } from 'state/mint/hooks'
import { ReactNode, useCallback, useMemo, useState } from 'react'
import { Currency, CurrencyAmount, Pair, Price, Token } from '@pancakeswap/sdk'
import { isSolana } from '@pancakeswap/chains'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { CurrencyField as Field } from 'utils/types'
import { BIG_INT_ZERO, V2_ROUTER_ADDRESS } from 'config/constants/exchange'
import { getViemErrorMessage } from 'utils/errors'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { calculateSlippageAmount, useRouterContract } from 'utils/exchange'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import {
  logGTMAddLiquidityTxSentEvent,
  logGTMClickAddLiquidityConfirmEvent,
  logGTMClickAddLiquidityEvent,
} from 'utils/customGTMEventTracking'
import { calculateGasMargin, getBlockExploreLink } from 'utils'
import { isUserRejected, logError } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { Hash } from 'viem'
import {
  AutoColumn,
  Button,
  Flex,
  LinkExternal,
  Message,
  MessageText,
  ScanLink,
  useModalV2,
  useToast,
} from '@pancakeswap/uikit'
import { CommitButton } from 'components/CommitButton'
import ConnectWalletButton from 'components/ConnectWalletButton'
import ApproveLiquidityTokens from 'views/AddLiquidityV3/components/ApproveLiquidityTokens'
import { ChainLinkSupportChains } from 'state/info/constant'
import { PairState } from 'hooks/usePairs'
import tryParseCurrencyAmount from 'utils/tryParseCurrencyAmount'
import tryParseAmount from '@pancakeswap/utils/tryParseAmount'
import { useStartingPriceQueryState } from 'state/infinity/create'
import { PreviewModal } from 'views/CreateLiquidityPool/components/PreviewModal'
import { useTokenRisk } from 'hooks/useTokenRisk'
import { useCurrencies } from '../useCurrencies'

export const useV2CreateForm = () => {
  const {
    t,
    currentLanguage: { locale },
  } = useTranslation()

  const router = useRouter()
  const { account, chainId, isWrongNetwork } = useAccountActiveChain()
  const { data: walletClient } = useWalletClient()
  const { onOpen: onOpenPreviewModal, isOpen: isPreviewModalOpen, onDismiss: onDismissPreviewModal } = useModalV2()
  const { toastError } = useToast()

  const { data: gasPrice } = useGasPrice()

  // User Settings
  const expertMode = useIsExpertMode()
  const [allowedSlippage] = useUserSlippage()
  const [deadline] = useTransactionDeadline()

  // Shared Create Liquidity State
  const { baseCurrency, quoteCurrency } = useCurrencies()
  const evmBase = baseCurrency && !isSolana(baseCurrency.chainId) ? (baseCurrency as unknown as Currency) : undefined
  const evmQuote =
    quoteCurrency && !isSolana(quoteCurrency.chainId) ? (quoteCurrency as unknown as Currency) : undefined
  const [startPriceTypedValue] = useStartingPriceQueryState()

  // Transaction Actions
  const addTransaction = useTransactionAdder()

  // Misc. Pair State
  const addPair = usePairAdder()

  // State
  // Modal and loading
  const [{ attemptingTxn, liquidityErrorMessage, txHash }, setLiquidityState] = useState<{
    attemptingTxn: boolean
    liquidityErrorMessage: string | undefined
    txHash: string | undefined
  }>({
    attemptingTxn: false,
    liquidityErrorMessage: undefined,
    txHash: undefined,
  })

  // V2 Form State
  const routerContract = useRouterContract()
  const { independentField, typedValue, otherTypedValue } = useAddLiquidityV2FormState()
  const { dependentField, currencies, currencyBalances, noLiquidity, isOneWeiAttack, pairState } = useDerivedMintInfo(
    evmBase ?? undefined,
    evmQuote ?? undefined,
  )

  // Validation
  const { shouldBlock: addIsUnsupported } = useTokenRisk(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

  // Actions
  const { onFieldAInput, onFieldBInput } = useMintActionHandlers(noLiquidity)

  // Derivative States
  const maxAmounts: { [field in Field]?: CurrencyAmount<Token> } = useMemo(
    () =>
      [Field.CURRENCY_A, Field.CURRENCY_B].reduce((accumulator, field) => {
        return {
          ...accumulator,
          [field]: maxAmountSpend(currencyBalances[field]),
        }
      }, {}),
    [currencyBalances],
  )

  // Calculate amounts based on starting price
  const pair = useMemo(() => {
    if (!evmBase || !evmQuote || !startPriceTypedValue) return undefined

    const baseCurrencyAmount = tryParseCurrencyAmount('1', evmBase.wrapped)
    const quoteCurrencyAmount = tryParseCurrencyAmount(startPriceTypedValue, evmQuote.wrapped)

    if (!baseCurrencyAmount || !quoteCurrencyAmount) return undefined

    return new Pair(baseCurrencyAmount, quoteCurrencyAmount)
  }, [evmBase, evmQuote, startPriceTypedValue])

  const independentAmount: CurrencyAmount<Currency> | undefined = useMemo(() => {
    return tryParseAmount(typedValue, currencies[independentField] as any)
  }, [typedValue, currencies, independentField])

  const dependentAmount: CurrencyAmount<Currency> | undefined = useMemo(() => {
    if (independentAmount) {
      // we wrap the currencies just to get the price in terms of the other token
      const wrappedIndependentAmount = independentAmount?.wrapped
      const [tokenA, tokenB] = [evmBase?.wrapped, evmQuote?.wrapped]

      if (tokenA && tokenB && wrappedIndependentAmount && pair) {
        const dependentCurrency = dependentField === Field.CURRENCY_B ? evmQuote : evmBase
        const dependentTokenAmount =
          dependentField === Field.CURRENCY_B
            ? pair.priceOf(tokenA).quote(wrappedIndependentAmount)
            : pair.priceOf(tokenB).quote(wrappedIndependentAmount)
        return dependentCurrency?.isNative
          ? CurrencyAmount.fromRawAmount(dependentCurrency, dependentTokenAmount.quotient)
          : (dependentTokenAmount as CurrencyAmount<Currency>)
      }
      return undefined
    }
    return undefined
  }, [dependentField, independentAmount, pair, evmBase, evmQuote])

  const parsedAmounts: { [field in Field]: CurrencyAmount<Currency> | undefined } = useMemo(
    () => ({
      [Field.CURRENCY_A]: independentField === Field.CURRENCY_A ? independentAmount : dependentAmount,
      [Field.CURRENCY_B]: independentField === Field.CURRENCY_A ? dependentAmount : independentAmount,
    }),
    [dependentAmount, independentAmount, independentField],
  )

  // Calculate errors based on amounts and balances
  const error = useMemo(() => {
    if (!account) {
      return t('Connect Wallet')
    }

    if (pairState === PairState.INVALID) {
      return t('Choose a valid pair')
    }

    const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts

    if (
      currencyAAmount &&
      currencyBAmount &&
      currencyBalances?.[Field.CURRENCY_A]?.equalTo(0) &&
      currencyBalances?.[Field.CURRENCY_B]?.equalTo(0)
    ) {
      return t('No token balance')
    }

    return undefined
  }, [account, pairState, parsedAmounts, currencyBalances, t])

  const addError = useMemo(() => {
    const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts

    if (!parsedAmounts[Field.CURRENCY_A] || !parsedAmounts[Field.CURRENCY_B]) {
      return t('Enter an amount')
    }

    if (currencyAAmount && currencyBalances?.[Field.CURRENCY_A]?.lessThan(currencyAAmount)) {
      return t('Insufficient %symbol% balance', { symbol: currencies[Field.CURRENCY_A]?.symbol })
    }

    if (currencyBAmount && currencyBalances?.[Field.CURRENCY_B]?.lessThan(currencyBAmount)) {
      return t('Insufficient %symbol% balance', { symbol: currencies[Field.CURRENCY_B]?.symbol })
    }

    return undefined
  }, [parsedAmounts, currencyBalances, currencies, t])

  const price = useMemo(() => {
    if (noLiquidity) {
      const { [Field.CURRENCY_A]: currencyAAmount, [Field.CURRENCY_B]: currencyBAmount } = parsedAmounts
      if (currencyAAmount && currencyBAmount) {
        return new Price(
          currencyAAmount.currency,
          currencyBAmount.currency,
          currencyAAmount.quotient,
          currencyBAmount.quotient,
        )
      }
      return undefined
    }
    if (!pair || pair.reserve0.quotient === BIG_INT_ZERO || pair.reserve1.quotient === BIG_INT_ZERO) {
      return undefined
    }
    const wrappedCurrencyA = evmBase?.wrapped
    return wrappedCurrencyA ? pair.priceOf(wrappedCurrencyA) : undefined
  }, [evmBase, noLiquidity, pair, parsedAmounts])

  const pairExplorerLink = useMemo(
    () => (pair && getBlockExploreLink(Pair.getAddress(pair.token0, pair.token1), 'address', chainId)) || undefined,
    [pair, chainId],
  )

  const formattedAmounts = useMemo(
    () => ({
      [independentField]: typedValue,
      [dependentField]: parsedAmounts[dependentField]?.toSignificant(6) ?? '',
    }),
    [dependentField, independentField, , parsedAmounts, typedValue],
  )

  const pendingText = useMemo(
    () =>
      t('Supplying %amountA% %symbolA% and %amountB% %symbolB%', {
        amountA: formatCurrencyAmount(parsedAmounts[Field.CURRENCY_A], 4, locale),
        symbolA: currencies[Field.CURRENCY_A]?.symbol ?? '',
        amountB: formatCurrencyAmount(parsedAmounts[Field.CURRENCY_B], 4, locale),
        symbolB: currencies[Field.CURRENCY_B]?.symbol ?? '',
      }),
    [currencies, locale, parsedAmounts, t],
  )

  // Approval States
  const {
    approvalState: approvalA,
    approveCallback: approveACallback,
    revokeCallback: revokeACallback,
    currentAllowance: currentAllowanceA,
  } = useApproveCallback(parsedAmounts[Field.CURRENCY_A], chainId ? V2_ROUTER_ADDRESS[chainId] : undefined)
  const {
    approvalState: approvalB,
    approveCallback: approveBCallback,
    revokeCallback: revokeBCallback,
    currentAllowance: currentAllowanceB,
  } = useApproveCallback(parsedAmounts[Field.CURRENCY_B], chainId && V2_ROUTER_ADDRESS[chainId])

  const isValid = !error && !addError
  const errorText = useMemo(() => error ?? addError, [error, addError])

  const buttonDisabled = !isValid || approvalA !== ApprovalState.APPROVED || approvalB !== ApprovalState.APPROVED

  const showFieldAApproval = approvalA === ApprovalState.NOT_APPROVED || approvalA === ApprovalState.PENDING
  const showFieldBApproval = approvalB === ApprovalState.NOT_APPROVED || approvalB === ApprovalState.PENDING

  const shouldShowApprovalGroup = (showFieldAApproval || showFieldBApproval) && isValid

  // Create Pool Action
  const onAdd = useCallback(async () => {
    logGTMClickAddLiquidityConfirmEvent()
    if (!chainId || !account || !routerContract || !walletClient) return

    const { [Field.CURRENCY_A]: parsedAmountA, [Field.CURRENCY_B]: parsedAmountB } = parsedAmounts
    if (!parsedAmountA || !parsedAmountB || !baseCurrency || !quoteCurrency || !deadline) {
      return
    }

    const amountsMin = {
      [Field.CURRENCY_A]: calculateSlippageAmount(parsedAmountA, noLiquidity ? 0 : allowedSlippage)[0],
      [Field.CURRENCY_B]: calculateSlippageAmount(parsedAmountB, noLiquidity ? 0 : allowedSlippage)[0],
    }

    // eslint-disable-next-line
    let estimate: any
    // eslint-disable-next-line
    let method: any
    // eslint-disable-next-line
    let args: Array<string | string[] | number | bigint>
    let value: bigint | null
    if (baseCurrency?.isNative || quoteCurrency?.isNative) {
      const tokenBIsNative = quoteCurrency?.isNative
      estimate = routerContract.estimateGas.addLiquidityETH
      method = routerContract.write.addLiquidityETH
      args = [
        (tokenBIsNative ? baseCurrency : quoteCurrency)?.wrapped?.address ?? '', // token
        (tokenBIsNative ? parsedAmountA : parsedAmountB).quotient.toString(), // token desired
        amountsMin[tokenBIsNative ? Field.CURRENCY_A : Field.CURRENCY_B].toString(), // token min
        amountsMin[tokenBIsNative ? Field.CURRENCY_B : Field.CURRENCY_A].toString(), // eth min
        account,
        deadline,
      ]
      value = (tokenBIsNative ? parsedAmountB : parsedAmountA).quotient
    } else {
      estimate = routerContract.estimateGas.addLiquidity
      method = routerContract.write.addLiquidity
      args = [
        baseCurrency?.wrapped?.address ?? '',
        quoteCurrency?.wrapped?.address ?? '',
        parsedAmountA.quotient.toString(),
        parsedAmountB.quotient.toString(),
        amountsMin[Field.CURRENCY_A].toString(),
        amountsMin[Field.CURRENCY_B].toString(),
        account,
        deadline,
      ]
      value = null
    }

    setLiquidityState({ attemptingTxn: true, liquidityErrorMessage: undefined, txHash: undefined })
    await estimate(
      args,
      value
        ? { value, account: routerContract.account, chain: routerContract.chain }
        : { account: routerContract.account, chain: routerContract.chain },
    )
      .then((estimatedGasLimit: any) =>
        method(args, {
          ...(value ? { value } : {}),
          gas: calculateGasMargin(estimatedGasLimit),
          gasPrice,
        }).then(async (response: Hash) => {
          setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: response })
          logGTMAddLiquidityTxSentEvent()
          const symbolA = currencies[Field.CURRENCY_A]?.symbol
          const amountA = parsedAmounts[Field.CURRENCY_A]?.toSignificant(3)
          const symbolB = currencies[Field.CURRENCY_B]?.symbol
          const amountB = parsedAmounts[Field.CURRENCY_B]?.toSignificant(3)
          addTransaction(
            { hash: response },
            {
              summary: `Add ${amountA} ${symbolA} and ${amountB} ${symbolB}`,
              translatableSummary: {
                text: 'Add %amountA% %symbolA% and %amountB% %symbolB%',
                data: { amountA, symbolA, amountB, symbolB },
              },
              type: 'add-liquidity',
            },
          )

          if (pair) {
            addPair(pair)
          }

          // toastSuccess(
          //   `${t('Create Pool')}`,
          //   <ToastDescriptionWithTx txHash={response}>{t('Successfully created pool')}</ToastDescriptionWithTx>,
          // )

          // Redirect to liquidity pools page
          router.push('/liquidity/pools')
        }),
      )
      ?.catch((err: any) => {
        if (err && !isUserRejected(err)) {
          logError(err)
          console.error(`Add Liquidity failed`, err, args, value)
          toastError(t('Error'), getViemErrorMessage(err))
        }
        setLiquidityState({
          attemptingTxn: false,
          liquidityErrorMessage:
            err && !isUserRejected(err)
              ? t('Add liquidity failed: %message%', { message: transactionErrorToUserReadableMessage(err, t) })
              : undefined,
          txHash: undefined,
        })
      })
  }, [
    account,
    baseCurrency,
    chainId,
    deadline,
    noLiquidity,
    parsedAmounts,
    addPair,
    addTransaction,
    allowedSlippage,
    currencies,
    gasPrice,
    pair,
    quoteCurrency,
    router,
    routerContract,
    t,
    toastError,
    walletClient,
  ])

  // Buttons
  const buttons: ReactNode = useMemo(() => {
    if (addIsUnsupported) {
      return (
        <Button disabled mb="4px">
          {t('Unsupported Asset')}
        </Button>
      )
    }
    if (!account) {
      return <ConnectWalletButton width="100%" />
    }
    if (isWrongNetwork) {
      return <CommitButton />
    }

    return (
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
            expertMode ? onAdd() : onOpenPreviewModal()
            logGTMClickAddLiquidityEvent()
          }}
          disabled={buttonDisabled}
        >
          {errorText || t('Add')}
        </CommitButton>
      </AutoColumn>
    )
  }, [
    account,
    addIsUnsupported,
    approvalA,
    approvalB,
    approveACallback,
    approveBCallback,
    chainId,
    currencies,
    currentAllowanceA,
    currentAllowanceB,
    expertMode,
    isOneWeiAttack,
    isWrongNetwork,
    onAdd,
    revokeACallback,
    revokeBCallback,
    shouldShowApprovalGroup,
    t,
    buttonDisabled,
    errorText,
    onOpenPreviewModal,
    pairExplorerLink,
    showFieldAApproval,
    showFieldBApproval,
  ])

  const previewModal = useMemo(() => {
    return (
      <PreviewModal
        currencies={currencies}
        parsedAmounts={parsedAmounts}
        onConfirm={onAdd}
        isOpen={isPreviewModalOpen}
        onDismiss={onDismissPreviewModal}
        feeTier="0.25%"
        details={{
          startPrice:
            baseCurrency && quoteCurrency ? (
              <>
                {price?.toSignificant(6)}{' '}
                {t('%assetA% = 1 %assetB%', {
                  assetA: quoteCurrency?.symbol,
                  assetB: baseCurrency?.symbol,
                })}
              </>
            ) : undefined,
        }}
      />
    )
  }, [
    currencies,
    parsedAmounts,
    onAdd,
    isPreviewModalOpen,
    onDismissPreviewModal,
    price,
    baseCurrency,
    quoteCurrency,
    t,
  ])

  return {
    // State
    currencies,
    pair,
    currencyBalances,
    noLiquidity,
    maxAmounts,
    formattedAmounts,
    pendingText,

    // Components
    buttons,
    previewModal,

    // Validation
    addIsUnsupported,
    errorText,
    buttonDisabled,

    // Approval States
    approvalA,
    approvalB,
    showFieldAApproval,
    showFieldBApproval,
    shouldShowApprovalGroup,

    // Actions
    onAdd,
    onFieldAInput,
    onFieldBInput,
    approveACallback,
    approveBCallback,
    revokeACallback,
    revokeBCallback,
  }
}
