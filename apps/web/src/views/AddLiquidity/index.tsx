import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Pair, Percent, Price, Token } from '@pancakeswap/sdk'
import { useModal } from '@pancakeswap/uikit'
import { useUserSlippage } from '@pancakeswap/utils/user'
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'

import { V2_ROUTER_ADDRESS } from 'config/constants/exchange'
import { useIsTransactionUnsupported, useIsTransactionWarning } from 'hooks/Trades'
import { useLPApr } from 'state/swap/useLPApr'
import { logGTMAddLiquidityTxSentEvent, logGTMClickAddLiquidityConfirmEvent } from 'utils/customGTMEventTracking'
import { formatCurrencyAmount } from 'utils/formatCurrencyAmount'
import { isUserRejected, logError } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { Address, Hash } from 'viem'
import { useWalletClient } from 'wagmi'
import { useCurrencyInversionEvent } from 'views/AddLiquidityV3/hooks/useHeaderInvertCurrencies'

import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { PairState } from 'hooks/usePairs'
import { CurrencyField as Field } from 'utils/types'
import { useDerivedMintInfo, useMintActionHandlers } from 'state/mint/hooks'

import { useAddLiquidityV2FormState } from 'state/mint/reducer'
import { useTransactionAdder } from 'state/transactions/hooks'
import { useGasPrice, usePairAdder } from 'state/user/hooks'
import { calculateGasMargin } from 'utils'
import { calculateSlippageAmount, useRouterContract } from 'utils/exchange'
import { maxAmountSpend } from 'utils/maxAmountSpend'
import { buildPostHogBaseProperties, capturePostHogEvent, getPostHogErrorProperties } from 'utils/posthog'
import currencyId from 'utils/currencyId'
import { useWalletRuntime } from 'wallet/hook/useWalletEnv'
import { useTransactionDeadline } from '../../hooks/useTransactionDeadline'
import ConfirmAddLiquidityModal from './components/ConfirmAddLiquidityModal'
import { useCurrencySelectRoute } from './useCurrencySelectRoute'
import useWarningLiquidity from './hooks/useWarningLiquidity'

export interface LP2ChildrenProps {
  error?: string
  currencies: {
    [Field.CURRENCY_A]?: Currency
    [Field.CURRENCY_B]?: Currency
  }
  isOneWeiAttack?: boolean
  noLiquidity?: boolean
  handleCurrencyASelect: (currencyA_: Currency) => void
  formattedAmounts: {
    [Field.CURRENCY_A]?: string
    [Field.CURRENCY_B]?: string
  }
  onFieldAInput: (typedValue: string) => void
  maxAmounts: { [field in Field]?: CurrencyAmount<Token> }
  handleCurrencyBSelect: (currencyB_: Currency) => void
  onFieldBInput: (typedValue: string) => void
  pairState: PairState
  poolTokenPercentage?: Percent
  price?: Price<Currency, Currency>
  allowedSlippage: number
  pair?: Pair | null
  poolData?: {
    lpApr: number
  } | null
  shouldShowApprovalGroup: boolean
  showFieldAApproval: boolean
  approveACallback: () => Promise<{ hash: Address } | undefined>
  revokeACallback: () => Promise<{ hash: Address } | undefined>
  currentAllowanceA: CurrencyAmount<Currency> | undefined
  approvalA: ApprovalState
  showFieldBApproval: boolean
  approveBCallback: () => Promise<{ hash: Address } | undefined>
  revokeBCallback: () => Promise<{ hash: Address } | undefined>
  currentAllowanceB: CurrencyAmount<Currency> | undefined
  approvalB: ApprovalState
  onAdd: () => Promise<void>
  onPresentAddLiquidityModal: () => void
  buttonDisabled: boolean
  errorText?: string
  addIsWarning: boolean
  addIsUnsupported: boolean
  pendingText: string
}

export default function AddLiquidity({
  currencyA,
  currencyB,
  children,
}: {
  currencyA?: Currency | null
  currencyB?: Currency | null
  children: (props: LP2ChildrenProps) => ReactElement
}) {
  const { data: walletClient } = useWalletClient()
  const { account, chainId } = useAccountActiveChain()
  const runtime = useWalletRuntime()

  const addPair = usePairAdder()

  const {
    t,
    currentLanguage: { locale },
  } = useTranslation()
  const gasPrice = useGasPrice()

  // mint state
  const { independentField, typedValue, otherTypedValue } = useAddLiquidityV2FormState()
  const {
    dependentField,
    currencies,
    pair,
    pairState,
    currencyBalances,
    parsedAmounts: mintParsedAmounts,
    price,
    noLiquidity,
    liquidityMinted,
    poolTokenPercentage,
    error,
    addError,
    isOneWeiAttack,
  } = useDerivedMintInfo(currencyA ?? undefined, currencyB ?? undefined)

  const poolData = useLPApr('v2', pair)

  const { onFieldAInput, onFieldBInput } = useMintActionHandlers(noLiquidity)

  const inversionEvent = useCurrencyInversionEvent()

  // Interchange input values on flipping currencies from the header
  useEffect(() => {
    if (inversionEvent) {
      const { currencyIdA: newCurrencyIdA, currencyIdB: newCurrencyIdB } = inversionEvent
      if (
        newCurrencyIdA &&
        newCurrencyIdB &&
        newCurrencyIdA !== currencyId(currencyA ?? undefined) &&
        newCurrencyIdB !== currencyId(currencyB ?? undefined)
      ) {
        onFieldAInput(formattedAmounts[Field.CURRENCY_B] ?? '')
        onFieldBInput(formattedAmounts[Field.CURRENCY_A] ?? '')
      }
    }
  }, [inversionEvent])

  // modal and loading
  const [{ attemptingTxn, liquidityErrorMessage, txHash }, setLiquidityState] = useState<{
    attemptingTxn: boolean
    liquidityErrorMessage: string | undefined
    txHash: string | undefined
  }>({
    attemptingTxn: false,
    liquidityErrorMessage: undefined,
    txHash: undefined,
  })

  // txn values
  const [deadline] = useTransactionDeadline() // custom from users settings
  const [allowedSlippage] = useUserSlippage() // custom from users

  // get the max amounts user can add
  const maxAmounts: { [field in Field]?: CurrencyAmount<Token> } = [Field.CURRENCY_A, Field.CURRENCY_B].reduce(
    (accumulator, field) => {
      return {
        ...accumulator,
        [field]: maxAmountSpend(currencyBalances[field]),
      }
    },
    {},
  )

  const { handleCurrencyASelect, handleCurrencyBSelect } = useCurrencySelectRoute()
  const warningHandler = useWarningLiquidity(
    currencyA ? currencyId(currencyA) : undefined,
    currencyB ? currencyId(currencyB) : undefined,
  )

  const handleCurrencyASelectWithWarning = useCallback(
    (curr: Currency) => {
      warningHandler(curr)
      handleCurrencyASelect(curr)
    },
    [warningHandler, handleCurrencyASelect],
  )

  const handleCurrencyBSelectWithWarning = useCallback(
    (curr: Currency) => {
      warningHandler(curr)
      handleCurrencyBSelect(curr)
    },
    [warningHandler, handleCurrencyBSelect],
  )

  const parsedAmounts = mintParsedAmounts

  // get formatted amounts
  const formattedAmounts = useMemo(
    () => ({
      [independentField]: typedValue,
      [dependentField]: noLiquidity ? otherTypedValue : parsedAmounts[dependentField]?.toSignificant(6) ?? '',
    }),
    [dependentField, independentField, noLiquidity, otherTypedValue, parsedAmounts, typedValue],
  )

  // check whether the user has approved the router on the tokens
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

  const addTransaction = useTransactionAdder()

  const routerContract = useRouterContract()

  async function onAdd() {
    logGTMClickAddLiquidityConfirmEvent()
    if (!chainId || !account || !routerContract || !walletClient) return

    const { [Field.CURRENCY_A]: parsedAmountA, [Field.CURRENCY_B]: parsedAmountB } = mintParsedAmounts
    if (!parsedAmountA || !parsedAmountB || !currencyA || !currencyB || !deadline) {
      return
    }

    const amountsMin = {
      [Field.CURRENCY_A]: calculateSlippageAmount(parsedAmountA, noLiquidity ? 0 : allowedSlippage)[0],
      [Field.CURRENCY_B]: calculateSlippageAmount(parsedAmountB, noLiquidity ? 0 : allowedSlippage)[0],
    }
    const symbolA = currencies[Field.CURRENCY_A]?.symbol
    const amountA = parsedAmounts[Field.CURRENCY_A]?.toSignificant(3)
    const symbolB = currencies[Field.CURRENCY_B]?.symbol
    const amountB = parsedAmounts[Field.CURRENCY_B]?.toSignificant(3)
    const postHogBaseProperties = buildPostHogBaseProperties({
      account,
      chainId,
      runtime,
    })

    // eslint-disable-next-line
    let estimate: any
    // eslint-disable-next-line
    let method: any
    // eslint-disable-next-line
    let args: Array<string | string[] | number | bigint>
    let value: bigint | null
    if (currencyA?.isNative || currencyB?.isNative) {
      const tokenBIsNative = currencyB?.isNative
      estimate = routerContract.estimateGas.addLiquidityETH
      method = routerContract.write.addLiquidityETH
      args = [
        (tokenBIsNative ? currencyA : currencyB)?.wrapped?.address ?? '', // token
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
        currencyA?.wrapped?.address ?? '',
        currencyB?.wrapped?.address ?? '',
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
    capturePostHogEvent('liquidity_add_started', {
      ...postHogBaseProperties,
      pool_type: 'v2',
      token_a_symbol: symbolA ?? null,
      token_a_amount: amountA ?? null,
      token_b_symbol: symbolB ?? null,
      token_b_amount: amountB ?? null,
      no_liquidity: noLiquidity,
    })
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
        }).then((response: Hash) => {
          setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: response })
          logGTMAddLiquidityTxSentEvent()
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

          capturePostHogEvent('liquidity_add_succeeded', {
            ...postHogBaseProperties,
            pool_type: 'v2',
            token_a_symbol: symbolA ?? null,
            token_a_amount: amountA ?? null,
            token_b_symbol: symbolB ?? null,
            token_b_amount: amountB ?? null,
            tx_hash: response,
            no_liquidity: noLiquidity,
          })
        }),
      )
      ?.catch((err: any) => {
        if (err && !isUserRejected(err)) {
          logError(err)
          console.error(`Add Liquidity failed`, err, args, value)
        }
        capturePostHogEvent('liquidity_add_failed', {
          ...postHogBaseProperties,
          pool_type: 'v2',
          token_a_symbol: symbolA ?? null,
          token_a_amount: amountA ?? null,
          token_b_symbol: symbolB ?? null,
          token_b_amount: amountB ?? null,
          rejected_by_user: Boolean(err && isUserRejected(err)),
          no_liquidity: noLiquidity,
          ...getPostHogErrorProperties(err, err && isUserRejected(err) ? 'Transaction rejected.' : undefined),
        })
        setLiquidityState({
          attemptingTxn: false,
          liquidityErrorMessage:
            err && !isUserRejected(err)
              ? t('Add liquidity failed: %message%', { message: transactionErrorToUserReadableMessage(err, t) })
              : undefined,
          txHash: undefined,
        })
      })
  }

  const pendingText = t('Supplying %amountA% %symbolA% and %amountB% %symbolB%', {
    amountA: formatCurrencyAmount(parsedAmounts[Field.CURRENCY_A], 4, locale),
    symbolA: currencies[Field.CURRENCY_A]?.symbol ?? '',
    amountB: formatCurrencyAmount(parsedAmounts[Field.CURRENCY_B], 4, locale),
    symbolB: currencies[Field.CURRENCY_B]?.symbol ?? '',
  })

  const handleDismissConfirmation = useCallback(() => {
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      onFieldAInput('')
    }
  }, [onFieldAInput, txHash])

  const addIsUnsupported = useIsTransactionUnsupported(currencies?.CURRENCY_A, currencies?.CURRENCY_B)
  const addIsWarning = useIsTransactionWarning(currencies?.CURRENCY_A, currencies?.CURRENCY_B)

  const [onPresentAddLiquidityModal_] = useModal(
    <ConfirmAddLiquidityModal
      title={noLiquidity ? t('You are creating a trading pair') : t('You will receive')}
      customOnDismiss={handleDismissConfirmation}
      attemptingTxn={attemptingTxn}
      hash={txHash}
      pendingText={pendingText}
      currencyToAdd={pair?.liquidityToken}
      allowedSlippage={allowedSlippage}
      onAdd={onAdd}
      parsedAmounts={parsedAmounts}
      currencies={currencies}
      liquidityErrorMessage={liquidityErrorMessage}
      price={price}
      noLiquidity={noLiquidity}
      poolTokenPercentage={poolTokenPercentage}
      liquidityMinted={liquidityMinted}
    />,
    true,
    true,
    'addLiquidityModal',
  )

  const onPresentAddLiquidityModal = useCallback(() => {
    setLiquidityState({
      attemptingTxn: false,
      liquidityErrorMessage: undefined,
      txHash: undefined,
    })
    onPresentAddLiquidityModal_()
  }, [onPresentAddLiquidityModal_])

  const isValid = !error && !addError
  const errorText = error ?? addError

  const buttonDisabled = !isValid || approvalA !== ApprovalState.APPROVED || approvalB !== ApprovalState.APPROVED

  const showFieldAApproval = approvalA === ApprovalState.NOT_APPROVED || approvalA === ApprovalState.PENDING
  const showFieldBApproval = approvalB === ApprovalState.NOT_APPROVED || approvalB === ApprovalState.PENDING

  const shouldShowApprovalGroup = (showFieldAApproval || showFieldBApproval) && isValid

  return children({
    isOneWeiAttack,
    error,
    currencies,
    noLiquidity,
    handleCurrencyASelect: handleCurrencyASelectWithWarning,
    formattedAmounts,
    onFieldAInput,
    maxAmounts,
    handleCurrencyBSelect: handleCurrencyBSelectWithWarning,
    onFieldBInput,
    pairState,
    poolTokenPercentage,
    price,
    allowedSlippage,
    pair,
    poolData,
    shouldShowApprovalGroup,
    showFieldAApproval,
    approveACallback,
    approvalA,
    revokeACallback,
    currentAllowanceA,
    showFieldBApproval,
    approveBCallback,
    approvalB,
    revokeBCallback,
    currentAllowanceB,
    onAdd,
    onPresentAddLiquidityModal,
    buttonDisabled,
    errorText,
    addIsWarning,
    addIsUnsupported,
    pendingText,
  })
}
