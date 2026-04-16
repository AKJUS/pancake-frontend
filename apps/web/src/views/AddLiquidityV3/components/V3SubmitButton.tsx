import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount } from '@pancakeswap/sdk'
import { AutoColumn, Button } from '@pancakeswap/uikit'
import { CommitButton } from 'components/CommitButton'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { DISABLED_ADD_LIQUIDITY_CHAINS } from 'config/constants/liquidity'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { ApprovalState } from 'hooks/useApproveCallback'
import { ReactNode, useMemo } from 'react'
import { CurrencyField as Field } from 'utils/types'
import { Address } from 'viem'
import ApproveLiquidityTokens from 'views/AddLiquidityV3/components/ApproveLiquidityTokens'

export interface V3SubmitButtonProps {
  addIsUnsupported: boolean
  account?: string
  isWrongNetwork: boolean
  approvalA: ApprovalState
  approvalB: ApprovalState
  isValid: boolean
  showApprovalA: boolean
  approveACallback: () => Promise<{ hash: Address } | undefined>
  currentAllowanceA: CurrencyAmount<Currency> | undefined
  revokeACallback: () => Promise<{ hash: Address } | undefined>
  currencies: {
    CURRENCY_A?: Currency
    CURRENCY_B?: Currency
  }
  approveBCallback: () => Promise<{ hash: Address } | undefined>
  currentAllowanceB: CurrencyAmount<Currency> | undefined
  revokeBCallback: () => Promise<{ hash: Address } | undefined>
  showApprovalB: boolean
  parsedAmounts: {
    CURRENCY_A?: CurrencyAmount<Currency>
    CURRENCY_B?: CurrencyAmount<Currency>
  }
  onClick: () => void | Promise<void>
  attemptingTxn: boolean
  errorMessage: ReactNode
  buttonText: string
  endIcon?: ReactNode
  depositADisabled: boolean
  depositBDisabled: boolean
}

export function V3SubmitButton({
  addIsUnsupported,
  account,
  isWrongNetwork,
  approvalA,
  approvalB,
  isValid,
  showApprovalA,
  approveACallback,
  currentAllowanceA,
  revokeACallback,
  currencies,
  approveBCallback,
  currentAllowanceB,
  revokeBCallback,
  showApprovalB,
  parsedAmounts,
  onClick,
  attemptingTxn,
  errorMessage,
  buttonText,
  endIcon,
  depositADisabled,
  depositBDisabled,
}: V3SubmitButtonProps) {
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()

  const shouldShowApprovalGroup = useMemo(
    () =>
      (approvalA === ApprovalState.NOT_APPROVED ||
        approvalA === ApprovalState.PENDING ||
        approvalB === ApprovalState.NOT_APPROVED ||
        approvalB === ApprovalState.PENDING) &&
      isValid,
    [approvalA, approvalB, isValid],
  )

  let buttons: ReactNode = null
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
          showFieldAApproval={showApprovalA}
          showFieldBApproval={showApprovalB}
          approveACallback={approveACallback}
          approveBCallback={approveBCallback}
          revokeACallback={revokeACallback}
          revokeBCallback={revokeBCallback}
          currencies={currencies}
          currentAllowanceA={currentAllowanceA}
          currentAllowanceB={currentAllowanceB}
          shouldShowApprovalGroup={shouldShowApprovalGroup}
        />
        <CommitButton
          endIcon={endIcon}
          variant={
            !isValid && !!parsedAmounts[Field.CURRENCY_A] && !!parsedAmounts[Field.CURRENCY_B] ? 'danger' : 'primary'
          }
          onClick={onClick}
          disabled={
            !isValid ||
            attemptingTxn ||
            (approvalA !== ApprovalState.APPROVED && !depositADisabled) ||
            (approvalB !== ApprovalState.APPROVED && !depositBDisabled) ||
            !!DISABLED_ADD_LIQUIDITY_CHAINS[chainId]
          }
        >
          {errorMessage || buttonText}
        </CommitButton>
      </AutoColumn>
    )
  }

  return buttons
}
