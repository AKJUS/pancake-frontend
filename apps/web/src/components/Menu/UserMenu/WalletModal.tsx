import { useTranslation } from '@pancakeswap/localization'
import {
  ButtonMenu,
  ButtonMenuItem,
  CloseIcon,
  Heading,
  IconButton,
  ModalBody,
  ModalTitle,
  ModalWrapper,
  ModalHeader as UIKitModalHeader,
} from '@pancakeswap/uikit'
import { useCallback } from 'react'
import { styled } from 'styled-components'
import { parseEther } from 'viem'
import { useAccount, useBalance } from 'wagmi'
import { useActiveChainId } from 'hooks/useActiveChainId'
import { NonEVMChainId } from '@pancakeswap/chains'
import { useMenuTab, WalletView } from './providers/MenuTabProvider'
import WalletInfo from './WalletInfo'
import WalletTransactions from './WalletTransactions'
import WalletWrongNetwork from './WalletWrongNetwork'

export const LOW_NATIVE_BALANCE = parseEther('0.002', 'wei')

const ModalHeader = styled(UIKitModalHeader)`
  background: ${({ theme }) => theme.colors.gradientBubblegum};
`

export const Tabs = styled.div`
  background-color: ${({ theme }) => theme.colors.dropdown};
  border-bottom: 1px solid ${({ theme }) => theme.colors.cardBorder};
  padding: 16px 24px;
`

interface TabsComponentProps {
  view: WalletView
  evmAccount?: string
  solanaAccount?: string
  handleClick: (newIndex: number) => void
  style?: React.CSSProperties
}

export const StyledButtonMenuItem = styled(ButtonMenuItem)<{ isActive?: boolean }>`
  color: ${({ theme, isActive }) => (isActive ? theme.colors.secondary : theme.colors.textSubtle)};
  padding-left: 16px;
  padding-right: 0px;
`

export const TabsComponent: React.FC<React.PropsWithChildren<TabsComponentProps>> = ({
  view,
  handleClick,
  style,
  evmAccount,
  solanaAccount,
}) => {
  const { t } = useTranslation()
  const solanaOnly = !evmAccount && Boolean(solanaAccount)

  return (
    <Tabs style={style}>
      <ButtonMenu scale="sm" variant="text" onItemClick={handleClick} activeIndex={view}>
        <StyledButtonMenuItem variant="secondary">{t('Assets')}</StyledButtonMenuItem>
        <StyledButtonMenuItem variant="secondary">{t('Transactions')}</StyledButtonMenuItem>
        {solanaOnly ? <></> : <StyledButtonMenuItem variant="secondary">{t('Gift')}</StyledButtonMenuItem>}
      </ButtonMenu>
    </Tabs>
  )
}

const WalletModal: React.FC<React.PropsWithChildren<{ onDismiss?: () => void; initialView?: WalletView }>> = ({
  onDismiss,
}) => {
  const { view, setView } = useMenuTab()
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()
  const { address: account } = useAccount()
  const { data, isFetched } = useBalance({ address: account })
  const hasLowNativeBalance = Boolean(isFetched && data && data.value <= LOW_NATIVE_BALANCE)

  const handleClick = useCallback(
    (newIndex: number) => {
      setView(newIndex)
    },
    [setView],
  )

  return (
    <ModalWrapper minWidth="360px">
      <ModalHeader>
        <ModalTitle>
          <Heading>{t('Your Wallet')}</Heading>
        </ModalTitle>
        <IconButton variant="text" onClick={onDismiss}>
          <CloseIcon width="24px" color="text" />
        </IconButton>
      </ModalHeader>
      {view !== WalletView.WRONG_NETWORK && chainId !== NonEVMChainId.SOLANA && (
        <TabsComponent view={view} handleClick={handleClick} />
      )}
      <ModalBody p="24px" width="100%">
        {view === WalletView.WALLET_INFO && (
          <WalletInfo hasLowNativeBalance={hasLowNativeBalance} switchView={handleClick} onDismiss={onDismiss} />
        )}
        {view === WalletView.TRANSACTIONS && !!onDismiss && <WalletTransactions onDismiss={onDismiss} />}
        {view === WalletView.WRONG_NETWORK && !!onDismiss && <WalletWrongNetwork onDismiss={onDismiss} />}
      </ModalBody>
    </ModalWrapper>
  )
}

export default WalletModal
