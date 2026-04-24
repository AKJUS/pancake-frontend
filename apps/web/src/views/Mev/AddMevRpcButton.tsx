import { useTranslation } from '@pancakeswap/localization'
import { ArrowDownIcon, Button, CheckmarkCircleFillIcon, LinkExternal, SwapLoading } from '@pancakeswap/uikit'
import ConnectWalletButton from 'components/ConnectWalletButton'
import useTheme from 'hooks/useTheme'
import React, { useCallback, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { useAddMevRpc, useIsMEVEnabled, useShouldShowMEVToggle, useWalletType } from './hooks'
import { WalletType } from './types'

export const useMevConfig = (walletType: WalletType) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const color = theme.isDark ? theme.colors.background : 'white'
  const config = useMemo(
    () => ({
      [WalletType.mevDefaultOnBSC]: {
        btnText: t('Added to wallet'),
        icon: <CheckmarkCircleFillIcon color={color} />,
      },
      [WalletType.mevOnlyManualConfig]: { btnText: t('See the guides'), icon: <ArrowDownIcon color={color} /> },
      [WalletType.nativeSupportCustomRPC]: { btnText: t('Add to wallet'), icon: null },
      [WalletType.mevNotSupported]: { btnText: t('See the wallets supported'), icon: <LinkExternal color={color} /> },
    }),
    [t, color],
  )
  return config[walletType]
}

export const AddMevRpcButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const { t } = useTranslation()
  const { address: account } = useAccount()

  const { isMEVEnabled, refetch, isLoading: isMEVStatusLoading } = useIsMEVEnabled()
  const shouldShowMEVToggle = useShouldShowMEVToggle()
  const [isLoading, setIsLoading] = useState(false)
  const { theme } = useTheme()
  const { addMevRpc } = useAddMevRpc(
    useCallback(async () => {
      await refetch()
      setTimeout(() => refetch(), 1500)
    }, [refetch]),
    useCallback(() => setIsLoading(true), []),
    useCallback(() => setIsLoading(false), []),
  )
  const { walletType } = useWalletType()
  const mevConfig = useMevConfig(walletType)

  if (!account) {
    return <ConnectWalletButton withIcon />
  }
  if (isMEVStatusLoading || !shouldShowMEVToggle) {
    return null
  }

  return (
    <Button
      width="100%"
      endIcon={
        isLoading ? (
          <SwapLoading />
        ) : isMEVEnabled ? (
          <CheckmarkCircleFillIcon color={theme.isDark ? 'white' : theme.colors.background} />
        ) : (
          mevConfig.icon
        )
      }
      variant={isMEVEnabled ? 'success' : undefined}
      isLoading={isLoading}
      onClick={isMEVEnabled && !isLoading ? undefined : onClick ?? addMevRpc}
    >
      {isLoading ? t('Adding to wallet') : isMEVEnabled ? t('Added to wallet') : mevConfig.btnText}
    </Button>
  )
}
