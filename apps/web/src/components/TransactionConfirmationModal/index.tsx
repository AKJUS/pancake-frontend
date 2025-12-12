import { ChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, Token } from '@pancakeswap/sdk'
import { WrappedTokenInfo } from '@pancakeswap/token-lists'
import {
  ArrowUpIcon,
  AutoColumn,
  BscScanIcon,
  Button,
  ColumnCenter,
  InjectedModalProps,
  Link,
  Modal,
  ModalProps,
  Text,
} from '@pancakeswap/uikit'
import { ConfirmationPendingContent, TransactionErrorContent } from '@pancakeswap/widgets-internal'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { useCallback, useMemo } from 'react'
import { styled } from 'styled-components'
import { useBlockExploreLink, useBlockExploreName } from 'utils'
import { wrappedCurrency } from 'utils/wrappedCurrency'
import AddToWalletButton, { AddToWalletTextOptions } from '../AddToWallet/AddToWalletButton'

const Wrapper = styled.div`
  width: 100%;
`
const Section = styled(AutoColumn)`
  padding: 24px;
`

const ConfirmedIcon = styled(ColumnCenter)`
  padding: 24px 0;
`

export function TransactionSubmittedContent({
  onDismiss,
  chainId,
  hash,
  currencyToAdd,
  isMultisig = false,
}: {
  onDismiss?: () => void
  hash?: string
  chainId?: ChainId
  currencyToAdd?: Currency | null
  isMultisig?: boolean
}) {
  const { t } = useTranslation()
  const blockExplorerName = useBlockExploreName(chainId)
  const getBlockExploreLink = useBlockExploreLink()

  const token: Token | undefined = wrappedCurrency(currencyToAdd, chainId)

  const showAddToWalletButton = useMemo(() => {
    if (token && currencyToAdd) {
      return !currencyToAdd.isNative
    }
    return false
  }, [token, currencyToAdd])

  return (
    <Wrapper>
      <Section>
        <ConfirmedIcon>
          <ArrowUpIcon strokeWidth={0.5} width="90px" color="primary" />
        </ConfirmedIcon>
        <AutoColumn gap="12px" justify="center">
          <Text fontSize="20px" bold>
            {isMultisig ? t('Multisig transaction submitted') : t('Transaction Submitted')}
          </Text>
          {isMultisig ? (
            <Text textAlign="center">
              {t('Transaction pending approvals. Execution will occur after multisig confirmation.')}
            </Text>
          ) : (
            chainId &&
            hash && (
              <Link external small href={getBlockExploreLink(hash, 'transaction', chainId)}>
                {t('View on %site%', { site: blockExplorerName })}
                {chainId === ChainId.BSC && <BscScanIcon color="primary" ml="4px" />}
              </Link>
            )
          )}
          {showAddToWalletButton && !isMultisig && (
            <AddToWalletButton
              variant="tertiary"
              mt="12px"
              width="fit-content"
              marginTextBetweenLogo="6px"
              textOptions={AddToWalletTextOptions.TEXT_WITH_ASSET}
              tokenAddress={token?.address}
              tokenSymbol={currencyToAdd!.symbol}
              tokenDecimals={token?.decimals}
              tokenLogo={token instanceof WrappedTokenInfo ? token.logoURI : undefined}
            />
          )}
          <Button onClick={onDismiss} mt="20px">
            {t('Close')}
          </Button>
        </AutoColumn>
      </Section>
    </Wrapper>
  )
}

interface ConfirmationModalProps {
  title: string
  customOnDismiss?: () => void
  hash: string | undefined
  errorMessage?: string
  content: () => React.ReactNode
  attemptingTxn: boolean
  pendingText: string
  currencyToAdd?: Currency | undefined | null
  isMultisig?: boolean
}

const TransactionConfirmationModal: React.FC<
  React.PropsWithChildren<InjectedModalProps & ConfirmationModalProps & ModalProps>
> = ({
  title,
  onDismiss,
  customOnDismiss,
  attemptingTxn,
  errorMessage,
  hash,
  pendingText,
  content,
  currencyToAdd,
  isMultisig,
  ...props
}) => {
  const { chainId } = useActiveChainId()

  const handleDismiss = useCallback(() => {
    if (customOnDismiss) {
      customOnDismiss()
    }
    onDismiss?.()
  }, [customOnDismiss, onDismiss])

  if (!chainId) return null

  return (
    <Modal title={title} headerBackground="gradientCardHeader" {...props} onDismiss={handleDismiss}>
      {attemptingTxn ? (
        <ConfirmationPendingContent pendingText={pendingText} />
      ) : hash ? (
        <TransactionSubmittedContent
          chainId={chainId}
          hash={hash}
          isMultisig={isMultisig}
          onDismiss={handleDismiss}
          currencyToAdd={currencyToAdd}
        />
      ) : errorMessage ? (
        <TransactionErrorContent message={errorMessage} onDismiss={handleDismiss} />
      ) : (
        content()
      )}
    </Modal>
  )
}

export default TransactionConfirmationModal
