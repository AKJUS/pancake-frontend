import { NonEVMChainId } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { SolanaProviderLocalStorageKey, WalletAdaptedNetwork } from '@pancakeswap/ui-wallets'
import { ASSET_CDN } from 'config/constants/endpoints'
import {
  ArrowBackIcon,
  Box,
  Button,
  Column,
  CopyButton,
  FlexGap,
  IconButton,
  Image,
  LogoutIcon,
  RowBetween,
  Text,
} from '@pancakeswap/uikit'
import truncateHash from '@pancakeswap/utils/truncateHash'
import { useLocalStorage, useWallet } from '@solana/wallet-adapter-react'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import useAuth from 'hooks/useAuth'
import { useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { walletModalVisibleAtom } from 'state/wallet/atom'
import { useCurrentWalletIconByNetworks } from 'state/wallet/hooks'
import styled from 'styled-components'
import { logGTMDisconnectWalletEvent } from 'utils/customGTMEventTracking'
import { useAccount } from 'wagmi'

export type ConnectedWalletsProps = {
  title?: React.ReactNode
  onBack: () => void
  solanaAddress: string | undefined
  evmAddress: string | undefined
}

const NetworkIcon = styled.img`
  position: absolute;
  border-radius: 8px;
  display: block;
`

const WalletIcon = styled(Image)`
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.background};
`

export const ConnectedWallets: React.FC<ConnectedWalletsProps> = ({ title, onBack, solanaAddress, evmAddress }) => {
  const { t } = useTranslation()
  const { chainId, unifiedAccount } = useAccountActiveChain()
  const { connector } = useAccount()
  const { disconnect } = useWallet()
  const { logout } = useAuth()
  const setWalletModalVisible = useSetAtom(walletModalVisibleAtom)
  const [, setSolanaWalletName] = useLocalStorage(SolanaProviderLocalStorageKey, '')

  const walletIcons = useCurrentWalletIconByNetworks()

  const handleWalletLogout = useCallback(
    async (network: WalletAdaptedNetwork) => {
      logGTMDisconnectWalletEvent(chainId, connector?.name, unifiedAccount ?? undefined)

      if (network === WalletAdaptedNetwork.EVM) await logout()
      if (network === WalletAdaptedNetwork.Solana) {
        await disconnect()
        // @notice: Clear the local storage key or next time use the same wallet cannot connect
        setSolanaWalletName('')
      }

      onBack()
    },
    [connector, chainId, unifiedAccount, disconnect, logout, onBack, setSolanaWalletName],
  )

  return (
    <Column gap="16px" alignItems="flex-start">
      <Button variant="text" onClick={onBack} margin={0} p={0}>
        <FlexGap alignItems="center" gap="8px">
          <IconButton variant="tertiary" scale="sm" borderRadius="12px">
            <ArrowBackIcon color="primary" width="24px" height="24px" />
          </IconButton>

          <Text fontSize="20px" fontWeight={600}>
            {title ?? t('Accounts')}
          </Text>
        </FlexGap>
      </Button>

      <RowBetween>
        <FlexGap alignItems="center" gap="8px">
          <Box position="relative" width={48} height={48}>
            <NetworkIcon
              src={`${ASSET_CDN}/web/wallet-ui/network-tag-evm.svg`}
              width={48}
              height={48}
              alt="EVM network"
            />
            {walletIcons[WalletAdaptedNetwork.EVM] && (
              <Box position="absolute" bottom="0" right="0" width={24} height={24}>
                <WalletIcon src={walletIcons[WalletAdaptedNetwork.EVM]} width={24} height={24} alt="EVM Wallet" />
              </Box>
            )}
          </Box>
          <Column>
            <Text fontSize="16px" fontWeight={600}>
              EVM
            </Text>
            <Text fontSize="14px" color="textSubtle" title={evmAddress}>
              {evmAddress ? truncateHash(evmAddress, 6, 4) : t('Disconnected')}
            </Text>
          </Column>
        </FlexGap>
        {evmAddress ? (
          <WalletAction address={evmAddress} onLogout={() => handleWalletLogout(WalletAdaptedNetwork.EVM)} />
        ) : (
          <Button scale="sm" onClick={() => setWalletModalVisible(true)}>
            {t('Connect')}
          </Button>
        )}
      </RowBetween>
      <RowBetween>
        <FlexGap alignItems="center" gap="8px">
          <Box position="relative" width={48} height={48}>
            <NetworkIcon
              src={`${ASSET_CDN}/web/chains/square/${NonEVMChainId.SOLANA}.svg`}
              width={48}
              height={48}
              alt="Solana network"
            />
            {walletIcons[WalletAdaptedNetwork.Solana] && (
              <Box position="absolute" bottom="0" right="0" width={24} height={24}>
                <WalletIcon src={walletIcons[WalletAdaptedNetwork.Solana]} width={24} height={24} alt="Solana Wallet" />
              </Box>
            )}
          </Box>
          <Column>
            <Text fontSize="16px" fontWeight={600}>
              Solana
            </Text>
            <Text fontSize="14px" color="textSubtle" title={solanaAddress}>
              {solanaAddress ? truncateHash(solanaAddress, 6, 4) : t('Disconnected')}
            </Text>
          </Column>
        </FlexGap>
        {solanaAddress ? (
          <WalletAction address={solanaAddress} onLogout={() => handleWalletLogout(WalletAdaptedNetwork.Solana)} />
        ) : (
          <Button scale="sm" onClick={() => setWalletModalVisible(true)}>
            {t('Connect')}
          </Button>
        )}
      </RowBetween>
    </Column>
  )
}

const WalletAction = ({ address, onLogout }: { address: string; onLogout: () => void }) => {
  const { t } = useTranslation()
  return (
    <FlexGap gap="8px">
      <IconButton variant="tertiary" scale="sm" borderRadius="12px">
        <CopyButton color="textSubtle" width="20px" text={address} tooltipMessage={t('Copied')} />
      </IconButton>
      <IconButton variant="tertiary" scale="sm" borderRadius="12px" onClick={onLogout}>
        <LogoutIcon color="failure" />
      </IconButton>
    </FlexGap>
  )
}
