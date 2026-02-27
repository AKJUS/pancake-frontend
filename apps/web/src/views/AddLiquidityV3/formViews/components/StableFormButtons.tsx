import { ReactElement } from 'react'
import { AutoColumn, Button, Dots, RowBetween } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { CommitButton } from 'components/CommitButton'
import ConnectWalletButton from 'components/ConnectWalletButton'
import { ApprovalState } from 'hooks/useApproveCallback'
import { logGTMClickAddLiquidityEvent } from 'utils/customGTMEventTracking'
import { CurrencyField as Field } from 'utils/types'
import { Currency } from '@pancakeswap/sdk'

interface StableFormButtonsProps {
  account?: string
  isWrongNetwork: boolean
  addIsUnsupported: boolean
  addIsWarning: boolean
  shouldShowApprovalGroup: boolean
  showFieldAApproval: boolean
  showFieldBApproval: boolean
  approvalA: ApprovalState
  approvalB: ApprovalState
  approveACallback: () => void
  approveBCallback: () => void
  currencies: {
    [Field.CURRENCY_A]?: Currency
    [Field.CURRENCY_B]?: Currency
  }
  buttonDisabled: boolean
  errorText?: string
  expertMode: boolean
  onAdd: () => void
  onPresentAddLiquidityModal: () => void
}

export function StableFormButtons({
  account,
  isWrongNetwork,
  addIsUnsupported,
  addIsWarning,
  shouldShowApprovalGroup,
  showFieldAApproval,
  showFieldBApproval,
  approvalA,
  approvalB,
  approveACallback,
  approveBCallback,
  currencies,
  buttonDisabled,
  errorText,
  expertMode,
  onAdd,
  onPresentAddLiquidityModal,
}: StableFormButtonsProps): ReactElement {
  const { t } = useTranslation()

  if (addIsUnsupported || addIsWarning) {
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
      {shouldShowApprovalGroup && (
        <RowBetween style={{ gap: '8px' }}>
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
      >
        {errorText || t('Add')}
      </CommitButton>
    </AutoColumn>
  )
}
