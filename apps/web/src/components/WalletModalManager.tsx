import { useTranslation } from '@pancakeswap/localization'
import { MultichainWalletModal } from '@pancakeswap/ui-wallets'
import { createQrCode, getDocLink } from 'config/wallet'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useAuth from 'hooks/useAuth'

import { ChainId } from '@pancakeswap/chains'
import { useFirebaseAuth } from 'wallet/Privy/firebase'
import { useCallback, useMemo } from 'react'
import { logGTMConnectWalletSelectEvent, logGTMWalletConnectedEvent } from 'utils/customGTMEventTracking'
import { useConnect } from 'wagmi'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useWalletFilterEffect } from '@pancakeswap/ui-wallets/src/state/hooks'

const WalletModalManager: React.FC<{ isOpen: boolean; onDismiss?: () => void }> = ({ isOpen, onDismiss }) => {
  const { login } = useAuth()
  const { account: evmAccount, solanaAccount } = useAccountActiveChain()
  const {
    t,
    currentLanguage: { code },
  } = useTranslation()
  const { connectAsync } = useConnect()
  const { chainId } = useActiveChainId()

  const docLink = useMemo(() => getDocLink(code), [code])

  const handleWalletConnect = useCallback(
    (connectedChainId: number | undefined, name?: string, address?: string) => {
      logGTMWalletConnectedEvent(connectedChainId ?? chainId, name, address)
    },
    [chainId],
  )
  const handleWalletConnectStart = useCallback(
    (connectedChainId: number | undefined, name?: string) => {
      logGTMConnectWalletSelectEvent(connectedChainId ?? chainId, name)
    },
    [chainId],
  )

  const { loginWithGoogle, loginWithX, loginWithDiscord, loginWithTelegram } = useFirebaseAuth()

  // Wrap social login handlers to pass chainId for GTM tracking
  const handleGoogleLogin = useCallback(() => loginWithGoogle(chainId), [loginWithGoogle, chainId])
  const handleXLogin = useCallback(() => loginWithX(chainId), [loginWithX, chainId])
  const handleTelegramLogin = useCallback(() => loginWithTelegram(chainId), [loginWithTelegram, chainId])
  const handleDiscordLogin = useCallback(() => loginWithDiscord(chainId), [loginWithDiscord, chainId])

  const createEvmQrCode = useCallback(() => {
    return createQrCode(chainId || ChainId.BSC, connectAsync)
  }, [chainId, connectAsync])

  useWalletFilterEffect({ evmAddress: evmAccount ?? undefined, solanaAddress: solanaAccount ?? undefined })

  return (
    <MultichainWalletModal
      evmAddress={evmAccount}
      solanaAddress={solanaAccount ?? undefined}
      chainId={chainId}
      docText={t('Learn How to Connect')}
      docLink={docLink}
      isOpen={isOpen}
      evmLogin={login}
      createEvmQrCode={createEvmQrCode}
      onDismiss={onDismiss}
      onWalletConnectStartCallBack={handleWalletConnectStart}
      onWalletConnectCallBack={handleWalletConnect}
      onGoogleLogin={handleGoogleLogin}
      onXLogin={handleXLogin}
      onTelegramLogin={handleTelegramLogin}
      onDiscordLogin={handleDiscordLogin}
    />
  )
}

export default WalletModalManager
